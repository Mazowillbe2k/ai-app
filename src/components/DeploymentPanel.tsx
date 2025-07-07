import React, { useState, useEffect } from 'react';
import { 
  Rocket, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  RefreshCw,
  Settings,
  Globe,
  Server,
  Loader2,
  Play,
  Square
} from 'lucide-react';
import { useAppStore } from '../store';
import { deploymentService } from '../services/deployment';
import type { DeploymentConfig } from '../types';

interface DeploymentPanelProps {
  onDeploy?: (config: DeploymentConfig) => void;
}

export function DeploymentPanel({ onDeploy }: DeploymentPanelProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<'render' | 'vercel' | 'netlify' | 'glitch' | 'replit'>('render');
  const [isDeploying, setIsDeploying] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);

  const { 
    files, 
    currentDeployment, 
    deployments,
    addDeployment,
    updateDeployment,
    setCurrentDeployment,
    setPreviewUrl,
    agent,
    updateAgent
  } = useAppStore();

  const platforms = [
    { 
      id: 'render', 
      name: 'Render', 
      icon: <Server className="w-4 h-4" />, 
      description: 'Full-stack hosting with automatic deploys',
      limitations: ['512MB RAM', '0.5 CPU', 'No websockets'],
      buildTime: '2-5 minutes'
    },
    { 
      id: 'vercel', 
      name: 'Vercel', 
      icon: <Globe className="w-4 h-4" />, 
      description: 'Serverless platform optimized for frontend',
      limitations: ['1GB RAM', '10s execution limit', 'Serverless only'],
      buildTime: '1-3 minutes'
    },
    { 
      id: 'netlify', 
      name: 'Netlify', 
      icon: <Globe className="w-4 h-4" />, 
      description: 'Static site hosting with edge functions',
      limitations: ['Static only', 'No server-side rendering', '300 build minutes/month'],
      buildTime: '1-2 minutes'
    },
    { 
      id: 'glitch', 
      name: 'Glitch', 
      icon: <Server className="w-4 h-4" />, 
      description: 'Creative platform for web apps',
      limitations: ['200MB storage', '0.25 CPU', 'No websockets'],
      buildTime: '3-6 minutes'
    },
    { 
      id: 'replit', 
      name: 'Replit', 
      icon: <Server className="w-4 h-4" />, 
      description: 'Cloud IDE with hosting',
      limitations: ['512MB RAM', 'Always-on requires premium', '1GB storage'],
      buildTime: '2-4 minutes'
    }
  ];

  const handleDeploy = async () => {
    if (files.length === 0) {
      alert('No files to deploy. Please generate an app first.');
      return;
    }

    setIsDeploying(true);
    setShowLogs(true);
    setDeploymentLogs([]);
    
    updateAgent({ 
      isDeploying: true, 
      currentTask: `Deploying to ${selectedPlatform}` 
    });

    const runtime = deploymentService.getRuntimeEnvironment(selectedPlatform);
    const config: DeploymentConfig = {
      platform: selectedPlatform,
      buildCommand: 'npm run build',
      startCommand: 'npm run preview',
      installCommand: 'npm install',
      environment: runtime.environmentVariables
    };

    try {
      const deployment = await deploymentService.deploy(
        files, 
        config, 
        (status) => {
          updateDeployment(status.id, status);
          setCurrentDeployment(status);
          setDeploymentLogs(status.logs);
          
          if (status.url) {
            setPreviewUrl(status.url);
          }
        }
      );

      if (deployment.status === 'deployed') {
        setPreviewUrl(deployment.url!);
      }

      onDeploy?.(config);
    } catch (error) {
      console.error('Deployment failed:', error);
      setDeploymentLogs(prev => [...prev, `Deployment failed: ${error}`]);
    } finally {
      setIsDeploying(false);
      updateAgent({ 
        isDeploying: false, 
        currentTask: undefined 
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'building': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'deployed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'building': return 'Building';
      case 'deployed': return 'Deployed';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  };

  const selectedPlatformInfo = platforms.find(p => p.id === selectedPlatform);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Deployment</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Toggle logs"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Platform Selection */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Select Platform
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              onClick={() => setSelectedPlatform(platform.id as any)}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedPlatform === platform.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {platform.icon}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {platform.name}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {platform.buildTime}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {platform.description}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {platform.limitations.map((limitation, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-xs rounded text-gray-600 dark:text-gray-400"
                  >
                    {limitation}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Deployment Status */}
      {currentDeployment && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Current Deployment
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(currentDeployment.timestamp).toLocaleString()}
            </span>
          </div>
          
          <div className="flex items-center gap-3 mb-3">
            {getStatusIcon(currentDeployment.status)}
            <span className="text-sm text-gray-900 dark:text-white">
              {getStatusText(currentDeployment.status)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              on {currentDeployment.platform}
            </span>
          </div>

          {currentDeployment.url && (
            <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
              <input
                type="text"
                value={currentDeployment.url}
                readOnly
                className="flex-1 bg-transparent text-sm font-mono text-gray-700 dark:text-gray-300 outline-none"
              />
              <button
                onClick={() => window.open(currentDeployment.url, '_blank')}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}

          {currentDeployment.error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400">
                  {currentDeployment.error}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deploy Button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleDeploy}
          disabled={isDeploying || files.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 
                   disabled:bg-gray-400 text-white rounded-lg transition-colors"
        >
          {isDeploying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Deploying to {selectedPlatformInfo?.name}...
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4" />
              Deploy to {selectedPlatformInfo?.name}
            </>
          )}
        </button>
        
        {files.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Generate an app first to enable deployment
          </p>
        )}
      </div>

      {/* Deployment Logs */}
      {showLogs && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Deployment Logs
            </h3>
            <button
              onClick={() => setDeploymentLogs([])}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs bg-gray-50 dark:bg-gray-900">
            {deploymentLogs.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Server className="w-8 h-8 mx-auto mb-2" />
                <p>No logs yet</p>
                <p className="text-xs mt-1">Deployment logs will appear here</p>
              </div>
            ) : (
              <div className="space-y-1">
                {deploymentLogs.map((log, index) => (
                  <div key={index} className="text-gray-700 dark:text-gray-300">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Deployments */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Recent Deployments
        </h3>
        {deployments.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            <Rocket className="w-6 h-6 mx-auto mb-2" />
            <p className="text-xs">No deployments yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deployments.slice(0, 3).map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(deployment.status)}
                  <span className="text-xs text-gray-900 dark:text-white">
                    {deployment.platform}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(deployment.timestamp).toLocaleTimeString()}
                  </span>
                  {deployment.url && (
                    <button
                      onClick={() => window.open(deployment.url, '_blank')}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 