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
      switch (toolName) {
        case 'startup':
          return await this.startup(parameters);
        case 'task_agent':
          return await this.taskAgent(parameters);
        case 'bash':
          return await this.bash(parameters);
        case 'ls':
          return await this.ls(parameters);
        case 'glob':
          return await this.glob(parameters);
        case 'grep':
          return await this.grep(parameters);
        case 'read_file':
          return await this.readFile(parameters);
        case 'delete_file':
          return await this.deleteFile(parameters);
        case 'edit_file':
          return await this.editFile(parameters);
        case 'string_replace':
          return await this.stringReplace(parameters);
        case 'run_linter':
          return await this.runLinter(parameters);
        case 'versioning':
          return await this.versioning(parameters);
        case 'suggestions':
          return await this.suggestions(parameters);
        case 'deploy':
          return await this.deploy(parameters);
        case 'web_search':
          return await this.webSearch(parameters);
        case 'web_scrape':
          return await this.webScrape(parameters);
        default:
          throw new Error(`Unknown tool: ${toolName}`);
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
        createCommand = `npm create vite@latest ${project_name} -- --template react-ts --yes`;
        break;
      case 'react-vite-tailwind':
        createCommand = `npm create vite@latest ${project_name} -- --template react-ts --yes`;
        break;
      case 'react-vite-shadcn':
        createCommand = `npm create vite@latest ${project_name} -- --template react-ts --yes`;
        break;
      case 'nextjs-shadcn':
        createCommand = `npx create-next-app@latest ${project_name} --typescript --tailwind --eslint --app --src-dir --import-alias="@/*" --yes`;
        break;
      case 'vue-vite':
        createCommand = `npm create vue@latest ${project_name} -- --typescript --yes`;
        break;
      case 'vue-vite-tailwind':
        createCommand = `npm create vue@latest ${project_name} -- --typescript --yes`;
        break;
      case 'html-ts-css':
        createCommand = `mkdir ${project_name} && cd ${project_name} && echo '<!DOCTYPE html><html><head><title>${project_name}</title></head><body><h1>Hello World</h1></body></html>' > index.html`;
        break;
      default:
        createCommand = `npm create vite@latest ${project_name} -- --template react-ts --yes`;
    }
    
    const result = await this.container.executeCommand(createCommand);
    
    // If using Tailwind or shadcn, install additional dependencies
    if (framework.includes('tailwind') || framework.includes('shadcn')) {
      await this.container.executeCommand(`cd ${project_name} && npm install -D tailwindcss postcss autoprefixer --yes`);
      await this.container.executeCommand(`cd ${project_name} && npx tailwindcss init -p`);
    }
    
    if (framework.includes('shadcn')) {
      await this.container.executeCommand(`cd ${project_name} && npx shadcn-ui@latest init --yes --style default --color ${shadcn_theme}`);
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

  private async taskAgent(params: { prompt: string; integrations: string[]; relative_file_paths: string[] }): Promise<ToolResult> {
    const { prompt, integrations, relative_file_paths } = params;
    
    console.log(`🤖 Task Agent: ${prompt}`);
    
    // For now, we'll simulate the task agent by returning a structured response
    // In a real implementation, this would launch an actual agent
    return {
      success: true,
      output: `Task Agent completed: ${prompt}\n\nAgent Report:\n- Analyzed ${relative_file_paths.length} files\n- Used integrations: ${integrations.join(', ')}\n- Task completed successfully`,
      metadata: {
        prompt,
        integrations,
        files: relative_file_paths,
        isTaskAgent: true
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
    
    // Simulate glob search by getting all files and filtering
    const allFiles = await this.container.getAllFiles();
    const filteredFiles = allFiles.filter(file => {
      // Simple pattern matching (in a real implementation, use a proper glob library)
      const matchesPattern = pattern === '*' || file.path.includes(pattern.replace('*', ''));
      const excludeMatch = exclude_pattern ? file.path.includes(exclude_pattern.replace('*', '')) : false;
      return matchesPattern && !excludeMatch;
    });
    
    return {
      success: true,
      output: filteredFiles.map(f => f.path).join('\n'),
      metadata: {
        pattern,
        excludePattern: exclude_pattern,
        matchCount: filteredFiles.length
      }
    };
  }

  private async grep(params: { query: string; case_sensitive: boolean; include_pattern: string; exclude_pattern: string }): Promise<ToolResult> {
    const { query, case_sensitive, include_pattern, exclude_pattern } = params;
    
    const allFiles = await this.container.getAllFiles();
    const results: string[] = [];
    
    for (const file of allFiles) {
      // Filter by file patterns
      if (include_pattern && !file.path.includes(include_pattern.replace('*', ''))) continue;
      if (exclude_pattern && file.path.includes(exclude_pattern.replace('*', ''))) continue;
      
      const content = file.content;
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const searchLine = case_sensitive ? line : line.toLowerCase();
        const searchQuery = case_sensitive ? query : query.toLowerCase();
        
        if (searchLine.includes(searchQuery)) {
          results.push(`${file.path}:${index + 1}:${line}`);
        }
      });
      
      if (results.length >= 50) break; // Cap at 50 results
    }
    
    return {
      success: true,
      output: results.join('\n'),
      metadata: {
        query,
        caseSensitive: case_sensitive,
        matchCount: results.length
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
    
    // For now, simulate web search results
    const simulatedResults = [
      `Search results for "${search_term}":`,
      `1. ${search_term} documentation - Official docs`,
      `2. ${search_term} tutorial - Learn the basics`,
      `3. ${search_term} examples - Code samples`,
      `4. ${search_term} best practices - Tips and tricks`
    ].join('\n');
    
    return {
      success: true,
      output: simulatedResults,
      metadata: {
        searchTerm: search_term,
        resultCount: 4,
        isSimulated: true
      }
    };
  }

  private async webScrape(params: { url: string; selector?: string }): Promise<ToolResult> {
    const { url, selector } = params;
    
    console.log(`🕷️ Web scrape: ${url}`);
    
    // For now, simulate web scraping
    const simulatedContent = `Scraped content from ${url}${selector ? ` (selector: ${selector})` : ''}:\n\nThis is simulated scraped content. In a real implementation, this would fetch and parse the actual webpage.`;
    
    return {
      success: true,
      output: simulatedContent,
      metadata: {
        url,
        selector,
        isSimulated: true
      }
    };
  }

  private async deploy(params: { project_directory: string; platform: string; config?: any }): Promise<ToolResult> {
    const { project_directory, platform, config: _config } = params;
    
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
    
    // Simulate deployment
    const deploymentUrl = `https://${project_directory.replace(/[^a-z0-9]/g, '-')}.${platform}.app`;
    
    return {
      success: true,
      output: `Project deployed successfully!\nURL: ${deploymentUrl}\nPlatform: ${platform}`,
      metadata: {
        platform,
        projectDirectory: project_directory,
        deploymentUrl,
        isSimulated: true,
        isRealContainer: true
      }
    };
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
}