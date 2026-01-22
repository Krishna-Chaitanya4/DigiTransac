import { test as setup } from '@playwright/test';

/**
 * Global setup for E2E tests
 * This runs once before all tests to set up any global state
 */
setup('global setup', async ({ page }) => {
  // Navigate to the app to ensure it's loaded
  await page.goto('/');
  
  // Wait for the app to be ready
  await page.waitForLoadState('networkidle');
  
  console.log('E2E test setup complete');
});
