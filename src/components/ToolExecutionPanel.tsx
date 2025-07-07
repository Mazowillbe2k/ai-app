import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Code, 
  Search, 
  FileText, 
  Folder, 
  Settings, 
  Globe, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Loader2,
  Brain,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useAppStore } from '../store';
import type { ToolExecution, AgentThought, AgentAction } from '../types';

interface ToolExecutionPanelProps {
  onToolExecute?: (tool: string, params: any) => void;
}

export function ToolExecutionPanel({ onToolExecute }: ToolExecutionPanelProps) {
  const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set());
  const [showThoughts, setShowThoughts] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { 
    toolExecutions, 
    activeToolExecution,
    agent,
    showAgentThoughts,
    showToolExecutions,
    toggleAgentThoughts,
    toggleToolExecutions,
    clearToolHistory
  } = useAppStore();

  // Auto-scroll to bottom when new executions are added
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [toolExecutions, agent.thoughts, autoScroll]);

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'codebase_search': return <Search className="w-4 h-4" />;
      case 'read_file': return <FileText className="w-4 h-4" />;
      case 'run_terminal_cmd': return <Terminal className="w-4 h-4" />;
      case 'list_dir': return <Folder className="w-4 h-4" />;
      case 'grep_search': return <Search className="w-4 h-4" />;
      case 'edit_file': return <Code className="w-4 h-4" />;
      case 'search_replace': return <Code className="w-4 h-4" />;
      case 'file_search': return <FileText className="w-4 h-4" />;
      case 'delete_file': return <Trash2 className="w-4 h-4" />;
      case 'web_search': return <Globe className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: ToolExecution['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const toggleExecution = (id: string) => {
    const newExpanded = new Set(expandedExecutions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedExecutions(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const renderToolExecution = (execution: ToolExecution) => {
    const isExpanded = expandedExecutions.has(execution.id);
    const isActive = activeToolExecution?.id === execution.id;

    return (
      <div 
        key={execution.id}
        className={`border rounded-lg mb-3 transition-all duration-200 ${
          isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 
          'border-gray-200 dark:border-gray-700'
        }`}
      >
        <div 
          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
          onClick={() => toggleExecution(execution.id)}
        >
          <div className="flex items-center gap-2 flex-1">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {getToolIcon(execution.toolName)}
            <span className="font-medium text-gray-900 dark:text-white">
              {execution.toolName}
            </span>
            {getStatusIcon(execution.status)}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{formatDuration(execution.duration)}</span>
            <span>{execution.timestamp.toLocaleTimeString()}</span>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-3">
            {/* Parameters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Parameters</h4>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(execution.parameters, null, 2))}
                  className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify(execution.parameters, null, 2)}
              </pre>
            </div>

            {/* Result */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Result</h4>
                <button
                  onClick={() => copyToClipboard(execution.result.output)}
                  className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className={`p-2 rounded text-xs ${
                execution.result.success 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              }`}>
                <pre className="whitespace-pre-wrap overflow-x-auto">
                  {execution.result.success ? execution.result.output : execution.result.error}
                </pre>
              </div>
            </div>

            {/* Metadata */}
            {execution.result.metadata && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Metadata</h4>
                <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(execution.result.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAgentThought = (thought: AgentThought) => {
    const typeColors = {
      analysis: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200',
      planning: 'bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200',
      decision: 'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200',
      observation: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
    };

    return (
      <div key={thought.id} className={`p-3 rounded-lg mb-2 ${typeColors[thought.type]}`}>
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wide">
            {thought.type}
          </span>
          <span className="text-xs opacity-75">
            {thought.timestamp.toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm">{thought.content}</p>
      </div>
    );
  };

  const renderAgentAction = (action: AgentAction) => {
    const statusColors = {
      pending: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200',
      in_progress: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200',
      completed: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200',
      failed: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
    };

    return (
      <div key={action.id} className={`p-3 rounded-lg mb-2 ${statusColors[action.status]}`}>
        <div className="flex items-center gap-2 mb-1">
          <Play className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wide">
            {action.type}
          </span>
          <span className="text-xs opacity-75">
            {action.timestamp.toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm font-medium">{action.description}</p>
        {action.details && (
          <pre className="text-xs mt-2 opacity-75">
            {JSON.stringify(action.details, null, 2)}
          </pre>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Agent Activity</h2>
          {agent.isExecutingTool && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Executing {agent.currentTool}...</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAgentThoughts}
            className={`p-2 rounded-md transition-colors ${
              showAgentThoughts 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Toggle agent thoughts"
          >
            <Brain className="w-4 h-4" />
          </button>
          
          <button
            onClick={toggleToolExecutions}
            className={`p-2 rounded-md transition-colors ${
              showToolExecutions 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Toggle tool executions"
          >
            <Terminal className="w-4 h-4" />
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-2 rounded-md transition-colors ${
              autoScroll 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Toggle auto-scroll"
          >
            {autoScroll ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <button
            onClick={clearToolHistory}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-red-500"
            title="Clear history"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {toolExecutions.length}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Tools Used</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {agent.thoughts.length}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Thoughts</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {agent.actionHistory.length}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Actions</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Agent Status */}
        {(agent.isThinking || agent.isExecutingTool || agent.isDeploying || agent.isBuilding) && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Agent Status: {
                  agent.isThinking ? 'Thinking' :
                  agent.isExecutingTool ? `Executing ${agent.currentTool}` :
                  agent.isDeploying ? 'Deploying' :
                  agent.isBuilding ? 'Building' : 'Active'
                }
              </span>
            </div>
            {agent.currentTask && (
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                {agent.currentTask}
              </p>
            )}
          </div>
        )}

        {/* Recent Thoughts */}
        {showAgentThoughts && agent.thoughts.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Agent Thoughts
            </h3>
            <div className="space-y-2">
              {agent.thoughts.slice(-5).map(renderAgentThought)}
            </div>
          </div>
        )}

        {/* Recent Actions */}
        {agent.actionHistory.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Recent Actions
            </h3>
            <div className="space-y-2">
              {agent.actionHistory.slice(-3).map(renderAgentAction)}
            </div>
          </div>
        )}

        {/* Tool Executions */}
        {showToolExecutions && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Tool Executions
            </h3>
            {toolExecutions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Terminal className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No tool executions yet</p>
                <p className="text-xs mt-1">Agent will use tools autonomously</p>
              </div>
            ) : (
              <div className="space-y-1">
                {toolExecutions.slice(-10).map(renderToolExecution)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 