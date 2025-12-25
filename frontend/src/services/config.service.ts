import { getBackendUrl, getEnvironment, logEnvironmentInfo } from '../utils/environment';

// Runtime configuration service
class ConfigService {
  private config: {
    apiUrl: string;
    environment: string;
    version: string;
  } | null = null;

  async fetchConfig(): Promise<void> {
    try {
      const backendUrl = getBackendUrl();

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
      logEnvironmentInfo();
    } catch (error) {
      console.error('❌ Failed to load configuration:', error);

      // Use environment-aware fallback
      const fallbackApiUrl = getBackendUrl();

      this.config = {
        apiUrl: fallbackApiUrl,
        environment: getEnvironment(),
        version: '1.0.0',
      };
      console.log('⚠️ Using fallback configuration:', this.config);
      logEnvironmentInfo();
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

// Helper function for convenient API URL access
export const getApiUrl = (): string => {
  return configService.getApiUrl();
};
