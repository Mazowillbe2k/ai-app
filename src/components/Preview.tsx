import React, { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Monitor, Tablet, Smartphone, Globe, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useStore } from '../store';

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

const viewportSizes = {
  desktop: { width: '100%', height: '100%', icon: Monitor },
  tablet: { width: '768px', height: '1024px', icon: Tablet },
  mobile: { width: '375px', height: '667px', icon: Smartphone }
};

export default function Preview() {
  const { files, previewUrl, agentStatus, deploymentStatus } = useStore();
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Auto-refresh when files change or agent completes work
  useEffect(() => {
    if (agentStatus === 'idle' && files.length > 0) {
      setLastRefresh(Date.now());
    }
  }, [files, agentStatus]);

  // Monitor preview URL changes
  useEffect(() => {
    if (previewUrl) {
      setIsLoading(true);
      setError(null);
      
      // Check if the preview URL is accessible
      const checkPreview = async () => {
        try {
          const response = await fetch(previewUrl, { method: 'HEAD' });
          if (response.ok) {
            setIsLoading(false);
            setError(null);
          } else {
            setError('Preview server not responding');
            setIsLoading(false);
          }
        } catch (err) {
          setError('Unable to connect to preview server');
          setIsLoading(false);
        }
      };

      // Check immediately and then every 5 seconds
      checkPreview();
      const interval = setInterval(checkPreview, 5000);
      return () => clearInterval(interval);
    }
  }, [previewUrl]);

  const handleRefresh = () => {
    setLastRefresh(Date.now());
    setIsLoading(true);
    setError(null);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError('Failed to load preview');
  };

  const getPreviewContent = () => {
    if (!previewUrl && files.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Preview Available
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Ask the AI agent to create an app and it will automatically start a development server with live preview.
            </p>
          </div>
        </div>
      );
    }

    if (!previewUrl && files.length > 0) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Starting Development Server
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              The AI agent is setting up your development environment. Preview will be available shortly.
            </p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Preview Error
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-4">
              {error}
            </p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800 p-4">
        <div 
          className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden relative"
          style={{
            width: viewportSizes[viewport].width,
            height: viewportSizes[viewport].height,
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        >
          {isLoading && (
            <div className="absolute inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading preview...</p>
              </div>
            </div>
          )}
          
          {previewUrl && (
            <iframe
              src={`${previewUrl}?t=${lastRefresh}`}
              className="w-full h-full border-0"
              title="App Preview"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Live Preview
          </h2>
          
          {previewUrl && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Live</span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {previewUrl}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Viewport Controls */}
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(Object.entries(viewportSizes) as [ViewportSize, typeof viewportSizes[ViewportSize]][]).map(([size, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={size}
                  onClick={() => setViewport(size)}
                  className={`p-2 rounded ${
                    viewport === size
                      ? 'bg-white dark:bg-gray-700 text-blue-500 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  title={`${size.charAt(0).toUpperCase() + size.slice(1)} view`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            title="Refresh preview"
            disabled={!previewUrl}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Open in new tab */}
          {previewUrl && (
            <button
              onClick={() => window.open(previewUrl, '_blank')}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      {(agentStatus === 'working' || deploymentStatus === 'deploying') && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-2 text-sm text-blue-800 dark:text-blue-200">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              {agentStatus === 'working' ? 'AI agent is building your app...' : 'Deploying to production...'}
            </span>
          </div>
        </div>
      )}

      {/* Preview Content */}
      {getPreviewContent()}

      {/* Footer Info */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Files: {files.length}</span>
            {previewUrl && (
              <span>Server: Running</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {agentStatus === 'idle' && previewUrl && (
              <>
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>Ready</span>
              </>
            )}
            {agentStatus === 'working' && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                <span>Building</span>
              </>
            )}
            {error && (
              <>
                <AlertCircle className="w-3 h-3 text-red-500" />
                <span>Error</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 