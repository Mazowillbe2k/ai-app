# AI Agent Backend API

Backend server for the AI Agent Platform that manages Docker containers for autonomous software development.

## Features

- **Docker Container Management** - Create and manage Ubuntu 22.04 LTS containers
- **Real Development Environment** - Full Linux environment with Node.js, Python, Git
- **File Operations** - Read, write, create, delete files in containers
- **Command Execution** - Run any terminal command in containers
- **Development Server Detection** - Automatically detect running dev servers

## Prerequisites

- Node.js 18+
- Docker Desktop installed and running
- Ubuntu 22.04 LTS Docker image (automatically pulled)

## Installation

```bash
# Install backend dependencies
cd backend
npm install
```

## Development

```bash
# Start backend server in development mode
npm run dev

# Or start from project root
npm run backend:dev
```

The backend server will start on `http://localhost:3001`

## API Endpoints

### Container Management

- `POST /api/container/init` - Initialize a new Docker container
- `GET /api/container/status` - Get container status
- `POST /api/container/cleanup` - Clean up all containers

### Command Execution

- `POST /api/container/execute` - Execute terminal command in container
  ```json
  {
    "command": "npm install",
    "workingDir": "/workspace"
  }
  ```

### File Operations

- `POST /api/container/read` - Read file from container
- `POST /api/container/write` - Write file to container
- `POST /api/container/list` - List directory contents
- `POST /api/container/mkdir` - Create directory
- `POST /api/container/delete` - Delete file/directory
- `POST /api/container/exists` - Check if file exists

### Project Operations

- `POST /api/container/all-files` - Get all project files
- `GET /api/container/preview-url` - Get running dev server URL

## Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)

## Docker Container Features

Each container includes:

- **Ubuntu 22.04 LTS** base system
- **Node.js 18.x** with npm
- **Python 3** with pip
- **Git** version control
- **Build tools** (gcc, make, build-essential)
- **Text editors** (nano, vim)
- **Development utilities** (curl, wget)

## Ports Exposed

- **3000** - React/Next.js applications
- **5173** - Vite development server
- **8080** - Alternative development port
- **4000** - Custom development servers
- **5000** - Python/Flask applications

## Logging

Logs are written to:
- Console (colorized)
- `backend/logs/container.log` (file)

## Health Check

Check if the backend is running:

```bash
curl http://localhost:3001/health
```

## Architecture

```
Frontend (React/Vite)
    ↓ HTTP API calls
Backend Server (Express)
    ↓ Docker commands
Docker Container (Ubuntu 22.04)
    ↓ File system & processes
Generated Projects
```

## Development Workflow

1. Backend creates Docker container with development tools
2. Frontend sends tool requests to backend API
3. Backend executes commands in Docker container
4. Results sent back to frontend for display
5. Real files created in Docker container
6. Development servers run in container, accessible via port forwarding 