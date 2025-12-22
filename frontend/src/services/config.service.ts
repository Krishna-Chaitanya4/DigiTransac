// Runtime configuration service
class ConfigService {
  private config: {
    apiUrl: string;
    environment: string;
    version: string;
  } | null = null;

  async fetchConfig(): Promise<void> {
    try {
      // Detect environment - check for local network IPs too
      const hostname = window.location.hostname;
      const isDevelopment =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.');

      // Use environment-specific backend URL
      // For local network access, use the current hostname with backend port
      const backendUrl = isDevelopment
        ? import.meta.env.VITE_API_URL ||
          (hostname === 'localhost' || hostname === '127.0.0.1'
            ? 'http://localhost:5000'
            : `http://${hostname}:5000`)
        : 'https://digitransac-backend.nicemeadow-64e62875.centralindia.azurecontainerapps.io';

      const response = await fetch(`${backendUrl}/api/config`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        mode: 'cors',
        credentials: 'omit',
      });

      if (!response.ok) {
        throw new Error(`Config fetch failed with status ${response.status}`);
      }

      this.config = await response.json();
      console.log('✅ Configuration loaded:', this.config);
      console.log(`🌍 Environment: ${isDevelopment ? 'Local Development' : 'Production'}`);
      if (this.config) {
        console.log(`🔗 API URL: ${this.config.apiUrl}`);
        console.log(`📍 Hostname: ${hostname}`);
      }
    } catch (error) {
      console.error('❌ Failed to load configuration:', error);

      // Environment-aware fallback with local network support
      const hostname = window.location.hostname;
      const isDevelopment =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.');

      const fallbackApiUrl = isDevelopment
        ? import.meta.env.VITE_API_URL ||
          (hostname === 'localhost' || hostname === '127.0.0.1'
            ? 'http://localhost:5000'
            : `http://${hostname}:5000`)
        : 'https://digitransac-backend.nicemeadow-64e62875.centralindia.azurecontainerapps.io';

      this.config = {
        apiUrl: fallbackApiUrl,
        environment: isDevelopment ? 'development' : 'production',
        version: '1.0.0',
      };
      console.log('⚠️ Using fallback configuration:', this.config);
      console.log(`🔗 Fallback API URL: ${fallbackApiUrl}`);
      console.log(`📍 Hostname: ${hostname}`);
    }
  }

  getApiUrl(): string {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call fetchConfig() first.');
    }
    return this.config.apiUrl;
  }

  getEnvironment(): string {
    return this.config?.environment || 'production';
  }

  getVersion(): string {
    return this.config?.version || '1.0.0';
  }
}

export const configService = new ConfigService();
