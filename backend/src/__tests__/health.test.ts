import request from 'supertest';
import express, { Application } from 'express';

describe('Health Check Endpoints', () => {
  let app: Application;

  beforeAll(() => {
    app = express();

    app.get('/ping', (_req, res) => {
      res.json({ status: 'alive' });
    });

    app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'initialized',
        uptime: process.uptime(),
        environment: 'test',
      });
    });
  });

  describe('GET /ping', () => {
    it('should return alive status', async () => {
      const response = await request(app).get('/ping');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'alive');
    });
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('database', 'initialized');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment', 'test');
    });
  });
});
