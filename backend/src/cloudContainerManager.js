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
    // In cloud environment, we're already in /workspace directory
    this.workspaceDir = process.env.NODE_ENV === 'production' ? '/workspace' : path.resolve('./workspace');
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
      
      // Preprocess command for compatibility  
      const processedCommand = this.preprocessCommand(command);
      
      // Execute all safe commands directly - no more simulation
      if (this.isSafeCommand(processedCommand)) {
        // Validate package.json for npm run commands
        if (processedCommand.includes('npm run') || (processedCommand.includes('npm') && !processedCommand.includes('create') && !processedCommand.includes('install'))) {
          const validation = await this.validatePackageJson(containerId, processedCommand, workingDir);
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
          timeout: 60000, // 1 minute timeout - more reasonable for cloud
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
        
        const { stdout, stderr } = await execAsync(processedCommand, execOptions);
        
        const duration = Date.now() - startTime;
        logger.info(`✅ Command completed in ${duration}ms`);
        
        if (stdout) {
          logger.info(`📤 STDOUT: ${stdout.substring(0, 500)}${stdout.length > 500 ? '...' : ''}`);
        }
        if (stderr) {
          logger.warn(`📤 STDERR: ${stderr.substring(0, 500)}${stderr.length > 500 ? '...' : ''}`);
        }

        // Handle post-creation setup for project creation commands
        if (processedCommand.includes('create-vite') || processedCommand.includes('create vite') || processedCommand.includes('degit')) {
          await this.handlePostProjectCreation(containerId, processedCommand, execDir);
        }
        
        return {
          output: stdout,
          error: stderr || undefined,
          exitCode: 0
        };
      }

      // For unsafe commands, return error instead of simulation
      logger.warn(`🚫 Command not allowed: ${processedCommand}`);
      return {
        output: '',
        error: `Command "${processedCommand}" is not allowed in cloud environment for security reasons`,
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

  // Handle post project creation setup
  async handlePostProjectCreation(containerId, command, execDir) {
    try {
      // Extract project name from degit or create-vite command
      let projectNameMatch = command.match(/degit\s+\S+\s+([^\s]+)/);  // degit command
      if (!projectNameMatch) {
        projectNameMatch = command.match(/create-vite@?\S*\s+"([^"]+)"/);  // quoted names
      }
      if (!projectNameMatch) {
        projectNameMatch = command.match(/create-vite@?\S*\s+([^\s]+?)(?:\s+--|$)/);  // unquoted names with proper handling
      }
      
      if (!projectNameMatch) {
        logger.warn(`⚠️ Could not extract project name from: ${command}`);
        return;
      }

      const projectName = projectNameMatch[1];
      const projectPath = path.join(execDir, projectName);
      
      logger.info(`🔧 Setting up project: ${projectName} at ${projectPath}`);
      
      // Wait a bit for file system to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if project directory was created
      if (await fs.pathExists(projectPath)) {
        // Update container working directory to the project
        const container = this.containers.get(containerId);
        container.workingDir = projectPath;
        this.containers.set(containerId, container);
        
        logger.info(`📁 Updated container working directory to: ${projectPath}`);
        
        // Install dependencies with shorter timeout
        logger.info(`📦 Installing dependencies for ${projectName}...`);
        const installOptions = {
          cwd: projectPath,
          maxBuffer: 10 * 1024 * 1024,
          timeout: 60000, // 1 minute for npm install
          env: {
            ...process.env,
            HOME: projectPath,
            npm_config_cache: path.join(projectPath, '.npm'),
            npm_config_prefix: projectPath
          }
        };
        
        try {
          await fs.ensureDir(path.join(projectPath, '.npm'));
          const { stdout: installStdout } = await execAsync('npm install', installOptions);
          logger.info(`✅ Dependencies installed successfully`);
          logger.info(`📤 Install output: ${installStdout.substring(0, 300)}...`);
        } catch (installError) {
          logger.error(`❌ Failed to install dependencies: ${installError.message}`);
          
          // Try with --force flag as fallback
          try {
            logger.info(`🔄 Retrying npm install with --force...`);
            const { stdout: forceInstallStdout } = await execAsync('npm install --force', installOptions);
            logger.info(`✅ Dependencies installed with --force`);
            logger.info(`📤 Force install output: ${forceInstallStdout.substring(0, 300)}...`);
          } catch (forceError) {
            logger.error(`❌ Force install also failed: ${forceError.message}`);
          }
        }
      } else {
        logger.error(`❌ Project directory not found: ${projectPath}`);
      }
    } catch (error) {
      logger.error(`❌ Post-creation setup failed: ${error.message}`);
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
      '^grep',
      '^find',
      'npm (run|start|build|test|install|ci)',
      'npx.*create',
      'npx.*degit',
      'npx.*glob',
      'cd.*&&.*npm',
      'cd.*&&.*bun',
      'cd.*&&.*yarn',
      'bun (run|start|build|test|install|dev)',
      'grep.*\\.(js|ts|tsx|jsx|json|md|txt|css|html)'
    ];
    
    return safePatterns.some(pattern => 
      new RegExp(pattern).test(command.trim())
    );
  }

  // Keep npm create vite as-is for complete project setup
  preprocessCommand(command) {
    // Don't convert npm create vite - let it run normally for complete setup
    // Just ensure proper template and yes flag
    if (command.includes('npm create vite@latest') || command.includes('npx create-vite')) {
      // Let the original command run to get complete Vite setup
      logger.info(`🚀 Using official Vite create for complete project setup: ${command}`);
      return command;
    }
    
    // Handle cd commands that reference /home/project/ paths - remove the cd part since we manage working directory
    if (command.includes('cd /home/project/') && command.includes('&&')) {
      const parts = command.split('&&');
      if (parts.length >= 2) {
        // Return just the command part after &&, trimmed
        const actualCommand = parts.slice(1).join('&&').trim();
        logger.info(`🔧 Simplified command by removing cd: ${actualCommand}`);
        return actualCommand;
      }
    }

    // Convert bun/bunx commands to npm equivalents if they fail
    if (command.includes('bunx vite')) {
      const fallbackCommand = command.replace('bunx vite', 'npx vite');
      logger.info(`🔧 Converting bunx to npx: ${fallbackCommand}`);
      return fallbackCommand;
    }
    
    if (command.startsWith('bun run ')) {
      const script = command.replace('bun run ', '');
      const fallbackCommand = `npm run ${script}`;
      logger.info(`🔧 Converting bun run to npm run: ${fallbackCommand}`);
      return fallbackCommand;
    }
    
    return command;
  }

  // Helper function to resolve file path within container
  resolvePath(containerId, filePath, workingDir = null) {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    // Use container's working directory (which gets updated after project creation)
    const baseDir = workingDir || container.workingDir || container.projectDir;
    
    // Handle paths that start with /home/project/ - map them to our workspace
    if (filePath.startsWith('/home/project/')) {
      const relativePath = filePath.replace('/home/project/', '');
      return path.resolve(baseDir, relativePath);
    }
    
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

  // Write file in container
  async writeFile(containerId, filePath, content) {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    // Use the current working directory (could be project directory after creation)
    const baseDir = container.workingDir || container.projectDir;
    const fullPath = this.resolvePath(containerId, filePath, baseDir);
    
    logger.info(`✏️ Writing file: ${filePath} to ${fullPath}`);
    
    try {
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content, 'utf8');
      logger.info(`✅ File written successfully: ${filePath}`);
      return { success: true };
    } catch (error) {
      logger.error(`❌ Failed to write file ${filePath}:`, error);
      throw error;
    }
  }

  // List directory contents in container
  async listDirectory(containerId, dirPath = '/') {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    // Use current working directory if dirPath is root
    let targetDir;
    if (dirPath === '/' || dirPath === '.') {
      targetDir = container.workingDir || container.projectDir;
    } else {
      targetDir = this.resolvePath(containerId, dirPath, container.workingDir || container.projectDir);
    }
    
    logger.info(`📁 Listing directory: ${dirPath} (resolved to: ${targetDir})`);
    
    try {
      const exists = await fs.pathExists(targetDir);
      if (!exists) {
        return [];
      }
      
      const items = await fs.readdir(targetDir, { withFileTypes: true });
      const result = items.map(item => ({
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file'
      }));
      
      logger.info(`📋 Found ${result.length} items in directory`);
      return result;
    } catch (error) {
      logger.error(`❌ Failed to list directory ${dirPath}:`, error);
      return [];
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

      // Handle both absolute and relative paths
      let newWorkingDir;
      if (path.isAbsolute(dirPath)) {
        newWorkingDir = dirPath;
      } else {
        // For relative paths, check both current working dir and workspace root
        const relativeToWorkspace = path.join(this.workspaceDir, dirPath);
        const relativeToContainer = path.join(container.workingDir || this.workspaceDir, dirPath);
        
        // Check which one exists
        if (await fs.pathExists(relativeToWorkspace)) {
          newWorkingDir = relativeToWorkspace;
        } else if (await fs.pathExists(relativeToContainer)) {
          newWorkingDir = relativeToContainer;
        } else {
          // Default to workspace-relative
          newWorkingDir = relativeToWorkspace;
        }
      }
      
      // Verify the directory exists
      if (!(await fs.pathExists(newWorkingDir))) {
        throw new Error(`Directory does not exist: ${dirPath} (resolved to: ${newWorkingDir})`);
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
