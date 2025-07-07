# AI Agent Platform with Docker

An advanced AI agent platform that uses Docker containers with Ubuntu 22.04 LTS for autonomous software development. The AI can create, build, and deploy full applications in a real Linux environment.

## 🐳 Docker Setup

### Prerequisites

- Docker Desktop installed and running
- Docker Compose v3.8+
- 8GB+ RAM recommended
- Internet connection for pulling images

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-agent-platform
   ```

2. **Install dependencies for frontend and backend**
   ```bash
   npm run setup
   ```

3. **Start the development servers (frontend + backend)**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Alternative: Docker Setup

1. **Build and start the Docker environment**
   ```bash
   npm run docker:build
   npm run docker:up
   ```

2. **Start the development server**
   ```bash
   npm run frontend:dev
   ```

### Docker Commands

- `npm run docker:build` - Build the Docker image
- `npm run docker:up` - Start containers in background
- `npm run docker:down` - Stop and remove containers
- `npm run docker:logs` - View container logs
- `npm run docker:shell` - Access container shell

### Container Features

The Docker container provides a full Ubuntu 22.04 LTS environment with:

- **Node.js 18.x** - For JavaScript/TypeScript development
- **Python 3** - For Python projects and AI tools
- **Git** - Version control
- **Build tools** - gcc, make, build-essential
- **Text editors** - nano, vim
- **Package managers** - npm, pip
- **Development tools** - curl, wget

### Architecture

```
Host System
├── AI Agent Platform (React/Vite)
└── Docker Container (Ubuntu 22.04 LTS)
    └── Generated Projects
        ├── React Apps
        ├── Next.js Apps
        ├── Vue Apps
        └── Static Sites
```

## 🚀 Features

### Available Tools

The AI agent has access to powerful development tools:

- **startup** - Create new projects from templates
- **bash** - Execute any terminal command
- **edit_file** - Create and modify files
- **read_file** - Read file contents
- **ls** - List directories
- **grep** - Search through files
- **suggestions** - Get next step recommendations

### Framework Support

- React with Vite
- React with Tailwind CSS
- React with shadcn/ui
- Next.js with shadcn/ui
- Vue.js with Vite
- Vue.js with Tailwind CSS
- HTML/TypeScript/CSS

### Real Container Execution

Unlike browser-based solutions, this platform uses real Docker containers providing:

- Full Linux environment
- All development tools available
- Real package installation
- Actual server processes
- True file system operations

## 🛠️ Development

### Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

3. **Build for production**
   ```bash
   npm run build
   ```

### Container Development

1. **Access container shell**
   ```bash
   npm run docker:shell
   ```

2. **View generated projects**
   ```bash
   ls /workspace
   ```

3. **Monitor container logs**
   ```bash
   npm run docker:logs
   ```

## 🎯 Usage

1. **Describe your app idea** - Tell the AI what you want to build
2. **Select framework** - Choose from React, Next.js, Vue, or HTML
3. **Watch it build** - The AI autonomously creates your application
4. **Preview and iterate** - Test your app and request changes

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```bash
VITE_HUGGINGFACE_API_KEY=your_api_key_here
```

### Port Configuration

Default ports (configurable in `docker-compose.yml`):

- **5173** - Vite development server
- **3000** - React/Next.js applications
- **8080** - Alternative port
- **4000** - Development servers
- **5000** - Python/Flask applications

## 🐛 Troubleshooting

### Docker Issues

**Container won't start:**
```bash
docker system prune -a
npm run docker:build
npm run docker:up
```

**Port conflicts:**
```bash
npm run docker:down
# Edit docker-compose.yml ports
npm run docker:up
```

**Permission issues:**
```bash
sudo chown -R $USER:$USER workspace/
```

### Development Issues

**Node modules not found:**
```bash
npm run docker:shell
cd /workspace/your-project
npm install
```

**Build failures:**
```bash
npm run docker:logs
# Check container logs for errors
```

## 📝 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Environment Variables

### Frontend (.env.local)
Copy `env.example` to `.env.local` and fill in your values:

```bash
# Copy the example file
cp env.example .env.local
```

Required variables:
- `VITE_HUGGINGFACE_API_KEY`: Get your key from [Hugging Face Settings](https://huggingface.co/settings/tokens)
- `VITE_BACKEND_URL`: Backend API URL (auto-configured for development/production)

### Backend (backend/.env)
The backend automatically detects environment:
- **Development**: Uses Docker containers
- **Production**: Uses cloud-compatible mode

For production deployment, set:
- `NODE_ENV=production`
- `PORT=10000` (for Render.com)

## Security

- Never commit actual API keys to version control
- Environment files (`.env*`) are automatically gitignored
- Use different API keys for development and production
