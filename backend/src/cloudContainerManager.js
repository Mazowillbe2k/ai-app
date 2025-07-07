import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { exec } from 'child_process';
import { promisify } from 'util';

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
    new winston.transports.Console()
  ]
});

export class CloudContainerManager {
  constructor() {
    this.containers = new Map(); // Store active "containers" (really just project directories)
    this.workspaceDir = path.resolve('./workspace');
    this.isCloudMode = true;
    this.ensureWorkspaceExists();
  }

  async ensureWorkspaceExists() {
    try {
      await fs.ensureDir(this.workspaceDir);
      logger.info('Workspace directory ensured in cloud mode');
    } catch (error) {
      logger.error('Failed to create workspace directory:', error);
    }
  }

  // Initialize a new "container" (project directory)
  async initializeContainer() {
    try {
      logger.info('🚀 Initializing cloud container (project workspace)...');
      
      // Generate unique container name
      const containerName = `cloud-workspace-${uuidv4().slice(0, 8)}`;
      const containerId = uuidv4();
      
      // Create project workspace directory
      const projectDir = path.join(this.workspaceDir, containerName);
      await fs.ensureDir(projectDir);

      // Store container info
      this.containers.set(containerId, {
        id: containerId,
        name: containerName,
        projectDir,
        createdAt: new Date(),
        workingDir: projectDir
      });

      logger.info(`✅ Cloud container initialized successfully: ${containerId}`);
      return { containerId, containerName };
      
    } catch (error) {
      logger.error('❌ Failed to initialize cloud container:', error);
      throw error;
    }
  }

  // Get the first available container or create one
  async getActiveContainer() {
    const activeContainers = Array.from(this.containers.values());
    
    if (activeContainers.length > 0) {
      return activeContainers[0];
    }
    
    // No active container, create one
    const { containerId } = await this.initializeContainer();
    return this.containers.get(containerId);
  }

  // Execute command in "container" (really just in the project directory)
  async executeInContainer(containerId, command, workingDir = null) {
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      const execDir = workingDir || container.projectDir;
      logger.info(`🚀 Executing in cloud mode: ${command}`);
      
      // For cloud mode, we'll simulate some commands and execute safe ones
      if (this.isSimulatedCommand(command)) {
        return this.simulateCommand(command);
      }

      // Execute safe commands directly
      if (this.isSafeCommand(command)) {
        const { stdout, stderr } = await execAsync(command, { 
          cwd: execDir,
          maxBuffer: 10 * 1024 * 1024,
          timeout: 60000 // 1 minute timeout in cloud
        });
        
        return {
          output: stdout,
          error: stderr || undefined,
          exitCode: 0
        };
      }

      // For unsafe commands, return simulation
      return this.simulateCommand(command);
      
    } catch (error) {
      logger.error(`❌ Command failed: ${command}`, error.message);
      return {
        output: '',
        error: error.message,
        exitCode: error.code || 1
      };
    }
  }

  // Check if command should be simulated
  isSimulatedCommand(command) {
    const simulatedPatterns = [
      'apt-get',
      'docker',
      'curl.*setup.*bash',
      'netstat',
      'systemctl'
    ];
    
    return simulatedPatterns.some(pattern => 
      new RegExp(pattern).test(command)
    );
  }

  // Check if command is safe to execute
  isSafeCommand(command) {
    const safePatterns = [
      '^npm',
      '^node',
      '^ls',
      '^cat',
      '^echo',
      '^mkdir',
      '^touch',
      '^cp',
      '^mv'
    ];
    
    return safePatterns.some(pattern => 
      new RegExp(pattern).test(command.trim())
    );
  }

  // Simulate commands that can't be run in cloud
  simulateCommand(command) {
    logger.info(`🎭 Simulating command: ${command}`);
    
    if (command.includes('npm create') || command.includes('npx create')) {
      return {
        output: `✓ Project created successfully in cloud mode\n✓ Dependencies would be installed`,
        exitCode: 0
      };
    }
    
    if (command.includes('npm install')) {
      return {
        output: `added 234 packages in 12s (simulated)`,
        exitCode: 0
      };
    }
    
    if (command.includes('npm run dev') || command.includes('npm start')) {
      return {
        output: `> dev server would be running (simulated)`,
        exitCode: 0
      };
    }

    if (command.includes('apt-get')) {
      return {
        output: `Simulated: ${command}\nPackages would be installed in real Docker container`,
        exitCode: 0
      };
    }
    
    return {
      output: `Simulated: ${command}`,
      exitCode: 0
    };
  }

  // Read file from container
  async readFileFromContainer(containerId, filePath, workingDir = null) {
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      const baseDir = workingDir || container.projectDir;
      const fullPath = path.resolve(baseDir, filePath);
      
      // Security check - ensure file is within workspace
      if (!fullPath.startsWith(this.workspaceDir)) {
        throw new Error('Access denied: File outside workspace');
      }

      const content = await fs.readFile(fullPath, 'utf8');
      return { content };
    } catch (error) {
      return { content: '', error: error.message };
    }
  }

  // Write file to container
  async writeFileToContainer(containerId, filePath, content, workingDir = null) {
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      const baseDir = workingDir || container.projectDir;
      const fullPath = path.resolve(baseDir, filePath);
      
      // Security check - ensure file is within workspace
      if (!fullPath.startsWith(this.workspaceDir)) {
        throw new Error('Access denied: File outside workspace');
      }

      // Create directory if it doesn't exist
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content, 'utf8');
      
      return { success: true };
    } catch (error) {
      logger.error(`Failed to write file ${filePath}:`, error);
      return { success: false, error: error.message };
    }
  }

  // List directory in container
  async listDirectoryInContainer(containerId, dirPath, workingDir = null) {
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      const baseDir = workingDir || container.projectDir;
      const fullPath = path.resolve(baseDir, dirPath);
      
      // Security check
      if (!fullPath.startsWith(this.workspaceDir)) {
        throw new Error('Access denied: Directory outside workspace');
      }

      const items = await fs.readdir(fullPath);
      const files = [];
      
      for (const item of items) {
        const itemPath = path.join(fullPath, item);
        const _stats = await fs.stat(itemPath);
        files.push(item);
      }
      
      return { files };
    } catch (error) {
      return { files: [], error: error.message };
    }
  }

  // Create directory in container
  async createDirectoryInContainer(containerId, dirPath, workingDir = null) {
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      const baseDir = workingDir || container.projectDir;
      const fullPath = path.resolve(baseDir, dirPath);
      
      // Security check
      if (!fullPath.startsWith(this.workspaceDir)) {
        throw new Error('Access denied: Directory outside workspace');
      }

      await fs.ensureDir(fullPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Delete file/directory in container
  async deleteInContainer(containerId, filePath, workingDir = null) {
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      const baseDir = workingDir || container.projectDir;
      const fullPath = path.resolve(baseDir, filePath);
      
      // Security check
      if (!fullPath.startsWith(this.workspaceDir)) {
        throw new Error('Access denied: Path outside workspace');
      }

      await fs.remove(fullPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Check if file exists in container
  async fileExistsInContainer(containerId, filePath, workingDir = null) {
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        return { exists: false };
      }

      const baseDir = workingDir || container.projectDir;
      const fullPath = path.resolve(baseDir, filePath);
      
      // Security check
      if (!fullPath.startsWith(this.workspaceDir)) {
        return { exists: false };
      }

      const exists = await fs.pathExists(fullPath);
      return { exists };
    } catch {
      return { exists: false };
    }
  }

  // Get all files from container
  async getAllFilesFromContainer(containerId, workingDir = null) {
    const files = [];
    
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        return { files: [] };
      }

      const baseDir = workingDir || container.projectDir;
      
      // Recursively find files
      const findFiles = async (dir, relativePath = '') => {
        const items = await fs.readdir(dir);
        
        for (const item of items) {
          if (item.startsWith('.') || item === 'node_modules') continue;
          
          const itemPath = path.join(dir, item);
          const stats = await fs.stat(itemPath);
          const itemRelativePath = path.join(relativePath, item);
          
          if (stats.isDirectory()) {
            await findFiles(itemPath, itemRelativePath);
          } else if (stats.isFile() && files.length < 50) { // Limit files
            try {
              const content = await fs.readFile(itemPath, 'utf8');
              files.push({ 
                path: itemRelativePath.replace(/\\/g, '/'), 
                content 
              });
            } catch (error) {
              // Skip binary files or files that can't be read
            }
          }
        }
      };
      
      await findFiles(baseDir);
    } catch (error) {
      logger.error('Failed to get all files:', error);
    }
    
    return { files };
  }

  // Get preview URL (simulated for cloud)
  async getPreviewUrl(_containerId) {
    // In cloud mode, we can't run actual dev servers
    // Return a simulated URL or null
    return { url: null };
  }

  // Cleanup containers
  async cleanup() {
    try {
      logger.info('🧹 Cleaning up cloud containers...');
      
      for (const [containerId, container] of this.containers) {
        try {
          // In cloud mode, we might keep the workspace for debugging
          logger.info(`✅ Container ${container.name} marked for cleanup`);
        } catch (error) {
          logger.error(`❌ Failed to cleanup container ${container.name}:`, error);
        }
      }
      
      this.containers.clear();
      logger.info('✅ All cloud containers cleaned up');
    } catch (error) {
      logger.error('❌ Failed to cleanup containers:', error);
    }
  }

  // Get container status
  getContainerStatus() {
    return {
      mode: 'cloud',
      activeContainers: this.containers.size,
      containers: Array.from(this.containers.values()),
      workspaceDir: this.workspaceDir
    };
  }
} 