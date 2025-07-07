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

  // Validate package.json exists and has required scripts
  async validatePackageJson(containerId, command, workingDir = null) {
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      const execDir = workingDir || container.workingDir || container.projectDir;
      const packageJsonPath = path.join(execDir, 'package.json');
      
      // Check if package.json exists
      if (!(await fs.pathExists(packageJsonPath))) {
        return {
          valid: false,
          error: `package.json not found in ${execDir}. Project may not have been created successfully.`
        };
      }

      // Read and parse package.json
      const packageJson = await fs.readJson(packageJsonPath);
      
      // Extract script name from npm command
      const scriptMatch = command.match(/npm run (\w+)|npm (\w+)/);
      if (scriptMatch) {
        const scriptName = scriptMatch[1] || scriptMatch[2];
        
        // Skip validation for standard npm commands
        if (['install', 'ci', 'update', 'audit', 'version'].includes(scriptName)) {
          return { valid: true };
        }
        
        // Check if the script exists
        if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
          const availableScripts = packageJson.scripts ? Object.keys(packageJson.scripts).join(', ') : 'none';
          return {
            valid: false,
            error: `Script "${scriptName}" not found in package.json. Available scripts: ${availableScripts}`
          };
        }
      }
      
      logger.info(`✅ Package validation passed for: ${command}`);
      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        error: `Failed to validate package.json: ${error.message}`
      };
    }
  }

  // Execute command in "container" (really just in the project directory)
  async executeInContainer(containerId, command, workingDir = null) {
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      const execDir = workingDir || container.workingDir || container.projectDir;
      logger.info(`🚀 Executing in cloud mode: ${command}`);
      logger.info(`📁 Working directory: ${execDir}`);
      
      // Execute all safe commands directly - no more simulation
      if (this.isSafeCommand(command)) {
        // Validate package.json for npm run commands
        if (command.includes('npm run') || (command.includes('npm') && !command.includes('create') && !command.includes('install'))) {
          const validation = await this.validatePackageJson(containerId, command, workingDir);
          if (!validation.valid) {
            logger.error(`❌ Package validation failed: ${validation.error}`);
            return {
              output: '',
              error: validation.error,
              exitCode: 1
            };
          }
        }
        
        // Create proper environment for npm commands
        const execOptions = { 
          cwd: execDir,
          maxBuffer: 10 * 1024 * 1024,
          timeout: 180000, // 3 minute timeout for npm create operations
          env: {
            ...process.env,
            HOME: execDir, // Set HOME to project directory to avoid permission issues
            npm_config_cache: path.join(execDir, '.npm'),
            npm_config_prefix: execDir
          }
        };
        
        // Ensure npm cache directory exists
        await fs.ensureDir(path.join(execDir, '.npm'));
        
        logger.info(`⚙️ Executing with timeout: ${execOptions.timeout}ms`);
        const startTime = Date.now();
        
        const { stdout, stderr } = await execAsync(command, execOptions);
        
        const duration = Date.now() - startTime;
        logger.info(`✅ Command completed in ${duration}ms`);
        
        if (stdout) {
          logger.info(`📤 STDOUT: ${stdout.substring(0, 500)}${stdout.length > 500 ? '...' : ''}`);
        }
        if (stderr) {
          logger.warn(`📤 STDERR: ${stderr.substring(0, 500)}${stderr.length > 500 ? '...' : ''}`);
        }
        
        return {
          output: stdout,
          error: stderr || undefined,
          exitCode: 0
        };
      }

      // For unsafe commands, return error instead of simulation
      logger.warn(`🚫 Command not allowed: ${command}`);
      return {
        output: '',
        error: `Command "${command}" is not allowed in cloud environment for security reasons`,
        exitCode: 1
      };
      
    } catch (error) {
      logger.error(`❌ Command failed: ${command}`, {
        message: error.message,
        code: error.code,
        signal: error.signal,
        killed: error.killed,
        timeout: error.timeout
      });
      
      return {
        output: '',
        error: `Command failed: ${error.message} (code: ${error.code || 'unknown'})`,
        exitCode: error.code || 1
      };
    }
  }

  // Check if command is safe to execute - expanded list for proper development
  isSafeCommand(command) {
    const safePatterns = [
      '^npm',
      '^npx',
      '^node',
      '^bun',
      '^yarn',
      '^pnpm',
      '^ls',
      '^cat',
      '^echo',
      '^mkdir',
      '^touch',
      '^cp',
      '^mv',
      '^cd ',
      '^pwd',
      '^which',
      '^git',
      'npm (run|start|build|test|install|ci)',
      'npx.*create',
      'cd.*&&.*npm',
      'cd.*&&.*bun',
      'cd.*&&.*yarn'
    ];
    
    return safePatterns.some(pattern => 
      new RegExp(pattern).test(command.trim())
    );
  }

  // Helper function to resolve file path within container
  resolvePath(containerId, filePath, workingDir = null) {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    // Use workingDir if provided, otherwise use container's project directory
    const baseDir = workingDir || container.projectDir;
    
    // If filePath is absolute and starts with /workspace, map it to the container directory
    if (filePath.startsWith('/workspace')) {
      const relativePath = path.relative('/workspace', filePath);
      return path.resolve(baseDir, relativePath);
    }
    
    // If filePath is relative, resolve it relative to baseDir
    if (!path.isAbsolute(filePath)) {
      return path.resolve(baseDir, filePath);
    }
    
    // If absolute path, check if it's within our workspace
    const resolvedPath = path.resolve(filePath);
    if (resolvedPath.startsWith(this.workspaceDir)) {
      return resolvedPath;
    }
    
    // Default: treat as relative to baseDir
    return path.resolve(baseDir, path.basename(filePath));
  }

  // Read file from container
  async readFileFromContainer(containerId, filePath, workingDir = null) {
    try {
      const fullPath = this.resolvePath(containerId, filePath, workingDir);
      
      // Verify path is within workspace
      if (!fullPath.startsWith(this.workspaceDir)) {
        throw new Error('Access denied: File outside workspace');
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      return { content };
    } catch (error) {
      return { content: '', error: error.message };
    }
  }

  // Write file to container
  async writeFileToContainer(containerId, filePath, content, workingDir = null) {
    try {
      const fullPath = this.resolvePath(containerId, filePath, workingDir);
      
      // Verify path is within workspace
      if (!fullPath.startsWith(this.workspaceDir)) {
        throw new Error('Access denied: File outside workspace');
      }

      // Ensure directory exists
      await fs.ensureDir(path.dirname(fullPath));
      
      // Write file
      await fs.writeFile(fullPath, content, 'utf-8');
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // List directory contents
  async listDirectoryInContainer(containerId, dirPath, workingDir = null) {
    try {
      const fullPath = this.resolvePath(containerId, dirPath, workingDir);
      
      // Verify path is within workspace
      if (!fullPath.startsWith(this.workspaceDir)) {
        throw new Error('Access denied: Directory outside workspace');
      }

      const items = await fs.readdir(fullPath, { withFileTypes: true });
      const files = items.map(item => {
        return item.isDirectory() ? `${item.name}/` : item.name;
      });
      
      return { files };
    } catch (error) {
      return { files: [], error: error.message };
    }
  }

  // Create directory in container
  async createDirectoryInContainer(containerId, dirPath, workingDir = null) {
    try {
      const fullPath = this.resolvePath(containerId, dirPath, workingDir);
      
      // Verify path is within workspace
      if (!fullPath.startsWith(this.workspaceDir)) {
        throw new Error('Access denied: Directory outside workspace');
      }

      await fs.ensureDir(fullPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Delete file/directory from container
  async deleteInContainer(containerId, filePath, workingDir = null) {
    try {
      const fullPath = this.resolvePath(containerId, filePath, workingDir);
      
      // Verify path is within workspace
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
      const fullPath = this.resolvePath(containerId, filePath, workingDir);
      
      // Verify path is within workspace
      if (!fullPath.startsWith(this.workspaceDir)) {
        return false;
      }

      return await fs.pathExists(fullPath);
    } catch (error) {
      return false;
    }
  }

  // Get all files from container (recursive)
  async getAllFilesFromContainer(containerId, workingDir = null) {
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      const baseDir = workingDir || container.projectDir;
      const files = [];

      // Recursive function to find files
      const findFiles = async (dir, relativePath = '') => {
        try {
          const items = await fs.readdir(dir, { withFileTypes: true });
          
          for (const item of items) {
            // Skip hidden files and common ignore patterns
            if (item.name.startsWith('.') || 
                item.name === 'node_modules' ||
                item.name === 'dist' ||
                item.name === 'build') {
              continue;
            }

            const fullPath = path.join(dir, item.name);
            const relPath = relativePath ? `${relativePath}/${item.name}` : item.name;

            if (item.isFile()) {
              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                files.push({ path: relPath, content });
              } catch (err) {
                // Skip files that can't be read as text
                console.warn(`Skipping file ${relPath}: ${err.message}`);
              }
            } else if (item.isDirectory()) {
              await findFiles(fullPath, relPath);
            }
          }
        } catch (err) {
          console.warn(`Error reading directory ${dir}: ${err.message}`);
        }
      };

      await findFiles(baseDir);
      return { files };
    } catch (error) {
      return { files: [], error: error.message };
    }
  }

  // Get preview URL (simulated for cloud)
  async getPreviewUrl(_containerId) {
    // In cloud mode, we can't run actual dev servers
    // Return a simulated URL or null
    return { url: null };
  }

  async getWorkingDirectory() {
    return this.workingDir;
  }

  async setWorkingDirectory(dirPath) {
    try {
      // Update working directory
      this.workingDir = dirPath.startsWith('/') ? dirPath : `/workspace/${dirPath}`;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Set container working directory
  async setContainerWorkingDirectory(containerId, dirPath) {
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      // Resolve the new working directory path
      const newWorkingDir = this.resolvePath(containerId, dirPath);
      
      // Verify the directory exists
      if (!(await fs.pathExists(newWorkingDir))) {
        throw new Error(`Directory does not exist: ${dirPath}`);
      }
      
      // Update the container's working directory
      container.workingDir = newWorkingDir;
      this.containers.set(containerId, container);
      
      logger.info(`📁 Container ${containerId} working directory set to: ${newWorkingDir}`);
      
      return { success: true };
    } catch (error) {
      logger.error(`❌ Failed to set working directory: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Cleanup containers
  async cleanup() {
    try {
      logger.info('🧹 Cleaning up cloud containers...');
      
      // In cloud mode, just clear the containers map
      // The actual directories can remain for debugging
      this.containers.clear();
      
      logger.info('✅ Cloud containers cleaned up');
    } catch (error) {
      logger.error('❌ Cleanup failed:', error);
      throw error;
    }
  }

  // Get container status
  getContainerStatus() {
    return {
      mode: 'cloud',
      activeContainers: this.containers.size,
      containers: Array.from(this.containers.values()).map(container => ({
        id: container.id,
        name: container.name,
        projectDir: container.projectDir,
        createdAt: container.createdAt
      }))
    };
  }
} 