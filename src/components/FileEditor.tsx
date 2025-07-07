import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { 
  File, 
  Folder, 
  FolderOpen, 
  Save, 
  Download, 
  Plus, 
  Trash2, 
  Edit,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react';
import { useStore } from '../store';
import { agenticAI } from '../services/agenticAI';
import type { ProjectFile } from '../types';

interface FileEditorProps {
  onFileChange?: (fileId: string, content: string) => void;
  onFileSave?: (fileId: string, content: string) => void;
}

export function FileEditor({ onFileChange, onFileSave }: FileEditorProps) {
  const [editorContent, setEditorContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  const { 
    files, 
    selectedFile, 
    selectFile, 
    updateFile, 
    deleteFile,
    addFile,
    setFiles,
    isDarkMode 
  } = useStore();

  const selectedFileData = files.find((f: ProjectFile) => f.id === selectedFile);

  // Load files from container on component mount
  useEffect(() => {
    loadFilesFromContainer();
  }, []);

  useEffect(() => {
    if (selectedFileData) {
      setEditorContent(selectedFileData.content);
      setHasChanges(false);
    }
  }, [selectedFileData]);

  const loadFilesFromContainer = async () => {
    try {
      const containerFiles = await agenticAI.getAllFilesFromContainer();
      
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
      } else {
        console.log('📁 No files found in WebContainer workspace');
      }
    } catch (error) {
      console.error('❌ Failed to load files from WebContainer:', error);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditorContent(value);
      setHasChanges(value !== selectedFileData?.content);
      onFileChange?.(selectedFile!, value);
    }
  };

  const handleSave = () => {
    if (selectedFile && hasChanges) {
      updateFile(selectedFile, { content: editorContent });
      setHasChanges(false);
      onFileSave?.(selectedFile, editorContent);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  const getFileIcon = (file: ProjectFile) => {
    if (file.type === 'directory') {
      return expandedFolders.has(file.id) ? 
        <FolderOpen className="w-4 h-4 text-blue-500" /> : 
        <Folder className="w-4 h-4 text-blue-500" />;
    }
    return <File className="w-4 h-4 text-gray-500" />;
  };

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx':
      case 'jsx': return 'typescriptreact';
      case 'ts': return 'typescript';
      case 'js': return 'javascript';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'yml':
      case 'yaml': return 'yaml';
      default: return 'plaintext';
    }
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileSelect = (file: ProjectFile) => {
    if (file.type === 'directory') {
      toggleFolder(file.id);
    } else {
      selectFile(file.id);
    }
  };

  const handleDeleteFile = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this file?')) {
      deleteFile(fileId);
    }
  };

  const handleCopyFile = (file: ProjectFile, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(file.content);
    setCopiedFile(file.id);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const handleDownloadFile = (file: ProjectFile, e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddFile = () => {
    const name = prompt('Enter file name:');
    if (name) {
      addFile({
        name,
        path: name,
        content: '',
        language: getLanguageFromPath(name),
        type: 'file',
        size: 0
      });
    }
  };

  const getMarginLeft = (depth: number) => {
    // Use fixed Tailwind classes instead of dynamic ones
    const margins = ['ml-0', 'ml-4', 'ml-8', 'ml-12', 'ml-16', 'ml-20'];
    return margins[Math.min(depth, margins.length - 1)] || 'ml-20';
  };

  const renderFileTree = (files: ProjectFile[], depth: number = 0) => {
    return files.map((file) => (
      <div key={file.id} className="select-none">
        <div
          className={`flex items-center gap-2 px-2 py-1 cursor-pointer rounded group
                     hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                     ${selectedFile === file.id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}
                     ${getMarginLeft(depth)}`}
          onClick={() => handleFileSelect(file)}
        >
          {getFileIcon(file)}
          <span className="flex-1 text-sm truncate">{file.name}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => handleCopyFile(file, e)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Copy content"
            >
              {copiedFile === file.id ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={(e) => handleDownloadFile(file, e)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Download"
            >
              <Download className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => handleDeleteFile(file.id, e)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-red-500"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        {file.type === 'directory' && expandedFolders.has(file.id) && file.children && (
          <div>
            {renderFileTree(file.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* File Tree */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Files</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={loadFilesFromContainer}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title="Refresh files from container"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleAddFile}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title="Add file"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {files.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <File className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Empty workspace</p>
              <p className="text-xs mt-1">Ask the AI to create an app and files will appear here</p>
            </div>
          ) : (
            <div className="space-y-1">
              {renderFileTree(files)}
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {selectedFileData ? (
          <>
            {/* Editor Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <File className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedFileData.name}
                </span>
                {hasChanges && (
                  <span className="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 
                           disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                >
                  <Save className="w-3 h-3" />
                  Save
                </button>
                <button
                  onClick={(e) => handleDownloadFile(selectedFileData, e)}
                  className="flex items-center gap-2 px-3 py-1 bg-gray-500 hover:bg-gray-600 
                           text-white rounded text-sm transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 relative" onKeyDown={handleKeyDown}>
              <Editor
                value={editorContent}
                onChange={handleEditorChange}
                language={getLanguageFromPath(selectedFileData.path)}
                theme={isDarkMode ? 'vs-dark' : 'vs-light'}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  folding: true,
                  autoIndent: 'full',
                  formatOnPaste: true,
                  formatOnType: true,
                  tabSize: 2,
                  insertSpaces: true,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  roundedSelection: false,
                  readOnly: false,
                  cursorStyle: 'line',
                  mouseWheelZoom: true,
                  quickSuggestions: true,
                  parameterHints: { enabled: true },
                  suggest: {
                    showKeywords: true,
                    showSnippets: true,
                    showFunctions: true,
                    showVariables: true,
                    showClasses: true,
                    showInterfaces: true,
                    showModules: true,
                    showProperties: true,
                    showValues: true,
                    showColors: true,
                    showFiles: true,
                    showReferences: true,
                    showFolders: true,
                    showTypeParameters: true,
                    showIssues: true,
                    showUsers: true,
                    showWords: true
                  }
                }}
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Edit className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No file selected</h3>
              <p className="text-sm">Select a file from the tree to start editing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 