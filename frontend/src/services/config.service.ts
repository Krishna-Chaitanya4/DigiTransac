// Runtime configuration service
class ConfigService {
  private config: {
    apiUrl: string;
    environment: string;
    version: string;
  } | null = null;

  async fetchConfig(): Promise<void> {
    try {
      // Try backend directly first (for runtime config)
      const backendUrl = 'https://digitransac-backend.nicemeadow-64e62875.centralindia.azurecontainerapps.io';
      const response = await fetch(`${backendUrl}/api/config`);
      if (!response.ok) {
        throw new Error('Failed to fetch config');
      }
      this.config = await response.json();
      console.log('✅ Configuration loaded:', this.config);
    } catch (error) {
      console.error('❌ Failed to load configuration:', error);
      // Fallback to current domain
      this.config = {
        apiUrl: window.location.origin,
        environment: 'production',
        version: '1.0.0'
      };
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
