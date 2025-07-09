import type { ProjectFile, ToolResult } from '../types';
import { DockerContainerInterface, type ContainerInterface } from './containerInterface';

export class ToolExecutionService {
  private projectFiles: ProjectFile[] = [];
  private container: ContainerInterface;

  constructor() {
    this.container = new DockerContainerInterface();
  }

  setProjectFiles(files: ProjectFile[]) {
    this.projectFiles = files;
  }

  getContainer(): ContainerInterface {
    return this.container;
  }

  async executeTool(toolName: string, parameters: any): Promise<ToolResult> {
    try {
      // Validate parameters exist
      if (!parameters || typeof parameters !== 'object') {
        return {
          success: false,
          output: '',
          error: `Tool '${toolName}' requires parameters but none were provided`
        };
      }

      switch (toolName) {
        case 'startup':
          // Map various parameter names the AI might use to expected ones
          const startupParams = {
            project_name: parameters.project_name || parameters.name || parameters.template || 'my-app',
            framework: this.mapFramework(parameters.framework || parameters.lang || parameters.language || parameters.template_type || 'react-vite'),
            shadcn_theme: parameters.shadcn_theme || parameters.theme || parameters.style || 'default'
          };
          
          console.log(`🚀 Mapped startup parameters:`, startupParams);
          return await this.startup(startupParams);
          

          
        case 'bash':
          const bashParams = {
            command: parameters.command || parameters.cmd || parameters.exec || '',
            starting_server: parameters.starting_server || parameters.start_server || parameters.server || false,
            require_user_interaction: parameters.require_user_interaction || parameters.interaction || ''
          };
          
          if (!bashParams.command) {
            return {
              success: false,
              output: '',
              error: `bash tool needs a command to execute. Got: ${JSON.stringify(parameters)}`
            };
          }
          
          console.log(`💻 Mapped bash parameters:`, bashParams);
          return await this.bash(bashParams);
          
        case 'ls':
          const lsParams = {
            relative_dir_path: parameters.relative_dir_path || parameters.path || parameters.directory || parameters.dir || '.'
          };
          return await this.ls(lsParams);
          
        case 'glob':
          if (!parameters.pattern) {
            return {
              success: false,
              output: '',
              error: `glob tool requires: pattern (string), exclude_pattern (string). Got: ${JSON.stringify(parameters)}`
            };
          }
          parameters.exclude_pattern = parameters.exclude_pattern || '';
          return await this.glob(parameters);
          
        case 'grep':
          if (!parameters.query) {
            return {
              success: false,
              output: '',
              error: `grep tool requires: query (string), case_sensitive (boolean), include_pattern (string), exclude_pattern (string). Got: ${JSON.stringify(parameters)}`
            };
          }
          parameters.case_sensitive = parameters.case_sensitive || false;
          parameters.include_pattern = parameters.include_pattern || '';
          parameters.exclude_pattern = parameters.exclude_pattern || '';
          return await this.grep(parameters);
          
        case 'read_file':
          const readParams = {
            relative_file_path: parameters.relative_file_path || parameters.file_path || parameters.path || parameters.file || '',
            should_read_entire_file: parameters.should_read_entire_file !== false,
            start_line_one_indexed: parameters.start_line_one_indexed || parameters.start_line,
            end_line_one_indexed: parameters.end_line_one_indexed || parameters.end_line
          };
          
          if (!readParams.relative_file_path) {
            return {
              success: false,
              output: '',
              error: `read_file tool needs a file path. Got: ${JSON.stringify(parameters)}`
            };
          }
          
          return await this.readFile(readParams);
          
        case 'delete_file':
          if (!parameters.relative_file_path) {
            return {
              success: false,
              output: '',
              error: `delete_file tool requires: relative_file_path (string). Got: ${JSON.stringify(parameters)}`
            };
          }
          return await this.deleteFile(parameters);
          
        case 'edit_file':
          const editParams = this.mapEditFileParams(parameters);
          
          if (!editParams.relative_file_path) {
            return {
              success: false,
              output: '',
              error: `edit_file tool needs a file path. Got: ${JSON.stringify(parameters)}`
            };
          }
          
          if (!editParams.code_edit || editParams.code_edit.trim() === '') {
            return {
              success: false,
              output: '',
              error: `edit_file tool needs actual code content in the 'code_edit' parameter. AI should provide the complete file content, not empty strings. Got: ${JSON.stringify(parameters)}`
            };
          }
          
          console.log(`✏️ Mapped edit_file parameters:`, editParams);
          return await this.editFile(editParams);
          
        case 'string_replace':
          if (!parameters.relative_file_path || !parameters.old_string || !parameters.new_string) {
            return {
              success: false,
              output: '',
              error: `string_replace tool requires: relative_file_path (string), old_string (string), new_string (string), replace_all (boolean). Got: ${JSON.stringify(parameters)}`
            };
          }
          parameters.replace_all = parameters.replace_all || false;
          return await this.stringReplace(parameters);
          
        case 'run_linter':
          const linterParams = {
            project_directory: parameters.project_directory || parameters.project || parameters.dir || parameters.directory || 'my-app',
            package_manager: parameters.package_manager || parameters.manager || 'npm'
          };
          console.log(`🧹 Mapped run_linter parameters:`, linterParams);
          return await this.runLinter(linterParams);
          
        case 'versioning':
          const versionParams = this.mapVersioningParams(parameters);
          console.log(`📦 Mapped versioning parameters:`, versionParams);
          return await this.versioning(versionParams);
          
        case 'suggestions':
          if (!parameters.suggestions || !Array.isArray(parameters.suggestions)) {
            return {
              success: false,
              output: '',
              error: `suggestions tool requires: suggestions (string[]). Got: ${JSON.stringify(parameters)}`
            };
          }
          return await this.suggestions(parameters);
          
        case 'deploy':
          const deployParams = this.mapDeployParams(parameters);
          console.log(`🚀 Mapped deploy parameters:`, deployParams);
          return await this.deploy(deployParams);
          
        case 'web_search':
          if (!parameters.search_term) {
            return {
              success: false,
              output: '',
              error: `web_search tool requires: search_term (string). Got: ${JSON.stringify(parameters)}`
            };
          }
          return await this.webSearch(parameters);
          
        case 'web_scrape':
          if (!parameters.url) {
            return {
              success: false,
              output: '',
              error: `web_scrape tool requires: url (string), selector (optional string). Got: ${JSON.stringify(parameters)}`
            };
          }
          return await this.webScrape(parameters);
          
        case 'browse':
          if (!parameters.url) {
            return {
              success: false,
              output: '',
              error: `browse tool requires: url (string). Got: ${JSON.stringify(parameters)}`
            };
          }
          return await this.browse(parameters);
          
        default:
          return {
            success: false,
            output: '',
            error: `Unknown tool: ${toolName}. Available tools: startup, bash, ls, glob, grep, read_file, delete_file, edit_file, string_replace, run_linter, versioning, suggestions, deploy, web_search, web_scrape, browse`
          };
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async startup(params: { project_name: string; framework: string; shadcn_theme: string }): Promise<ToolResult> {
    const { project_name, framework, shadcn_theme } = params;
    
    console.log(`🚀 Creating project: ${project_name} with framework: ${framework}`);
    
    let createCommand = '';
    
    switch (framework) {
      case 'react-vite':
        createCommand = `npx degit vitejs/vite/packages/create-vite/template-react-ts ${project_name}`;
        break;
      case 'react-vite-tailwind':
        createCommand = `npx degit vitejs/vite/packages/create-vite/template-react-ts ${project_name}`;
        break;
      case 'react-vite-shadcn':
        createCommand = `npx degit vitejs/vite/packages/create-vite/template-react-ts ${project_name}`;
        break;
      case 'nextjs-shadcn':
        createCommand = `npx create-next-app@latest ${project_name} --typescript --tailwind --eslint --app --src-dir --import-alias="@/*" --yes`;
        break;
      case 'vue-vite':
        createCommand = `npx degit vitejs/vite/packages/create-vite/template-vue-ts ${project_name}`;
        break;
      case 'vue-vite-tailwind':
        createCommand = `npx degit vitejs/vite/packages/create-vite/template-vue-ts ${project_name}`;
        break;
      case 'svelte-vite':
        createCommand = `npx degit vitejs/vite/packages/create-vite/template-svelte-ts ${project_name}`;
        break;
      case 'lit-vite':
        createCommand = `npx degit vitejs/vite/packages/create-vite/template-lit-ts ${project_name}`;
        break;
      case 'preact-vite':
        createCommand = `npx degit vitejs/vite/packages/create-vite/template-preact-ts ${project_name}`;
        break;
      case 'vanilla-vite':
        createCommand = `npx degit vitejs/vite/packages/create-vite/template-vanilla-ts ${project_name}`;
        break;
      case 'html-ts-css':
        createCommand = `npx degit vitejs/vite/packages/create-vite/template-vanilla-ts ${project_name}`;
        break;
      default:
        createCommand = `npx degit vitejs/vite/packages/create-vite/template-react-ts ${project_name}`;
    }
    
    // First, check if the project directory already exists and clean it
    const checkDirResult = await this.container.executeCommand(`ls -la ${project_name}`);
    if (checkDirResult.exitCode === 0) {
      console.log(`🗑️ Project directory ${project_name} already exists, cleaning it...`);
      await this.container.executeCommand(`rm -rf ${project_name}`);
    }
    
    const result = await this.container.executeCommand(createCommand);
    
    // Set working directory to the newly created project
    if (result.exitCode === 0) {
      console.log(`📂 Setting working directory to: ${project_name}`);
      await this.container.setWorkingDirectory(project_name);
      
      // For degit templates, we need to install dependencies with progress tracking
      if (createCommand.includes('degit')) {
        console.log(`📦 Installing dependencies for degit template...`);
        
        // Use executeCommandWithProgress for npm install to show progress
        await this.container.executeCommandWithProgress(
          `cd ${project_name} && npm install`,
          (progress) => {
            // Progress callback will be handled by the agenticAI service
            // which will update the tool execution with progress
            console.log(`📦 Progress: ${progress.current}/${progress.total} - ${progress.message}`);
          }
        );
      }
    }
    
    // If using Tailwind or shadcn, install additional dependencies
    if (framework.includes('tailwind') || framework.includes('shadcn')) {
      await this.container.executeCommand(`cd ${project_name} && npm install -D tailwindcss postcss autoprefixer --yes`);
      await this.container.executeCommand(`cd ${project_name} && npx tailwindcss init -p`);
    }
    
    if (framework.includes('shadcn')) {
      await this.container.executeCommand(`cd ${project_name} && npx shadcn-ui@latest init --yes --style default --color ${shadcn_theme}`);
    }
    
    // Configure dev server to use port 3000 to avoid conflicts with backend (port 10000)
    if (result.exitCode === 0 && (framework.includes('vite') || framework.includes('react'))) {
      console.log(`🔧 Configuring dev server for port 3000...`);
      
      const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0'
  }
})`;
      
      await this.container.writeFile(`${project_name}/vite.config.ts`, viteConfig);
      console.log(`✅ Vite config created with port 3000`);
    }
    
    return {
      success: result.exitCode === 0,
      output: `Project ${project_name} created successfully with ${framework}${framework.includes('shadcn') ? ` (${shadcn_theme} theme)` : ''}`,
      error: result.error,
      metadata: {
        projectName: project_name,
        framework,
        shadcnTheme: shadcn_theme,
        isRealContainer: true
      }
    };
  }



  private async bash(params: { command: string; starting_server: boolean; require_user_interaction: string }): Promise<ToolResult> {
    const { command, starting_server, require_user_interaction } = params;
    
    console.log(`💻 Bash: ${command}`);
    
    if (require_user_interaction) {
      console.log(`⚠️ User interaction required: ${require_user_interaction}`);
    }
    
    const result = await this.container.executeCommand(command);
    
    return {
      success: result.exitCode === 0,
      output: result.output,
      error: result.error,
      metadata: {
        command,
        startingServer: starting_server,
        requiresInteraction: require_user_interaction,
        isRealContainer: true
      }
    };
  }

  private async ls(params: { relative_dir_path: string }): Promise<ToolResult> {
    const { relative_dir_path } = params;
    
    const result = await this.container.listDirectory(relative_dir_path);
    
    return {
      success: !result.error,
      output: result.files.join('\n'),
      error: result.error,
      metadata: {
        path: relative_dir_path,
        fileCount: result.files.length,
        isRealContainer: true
      }
    };
  }

  private async glob(params: { pattern: string; exclude_pattern: string }): Promise<ToolResult> {
    const { pattern, exclude_pattern } = params;
    
    // Use find command with proper glob patterns
    let findCommand = `find . -type f`;
    
    // Convert glob pattern to find pattern
    if (pattern !== '*') {
      const findPattern = pattern
        .replace(/\*/g, '*')  // Keep * as wildcard
        .replace(/\?/g, '?')  // Keep ? as single char wildcard
        .replace(/\[/g, '\\[') // Escape brackets
        .replace(/\]/g, '\\]');
      findCommand += ` -name "${findPattern}"`;
    }
    
    // Add exclude pattern if specified
    if (exclude_pattern) {
      const excludePattern = exclude_pattern
        .replace(/\*/g, '*')
        .replace(/\?/g, '?')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]');
      findCommand += ` ! -name "${excludePattern}"`;
    }
    
    const result = await this.container.executeCommand(findCommand);
    
    if (result.exitCode !== 0) {
      return {
        success: false,
        output: '',
        error: `Glob search failed: ${result.error}`,
        metadata: {
          pattern,
          excludePattern: exclude_pattern,
          isRealGlob: true
        }
      };
    }
    
    const files = result.output.split('\n').filter(line => line.trim() !== '');
    
    return {
      success: true,
      output: files.join('\n'),
      metadata: {
        pattern,
        excludePattern: exclude_pattern,
        matchCount: files.length,
        isRealGlob: true
      }
    };
  }

  private async grep(params: { query: string; case_sensitive: boolean; include_pattern: string; exclude_pattern: string }): Promise<ToolResult> {
    const { query, case_sensitive, include_pattern, exclude_pattern } = params;
    
    // Build grep command with proper options
    let grepCommand = 'grep';
    
    if (!case_sensitive) {
      grepCommand += ' -i';
    }
    
    grepCommand += ' -n'; // Show line numbers
    
    if (include_pattern) {
      grepCommand += ` --include="${include_pattern}"`;
    }
    
    if (exclude_pattern) {
      grepCommand += ` --exclude="${exclude_pattern}"`;
    }
    
    // Escape special regex characters in the query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    grepCommand += ` "${escapedQuery}" .`;
    
    const result = await this.container.executeCommand(grepCommand);
    
    // grep returns exit code 1 when no matches found, which is not an error
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      return {
        success: false,
        output: '',
        error: `Grep search failed: ${result.error}`,
        metadata: {
          query,
          caseSensitive: case_sensitive,
          isRealGrep: true
        }
      };
    }
    
    const results = result.output.split('\n').filter(line => line.trim() !== '');
    
    return {
      success: true,
      output: results.join('\n'),
      metadata: {
        query,
        caseSensitive: case_sensitive,
        matchCount: results.length,
        isRealGrep: true
      }
    };
  }

  private async stringReplace(params: { relative_file_path: string; old_string: string; new_string: string; replace_all: boolean }): Promise<ToolResult> {
    const { relative_file_path, old_string, new_string, replace_all } = params;
    
    const readResult = await this.container.readFile(relative_file_path);
    if (readResult.error) {
      return {
        success: false,
        output: '',
        error: readResult.error,
        metadata: { filePath: relative_file_path }
      };
    }
    
    let content = readResult.content;
    
    if (replace_all) {
      content = content.replace(new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), new_string);
    } else {
      const index = content.indexOf(old_string);
      if (index === -1) {
        return {
          success: false,
          output: '',
          error: 'String not found in file',
          metadata: { filePath: relative_file_path }
        };
      }
      content = content.replace(old_string, new_string);
    }
    
    const writeResult = await this.container.writeFile(relative_file_path, content);
    
    return {
      success: writeResult.success,
      output: writeResult.success ? `String replacement completed in ${relative_file_path}` : 'Failed to write file',
      error: writeResult.error,
      metadata: {
        filePath: relative_file_path,
        replaceAll: replace_all
      }
    };
  }

  private async runLinter(params: { project_directory: string; package_manager: string }): Promise<ToolResult> {
    const { project_directory, package_manager } = params;
    
    const lintCommand = `cd ${project_directory} && ${package_manager} run lint`;
    const result = await this.container.executeCommand(lintCommand);
    
    return {
      success: result.exitCode === 0,
      output: result.output,
      error: result.error,
      metadata: {
        projectDirectory: project_directory,
        packageManager: package_manager
      }
    };
  }

  private async versioning(params: { project_directory: string; version_title: string; version_changelog: string[]; version_number: string }): Promise<ToolResult> {
    const { project_directory, version_title, version_changelog, version_number } = params;
    
    console.log(`📦 Creating version ${version_number}: ${version_title}`);
    
    // For now, we'll simulate versioning by creating a changelog entry
    const changelogContent = `# ${version_title} (${version_number})\n\n${version_changelog.map(item => `- ${item}`).join('\n')}\n\n`;
    
    const writeResult = await this.container.writeFile(`${project_directory}/CHANGELOG.md`, changelogContent);
    
    return {
      success: writeResult.success,
      output: `Version ${version_number} created with changelog`,
      error: writeResult.error,
      metadata: {
        version: version_number,
        title: version_title,
        changelog: version_changelog,
        isRealContainer: true
      }
    };
  }

  private async readFile(params: { relative_file_path: string; should_read_entire_file: boolean; start_line_one_indexed?: number; end_line_one_indexed?: number }): Promise<ToolResult> {
    const { relative_file_path, should_read_entire_file, start_line_one_indexed, end_line_one_indexed } = params;
    
    console.log(`📖 Reading file: ${relative_file_path}`);
    
    const readResult = await this.container.readFile(relative_file_path);
    
    if (readResult.error) {
      return {
        success: false,
        output: '',
        error: readResult.error,
        metadata: { filePath: relative_file_path }
      };
    }
    
    let content = readResult.content;
    
    // If not reading entire file, extract line range
    if (!should_read_entire_file && start_line_one_indexed && end_line_one_indexed) {
      const lines = content.split('\n');
      const startIndex = start_line_one_indexed - 1;
      const endIndex = end_line_one_indexed;
      content = lines.slice(startIndex, endIndex).join('\n');
    }
    
    return {
      success: true,
      output: content,
      metadata: {
        filePath: relative_file_path,
        lineCount: content.split('\n').length,
        isRealContainer: true
      }
    };
  }

  private async deleteFile(params: { relative_file_path: string }): Promise<ToolResult> {
    const { relative_file_path } = params;
    
    console.log(`🗑️ Deleting file: ${relative_file_path}`);
    
    const deleteResult = await this.container.deleteFile(relative_file_path);
    
    return {
      success: deleteResult.success,
      output: deleteResult.success ? `File ${relative_file_path} deleted successfully` : 'Failed to delete file',
      error: deleteResult.error,
      metadata: {
        filePath: relative_file_path,
        isRealContainer: true
      }
    };
  }

  private async editFile(params: { relative_file_path: string; instructions: string; code_edit: string; smart_apply?: boolean }): Promise<ToolResult> {
    const { relative_file_path, instructions, code_edit, smart_apply } = params;
    
    console.log(`✏️ Editing file: ${relative_file_path} - ${instructions}`);
    
    const writeResult = await this.container.writeFile(relative_file_path, code_edit);
    
    return {
      success: writeResult.success,
      output: writeResult.success ? `File ${relative_file_path} edited successfully` : 'Failed to edit file',
      error: writeResult.error,
      metadata: {
        filePath: relative_file_path,
        instructions,
        smartApply: smart_apply,
        isRealContainer: true
      }
    };
  }

  private async webSearch(params: { search_term: string }): Promise<ToolResult> {
    const { search_term } = params;
    
    console.log(`🔍 Web search: ${search_term}`);
    
    // Use curl to perform a real web search via DuckDuckGo
    const searchCommand = `curl -s "https://api.duckduckgo.com/?q=${encodeURIComponent(search_term)}&format=json&no_html=1&skip_disambig=1"`;
    const result = await this.container.executeCommand(searchCommand);
    
    if (result.exitCode !== 0) {
      return {
        success: false,
        output: '',
        error: `Web search failed: ${result.error}`,
        metadata: {
          searchTerm: search_term,
          isRealWebSearch: true
        }
      };
    }
    
    try {
      const searchData = JSON.parse(result.output);
      const results = [];
      
      if (searchData.Abstract) {
        results.push(`Abstract: ${searchData.Abstract}`);
      }
      
      if (searchData.RelatedTopics && searchData.RelatedTopics.length > 0) {
        results.push('Related topics:');
        searchData.RelatedTopics.slice(0, 5).forEach((topic: any, index: number) => {
          if (topic.Text) {
            results.push(`${index + 1}. ${topic.Text}`);
          }
        });
      }
      
      const output = results.length > 0 ? results.join('\n') : 'No search results found';
      
      return {
        success: true,
        output,
        metadata: {
          searchTerm: search_term,
          resultCount: results.length,
          isRealWebSearch: true
        }
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Failed to parse search results: ${error}`,
        metadata: {
          searchTerm: search_term,
          isRealWebSearch: true
        }
      };
    }
  }

  private async webScrape(params: { url: string; selector?: string }): Promise<ToolResult> {
    const { url, selector } = params;
    
    console.log(`��️ Web scrape: ${url}${selector ? ` (selector: ${selector})` : ''}`);
    
    try {
      const browseResult = await this.container.browse(url);
      
      if (browseResult.error) {
        return {
          success: false,
          output: '',
          error: `Failed to browse to ${url}: ${browseResult.error}`
        };
      }
      
      let content = browseResult.html;
      
      // If a selector is provided, try to extract that specific content
      if (selector) {
        // Basic selector extraction (for more complex selectors, you'd use a proper DOM parser)
        const selectorRegex = new RegExp(`<[^>]*${selector}[^>]*>(.*?)<\/[^>]*>`, 'gsi');
        const match = content.match(selectorRegex);
        if (match) {
          content = match[1];
        } else {
          console.warn(`⚠️ Selector "${selector}" not found in page content`);
        }
      }
      
      const formattedOutput = [
        `🌐 Successfully scraped: ${url}`,
        `📄 Page title: ${browseResult.title}`,
        selector ? `🎯 Selector: ${selector}` : '',
        '📝 Content:',
        content.slice(0, 2000) + (content.length > 2000 ? '...' : '')
      ].filter(Boolean).join('\n');
      
      return {
        success: true,
        output: formattedOutput,
        metadata: {
          url,
          title: browseResult.title,
          selector,
          contentLength: content.length,
          isRealBrowser: true,
          // Include screenshot and additional metadata
          screenshot: browseResult.screenshot,
          description: browseResult.metadata?.description,
          image: browseResult.metadata?.image,
          favicon: browseResult.metadata?.favicon
        }
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error during web scraping'
      };
    }
  }

  private async deploy(params: { project_directory: string; platform: string; config?: any }): Promise<ToolResult> {
    const { project_directory, platform, config } = params;
    
    console.log(`🚀 Deploy to ${platform}: ${project_directory}`);
    
    // Build the project first
    const buildResult = await this.container.executeCommand(`cd ${project_directory} && npm run build`);
    
    if (buildResult.exitCode !== 0) {
      return {
        success: false,
        output: buildResult.output,
        error: buildResult.error || 'Build failed',
        metadata: { platform, projectDirectory: project_directory }
      };
    }
    
    // Deploy based on platform
    let deployCommand = '';
    let deploymentUrl = '';
    
    switch (platform.toLowerCase()) {
      case 'vercel':
        deployCommand = `cd ${project_directory} && npx vercel --yes`;
        break;
      case 'netlify':
        deployCommand = `cd ${project_directory} && npx netlify-cli deploy --prod --dir=dist`;
        break;
      case 'render':
        deployCommand = `cd ${project_directory} && npx render-cli deploy`;
        break;
      case 'railway':
        deployCommand = `cd ${project_directory} && npx @railway/cli deploy`;
        break;
      default:
        return {
          success: false,
          output: '',
          error: `Unsupported platform: ${platform}. Supported platforms: vercel, netlify, render, railway`,
          metadata: { platform, projectDirectory: project_directory }
        };
    }
    
    const deployResult = await this.container.executeCommand(deployCommand);
    
    if (deployResult.exitCode !== 0) {
      return {
        success: false,
        output: deployResult.output,
        error: deployResult.error || 'Deployment failed',
        metadata: { platform, projectDirectory: project_directory }
      };
    }
    
    // Extract deployment URL from output
    const urlMatch = deployResult.output.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      deploymentUrl = urlMatch[0];
    }
    
    return {
      success: true,
      output: `Project deployed successfully!\nURL: ${deploymentUrl}\nPlatform: ${platform}`,
      metadata: {
        platform,
        projectDirectory: project_directory,
        deploymentUrl,
        isRealDeployment: true
      }
    };
  }

  private async browse(params: { url: string }): Promise<ToolResult> {
    const { url } = params;
    
    console.log(`🌐 Browse: ${url}`);
    
    try {
      const result = await this.container.browse(url);
      
      if (result.error) {
        return {
          success: false,
          output: '',
          error: `Failed to browse to ${url}: ${result.error}`
        };
      }
      
      const formattedOutput = [
        `🌐 Successfully browsed: ${url}`,
        `📄 Page title: ${result.title}`,
        '📝 Page content:',
        result.html.slice(0, 3000) + (result.html.length > 3000 ? '\n\n...(content truncated for display)' : '')
      ].join('\n');
      
      return {
        success: true,
        output: formattedOutput,
        metadata: {
          url,
          title: result.title,
          contentLength: result.html.length,
          isRealBrowser: true,
          // Include screenshot and additional metadata
          screenshot: result.screenshot,
          description: result.metadata?.description,
          image: result.metadata?.image,
          favicon: result.metadata?.favicon
        }
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error during browsing'
      };
    }
  }

  private async suggestions(params: { suggestions: string[] }): Promise<ToolResult> {
    const { suggestions } = params;
    
    console.log(`💡 Providing ${suggestions.length} suggestions`);
    
    const formattedSuggestions = suggestions.map((suggestion, index) => 
      `${index + 1}. ${suggestion}`
    ).join('\n');
    
    return {
      success: true,
      output: `Next steps:\n${formattedSuggestions}`,
      metadata: {
        suggestionCount: suggestions.length,
        suggestions
      }
    };
  }

  private mapFramework(framework: string): string {
    const fw = framework.toLowerCase();
    
    // Map common AI variations to actual framework names
    if (fw.includes('typescript') || fw === 'ts') {
      return 'react-vite'; // Default TypeScript to React + Vite
    }
    if (fw.includes('react') && fw.includes('shadcn')) {
      return 'react-vite-shadcn';
    }
    if (fw.includes('react') && fw.includes('tailwind')) {
      return 'react-vite-tailwind';
    }
    if (fw.includes('react')) {
      return 'react-vite';
    }
    if (fw.includes('next')) {
      return 'nextjs-shadcn';
    }
    if (fw.includes('vue')) {
      return 'vue-vite';
    }
    if (fw.includes('html')) {
      return 'html-ts-css';
    }
    
    // Direct matches
    const directMappings: Record<string, string> = {
      'react-vite': 'react-vite',
      'react-vite-tailwind': 'react-vite-tailwind', 
      'react-vite-shadcn': 'react-vite-shadcn',
      'nextjs-shadcn': 'nextjs-shadcn',
      'vue-vite': 'vue-vite',
      'vue-vite-tailwind': 'vue-vite-tailwind',
      'html-ts-css': 'html-ts-css'
    };
    
    return directMappings[fw] || 'react-vite'; // Default
  }

  private mapEditFileParams(parameters: any): any {
    return {
      relative_file_path: parameters.relative_file_path || parameters.file_path || parameters.path || parameters.file,
      instructions: parameters.instructions || parameters.description || parameters.action || 'Editing file',
      code_edit: parameters.code_edit || parameters.content || parameters.code || parameters.body || '',
      smart_apply: parameters.smart_apply || false
    };
  }



  private mapVersioningParams(parameters: any): any {
    // Handle changelog - convert string to array if needed
    let changelog = parameters.version_changelog || parameters.changelog || parameters.changes || [];
    if (typeof changelog === 'string') {
      changelog = [changelog]; // Convert string to single-item array
    }
    if (!Array.isArray(changelog)) {
      changelog = [];
    }
    
    return {
      project_directory: parameters.project_directory || parameters.project || parameters.dir || parameters.directory || 'my-app',
      version_title: parameters.version_title || parameters.title || parameters.name || 'New Version',
      version_changelog: changelog,
      version_number: parameters.version_number || parameters.version || '1.0.0'
    };
  }

  private mapDeployParams(parameters: any): any {
    return {
      project_directory: parameters.project_directory || parameters.project || parameters.dir || parameters.directory || 'my-app',
      platform: parameters.platform || parameters.service || parameters.host || 'netlify',
      config: parameters.config || parameters.options || {}
    };
  }
}