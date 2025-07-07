import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

const execAsync = promisify(exec);

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'backend/logs/container.log' })
  ]
});

export class DockerContainerManager {
  constructor() {
    this.containers = new Map(); // Store active containers
    this.workspaceDir = path.resolve('./workspace');
    this.ensureWorkspaceExists();
  }

  async ensureWorkspaceExists() {
    try {
      await fs.ensureDir(this.workspaceDir);
      await fs.ensureDir('backend/logs');
      logger.info('Workspace directory ensured');
    } catch (error) {
      logger.error('Failed to create workspace directory:', error);
    }
  }

  // Initialize a new Docker container
  async initializeContainer() {
    try {
      logger.info('🐳 Initializing Docker container...');
      
      // Check if Docker is available
      try {
        await execAsync('docker --version');
      } catch (error) {
        throw new Error('Docker is not installed or not running. Please install Docker Desktop.');
      }

      // Pull Ubuntu 22.04 LTS image if not exists
      logger.info('📦 Pulling Ubuntu 22.04 LTS image...');
      await execAsync('docker pull ubuntu:22.04');

      // Generate unique container name
      const containerName = `ai-dev-container-${uuidv4().slice(0, 8)}`;
      
      // Create and start container with volume mount
      logger.info('🚀 Creating and starting container...');
      const createCommand = `docker run -d --name ${containerName} ` +
        `-v "${this.workspaceDir}:/workspace" ` +
        `-w /workspace ` +
        `-p 3000:3000 -p 5173:5173 -p 8080:8080 -p 4000:4000 -p 5000:5000 ` +
        `ubuntu:22.04 tail -f /dev/null`;
      
      const { stdout } = await execAsync(createCommand);
      const containerId = stdout.trim();

      // Install essential development tools
      logger.info('🔧 Installing development tools...');
      await this.executeInContainer(containerId, 'apt-get update');
      await this.executeInContainer(containerId, 'apt-get install -y curl wget git nano vim build-essential python3 python3-pip ca-certificates gnupg lsb-release');
      
      // Install Node.js and npm
      logger.info('📦 Installing Node.js...');
      await this.executeInContainer(containerId, 'curl -fsSL https://deb.nodesource.com/setup_18.x | bash -');
      await this.executeInContainer(containerId, 'apt-get install -y nodejs');

      // Store container info
      this.containers.set(containerId, {
        id: containerId,
        name: containerName,
        createdAt: new Date(),
        workingDir: '/workspace'
      });

      logger.info(`✅ Docker container initialized successfully: ${containerId}`);
      return { containerId, containerName };
      
    } catch (error) {
      logger.error('❌ Failed to initialize Docker container:', error);
      throw error;
    }
  }

  // Get the first available container or create one
  async getActiveContainer() {
    // For simplicity, we'll use the first available container
    // In a production app, you might want container pooling or user-specific containers
    const activeContainers = Array.from(this.containers.values());
    
    if (activeContainers.length > 0) {
      return activeContainers[0];
    }
    
    // No active container, create one
    const { containerId } = await this.initializeContainer();
    return this.containers.get(containerId);
  }

  // Execute command in container
  async executeInContainer(containerId, command, workingDir = '/workspace') {
    try {
      const dockerCommand = `docker exec -w ${workingDir} ${containerId} bash -c "${command.replace(/"/g, '\\"')}"`;
      logger.info(`🐳 Executing: ${command}`);
      
      const { stdout, stderr } = await execAsync(dockerCommand, { 
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 300000 // 5 minute timeout
      });
      
      return {
        output: stdout,
        error: stderr || undefined,
        exitCode: 0
      };
    } catch (error) {
      logger.error(`❌ Command failed: ${command}`, error.message);
      return {
        output: '',
        error: error.message,
        exitCode: error.code || 1
      };
    }
  }

  // Read file from container
  async readFileFromContainer(containerId, filePath, workingDir = '/workspace') {
    try {
      const fullPath = path.posix.join(workingDir, filePath);
      const { stdout, stderr } = await execAsync(`docker exec ${containerId} cat "${fullPath}"`);
      
      if (stderr) {
        return { content: '', error: stderr };
      }
      
      return { content: stdout };
    } catch (error) {
      return { content: '', error: error.message };
    }
  }

  // Write file to container
  async writeFileToContainer(containerId, filePath, content, workingDir = '/workspace') {
    try {
      const fullPath = path.posix.join(workingDir, filePath);
      const dirPath = path.posix.dirname(fullPath);
      
      // Create directory if it doesn't exist
      await execAsync(`docker exec ${containerId} mkdir -p "${dirPath}"`);
      
      // Write file using a temporary file approach for better handling of special characters
      const tempFile = `/tmp/temp_${Date.now()}.txt`;
      await fs.writeFile(path.join(this.workspaceDir, '..', 'temp_write.txt'), content);
      
      // Copy to container and move to final location
      await execAsync(`docker cp "${path.join(this.workspaceDir, '..', 'temp_write.txt')}" ${containerId}:${tempFile}`);
      await execAsync(`docker exec ${containerId} mv "${tempFile}" "${fullPath}"`);
      
      // Clean up temp file
      await fs.remove(path.join(this.workspaceDir, '..', 'temp_write.txt'));
      
      return { success: true };
    } catch (error) {
      logger.error(`Failed to write file ${filePath}:`, error);
      return { success: false, error: error.message };
    }
  }

  // List directory in container
  async listDirectoryInContainer(containerId, dirPath, workingDir = '/workspace') {
    try {
      const fullPath = path.posix.join(workingDir, dirPath);
      const { stdout, stderr } = await execAsync(`docker exec ${containerId} ls -la "${fullPath}"`);
      
      if (stderr) {
        return { files: [], error: stderr };
      }
      
      const files = stdout.split('\n')
        .filter(line => line.trim() && !line.startsWith('total'))
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[parts.length - 1];
        })
        .filter(name => name !== '.' && name !== '..');
      
      return { files };
    } catch (error) {
      return { files: [], error: error.message };
    }
  }

  // Create directory in container
  async createDirectoryInContainer(containerId, dirPath, workingDir = '/workspace') {
    try {
      const fullPath = path.posix.join(workingDir, dirPath);
      await execAsync(`docker exec ${containerId} mkdir -p "${fullPath}"`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Delete file/directory in container
  async deleteInContainer(containerId, filePath, workingDir = '/workspace') {
    try {
      const fullPath = path.posix.join(workingDir, filePath);
      await execAsync(`docker exec ${containerId} rm -rf "${fullPath}"`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Check if file exists in container
  async fileExistsInContainer(containerId, filePath, workingDir = '/workspace') {
    try {
      const fullPath = path.posix.join(workingDir, filePath);
      await execAsync(`docker exec ${containerId} test -e "${fullPath}"`);
      return { exists: true };
    } catch {
      return { exists: false };
    }
  }

  // Get all files from container
  async getAllFilesFromContainer(containerId, workingDir = '/workspace') {
    const files = [];
    
    try {
      // Find all files recursively, excluding node_modules and other common directories
      const { stdout } = await execAsync(`docker exec ${containerId} find ${workingDir} -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" ! -name "*.log" | head -100`);
      
      const filePaths = stdout.split('\n').filter(p => p.trim());
      
      for (const filePath of filePaths) {
        try {
          const relativePath = path.posix.relative(workingDir, filePath);
          const { content, error } = await this.readFileFromContainer(containerId, relativePath, workingDir);
          
          if (!error && content && relativePath) {
            files.push({ path: relativePath, content });
          }
        } catch (error) {
          logger.warn(`Failed to read file ${filePath}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to get all files:', error);
    }
    
    return { files };
  }

  // Get preview URL (check running servers)
  async getPreviewUrl(containerId) {
    try {
      const portChecks = [5173, 3000, 8080, 4000, 5000]; // Common dev server ports
      
      for (const port of portChecks) {
        try {
          const { stdout } = await execAsync(`docker exec ${containerId} netstat -tuln | grep :${port}`);
          if (stdout.trim()) {
            return { url: `http://localhost:${port}` };
          }
        } catch {
          // Port not in use, continue checking
        }
      }
    } catch (error) {
      logger.warn('Failed to check for running servers:', error);
    }
    
    return { url: null };
  }

  // Cleanup containers
  async cleanup() {
    try {
      logger.info('🧹 Cleaning up Docker containers...');
      
      for (const [containerId, container] of this.containers) {
        try {
          await execAsync(`docker stop ${containerId}`);
          await execAsync(`docker rm ${containerId}`);
          logger.info(`✅ Container ${container.name} cleaned up`);
        } catch (error) {
          logger.error(`❌ Failed to cleanup container ${container.name}:`, error);
        }
      }
      
      this.containers.clear();
      logger.info('✅ All containers cleaned up');
    } catch (error) {
      logger.error('❌ Failed to cleanup containers:', error);
    }
  }

  // Get container status
  getContainerStatus() {
    return {
      mode: 'docker',
      activeContainers: this.containers.size,
      containers: Array.from(this.containers.values())
    };
  }
} 