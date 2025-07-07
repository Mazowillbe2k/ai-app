import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { 
  ChatMessage, 
  ProjectFile, 
  DeploymentStatus, 
  AgentState, 
  BuildError,
  DeploymentConfig,
  RuntimeEnvironment,
  ToolExecution,
  AgentAction,
  AgentThought,
  ContainerEnvironment
} from '../types';

interface AppState {
  // Chat state
  messages: ChatMessage[];
  isAIThinking: boolean;
  
  // Project state
  currentProject: string | null;
  files: ProjectFile[];
  selectedFile: string | null;
  
  // Deployment state
  deployments: DeploymentStatus[];
  currentDeployment: DeploymentStatus | null;
  deploymentConfig: DeploymentConfig | null;
  deploymentStatus: 'idle' | 'deploying' | 'deployed' | 'failed';
  
  // Agent state
  agent: AgentState;
  agentStatus: 'idle' | 'thinking' | 'working' | 'error';
  agentThoughts: AgentThought[];
  agentActions: AgentAction[];
  
  // Tool execution state
  toolExecutions: ToolExecution[];
  activeToolExecution: ToolExecution | null;
  
  // Container environment
  containerEnv: ContainerEnvironment | null;
  
  // UI state
  isDarkMode: boolean;
  sidebarCollapsed: boolean;
  previewUrl: string | null;
  buildErrors: BuildError[];
  showAgentThoughts: boolean;
  showToolExecutions: boolean;
  
  // Runtime environment
  runtime: RuntimeEnvironment | null;
  
  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  
  setAIThinking: (thinking: boolean) => void;
  
  // File actions
  addFile: (file: Omit<ProjectFile, 'id' | 'modified'>) => void;
  updateFile: (id: string, updates: Partial<ProjectFile>) => void;
  deleteFile: (id: string) => void;
  selectFile: (id: string | null) => void;
  setFiles: (files: ProjectFile[]) => void;
  
  // Deployment actions
  addDeployment: (deployment: Omit<DeploymentStatus, 'id'>) => void;
  updateDeployment: (id: string, updates: Partial<DeploymentStatus>) => void;
  setCurrentDeployment: (deployment: DeploymentStatus | null) => void;
  setDeploymentConfig: (config: DeploymentConfig | null) => void;
  setDeploymentStatus: (status: 'idle' | 'deploying' | 'deployed' | 'failed') => void;
  
  // Agent actions
  updateAgent: (updates: Partial<AgentState>) => void;
  setAgentTask: (task: string | undefined) => void;
  setAgentStatus: (status: 'idle' | 'thinking' | 'working' | 'error') => void;
  addAgentThought: (thought: AgentThought) => void;
  addAgentAction: (action: AgentAction) => void;
  updateAgentAction: (id: string, updates: Partial<AgentAction>) => void;
  
  // Tool execution actions
  addToolExecution: (execution: ToolExecution) => void;
  updateToolExecution: (id: string, updates: Partial<ToolExecution>) => void;
  setActiveToolExecution: (execution: ToolExecution | null) => void;
  clearToolHistory: () => void;
  
  // Container actions
  setContainerEnv: (env: ContainerEnvironment | null) => void;
  
  // UI actions
  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  setPreviewUrl: (url: string | null) => void;
  setBuildErrors: (errors: BuildError[]) => void;
  toggleAgentThoughts: () => void;
  toggleToolExecutions: () => void;
  
  // Runtime actions
  setRuntime: (runtime: RuntimeEnvironment) => void;
  
  // Utility actions
  reset: () => void;
  clearAllData: () => void;
}

const initialAgentState: AgentState = {
  isThinking: false,
  isDeploying: false,
  isBuilding: false,
  isExecutingTool: false,
  currentTask: undefined,
  currentTool: undefined,
  capabilities: {
    canCreateFiles: true,
    canEditFiles: true,
    canDeleteFiles: true,
    canInstallDependencies: true,
    canDeploy: true,
    canAccessNetwork: true,
    canRunCommands: true,
    canUseTools: true,
    canAnalyzeCode: true,
    canSearchWeb: true,
    canCreateDiagrams: true,
  },
  contextFiles: [],
  memoryStore: {},
  thoughts: [],
  actionHistory: [],
  toolHistory: [],
};

export const useStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        messages: [],
        isAIThinking: false,
        
        currentProject: null,
        files: [],
        selectedFile: null,
        
        deployments: [],
        currentDeployment: null,
        deploymentConfig: null,
        deploymentStatus: 'idle',
        
        agent: initialAgentState,
        agentStatus: 'idle',
        agentThoughts: [],
        agentActions: [],
        
        toolExecutions: [],
        activeToolExecution: null,
        
        containerEnv: null,
        
        isDarkMode: false,
        sidebarCollapsed: false,
        previewUrl: null,
        buildErrors: [],
        showAgentThoughts: false,
        showToolExecutions: true,
        
        runtime: null,
        
        // Actions
        addMessage: (message) => {
          const newMessage: ChatMessage = {
            ...message,
            id: crypto.randomUUID(),
            timestamp: new Date(),
          };
          set((state) => ({
            messages: [...state.messages, newMessage],
          }));
        },
        
        updateMessage: (id, updates) => {
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === id ? { ...msg, ...updates } : msg
            ),
          }));
        },
        
        clearMessages: () => {
          set({ messages: [] });
        },
        
        setAIThinking: (thinking) => {
          set({ isAIThinking: thinking });
        },
        
        // File actions
        addFile: (file) => {
          const newFile: ProjectFile = {
            ...file,
            id: crypto.randomUUID(),
            modified: new Date(),
          };
          set((state) => ({
            files: [...state.files, newFile],
          }));
        },
        
        updateFile: (id, updates) => {
          set((state) => ({
            files: state.files.map((file) =>
              file.id === id ? { ...file, ...updates, modified: new Date() } : file
            ),
          }));
        },
        
        deleteFile: (id) => {
          set((state) => ({
            files: state.files.filter((file) => file.id !== id),
            selectedFile: state.selectedFile === id ? null : state.selectedFile,
          }));
        },
        
        selectFile: (id) => {
          set({ selectedFile: id });
        },
        
        setFiles: (files) => {
          set({ files });
        },
        
        // Deployment actions
        addDeployment: (deployment) => {
          const newDeployment: DeploymentStatus = {
            ...deployment,
            id: crypto.randomUUID(),
          };
          set((state) => ({
            deployments: [...state.deployments, newDeployment],
          }));
        },
        
        updateDeployment: (id, updates) => {
          set((state) => ({
            deployments: state.deployments.map((dep) =>
              dep.id === id ? { ...dep, ...updates } : dep
            ),
          }));
        },
        
        setCurrentDeployment: (deployment) => {
          set({ currentDeployment: deployment });
        },
        
        setDeploymentConfig: (config) => {
          set({ deploymentConfig: config });
        },
        
        setDeploymentStatus: (status) => {
          set({ deploymentStatus: status });
        },
        
        // Agent actions
        updateAgent: (updates) => {
          set((state) => ({
            agent: { ...state.agent, ...updates },
          }));
        },
        
        setAgentTask: (task) => {
          set((state) => ({
            agent: { ...state.agent, currentTask: task },
          }));
        },
        
        setAgentStatus: (status) => {
          set({ agentStatus: status });
        },
        
        addAgentThought: (thought) => {
          set((state) => {
            // Check if thought with this ID already exists
            const existingIndex = state.agentThoughts.findIndex(t => t.id === thought.id);
            const existingAgentIndex = state.agent.thoughts.findIndex(t => t.id === thought.id);
            
            if (existingIndex !== -1) {
              // Update existing thought instead of adding duplicate
              const updatedAgentThoughts = [...state.agentThoughts];
              updatedAgentThoughts[existingIndex] = thought;
              
              const updatedAgentThoughtHistory = [...state.agent.thoughts];
              updatedAgentThoughtHistory[existingAgentIndex] = thought;
              
              return {
                agentThoughts: updatedAgentThoughts,
                agent: {
                  ...state.agent,
                  thoughts: updatedAgentThoughtHistory,
                },
              };
            } else {
              // Add new thought
              return {
                agentThoughts: [...state.agentThoughts, thought],
                agent: {
                  ...state.agent,
                  thoughts: [...state.agent.thoughts, thought],
                },
              };
            }
          });
        },
        
        addAgentAction: (action) => {
          set((state) => {
            // Check if action with this ID already exists
            const existingIndex = state.agentActions.findIndex(a => a.id === action.id);
            const existingAgentIndex = state.agent.actionHistory.findIndex(a => a.id === action.id);
            
            if (existingIndex !== -1) {
              // Update existing action instead of adding duplicate
              const updatedAgentActions = [...state.agentActions];
              updatedAgentActions[existingIndex] = action;
              
              const updatedAgentActionHistory = [...state.agent.actionHistory];
              updatedAgentActionHistory[existingAgentIndex] = action;
              
              return {
                agentActions: updatedAgentActions,
                agent: {
                  ...state.agent,
                  actionHistory: updatedAgentActionHistory,
                },
              };
            } else {
              // Add new action
              return {
                agentActions: [...state.agentActions, action],
                agent: {
                  ...state.agent,
                  actionHistory: [...state.agent.actionHistory, action],
                },
              };
            }
          });
        },
        
        updateAgentAction: (id, updates) => {
          set((state) => ({
            agentActions: state.agentActions.map((action) =>
              action.id === id ? { ...action, ...updates } : action
            ),
            agent: {
              ...state.agent,
              actionHistory: state.agent.actionHistory.map((action) =>
                action.id === id ? { ...action, ...updates } : action
              ),
            },
          }));
        },
        
        // Tool execution actions
        addToolExecution: (execution) => {
          set((state) => {
            // Check if execution with this ID already exists
            const existingIndex = state.toolExecutions.findIndex(exec => exec.id === execution.id);
            const existingAgentIndex = state.agent.toolHistory.findIndex(exec => exec.id === execution.id);
            
            if (existingIndex !== -1) {
              // Update existing execution instead of adding duplicate
              const updatedToolExecutions = [...state.toolExecutions];
              updatedToolExecutions[existingIndex] = execution;
              
              const updatedAgentToolHistory = [...state.agent.toolHistory];
              updatedAgentToolHistory[existingAgentIndex] = execution;
              
              return {
                toolExecutions: updatedToolExecutions,
                agent: {
                  ...state.agent,
                  toolHistory: updatedAgentToolHistory,
                },
              };
            } else {
              // Add new execution
              return {
                toolExecutions: [...state.toolExecutions, execution],
                agent: {
                  ...state.agent,
                  toolHistory: [...state.agent.toolHistory, execution],
                },
              };
            }
          });
        },
        
        updateToolExecution: (id, updates) => {
          set((state) => {
            const toolExecIndex = state.toolExecutions.findIndex(exec => exec.id === id);
            const agentToolIndex = state.agent.toolHistory.findIndex(exec => exec.id === id);
            
            if (toolExecIndex === -1) {
              // If execution doesn't exist, don't update anything
              console.warn(`Tool execution with ID ${id} not found for update`);
              return state;
            }
            
            const updatedToolExecutions = [...state.toolExecutions];
            updatedToolExecutions[toolExecIndex] = { ...updatedToolExecutions[toolExecIndex], ...updates };
            
            const updatedAgentToolHistory = [...state.agent.toolHistory];
            if (agentToolIndex !== -1) {
              updatedAgentToolHistory[agentToolIndex] = { ...updatedAgentToolHistory[agentToolIndex], ...updates };
            }
            
            return {
              toolExecutions: updatedToolExecutions,
              agent: {
                ...state.agent,
                toolHistory: updatedAgentToolHistory,
              },
            };
          });
        },
        
        setActiveToolExecution: (execution) => {
          set({ activeToolExecution: execution });
        },
        
        clearToolHistory: () => {
          set({
            toolExecutions: [],
            agent: {
              ...get().agent,
              toolHistory: [],
            },
          });
        },
        
        // Container actions
        setContainerEnv: (env) => {
          set({ containerEnv: env });
        },
        
        // UI actions
        toggleDarkMode: () => {
          set((state) => ({ isDarkMode: !state.isDarkMode }));
        },
        
        toggleSidebar: () => {
          set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
        },
        
        setPreviewUrl: (url) => {
          set({ previewUrl: url });
        },
        
        setBuildErrors: (errors) => {
          set({ buildErrors: errors });
        },
        
        toggleAgentThoughts: () => {
          set((state) => ({ showAgentThoughts: !state.showAgentThoughts }));
        },
        
        toggleToolExecutions: () => {
          set((state) => ({ showToolExecutions: !state.showToolExecutions }));
        },
        
        // Runtime actions
        setRuntime: (runtime) => {
          set({ runtime });
        },
        
        // Utility actions
        reset: () => {
          set({
            messages: [],
            isAIThinking: false,
            currentProject: null,
            files: [],
            selectedFile: null,
            deployments: [],
            currentDeployment: null,
            deploymentConfig: null,
            deploymentStatus: 'idle',
            agent: initialAgentState,
            agentStatus: 'idle',
            agentThoughts: [],
            agentActions: [],
            toolExecutions: [],
            activeToolExecution: null,
            containerEnv: null,
            previewUrl: null,
            buildErrors: [],
            runtime: null,
          });
        },
        
        // Clear all persisted data
        clearAllData: () => {
          localStorage.removeItem('ai-agent-store');
          get().reset();
        },
      }),
      {
        name: 'ai-agent-store',
        version: 1, // Add version to force clear old data
        partialize: (state) => ({
          // Only persist UI preferences, not actual work data
          isDarkMode: state.isDarkMode,
          sidebarCollapsed: state.sidebarCollapsed,
          showAgentThoughts: state.showAgentThoughts,
          showToolExecutions: state.showToolExecutions,
        }),
        // Clear old data when version changes
        migrate: (persistedState, version) => {
          if (version === 0) {
            // Clear all old data from version 0
            localStorage.removeItem('ai-agent-store');
            return undefined;
          }
          return persistedState;
        },
      }
    ),
    {
      name: 'ai-agent-store',
    }
  )
);

// Clear old localStorage data on import
if (typeof window !== 'undefined') {
  const storedData = localStorage.getItem('ai-agent-store');
  if (storedData) {
    try {
      const parsed = JSON.parse(storedData);
      // If old data structure exists, clear it
      if (parsed.state && (parsed.state.messages || parsed.state.files)) {
        console.log('Clearing old localStorage data...');
        localStorage.removeItem('ai-agent-store');
        window.location.reload();
      }
    } catch (error) {
      console.log('Clearing corrupted localStorage data...');
      localStorage.removeItem('ai-agent-store');
    }
  }
}

// Export aliases for convenience
export const useAppStore = useStore;
export default useStore; 