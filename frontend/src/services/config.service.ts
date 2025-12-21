// Runtime configuration service
class ConfigService {
  private config: {
    apiUrl: string;
    environment: string;
    version: string;
  } | null = null;

  async fetchConfig(): Promise<void> {
    try {
      // Detect environment
      const isDevelopment =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      // Use environment-specific backend URL
      const backendUrl = isDevelopment
        ? import.meta.env.VITE_API_URL || 'http://localhost:5000'
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
    } catch (error) {
      console.error('❌ Failed to load configuration:', error);

      // Environment-aware fallback
      const isDevelopment =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const fallbackApiUrl = isDevelopment
        ? import.meta.env.VITE_API_URL || 'http://localhost:5000'
        : 'https://digitransac-backend.nicemeadow-64e62875.centralindia.azurecontainerapps.io';

      this.config = {
        apiUrl: fallbackApiUrl,
        environment: isDevelopment ? 'development' : 'production',
        version: '1.0.0',
      };
      console.log('⚠️ Using fallback configuration:', this.config);
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
