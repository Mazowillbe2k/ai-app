import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Code, 
  Eye, 
  Rocket, 
  Settings, 
  Download, 
  Moon, 
  Sun, 
  Terminal,
  Wrench,
  Box,
  Activity
} from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import { FileEditor } from './components/FileEditor';
import Preview from './components/Preview';
import { DeploymentPanel } from './components/DeploymentPanel';
import { ToolExecutionPanel } from './components/ToolExecutionPanel';
import { ContainerEnvironment } from './components/ContainerEnvironment';
import { useStore } from './store';
import { agenticAI } from './services/agenticAI';

type Tab = 'chat' | 'editor' | 'preview' | 'deploy' | 'tools' | 'container';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const { 
    messages, 
    files, 
    agentStatus, 
    deploymentStatus, 
    toolExecutions, 
    agentActions, 
    currentProject 
  } = useStore();

  useEffect(() => {
    // Initialize the app
    document.documentElement.classList.toggle('dark', isDarkMode);
    
    // Initialize AI agent callbacks for real-time updates
    agenticAI.setCallbacks({
      onThought: (thought) => {
        useStore.getState().addAgentThought(thought);
      },
      onAction: (action) => {
        useStore.getState().addAgentAction(action);
      },
      onToolExecution: (execution) => {
        useStore.getState().addToolExecution(execution);
      }
    });

    // Set project files for tool operations
    agenticAI.setProjectFiles(files);
    
    setIsInitialized(true);
  }, [isDarkMode, files]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const exportProject = () => {
    const projectData = {
      files,
      messages,
      deploymentStatus,
      toolExecutions,
      agentActions,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-agent-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTabIcon = (tab: Tab) => {
    switch (tab) {
      case 'chat': return <MessageSquare className="w-4 h-4" />;
      case 'editor': return <Code className="w-4 h-4" />;
      case 'preview': return <Eye className="w-4 h-4" />;
      case 'deploy': return <Rocket className="w-4 h-4" />;
      case 'tools': return <Wrench className="w-4 h-4" />;
      case 'container': return <Terminal className="w-4 h-4" />;
      default: return <Box className="w-4 h-4" />;
    }
  };

  const getTabLabel = (tab: Tab) => {
    switch (tab) {
      case 'chat': return 'Chat';
      case 'editor': return 'Editor';
      case 'preview': return 'Preview';
      case 'deploy': return 'Deploy';
      case 'tools': return 'Agent Tools';
      case 'container': return 'Container';
      default: return 'Unknown';
    }
  };

  const getTabBadge = (tab: Tab) => {
    switch (tab) {
      case 'chat':
        return messages.length > 0 ? messages.length : null;
      case 'editor':
        return files.length > 0 ? files.length : null;
      case 'deploy':
        return deploymentStatus === 'deployed' ? '✓' : null;
      case 'tools':
        return toolExecutions.length > 0 ? toolExecutions.length : null;
      case 'container':
        return agentStatus === 'working' ? '●' : null;
      default:
        return null;
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Initializing AI Agent Platform...</p>
          <p className="text-gray-400 text-sm mt-2">Setting up container environment and tool integrations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  AI Agent Platform
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Autonomous development with real container environment
                </p>
              </div>
            </div>
            
            {/* Agent Status */}
            <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
              <div className={`w-2 h-2 rounded-full ${
                agentStatus === 'working' ? 'bg-green-500 animate-pulse' : 
                agentStatus === 'thinking' ? 'bg-yellow-500 animate-pulse' : 
                'bg-gray-400'
              }`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {agentStatus === 'working' ? 'Agent Working' : 
                 agentStatus === 'thinking' ? 'Agent Thinking' : 
                 'Agent Ready'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Container Status */}
            <div className="flex items-center space-x-2 bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full">
              <Terminal className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Container Live
              </span>
            </div>
            
            {/* Project Info */}
            {currentProject && (
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {currentProject}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  React • {files.length} files
                </p>
              </div>
            )}
            
            <button
              onClick={exportProject}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Export project"
            >
              <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            
            <button
              onClick={toggleDarkMode}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Toggle dark mode"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Navigation */}
          <div className="p-4 space-y-2">
            {(['chat', 'editor', 'preview', 'deploy', 'tools', 'container'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {getTabIcon(tab)}
                  <span className="font-medium">{getTabLabel(tab)}</span>
                </div>
                {getTabBadge(tab) && (
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    activeTab === tab
                      ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {getTabBadge(tab)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Messages</span>
                <span className="font-medium text-gray-900 dark:text-white">{messages.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Files</span>
                <span className="font-medium text-gray-900 dark:text-white">{files.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Tool Executions</span>
                <span className="font-medium text-gray-900 dark:text-white">{toolExecutions.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Agent Actions</span>
                <span className="font-medium text-gray-900 dark:text-white">{agentActions.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' && <ChatInterface />}
          {activeTab === 'editor' && <FileEditor />}
          {activeTab === 'preview' && <Preview />}
          {activeTab === 'deploy' && <DeploymentPanel />}
          {activeTab === 'tools' && <ToolExecutionPanel />}
          {activeTab === 'container' && <ContainerEnvironment />}
        </div>
      </div>
    </div>
  );
}

export default App;
