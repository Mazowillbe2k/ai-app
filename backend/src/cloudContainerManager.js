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
    // Separate user projects from backend files to avoid contamination
    this.workspaceDir = process.env.NODE_ENV === 'production' ? '/workspace/projects' : path.resolve('./workspace');
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
          // Remove timeout for npm install commands to allow longer installation times
          timeout: processedCommand.includes('npm install') ? undefined : 60000,
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
        
        try {
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
        } catch (commandError) {
          // Check if this is a Vite creation command that failed due to Node.js version
          if (command.includes('create vite') && commandError.message.includes('EBADENGINE')) {
            logger.info(`🔄 Vite creation failed due to Node.js version, trying degit fallback...`);
            
            // Try degit approach first - more reliable than manual creation
            const degitFallback = await this.tryDegitFallback(containerId, command, execDir);
            if (degitFallback.exitCode === 0) {
              return degitFallback;
            }
            
            // If degit also fails, try manual project creation approach
            logger.info(`🔄 Degit fallback failed, trying manual project creation...`);
            return await this.createProjectManually(containerId, command, execDir);
          }
          
          // For other errors, re-throw to be handled by outer catch
          throw commandError;
        }
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
        error: `Command failed: ${command} ${error.message}`,
        exitCode: error.code || 1
      };
    }
  }

  // Try degit fallback when create-vite fails
  async tryDegitFallback(containerId, originalCommand, execDir) {
    try {
      logger.info(`🔧 Attempting degit fallback for failed create-vite command...`);
      
      // Extract project name and template from original command
      const projectNameMatch = originalCommand.match(/create-vite@?\S*\s+"?([^"\s]+)"?/);
      const templateMatch = originalCommand.match(/--template\s+([^\s]+)/);
      
      const projectName = projectNameMatch ? projectNameMatch[1] : 'TodoApp';
      const template = templateMatch ? templateMatch[1] : 'react-ts';
      
      // Get appropriate degit template
      const degitTemplate = this.getDegitTemplate(template);
      const degitCommand = `npx degit ${degitTemplate} ${projectName}`;
      
      logger.info(`🚀 Executing degit command: ${degitCommand}`);
      
      // Execute degit command
      const execOptions = {
        cwd: execDir,
        maxBuffer: 10 * 1024 * 1024,
        // Remove timeout for degit commands to allow longer download times
        timeout: undefined,
        env: {
          ...process.env,
          HOME: execDir,
          npm_config_cache: path.join(execDir, '.npm'),
          npm_config_prefix: execDir
        }
      };
      
      await fs.ensureDir(path.join(execDir, '.npm'));
      
      const { stdout, stderr } = await execAsync(degitCommand, execOptions);
      
      logger.info(`✅ Degit command completed successfully`);
      
      // Handle post-creation setup
      await this.handlePostProjectCreation(containerId, degitCommand, execDir);
      
      return {
        output: `Successfully created ${projectName} using degit\n${stdout}`,
        error: stderr || undefined,
        exitCode: 0
      };
      
    } catch (error) {
      logger.error(`❌ Degit fallback failed: ${error.message}`);
      return {
        output: '',
        error: `Degit fallback failed: ${error.message}`,
        exitCode: 1
      };
    }
  }

  // Manual project creation fallback when automated tools fail
  async createProjectManually(containerId, originalCommand, execDir) {
    try {
      logger.info(`🛠️ Creating React TypeScript project manually...`);
      
      // Extract project name from original command
      let projectName = 'TodoApp'; // default
      const nameMatch = originalCommand.match(/create[^"]*\s+"?([^"\s]+)"?/);
      if (nameMatch) {
        projectName = nameMatch[1];
      }
      
      const projectPath = path.join(execDir, projectName);
      await fs.ensureDir(projectPath);
      
      // Create package.json
      const packageJson = {
        name: projectName.toLowerCase(),
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc && vite build",
          lint: "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
          preview: "vite preview"
        },
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0"
        },
        devDependencies: {
          "@types/react": "^18.2.43",
          "@types/react-dom": "^18.2.17",
          "@typescript-eslint/eslint-plugin": "^6.14.0",
          "@typescript-eslint/parser": "^6.14.0",
          "@vitejs/plugin-react": "^4.2.1",
          eslint: "^8.55.0",
          "eslint-plugin-react-hooks": "^4.6.0",
          "eslint-plugin-react-refresh": "^0.4.5",
          typescript: "^5.2.2",
          vite: "^4.5.0"
        }
      };
      
      await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 });
      
      // Create basic project structure
      await this.createBasicReactStructure(projectPath);
      
      // Update container working directory
      const container = this.containers.get(containerId);
      container.workingDir = projectPath;
      this.containers.set(containerId, container);
      
      logger.info(`✅ Manual project creation completed: ${projectName}`);
      
      return {
        output: `Successfully created ${projectName} project manually`,
        error: undefined,
        exitCode: 0
      };
      
    } catch (error) {
      logger.error(`❌ Manual project creation failed: ${error.message}`);
      return {
        output: '',
        error: `Manual project creation failed: ${error.message}`,
        exitCode: 1
      };
    }
  }

  // Create basic React TypeScript project structure
  async createBasicReactStructure(projectPath) {
    // Create directories
    await fs.ensureDir(path.join(projectPath, 'src'));
    await fs.ensureDir(path.join(projectPath, 'public'));
    
    // Create index.html
    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
    await fs.writeFile(path.join(projectPath, 'index.html'), indexHtml);
    
    // Create vite.config.ts
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})`;
    await fs.writeFile(path.join(projectPath, 'vite.config.ts'), viteConfig);
    
    // Create tsconfig.json
    const tsConfig = {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true
      },
      include: ["src"],
      references: [{ path: "./tsconfig.node.json" }]
    };
    await fs.writeJson(path.join(projectPath, 'tsconfig.json'), tsConfig, { spaces: 2 });
    
    // Create basic React components
    const mainTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;
    await fs.writeFile(path.join(projectPath, 'src', 'main.tsx'), mainTsx);
    
    const appTsx = `import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App`;
    await fs.writeFile(path.join(projectPath, 'src', 'App.tsx'), appTsx);
    
    // Create basic CSS files
    const indexCss = `body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}`;
    await fs.writeFile(path.join(projectPath, 'src', 'index.css'), indexCss);
    
    logger.info(`📁 Created basic React TypeScript project structure`);
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
        
        // Install dependencies with cloud-optimized settings
        logger.info(`📦 Installing dependencies for ${projectName}...`);
        const installOptions = {
          cwd: projectPath,
          maxBuffer: 10 * 1024 * 1024,
          // Remove timeout for npm install to allow unlimited time
          timeout: undefined,
          env: {
            ...process.env,
            // Use global npm cache to avoid permission issues
            npm_config_fund: 'false',
            npm_config_audit: 'false',
            npm_config_update_notifier: 'false',
            NODE_ENV: 'development'
          }
        };
        
        // Try different npm install strategies
        const installStrategies = [
          'npm install --no-fund --no-audit',
          'npm install --legacy-peer-deps --no-fund --no-audit',
          'npm install --force --no-fund --no-audit',
          'npm ci --no-fund --no-audit'
        ];
        
        let installSuccess = false;
        for (const strategy of installStrategies) {
          if (installSuccess) break;
          
          try {
            logger.info(`🔄 Trying: ${strategy}`);
            const { stdout: installStdout } = await execAsync(strategy, installOptions);
            logger.info(`✅ Dependencies installed successfully with: ${strategy}`);
            logger.info(`📤 Install output: ${installStdout.substring(0, 300)}...`);
            installSuccess = true;
            break;
          } catch (error) {
            logger.warn(`⚠️ Strategy failed: ${strategy} - ${error.message}`);
            
            // If package-lock.json doesn't exist and npm ci failed, remove it from strategies
            if (strategy.includes('npm ci')) {
              const packageLockPath = path.join(projectPath, 'package-lock.json');
              if (!await fs.pathExists(packageLockPath)) {
                logger.info(`📋 No package-lock.json found, skipping npm ci strategies`);
                continue;
              }
            }
          }
        }
        
        if (!installSuccess) {
          logger.error(`❌ All npm install strategies failed for ${projectName}`);
          logger.info(`💡 Project structure created, but dependencies need manual installation`);
        }
        
        // Configure dev server to use port 3000 to avoid conflict with backend (port 10000)
        await this.configureDevServer(projectPath);
      } else {
        logger.error(`❌ Project directory not found: ${projectPath}`);
      }
    } catch (error) {
      logger.error(`❌ Post-creation setup failed: ${error.message}`);
    }
  }

  // Configure development server to use port 3000
  async configureDevServer(projectPath) {
    try {
      logger.info(`🔧 Configuring dev server for port 3000...`);
      
      // Check if it's a Vite project
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        
        // Configure Vite to use port 3000
        const viteConfigPath = path.join(projectPath, 'vite.config.js');
        const viteConfigTsPath = path.join(projectPath, 'vite.config.ts');
        
        const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0'
  }
})`;

        if (await fs.pathExists(viteConfigTsPath)) {
          await fs.writeFile(viteConfigTsPath, viteConfig);
          logger.info(`✅ Updated vite.config.ts with port 3000`);
        } else if (await fs.pathExists(viteConfigPath)) {
          await fs.writeFile(viteConfigPath, viteConfig);
          logger.info(`✅ Updated vite.config.js with port 3000`);
        } else {
          // Create vite.config.js if it doesn't exist
          await fs.writeFile(viteConfigPath, viteConfig);
          logger.info(`✅ Created vite.config.js with port 3000`);
        }
        
        // Update package.json scripts to use correct port
        if (packageJson.scripts && packageJson.scripts.dev) {
          packageJson.scripts.dev = packageJson.scripts.dev.replace(/--port \d+/, '--port 3000');
          if (!packageJson.scripts.dev.includes('--port')) {
            packageJson.scripts.dev += ' --port 3000';
          }
          await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
          logger.info(`✅ Updated package.json dev script with port 3000`);
        }
      }
      
      logger.info(`✅ Dev server configured for port 3000`);
    } catch (error) {
      logger.error(`❌ Failed to configure dev server: ${error.message}`);
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

  // Enhanced command preprocessing with fallback strategies
  preprocessCommand(command) {
    // Handle npm create vite with degit fallback for Node.js compatibility
    if (command.includes('npm create vite@latest') || command.includes('npx create-vite@latest')) {
      // Check Node.js version and provide fallback strategies
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.split('.')[0].slice(1));
      
      if (majorVersion < 20) {
        // Extract project name and template from original command
        const projectNameMatch = command.match(/create-vite@?\S*\s+"?([^"\s]+)"?/);
        const templateMatch = command.match(/--template\s+([^\s]+)/);
        
        const projectName = projectNameMatch ? projectNameMatch[1] : 'my-vite-app';
        const template = templateMatch ? templateMatch[1] : 'react-ts';
        
        // Use degit as primary fallback - it's more reliable in cloud environments
        const degitTemplate = this.getDegitTemplate(template);
        const degitCommand = `npx degit ${degitTemplate} ${projectName}`;
        
        logger.info(`🔧 Using degit fallback for Node.js ${nodeVersion}: ${degitCommand}`);
        return degitCommand;
      } else {
        // Let the original command run for Node 20+
        logger.info(`🚀 Using latest Vite for Node.js ${nodeVersion}: ${command}`);
        return command;
      }
    }
    
    // Generic fallback for any npm create vite command that doesn't specify version
    if (command.includes('npm create vite') && !command.includes('vite@') && !command.includes('vite@latest')) {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.split('.')[0].slice(1));
      
      if (majorVersion < 20) {
        // Extract project details and convert to degit
        const projectNameMatch = command.match(/create[^"]*\s+"?([^"\s]+)"?/);
        const templateMatch = command.match(/--template\s+([^\s]+)/);
        
        const projectName = projectNameMatch ? projectNameMatch[1] : 'my-vite-app';
        const template = templateMatch ? templateMatch[1] : 'react-ts';
        
        const degitTemplate = this.getDegitTemplate(template);
        const degitCommand = `npx degit ${degitTemplate} ${projectName}`;
        
        logger.info(`🔧 Converting to degit for compatibility: ${degitCommand}`);
        return degitCommand;
      }
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

  // Get appropriate degit template based on Vite template type
  getDegitTemplate(template) {
    const templateMap = {
      'react-ts': 'vitejs/vite/packages/create-vite/template-react-ts',
      'react': 'vitejs/vite/packages/create-vite/template-react',
      'vue-ts': 'vitejs/vite/packages/create-vite/template-vue-ts',
      'vue': 'vitejs/vite/packages/create-vite/template-vue',
      'vanilla-ts': 'vitejs/vite/packages/create-vite/template-vanilla-ts',
      'vanilla': 'vitejs/vite/packages/create-vite/template-vanilla',
      'svelte-ts': 'vitejs/vite/packages/create-vite/template-svelte-ts',
      'svelte': 'vitejs/vite/packages/create-vite/template-svelte',
      'lit-ts': 'vitejs/vite/packages/create-vite/template-lit-ts',
      'lit': 'vitejs/vite/packages/create-vite/template-lit',
      'preact-ts': 'vitejs/vite/packages/create-vite/template-preact-ts',
      'preact': 'vitejs/vite/packages/create-vite/template-preact'
    };
    
    // Return the mapped template or default to react-ts
    return templateMap[template] || templateMap['react-ts'];
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

      // Only search within the project directory, not the entire workspace
      const baseDir = workingDir || container.workingDir || container.projectDir;
      
      // If no project directory exists yet, return empty
      if (!baseDir || !await fs.pathExists(baseDir)) {
        return { files: [] };
      }
      
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

  // Get preview URL for cloud deployment
  async getPreviewUrl(containerId) {
    try {
      const container = this.containers.get(containerId);
      if (!container) {
        return { url: null };
      }

      // Check if there's a package.json with dev script in the project
      const packageJsonPath = path.join(container.workingDir || container.projectDir, 'package.json');
      
      if (await fs.pathExists(packageJsonPath)) {
        try {
          const packageJson = await fs.readJson(packageJsonPath);
          
          // If this has dev scripts, it's likely a web project
          if (packageJson.scripts && (packageJson.scripts.dev || packageJson.scripts.start)) {
            // In cloud deployment, generate preview URL based on project structure
            // Since we're running on Render, we can't expose random ports directly
            // Instead, indicate that the project is ready for local development
            const projectName = container.name;
            
            return { 
              url: `http://localhost:3000`,
              metadata: {
                projectName,
                ready: true,
                devCommand: packageJson.scripts.dev || packageJson.scripts.start,
                note: 'Run `npm run dev` in the project directory to start the development server'
              }
            };
          }
        } catch (jsonError) {
          logger.warn(`Could not read package.json: ${jsonError.message}`);
        }
      }
      
      // For static HTML projects or other types
      const indexPath = path.join(container.workingDir || container.projectDir, 'index.html');
      if (await fs.pathExists(indexPath)) {
        return { 
          url: `file://${indexPath}`,
          metadata: {
            type: 'static',
            note: 'Static HTML file'
          }
        };
      }
      
      return { url: null };
    } catch (error) {
      logger.error(`Failed to generate preview URL: ${error.message}`);
      return { url: null };
    }
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
