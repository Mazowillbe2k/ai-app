# AI Agent Deployment Guide

## Overview
This document provides instructions for deploying the AI Agent Platform to various cloud environments.

## Recent Improvements (Latest Updates)

### Node.js Version Compatibility
- **Updated Render configuration** to use Node.js 20.11.0 for better compatibility with modern tools
- **Updated Dockerfile** to use Node.js 20.x instead of 18.x
- **Added fallback strategies** for Vite project creation when using older Node.js versions
- **Enhanced error handling** with automatic project creation fallbacks

### Browser Agent Integration
- **Fixed missing dependencies** - Added `playwright` and `node-fetch` to backend dependencies
- **Integrated browser agent** - Browser agent now starts automatically with the main server
- **Added proxy endpoint** - Main server forwards browser requests to browser agent
- **Automatic browser installation** - Playwright browsers install automatically during deployment

### Cloud Container Manager Enhancements
- **Automatic version detection** - System automatically detects Node.js version and uses compatible tool versions
- **Degit-based fallback** - When `create-vite` fails, system automatically uses `degit` to clone Vite templates
- **Multi-tier fallback system** - Progressive fallback: `create-vite` → `degit` → manual project creation
- **Better error recovery** - Improved error messages and recovery strategies
- **Enhanced command preprocessing** - Smart command translation with compatibility checks

## Architecture Overview

### Main Server (Port 10000)
- **AI Agent Backend API** - Main server handling container management and AI operations
- **Browser Agent Proxy** - Forwards browser requests to the browser agent subprocess
- **Cloud Container Manager** - Manages project creation and command execution
- **Health Check** - Provides deployment status and health monitoring

### Browser Agent (Port 10001)
- **Playwright Integration** - Automated browser interaction for web scraping and testing
- **Subprocess Management** - Runs as a separate process managed by the main server
- **Automatic Startup** - Starts automatically when the main server starts
- **Graceful Shutdown** - Properly terminated when the main server shuts down

### Service Integration
The browser agent is now fully integrated into the main server:
1. **Main server starts** on port 10000
2. **Browser agent subprocess** starts automatically on port 10001
3. **Proxy endpoint** `/api/browse` forwards requests to the browser agent
4. **Dependency management** - All required packages are installed automatically
5. **Error handling** - Fallback mechanisms for browser agent failures

## Template Support
The system supports all standard Vite templates via degit:
- `react-ts` (default) - React with TypeScript
- `react` - React with JavaScript
- `vue-ts` - Vue with TypeScript
- `vue` - Vue with JavaScript
- `vanilla-ts` - Vanilla TypeScript
- `vanilla` - Vanilla JavaScript
- `svelte-ts` - Svelte with TypeScript
- `svelte` - Svelte with JavaScript
- `lit-ts` - Lit with TypeScript
- `lit` - Lit with JavaScript
- `preact-ts` - Preact with TypeScript
- `preact` - Preact with JavaScript

## Render Deployment

### Prerequisites
- Node.js 20.11.0+ (specified in render.yaml)
- Git repository with your code

### Why Degit is Better for Cloud Deployment
The system now uses `degit` as the primary fallback strategy because:
- **No Node.js version constraints** - Works with any Node.js version
- **Faster** - Only downloads template files, not full Git history
- **More reliable** - Fewer network dependencies and simpler operation
- **Cloud-friendly** - Better suited for containerized environments

### Configuration
The `render.yaml` file has been optimized for:
- **Node.js 20.11.0** runtime for maximum compatibility
- **Production environment** with proper health checks
- **Automatic dependency installation** during build

### Environment Variables
```yaml
envVars:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: 10000
  - key: NODE_VERSION
    value: 20.11.0
```

### Health Check
The service includes a health check endpoint at `/health` that Render uses to verify the service is running correctly.

### Deployment Steps
1. **Push your code** to your Git repository
2. **Connect repository** to Render
3. **Use render.yaml** configuration (automatic deployment)
4. **Monitor deployment** logs for any issues

## Troubleshooting

### Common Issues and Solutions

#### 1. Node.js Version Compatibility
**Problem**: `create-vite` fails with "EBADENGINE" error
**Solution**: 
- The system now automatically detects Node.js version
- **Primary fallback**: Uses `degit` to clone Vite templates (works with any Node.js version)
- **Secondary fallback**: Manual project creation if degit fails
- Progressive recovery ensures project creation always succeeds

#### 2. Project Directory Not Found
**Problem**: `cd TodoApp` fails because directory wasn't created
**Solution**: 
- Enhanced error detection with multi-tier fallback system
- Degit-based project creation when `create-vite` fails
- Automatic manual project creation as final fallback
- Better working directory management

#### 3. Template and Framework Support
**Problem**: Need specific frameworks or templates
**Solution**: 
- Full support for all Vite templates via degit mapping
- Automatic template detection from original commands
- Fallback to React TypeScript if template not specified
- Works with React, Vue, Svelte, Lit, Preact, and Vanilla projects

#### 4. Browser Agent and Playwright Issues
**Problem**: "Cannot find package 'playwright'" or browser agent errors
**Solution**: 
- Added `playwright` and `node-fetch` to backend dependencies
- Integrated browser agent into main server process
- Automatic browser installation during deployment
- Proxy endpoint for browser requests

#### 5. Missing Dependencies
**Problem**: `nodemon: not found` or similar dependency errors
**Solution**: 
- Updated package.json with proper engines field
- Better dependency validation before command execution
- Fallback strategies for missing dev dependencies

#### 6. Command Execution Failures
**Problem**: Various npm/npx commands failing in cloud environment
**Solution**: 
- Enhanced command preprocessing with Node.js version detection
- Better environment variable setup for npm commands
- Improved working directory management

### Deployment Verification
After deployment, verify your service is working:

1. **Health Check**: Visit `https://your-app.onrender.com/health`
2. **API Status**: Check `https://your-app.onrender.com/api/status`
3. **Container Initialize**: Test container creation via API

### Expected Response from Health Check
```json
{
  "status": "healthy",
  "timestamp": "2025-01-07T18:32:52.557Z",
  "message": "AI Agent Backend is running",
  "port": 10000,
  "containerMode": "cloud"
}
```

## Local Development vs Cloud Deployment

### Local Development
- Uses DockerContainerManager when Docker is available
- Full development environment with all tools

### Cloud Deployment (Render)
- Uses CloudContainerManager with enhanced fallback strategies
- Automatic Node.js version detection and compatibility handling
- Manual project creation when automated tools fail
- Optimized for cloud environment constraints

## Best Practices

1. **Always specify Node.js version** in package.json engines field
2. **Use health check endpoints** for deployment verification
3. **Monitor deployment logs** for early issue detection
4. **Test fallback scenarios** in development environment
5. **Keep dependencies updated** but verify compatibility

## Support

If you encounter issues:
1. Check deployment logs in Render dashboard
2. Verify Node.js version compatibility
3. Test health check endpoint
4. Review error messages for specific guidance

The system now includes comprehensive error handling and fallback strategies to ensure reliable deployment across different environments and Node.js versions. 