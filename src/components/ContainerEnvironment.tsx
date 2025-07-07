import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Play, Square, Trash2, RefreshCw, Folder, File, Settings, Download } from 'lucide-react';
import { useStore } from '../store';
import { agenticAI } from '../services/agenticAI';

interface TerminalSession {
  id: string;
  name: string;
  isActive: boolean;
  workingDir: string;
  history: TerminalLine[];
}

interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error';
  content: string;
  timestamp: Date;
  exitCode?: number;
}

interface ProcessInfo {
  pid: number;
  command: string;
  status: 'running' | 'stopped';
  port?: number;
  startTime: Date;
}

export function ContainerEnvironment() {
  const [sessions, setSessions] = useState<TerminalSession[]>([
    {
      id: 'main',
      name: 'Main Terminal',
      isActive: true,
      workingDir: '/workspace',
      history: [
        {
          id: '1',
          type: 'output',
          content: 'Welcome to AI Agent Container Environment',
          timestamp: new Date()
        },
        {
          id: '2',
          type: 'output',
          content: 'Container ready for autonomous development',
          timestamp: new Date()
        }
      ]
    }
  ]);
  
  const [activeSessionId, setActiveSessionId] = useState('main');
  const [currentCommand, setCurrentCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [containerStats, setContainerStats] = useState({
    cpu: 15,
    memory: 45,
    disk: 23,
    network: 'Connected'
  });
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  useEffect(() => {
    // Auto-scroll terminal
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [activeSession?.history]);

  useEffect(() => {
    // Focus input when component mounts
    inputRef.current?.focus();
  }, []);

  const addTerminalLine = (sessionId: string, line: Omit<TerminalLine, 'id'>) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? {
            ...session,
            history: [...session.history, { ...line, id: crypto.randomUUID() }]
          }
        : session
    ));
  };

  const executeCommand = async (command: string) => {
    if (!command.trim() || isExecuting) return;

    setIsExecuting(true);
    
    // Add command to history
    addTerminalLine(activeSessionId, {
      type: 'command',
      content: `$ ${command}`,
      timestamp: new Date()
    });

    try {
      // Execute command through AI agent's container interface
      const result = await agenticAI.executeInContainer(command);
      
      // Add output to history
      if (result.output) {
        addTerminalLine(activeSessionId, {
          type: 'output',
          content: result.output,
          timestamp: new Date(),
          exitCode: result.exitCode
        });
      }
      
      if (result.error) {
        addTerminalLine(activeSessionId, {
          type: 'error',
          content: result.error,
          timestamp: new Date(),
          exitCode: result.exitCode
        });
      }

      // Handle special commands that start processes
      if (command.includes('npm run dev') || command.includes('vite')) {
        const newProcess: ProcessInfo = {
          pid: Math.floor(Math.random() * 10000) + 1000,
          command: command,
          status: 'running',
          port: 5173,
          startTime: new Date()
        };
        setProcesses(prev => [...prev, newProcess]);
      }

      // Update working directory if cd command
      if (command.startsWith('cd ')) {
        const newDir = command.substring(3).trim();
        setSessions(prev => prev.map(session => 
          session.id === activeSessionId 
            ? { ...session, workingDir: newDir || '/workspace' }
            : session
        ));
      }

    } catch (error) {
      addTerminalLine(activeSessionId, {
        type: 'error',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        exitCode: 1
      });
    } finally {
      setIsExecuting(false);
      setCurrentCommand('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(currentCommand);
    }
  };

  const createNewSession = () => {
    const newSession: TerminalSession = {
      id: crypto.randomUUID(),
      name: `Terminal ${sessions.length + 1}`,
      isActive: false,
      workingDir: '/workspace',
      history: [
        {
          id: crypto.randomUUID(),
          type: 'output',
          content: 'New terminal session started',
          timestamp: new Date()
        }
      ]
    };
    
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSession.id);
  };

  const killProcess = (pid: number) => {
    setProcesses(prev => prev.map(proc => 
      proc.pid === pid ? { ...proc, status: 'stopped' as const } : proc
    ));
    
    addTerminalLine(activeSessionId, {
      type: 'output',
      content: `Process ${pid} terminated`,
      timestamp: new Date()
    });
  };

  const clearTerminal = () => {
    setSessions(prev => prev.map(session => 
      session.id === activeSessionId 
        ? { ...session, history: [] }
        : session
    ));
  };

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'command':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'output':
      default:
        return 'text-gray-300';
    }
  };

  const runQuickCommand = async (cmd: string) => {
    setCurrentCommand(cmd);
    await executeCommand(cmd);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <Terminal className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold">Container Environment</h2>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-400">Live Container</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">CPU: {containerStats.cpu}%</span>
          <span className="text-xs text-gray-400">RAM: {containerStats.memory}%</span>
          <span className="text-xs text-gray-400">Disk: {containerStats.disk}%</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Processes and Quick Actions */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          {/* Running Processes */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Running Processes</h3>
            <div className="space-y-2">
              {processes.length === 0 ? (
                <p className="text-xs text-gray-500">No processes running</p>
              ) : (
                processes.map(proc => (
                  <div key={proc.pid} className="flex items-center justify-between bg-gray-700 rounded p-2">
                    <div className="flex-1">
                      <p className="text-xs font-mono text-gray-300">{proc.command}</p>
                      <p className="text-xs text-gray-500">PID: {proc.pid} {proc.port && `| Port: ${proc.port}`}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${
                        proc.status === 'running' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      {proc.status === 'running' && (
                        <button
                          onClick={() => killProcess(proc.pid)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Square className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Commands */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Commands</h3>
            <div className="space-y-2">
              <button
                onClick={() => runQuickCommand('ls -la')}
                className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                📁 List files
              </button>
              <button
                onClick={() => runQuickCommand('npm run dev')}
                className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                🚀 Start dev server
              </button>
              <button
                onClick={() => runQuickCommand('npm install')}
                className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                📦 Install packages
              </button>
              <button
                onClick={() => runQuickCommand('git status')}
                className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                🔧 Git status
              </button>
              <button
                onClick={() => runQuickCommand('ps aux')}
                className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                ⚡ Show processes
              </button>
            </div>
          </div>

          {/* Container Info */}
          <div className="p-4 flex-1">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Container Info</h3>
            <div className="space-y-2 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Working Dir:</span>
                <span className="font-mono">{activeSession?.workingDir}</span>
              </div>
              <div className="flex justify-between">
                <span>Node Version:</span>
                <span>18.17.0</span>
              </div>
              <div className="flex justify-between">
                <span>NPM Version:</span>
                <span>9.8.1</span>
              </div>
              <div className="flex justify-between">
                <span>Network:</span>
                <span className="text-green-400">{containerStats.network}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Terminal */}
        <div className="flex-1 flex flex-col">
          {/* Terminal Tabs */}
          <div className="flex items-center bg-gray-800 border-b border-gray-700 px-4">
            <div className="flex space-x-2">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                    session.id === activeSessionId
                      ? 'border-green-400 text-green-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {session.name}
                </button>
              ))}
            </div>
            
            <div className="ml-auto flex items-center space-x-2">
              <button
                onClick={createNewSession}
                className="text-gray-400 hover:text-gray-300 p-1"
                title="New terminal"
              >
                +
              </button>
              <button
                onClick={clearTerminal}
                className="text-gray-400 hover:text-gray-300 p-1"
                title="Clear terminal"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Terminal Content */}
          <div 
            ref={terminalRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-black"
          >
            {activeSession?.history.map(line => (
              <div key={line.id} className={`mb-1 ${getLineColor(line.type)}`}>
                <span className="select-none text-gray-500 text-xs mr-2">
                  {line.timestamp.toLocaleTimeString()}
                </span>
                <span className="whitespace-pre-wrap">{line.content}</span>
                {line.exitCode !== undefined && line.exitCode !== 0 && (
                  <span className="text-red-400 ml-2">[Exit: {line.exitCode}]</span>
                )}
              </div>
            ))}
            
            {/* Command Input */}
            <div className="flex items-center mt-2">
              <span className="text-green-400 mr-2">
                {activeSession?.workingDir || '/workspace'} $
              </span>
              <input
                ref={inputRef}
                type="text"
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isExecuting}
                className="flex-1 bg-transparent outline-none text-gray-300 disabled:opacity-50"
                placeholder={isExecuting ? "Executing..." : "Enter command..."}
                autoFocus
              />
              {isExecuting && (
                <div className="ml-2 w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
          </div>

          {/* Terminal Footer */}
          <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center space-x-4">
              <span>Session: {activeSession?.name}</span>
              <span>Lines: {activeSession?.history.length || 0}</span>
              <span>Status: {isExecuting ? 'Executing' : 'Ready'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>Press Enter to execute</span>
              <span>•</span>
              <span>Ctrl+C to interrupt</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 