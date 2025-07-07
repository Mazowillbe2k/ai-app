export interface ContainerInterface {
  executeCommand: (command: string) => Promise<{ output: string; error?: string; exitCode: number }>;
  readFile: (path: string) => Promise<{ content: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
  listDirectory: (path: string) => Promise<{ files: string[]; error?: string }>;
  createDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
  fileExists: (path: string) => Promise<boolean>;
  getWorkingDirectory: () => Promise<string>;
  setWorkingDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
  getAllFiles: () => Promise<Array<{ path: string; content: string }>>;
  getPreviewUrl: () => Promise<string | null>;
}

export class DockerContainerInterface implements ContainerInterface {
  private baseUrl: string;
  private workingDir = '/workspace';
  private isInitialized = false;
  
  constructor() {
    // Use environment variable with fallback for different environments
    if (typeof window !== 'undefined') {
      // Browser environment - use Vite injected variables or fallback to deployed backend
      this.baseUrl = (window as any).__VITE_BACKEND_URL__ || 
                     import.meta.env.VITE_BACKEND_URL || 
                     'https://ai-app-jyur.onrender.com';
    } else {
      // Node.js environment - use process.env
      this.baseUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3001';
    }
    console.log(`🔗 Using backend: ${this.baseUrl}`);
    this.initializeContainer();
  }

  private async initializeContainer(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('🐳 Initializing Docker container...');
      const response = await fetch(`${this.baseUrl}/api/container/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to initialize container: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Container initialization failed');
      }
      
      this.isInitialized = true;
      console.log('✅ Docker container initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Docker container:', error);
      throw error;
    }
  }

  private async ensureReady(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeContainer();
    }
  }

  async executeCommand(command: string): Promise<{ output: string; error?: string; exitCode: number }> {
    await this.ensureReady();
    
    console.log(`🐳 Executing: ${command}`);
    
    const response = await fetch(`${this.baseUrl}/api/container/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command,
        workingDir: this.workingDir
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  }

  async readFile(filePath: string): Promise<{ content: string; error?: string }> {
    await this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/container/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath,
        workingDir: this.workingDir
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  }

  async writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    await this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/container/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath,
        content,
        workingDir: this.workingDir
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  }

  async listDirectory(dirPath: string): Promise<{ files: string[]; error?: string }> {
    await this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/container/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dirPath,
        workingDir: this.workingDir
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  }

  async createDirectory(dirPath: string): Promise<{ success: boolean; error?: string }> {
    await this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/container/mkdir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dirPath,
        workingDir: this.workingDir
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  }

  async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    await this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/container/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath,
        workingDir: this.workingDir
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  }

  async fileExists(filePath: string): Promise<boolean> {
    await this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/container/exists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath,
        workingDir: this.workingDir
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.exists;
  }

  async getWorkingDirectory(): Promise<string> {
    return this.workingDir;
  }

  async setWorkingDirectory(dirPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Update local working directory
      this.workingDir = dirPath.startsWith('/') ? dirPath : `/workspace/${dirPath}`;
      
      // Also update the container's working directory on the backend
      const response = await fetch(`${this.baseUrl}/api/container/set-working-dir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirPath })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getAllFiles(): Promise<Array<{ path: string; content: string }>> {
    await this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/container/all-files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workingDir: this.workingDir
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.files || [];
  }

  async getPreviewUrl(): Promise<string | null> {
    await this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/container/preview-url`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.url;
  }

  // Cleanup method (for API-based cleanup)
  async cleanup(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/container/cleanup`, {
        method: 'POST'
      });
      console.log('✅ Container cleaned up successfully');
    } catch (error) {
      console.warn('⚠️ Cleanup request failed:', error);
    }
  }
}

// Export the Docker implementation as default
export { DockerContainerInterface as DefaultContainerInterface }; 