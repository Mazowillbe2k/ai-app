// Configuration example for AI Agent Platform
// Copy this to .env and update the values

export const config = {
  // Backend URL - Update this after deploying to Render
  // Local development (default): http://localhost:3001
  // Production: https://your-app-name.onrender.com
  BACKEND_URL: 'http://localhost:3001',
  
  // Example after Render deployment:
  // BACKEND_URL: 'https://ai-agent-backend.onrender.com',
  
  // Hugging Face API Key
  HUGGINGFACE_API_KEY: 'your_huggingface_api_key_here'
};

// Instructions:
// 1. Create a .env file in the project root
// 2. Add: VITE_BACKEND_URL=https://your-deployed-backend-url.onrender.com
// 3. Add: VITE_HUGGINGFACE_API_KEY=your_actual_api_key 