export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  appIdea?: AppIdea;
  structured?: StructuredAgentOutput;
  metadata?: {
    files?: string[];
    deploymentUrl?: string;
    error?: string;
    thinking?: boolean;
    toolExecutions?: ToolExecution[];
    agentActions?: AgentAction[];
  };
}

export interface ToolExecution {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  result: ToolResult;
  timestamp: Date;
  duration: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AgentAction {
  id: string;
  type: 'tool_use' | 'file_operation' | 'analysis' | 'planning' | 'execution';
  description: string;
  timestamp: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  details?: Record<string, any>;
}

export interface AgentThought {
  id: string;
  content: string;
  type: 'analysis' | 'planning' | 'decision' | 'observation';
  timestamp: Date;
  relatedActions?: string[];
}

export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  type: 'file' | 'directory';
  children?: ProjectFile[];
  modified: Date;
  size: number;
}

export interface DeploymentConfig {
  platform: 'glitch' | 'replit' | 'render' | 'vercel' | 'netlify';
  projectId?: string;
  url?: string;
  apiKey?: string;
  environment?: Record<string, string>;
  buildCommand?: string;
  startCommand?: string;
  installCommand?: string;
}

export interface DeploymentStatus {
  id: string;
  status: 'pending' | 'building' | 'deployed' | 'failed' | 'idle';
  url?: string;
  error?: string;
  logs: string[];
  timestamp: Date;
  platform: string;
}

export interface AgentCapabilities {
  canCreateFiles: boolean;
  canEditFiles: boolean;
  canDeleteFiles: boolean;
  canInstallDependencies: boolean;
  canDeploy: boolean;
  canAccessNetwork: boolean;
  canRunCommands: boolean;
  canUseTools: boolean;
  canAnalyzeCode: boolean;
  canSearchWeb: boolean;
  canCreateDiagrams: boolean;
}

export interface AgentState {
  isThinking: boolean;
  isDeploying: boolean;
  isBuilding: boolean;
  isExecutingTool: boolean;
  currentTask?: string;
  currentTool?: string;
  capabilities: AgentCapabilities;
  contextFiles: string[];
  memoryStore: Record<string, any>;
  thoughts: AgentThought[];
  actionHistory: AgentAction[];
  toolHistory: ToolExecution[];
}

export interface BuildError {
  file: string;
  line: number;
  column: number;
  message: string;
  type: 'error' | 'warning';
  code?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  files: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  framework: 'react' | 'vue' | 'angular' | 'svelte' | 'vanilla';
}

export interface AIAgentResponse {
  files: {
    create?: Record<string, string>;
    update?: Record<string, string>;
    delete?: string[];
  };
  commands?: string[];
  dependencies?: {
    add?: Record<string, string>;
    remove?: string[];
  };
  deployment?: {
    platform: string;
    config: Record<string, any>;
  };
  explanation?: string;
  errors?: BuildError[];
  toolCalls?: ToolCall[];
  thoughts?: string[];
  nextActions?: string[];
}

export interface ToolCall {
  tool: string;
  parameters: Record<string, any>;
  reasoning: string;
}

export interface ContainerConstraints {
  nodeVersion: string;
  memoryLimit: string;
  cpuLimit: string;
  diskSpace: string;
  networkTimeout: number;
  ephemeralStorage: boolean;
  supportedPackages: string[];
  restrictions: string[];
}

export interface RuntimeEnvironment {
  platform: string;
  constraints: ContainerConstraints;
  environmentVariables: Record<string, string>;
  supportedLanguages: string[];
  buildTools: string[];
}

export interface ErrorContext {
  file?: string;
  line?: number;
  column?: number;
  function?: string;
  stack?: string;
  buildStep?: string;
  deploymentPhase?: string;
}

export interface StructuredAgentOutput {
  action: 'create_app' | 'update_app' | 'deploy' | 'fix_error' | 'explain';
  files: Record<string, string>;
  commands: string[];
  dependencies: Record<string, string>;
  deployment: {
    platform: string;
    url?: string;
    config: Record<string, any>;
  };
  logs: string[];
  explanation: string;
  nextSteps?: string[];
}

export interface AppIdea {
  description: string;
  features: string[];
  framework: string;
  styling: string;
  complexity: 'simple' | 'medium' | 'complex';
  category: 'productivity' | 'entertainment' | 'utility' | 'business' | 'educational';
}

export interface LiveSession {
  id: string;
  userId: string;
  projectId: string;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
  participants: string[];
  sharedState: Record<string, any>;
}

export interface ContainerEnvironment {
  id: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  capabilities: string[];
  workingDirectory: string;
  environmentVariables: Record<string, string>;
  installedPackages: string[];
  runningProcesses: ProcessInfo[];
}

export interface ProcessInfo {
  pid: number;
  command: string;
  status: 'running' | 'stopped' | 'error';
  port?: number;
  logs: string[];
}

export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStep: number;
  results: Record<string, any>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'tool_use' | 'analysis' | 'file_operation' | 'command' | 'decision';
  description: string;
  parameters: Record<string, any>;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
} 