# Deployment Directory

This directory contains all deployment-related files and configurations for the AI Agent Platform.

## Files

### `deploy-to-render.js`
Automated deployment script for Render.com hosting platform.

**Usage:**
```bash
# Automated deployment
npm run deploy:render

# Manual deployment instructions
npm run deploy:instructions
```

### `config.example.js`
Example configuration file showing the structure needed for deployment configuration.

**Setup:**
1. Copy this file to `config.js` in the root directory
2. Fill in your actual API keys and configuration values
3. The config file is gitignored for security

### `render.yaml` (located in root)
Render.com service configuration file that defines:
- Service type and runtime
- Build and start commands
- Environment variables
- Health check endpoints

## Environment Variables

The following environment variables are needed for deployment:

- `RENDER_API_KEY`: Your Render.com API key
- `NODE_ENV`: Set to 'production' for cloud deployment
- `PORT`: Server port (default: 10000 for Render)

## Deployment Process

1. **Local Development**: Uses Docker containers for full Linux environment
2. **Production Deployment**: Uses cloud-compatible container manager without Docker dependency
3. **Auto-detection**: Backend automatically switches between development and production modes

## Security Notes

- Never commit API keys or sensitive configuration to version control
- Use environment variables for sensitive data in production
- The `config.js` file is automatically gitignored 