import { HfInference } from '@huggingface/inference';
import type { 
  AIAgentResponse, 
  AppIdea, 
  StructuredAgentOutput, 
  ProjectFile, 
  DeploymentConfig,
  BuildError,
  RuntimeEnvironment,
  ErrorContext
} from '../types';

// Use environment variable for API key - fallback to empty string if not set
const HF_TOKEN = import.meta.env.VITE_HUGGINGFACE_API_KEY || '';
const hf = new HfInference(HF_TOKEN);

export class AIAgentService {
  private context: Record<string, any> = {};
  private memory: Record<string, any> = {};

  constructor() {}

  // Generate a complete app from an idea
  async generateApp(idea: AppIdea): Promise<StructuredAgentOutput> {
    const systemPrompt = this.getSystemPrompt();
    const prompt = this.buildAppGenerationPrompt(idea);
    
    try {
      const response = await this.callAI(systemPrompt, prompt);
      return this.parseStructuredOutput(response);
    } catch (error) {
      console.error('AI Generation Error:', error);
      return this.handleError(error, 'app_generation');
    }
  }

  // Update an existing app based on user feedback
  async updateApp(
    currentFiles: ProjectFile[], 
    userRequest: string, 
    context?: string
  ): Promise<StructuredAgentOutput> {
    const systemPrompt = this.getSystemPrompt();
    const prompt = this.buildUpdatePrompt(currentFiles, userRequest, context);
    
    try {
      const response = await this.callAI(systemPrompt, prompt);
      return this.parseStructuredOutput(response);
    } catch (error) {
      console.error('AI Update Error:', error);
      return this.handleError(error, 'app_update');
    }
  }

  // Fix errors autonomously
  async fixErrors(
    files: ProjectFile[], 
    errors: BuildError[], 
    deploymentLogs?: string[]
  ): Promise<StructuredAgentOutput> {
    const systemPrompt = this.getSystemPrompt();
    const prompt = this.buildErrorFixPrompt(files, errors, deploymentLogs);
    
    try {
      const response = await this.callAI(systemPrompt, prompt);
      return this.parseStructuredOutput(response);
    } catch (error) {
      console.error('AI Fix Error:', error);
      return this.handleError(error, 'error_fix');
    }
  }

  // Generate deployment configuration
  async generateDeploymentConfig(
    files: ProjectFile[], 
    runtime: RuntimeEnvironment
  ): Promise<DeploymentConfig> {
    const systemPrompt = this.getSystemPrompt();
    const prompt = this.buildDeploymentPrompt(files, runtime);
    
    try {
      const response = await this.callAI(systemPrompt, prompt);
      return this.parseDeploymentConfig(response);
    } catch (error) {
      console.error('AI Deployment Config Error:', error);
      // Return default config if AI fails
      return {
        platform: 'render',
        buildCommand: 'npm run build',
        startCommand: 'npm run preview',
        installCommand: 'npm install',
        environment: {}
      };
    }
  }

  // Explain what the agent is doing
  async explain(action: string, context: any): Promise<string> {
    const systemPrompt = "You are an AI assistant that explains technical processes in simple terms.";
    const prompt = `
      Explain what you're doing in simple terms:
      Action: ${action}
      Context: ${JSON.stringify(context, null, 2)}
      
      Provide a clear, concise explanation for the user.
    `;

    try {
      const response = await this.callAI(systemPrompt, prompt);
      return response.trim();
    } catch (error) {
      console.error('AI Explanation Error:', error);
      return `Working on: ${action}`;
    }
  }

  // Store context for continuity
  setContext(key: string, value: any) {
    this.context[key] = value;
  }

  // Store memory for learning
  setMemory(key: string, value: any) {
    this.memory[key] = value;
  }

  // Private methods
  private getSystemPrompt(): string {
    return `You are an autonomous AI software engineer capable of creating, updating, and deploying complete web applications. 

KEY CAPABILITIES:
- Generate production-ready React applications with TypeScript, Vite, and Tailwind CSS
- Create real, working code - no placeholders or mock data
- Handle the full development lifecycle from idea to deployment
- Autonomously fix errors and optimize applications
- Deploy to cloud platforms (Render, Vercel, Netlify, Glitch, Replit)

CRITICAL REQUIREMENTS:
1. ALWAYS return valid JSON in the specified format
2. Generate complete, working applications
3. Use modern best practices and patterns
4. Include proper error handling and TypeScript types
5. Create responsive, accessible UIs
6. Ensure production-ready code quality

RESPONSE FORMAT:
Always respond with valid JSON in this exact structure:
{
  "action": "create_app" | "update_app" | "fix_error" | "deploy" | "explain",
  "files": {
    "filename": "complete_file_content"
  },
  "commands": ["npm install", "npm run build"],
  "dependencies": {
    "package_name": "version"
  },
  "deployment": {
    "platform": "render" | "vercel" | "netlify" | "glitch" | "replit",
    "config": {}
  },
  "logs": ["action taken"],
  "explanation": "clear explanation of what was done",
  "nextSteps": ["suggested next actions"]
}

You are operating in a live environment where users can see real-time updates and deployed applications.`;
  }

  private buildAppGenerationPrompt(idea: AppIdea): string {
    return `Generate a complete, production-ready ${idea.framework} application based on this idea:

**App Idea**: ${idea.description}
**Features**: ${idea.features.join(', ')}
**Framework**: ${idea.framework}
**Styling**: ${idea.styling}
**Complexity**: ${idea.complexity}
**Category**: ${idea.category}

REQUIREMENTS:
1. Create ALL necessary files (package.json, src/, public/, config files)
2. Use React 19, Vite, TypeScript, and Tailwind CSS
3. Implement ALL requested features with working functionality
4. Include proper error handling and loading states
5. Make it responsive and accessible
6. Add TypeScript types for everything
7. Include proper routing if needed
8. Add state management if complex
9. Include proper build configuration
10. Make it deployment-ready

Generate the complete application now as JSON:`;
  }

  private buildUpdatePrompt(files: ProjectFile[], userRequest: string, context?: string): string {
    const filesList = files.map(f => `${f.path}:\n${f.content}`).join('\n\n---\n\n');
    
    return `Update the existing application based on this request:

**Current Files**:
${filesList}

**User Request**: ${userRequest}
**Context**: ${context || 'None'}

REQUIREMENTS:
1. Only modify files that need changes
2. Preserve existing functionality unless explicitly asked to change
3. Add new features as requested
4. Update dependencies if needed
5. Maintain code quality and TypeScript types
6. Ensure the app still works after changes

Provide the complete updated files as JSON:`;
  }

  private buildErrorFixPrompt(files: ProjectFile[], errors: BuildError[], deploymentLogs?: string[]): string {
    const filesList = files.map(f => `${f.path}:\n${f.content}`).join('\n\n---\n\n');
    const errorSummary = errors.map(e => `${e.file}:${e.line} - ${e.message} (${e.type})`).join('\n');
    const logs = deploymentLogs?.join('\n') || 'No deployment logs';
    
    return `Fix these errors in the application:

**Current Files**:
${filesList}

**Build Errors**:
${errorSummary}

**Deployment Logs**:
${logs}

REQUIREMENTS:
1. Fix all errors without breaking existing functionality
2. Update dependencies if needed
3. Ensure the app builds and runs successfully
4. Maintain code quality and best practices
5. Provide clear explanation of what was fixed

Fix all errors and return the corrected files as JSON:`;
  }

  private buildDeploymentPrompt(files: ProjectFile[], runtime: RuntimeEnvironment): string {
    const filesList = files.map(f => f.path).join(', ');
    
    return `Generate optimal deployment configuration for this application:

**Runtime Environment**: ${runtime.platform}
**Constraints**: ${JSON.stringify(runtime.constraints, null, 2)}
**Files**: ${filesList}

Return deployment configuration as JSON:
{
  "platform": "render",
  "buildCommand": "npm run build",
  "startCommand": "npm run preview",
  "installCommand": "npm install",
  "environment": {}
}`;
  }

  private async callAI(systemPrompt: string, prompt: string): Promise<string> {
    try {
      const response = await hf.chatCompletion({
        model: 'Qwen/Qwen2.5-72B-Instruct',
        messages: [{
          role: 'system',
          content: systemPrompt
        }, {
          role: 'user',
          content: prompt
        }],
        max_tokens: 4000,
        temperature: 0.9,
        top_p: 0.7
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Hugging Face API Error:', error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseStructuredOutput(response: string): StructuredAgentOutput {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action || 'explain',
        files: parsed.files || {},
        commands: parsed.commands || [],
        dependencies: parsed.dependencies || {},
        deployment: parsed.deployment || { platform: 'render', config: {} },
        logs: parsed.logs || [],
        explanation: parsed.explanation || '',
        nextSteps: parsed.nextSteps || []
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      // Return a fallback response
      return {
        action: 'explain',
        files: {},
        commands: [],
        dependencies: {},
        deployment: { platform: 'render', config: {} },
        logs: [`Error parsing AI response: ${error}`],
        explanation: 'I encountered an error processing your request. Please try again.',
        nextSteps: []
      };
    }
  }

  private parseDeploymentConfig(response: string): DeploymentConfig {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        platform: parsed.platform || 'render',
        buildCommand: parsed.buildCommand || 'npm run build',
        startCommand: parsed.startCommand || 'npm run preview',
        installCommand: parsed.installCommand || 'npm install',
        environment: parsed.environment || {}
      };
    } catch (error) {
      console.error('Error parsing deployment config:', error);
      return {
        platform: 'render',
        buildCommand: 'npm run build',
        startCommand: 'npm run preview',
        installCommand: 'npm install',
        environment: {}
      };
    }
  }

  private handleError(error: any, context: string): StructuredAgentOutput {
    return {
      action: 'explain',
      files: {},
      commands: [],
      dependencies: {},
      deployment: { platform: 'render', config: {} },
      logs: [`Error in ${context}: ${error.message || error}`],
      explanation: `I encountered an error during ${context}. Please try again or provide more details.`,
      nextSteps: ['Review error details', 'Try alternative approach']
    };
  }
}

export const aiAgent = new AIAgentService(); 