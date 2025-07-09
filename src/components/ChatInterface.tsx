import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Code, Zap, Brain, Terminal, CheckCircle, AlertCircle, Clock, FileText, FolderOpen, Edit3, Play } from 'lucide-react';
import { useStore } from '../store';
import { agenticAI } from '../services/agenticAI';
import type { AppIdea, AgentThought, AgentAction, ToolExecution, ProjectFile } from '../types';

interface ThinkingBubble {
  id: string;
  content: string;
  startTime: number;
  duration?: number;
  status: 'thinking' | 'completed';
}

interface ToolSummary {
  id: string;
  description: string;
  files: string[];
  duration: number;
  status: 'completed' | 'running' | 'failed';
  toolName?: string;
  screenshot?: string;
  metadata?: {
    url?: string;
    title?: string;
    description?: string;
    image?: string;
    favicon?: string;
  };
}

export default function ChatInterface() {
  const { 
    messages, 
    files, 
    agentStatus, 
    toolExecutions, 
    agentThoughts, 
    agentActions,
    addMessage, 
    setFiles, 
    setAgentStatus, 
    addToolExecution,
    addAgentThought,
    addAgentAction,
    setPreviewUrl,
    updateMessage
  } = useStore();

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentThought, setCurrentThought] = useState<string>('');
  const [currentAction, setCurrentAction] = useState<string>('');
  const [thinkingBubbles, setThinkingBubbles] = useState<ThinkingBubble[]>([]);
  const [toolSummaries, setToolSummaries] = useState<ToolSummary[]>([]);
  const [activeCodeEdit, setActiveCodeEdit] = useState<string | null>(null);
  const [streamingThinkingBubble, setStreamingThinkingBubble] = useState<ThinkingBubble | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingBubbles, toolSummaries, streamingThinkingBubble]);

  // Set up agent callbacks for real-time updates
  useEffect(() => {
    agenticAI.setCallbacks({
      onThought: (thought: AgentThought) => {
        addAgentThought(thought);
        
        // Create thinking bubble
        const bubble: ThinkingBubble = {
          id: thought.id,
          content: thought.content,
          startTime: Date.now(),
          status: 'thinking'
        };
        setThinkingBubbles(prev => [...prev, bubble]);
        
        // Complete thinking bubble after a delay
        setTimeout(() => {
          setThinkingBubbles(prev => prev.map(b => 
            b.id === thought.id 
              ? { ...b, status: 'completed', duration: Date.now() - b.startTime }
              : b
          ));
        }, Math.random() * 3000 + 2000); // 2-5 seconds
      },
      onAction: (action: AgentAction) => {
        addAgentAction(action);
        setCurrentAction(action.description);
      },
      onToolExecution: (execution: ToolExecution) => {
        addToolExecution(execution);
        
        // Create tool summary with enhanced information
        if (execution.status === 'completed' || execution.status === 'failed') {
          const getDetailedDescription = (toolName: string, result: any, parameters: any) => {
            switch (toolName) {
              case 'startup':
                return `Created ${parameters?.project_name || 'project'} with ${parameters?.framework || 'React'} framework`;
              case 'edit_file':
                return `Edited ${parameters?.relative_file_path || 'file'} - ${parameters?.instructions || 'File updated'}`;
              case 'read_file':
                return `Read ${parameters?.relative_file_path || 'file'}`;
              case 'bash':
                return `Executed: ${parameters?.command || 'command'}`;
              case 'web_scrape':
                return `Scraped ${parameters?.url || 'website'} - ${result?.metadata?.title || 'Page content extracted'}`;
              case 'browse':
                return `Browsed ${parameters?.url || 'website'} - ${result?.metadata?.title || 'Page visited'}`;
              case 'ls':
                return `Listed directory ${parameters?.relative_dir_path || parameters?.path || '.'} - ${result?.metadata?.fileCount || 0} items`;
              default:
                return `${toolName} - ${result?.output?.substring(0, 100) || 'Operation completed'}`;
            }
          };

          const getAffectedFiles = (toolName: string, result: any, parameters: any) => {
            const files = [];
            
            if (parameters?.relative_file_path) {
              files.push(parameters.relative_file_path);
            }
            if (parameters?.file_path) {
              files.push(parameters.file_path);
            }
            if (result?.metadata?.files) {
              files.push(...result.metadata.files);
            }
            if (result?.metadata?.projectName && toolName === 'startup') {
              files.push(`${result.metadata.projectName}/package.json`, `${result.metadata.projectName}/src/`);
            }
            
            return [...new Set(files)]; // Remove duplicates
          };

          const summary: ToolSummary = {
            id: execution.id,
            toolName: execution.toolName,
            description: getDetailedDescription(execution.toolName, execution.result, execution.parameters),
            files: getAffectedFiles(execution.toolName, execution.result, execution.parameters),
            duration: execution.duration,
            status: execution.status === 'completed' ? 'completed' : 'failed',
            // Include screenshot and metadata for web scraping
            screenshot: execution.toolName === 'web_scrape' ? execution.result.metadata?.screenshot : undefined,
            metadata: execution.toolName === 'web_scrape' ? execution.result.metadata : undefined
          };
          setToolSummaries(prev => [...prev, summary]);
        }
      }
    });
  }, [addAgentThought, addAgentAction, addToolExecution]);

  const parseAppIdea = (description: string): AppIdea => {
    return {
      description: description.trim(),
      features: [],
      framework: 'react',
      complexity: 'medium',
      category: 'utility',
      styling: 'tailwind'
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage = {
      type: 'user' as const,
      content: input.trim()
    };
    addMessage(userMessage);

    const currentInput = input.trim();
    setInput('');
    setIsProcessing(true);
    setAgentStatus('thinking');

    // Create AI message that will be updated with streaming content
    const aiMessageId = crypto.randomUUID();
    const initialAiMessage = {
      id: aiMessageId,
      type: 'ai' as const,
      content: '',
      timestamp: new Date()
    };
    
    // Add initial AI message to store
    addMessage({
      type: 'ai' as const,
      content: ''
    });

    // Set up streaming content tracking
    let currentAiContent = '';

    try {
      const appIdea = parseAppIdea(currentInput);
      
      // Set up streaming callbacks for real-time updates
      let isFirstChunk = true;
      
      agenticAI.setCallbacks({
        onStreamingThinking: (content, isComplete) => {
          if (!isComplete) {
            // Update streaming thinking bubble with new content
            if (streamingThinkingBubble) {
              setStreamingThinkingBubble(prev => prev ? {
                ...prev,
                content: content
              } : null);
            } else {
              // Create new streaming thinking bubble
              const newBubble: ThinkingBubble = {
                id: crypto.randomUUID(),
                content: content,
                startTime: Date.now(),
                status: 'thinking'
              };
              setStreamingThinkingBubble(newBubble);
            }
          } else {
            // Complete the streaming thinking bubble
            if (streamingThinkingBubble) {
              const completedBubble = {
                ...streamingThinkingBubble,
                content: content,
                status: 'completed' as const,
                duration: Date.now() - streamingThinkingBubble.startTime
              };
              setThinkingBubbles(prev => [...prev, completedBubble]);
              setStreamingThinkingBubble(null);
            }
          }
        },
        
        onThought: (thought) => {
          // Add thinking bubbles as they happen (for non-streaming thoughts)
          const thinkingBubble: ThinkingBubble = {
            id: thought.id,
            content: thought.content,
            startTime: Date.now(),
            status: 'thinking'
          };
          setThinkingBubbles(prev => [...prev, thinkingBubble]);
          
          // Complete previous thinking bubble
          setThinkingBubbles(prev => prev.map(bubble => 
            bubble.status === 'thinking' && bubble.id !== thought.id
              ? { ...bubble, status: 'completed', duration: Date.now() - bubble.startTime }
              : bubble
          ));
        },
        
        onAction: (action) => {
          // Update AI message content with action description
          const actionText = `\n\n🔄 **${action.type}**: ${action.description}`;
          currentAiContent += actionText;
          
          updateMessage(aiMessageId, {
            content: currentAiContent
          });
        },
        
        onToolExecution: (execution) => {
          if (execution.status === 'completed') {
            // Add tool summary
            const toolSummary: ToolSummary = {
              id: execution.id,
              description: `Executed ${execution.toolName}`,
              files: execution.parameters?.target_file ? [execution.parameters.target_file] : [],
              duration: execution.duration,
              status: 'completed'
            };
            setToolSummaries(prev => [...prev, toolSummary]);
            
            // Update AI message with tool result
            const toolText = `\n\n✅ **Tool**: ${execution.toolName} (${Math.round(execution.duration / 1000)}s)`;
            currentAiContent += toolText;
            
            updateMessage(aiMessageId, {
              content: currentAiContent
            });
          }
        }
      });

      // Start the autonomous development process
      setAgentStatus('working');
      const response = await agenticAI.generateApp(appIdea);

      // Complete all thinking bubbles
      setThinkingBubbles(prev => prev.map(bubble => 
        bubble.status === 'thinking'
          ? { ...bubble, status: 'completed', duration: Date.now() - bubble.startTime }
          : bubble
      ));

      // Get all files created by AI in the container
      const containerFiles = await agenticAI.getAllFilesFromContainer();
      
      // Convert container files to ProjectFile format for the editor
      if (containerFiles.length > 0) {
        const buildFileTree = (files: Array<{ path: string; content: string }>): ProjectFile[] => {
          const tree: Record<string, ProjectFile> = {};
          const roots: ProjectFile[] = [];

          // First pass: create all file entries
          files.forEach(file => {
            const pathParts = file.path.split('/').filter(part => part !== '');
            let currentPath = '';
            
            pathParts.forEach((part, index) => {
              const parentPath = currentPath;
              currentPath = currentPath ? `${currentPath}/${part}` : part;
              
              if (!tree[currentPath]) {
                const isFile = index === pathParts.length - 1;
                
                tree[currentPath] = {
                  id: crypto.randomUUID(),
                  name: part,
                  path: `/${currentPath}`,
                  content: isFile ? file.content : '',
                  language: isFile ? (
                    file.path.endsWith('.tsx') || file.path.endsWith('.ts') ? 'typescript' : 
                    file.path.endsWith('.css') ? 'css' : 
                    file.path.endsWith('.json') ? 'json' : 
                    file.path.endsWith('.js') || file.path.endsWith('.jsx') ? 'javascript' : 
                    file.path.endsWith('.html') ? 'html' :
                    file.path.endsWith('.md') ? 'markdown' : 'text'
                  ) : 'folder',
                  type: isFile ? 'file' : 'directory',
                  children: isFile ? undefined : [],
                  size: isFile ? file.content.length : 0,
                  modified: new Date()
                };
              }
            });
          });

          // Second pass: build the tree structure
          Object.values(tree).forEach(item => {
            const pathParts = item.path.split('/').filter(part => part !== '');
            if (pathParts.length === 1) {
              // Root level item
              roots.push(item);
            } else {
              // Find parent and add as child
              const parentPath = '/' + pathParts.slice(0, -1).join('/');
              const parent = tree[parentPath.substring(1)]; // Remove leading slash for lookup
              if (parent && parent.children) {
                parent.children.push(item);
              }
            }
          });

          // Sort directories first, then files, alphabetically
          const sortItems = (items: ProjectFile[]): ProjectFile[] => {
            return items.sort((a, b) => {
              if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            }).map(item => ({
              ...item,
              children: item.children ? sortItems(item.children) : undefined
            }));
          };

          return sortItems(roots);
        };

        const projectFiles = buildFileTree(containerFiles);
        setFiles(projectFiles);
        console.log(`📁 Loaded file tree with ${containerFiles.length} files and ${projectFiles.length} root items from WebContainer`);
      }

      // Set WebContainer preview URL - poll until available
      const checkForPreviewUrl = async () => {
        try {
          const previewUrl = await agenticAI.getDockerPreviewUrl();
          if (previewUrl) {
            setPreviewUrl(previewUrl);
            console.log(`🌐 WebContainer preview available: ${previewUrl}`);
            return true; // Found the URL
          }
        } catch (error) {
          console.warn('Failed to get WebContainer preview URL:', error);
        }
        return false; // URL not ready yet
      };

      // Check immediately
      const foundUrl = await checkForPreviewUrl();
      
      // If not found, poll every 2 seconds for up to 30 seconds
      if (!foundUrl) {
        console.log('🔍 WebContainer preview URL not ready yet, polling...');
        let attempts = 0;
        const maxAttempts = 15; // 30 seconds
        
        const pollInterval = setInterval(async () => {
          attempts++;
          const found = await checkForPreviewUrl();
          
          if (found || attempts >= maxAttempts) {
            clearInterval(pollInterval);
            if (!found) {
              console.warn('⚠️ WebContainer preview URL not available after 30 seconds');
            }
          }
        }, 2000);
      }

      // Set preview URL
      if (response.previewUrl) {
        setPreviewUrl(response.previewUrl);
      }

      // Final completion message content
      const finalContent = currentAiContent + `\n\n✅ **Development Complete!**\n\n${response.explanation}\n\n**What was accomplished:**\n${response.developmentLogs?.map(log => `• ${log}`).join('\n') || '• Development completed successfully'}\n\n**Next Steps:**\n${response.nextSteps.map(step => `• ${step}`).join('\n')}\n\n${response.previewUrl ? `🌐 **Live Preview:** ${response.previewUrl}\n\n` : ''}The AI has autonomously built your application using real container tools. You can now interact with the live application and request modifications!`;
      
      // Update the AI message with final content
      updateMessage(aiMessageId, {
        content: finalContent
      });

      setAgentStatus('idle');
    } catch (error) {
      console.error('Error generating app:', error);
      
      const errorContent = `❌ **Error during autonomous development:**\n\n${error instanceof Error ? error.message : 'An unknown error occurred'}\n\nThe AI encountered an issue while building your application. Please try again with a different approach or simpler requirements.`;
      
      updateMessage(aiMessageId, {
        content: currentAiContent + '\n\n' + errorContent
      });
      
      setAgentStatus('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderThinkingBubble = (bubble: ThinkingBubble) => {
    const isActive = bubble.status === 'thinking';
    const duration = bubble.duration ? Math.round(bubble.duration / 1000) : 0;
    
    return (
      <div key={bubble.id} className={`flex items-start space-x-3 mb-4 ${isActive ? 'opacity-100' : 'opacity-75'}`}>
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
          {isActive ? (
            <Brain className="w-4 h-4 text-white animate-pulse" />
          ) : (
            <CheckCircle className="w-4 h-4 text-white" />
          )}
        </div>
        <div className={`flex-1 p-3 rounded-lg transition-all duration-500 ${
          isActive ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 
          'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
              {isActive ? '🧠 AI is thinking...' : `💭 Thought for ${duration}s`}
            </span>
            {isActive && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-blue-600 dark:text-blue-400">Live</span>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            )}
          </div>
          {/* Only show thinking content for completed thoughts, hide for active thinking */}
          {!isActive && (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
              {bubble.content.length > 200 ? `${bubble.content.substring(0, 200)}...` : bubble.content}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderToolSummary = (summary: ToolSummary) => {
    const toolName = summary.toolName || summary.description;
    
    const getToolIcon = (toolName: string) => {
      if (toolName === 'startup') return <Play className="w-4 h-4" />;
      if (toolName === 'edit_file') return <FileText className="w-4 h-4" />;
      if (toolName === 'read_file') return <FolderOpen className="w-4 h-4" />;
      if (toolName === 'bash') return <Terminal className="w-4 h-4" />;
      if (toolName === 'web_scrape') return <Zap className="w-4 h-4" />;
      if (toolName === 'browse') return <Zap className="w-4 h-4" />;
      if (toolName === 'ls') return <FolderOpen className="w-4 h-4" />;
      return <Code className="w-4 h-4" />;
    };

    const getToolEmoji = (toolName: string) => {
      if (toolName === 'startup') return '🚀';
      if (toolName === 'edit_file') return '✏️';
      if (toolName === 'read_file') return '📖';
      if (toolName === 'bash') return '💻';
      if (toolName === 'web_scrape') return '🌐';
      if (toolName === 'browse') return '🔍';
      if (toolName === 'ls') return '📁';
      return '🛠️';
    };

    const getToolDisplayName = (toolName: string) => {
      if (toolName === 'startup') return 'Project Creation';
      if (toolName === 'edit_file') return 'File Edit';
      if (toolName === 'read_file') return 'File Read';
      if (toolName === 'bash') return 'Command Execution';
      if (toolName === 'web_scrape') return 'Web Scraping';
      if (toolName === 'browse') return 'Web Browse';
      if (toolName === 'ls') return 'Directory List';
      return toolName.charAt(0).toUpperCase() + toolName.slice(1);
    };

    return (
      <div key={summary.id} className="flex items-start space-x-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
          {getToolIcon(toolName)}
        </div>
        <div className="flex-1 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {getToolEmoji(toolName)} {getToolDisplayName(toolName)} ({Math.round(summary.duration / 1000)}s)
            </span>
            <div className="flex items-center space-x-1">
              {summary.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />}
              {summary.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />}
            </div>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            {summary.description.length > 150 ? `${summary.description.substring(0, 150)}...` : summary.description}
          </p>
          
          {/* Show screenshot thumbnail for web scraping */}
          {summary.screenshot && (
            <div className="mt-2 mb-2">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Page preview:
              </div>
              <div className="relative">
                <img 
                  src={summary.screenshot} 
                  alt="Website screenshot" 
                  className="w-full max-w-sm h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => window.open(summary.metadata?.url, '_blank')}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg" />
                <div className="absolute bottom-1 left-1 right-1 text-xs text-white bg-black/50 px-2 py-1 rounded truncate">
                  {summary.metadata?.title || summary.metadata?.url}
                </div>
              </div>
            </div>
          )}
          
          {summary.files.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Files affected ({summary.files.length}):
              </div>
              <div className="flex flex-wrap gap-1">
                {summary.files.slice(0, 5).map((file, index) => (
                  <span key={index} className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs rounded">
                    {file.length > 20 ? `...${file.slice(-20)}` : file}
                  </span>
                ))}
                {summary.files.length > 5 && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                    +{summary.files.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCodeEdit = (filePath: string, content: string) => {
    return (
      <div className="mb-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
            <Edit3 className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              📝 Code Generated
            </span>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {filePath}
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm text-gray-100">
            <code>{content}</code>
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI Agent Chat
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Autonomous development with real container environment
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            agentStatus === 'working' ? 'bg-green-500 animate-pulse' : 
            agentStatus === 'thinking' ? 'bg-yellow-500 animate-pulse' : 
            'bg-gray-400'
          }`} />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {agentStatus === 'working' ? 'Working' : 
             agentStatus === 'thinking' ? 'Thinking' : 
             'Ready'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl px-4 py-3 rounded-lg ${
              message.type === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
            }`}>
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.timestamp && (
                <div className={`text-xs mt-2 ${
                  message.type === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Real-time AI interactions */}
        {streamingThinkingBubble && renderThinkingBubble(streamingThinkingBubble)}
        {thinkingBubbles.map(renderThinkingBubble)}
        {toolSummaries.map(renderToolSummary)}
        
        {/* Current action indicator */}
        {currentAction && (
          <div className="flex items-center space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <Loader2 className="w-4 h-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
            <span className="text-sm text-yellow-700 dark:text-yellow-300">
              {currentAction}
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the app you want to build..."
            className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>{isProcessing ? 'Building...' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
} 