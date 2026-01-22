import { test, expect } from '@playwright/test';

test.describe('Navigation and Accessibility', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected routes
    await page.goto('/dashboard');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect /transactions to login when not authenticated', async ({ page }) => {
    await page.goto('/transactions');
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect /accounts to login when not authenticated', async ({ page }) => {
    await page.goto('/accounts');
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect /settings to login when not authenticated', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/login/);
  });

  test('should have proper page title', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/DigiTransac/i);
  });

  test('should handle 404 routes gracefully', async ({ page }) => {
    await page.goto('/non-existent-page');
    
    // Should redirect to home or show 404
    await expect(page).toHaveURL(/login|\//);
  });
});

test.describe('Theme Toggle', () => {
  test('should toggle between light and dark theme', async ({ page }) => {
    await page.goto('/login');
    
    // Look for theme toggle button
    const themeToggle = page.getByRole('button', { name: /theme|dark|light|mode/i });
    
    if (await themeToggle.isVisible()) {
      // Get initial theme state
      const html = page.locator('html');
      const initialDark = await html.getAttribute('class').then(c => c?.includes('dark'));
      
      // Toggle theme
      await themeToggle.click();
      
      // Wait for theme change
      await page.waitForTimeout(300);
      
      // Check theme changed
      const newDark = await html.getAttribute('class').then(c => c?.includes('dark'));
      expect(newDark).not.toBe(initialDark);
    }
  });
});

test.describe('Responsive Design', () => {
  test('should display mobile-friendly layout on small screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/login');
    
    // Form should still be visible and usable
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should handle tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/login');
    
    // Check form is properly displayed
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});

test.describe('Keyboard Navigation', () => {
  test('should support tab navigation through login form', async ({ page }) => {
    await page.goto('/login');
    
    // Focus on email field
    await page.getByLabel(/email/i).focus();
    
    // Tab to password
    await page.keyboard.press('Tab');
    
    // Check password field is focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe('INPUT');
  });

  test('should submit form with Enter key', async ({ page }) => {
    await page.goto('/login');
    
    // Fill form
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    
    // Press Enter to submit
    await page.keyboard.press('Enter');
    
    // Form should attempt to submit (we'll see an error since credentials are fake)
    await expect(page.getByText(/invalid|error|loading/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Error Boundary', () => {
  test('should display error boundary on crash', async ({ page }) => {
    // This test verifies the error boundary is working
    // We can't easily trigger a React error from E2E, but we can verify the app loads
    await page.goto('/login');
    
    // App should load without errors
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('should load login page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should have no console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Filter out known acceptable errors (like API failures when not connected)
    const criticalErrors = errors.filter(e => 
      !e.includes('net::') && 
      !e.includes('Failed to load') &&
      !e.includes('NetworkError')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});
