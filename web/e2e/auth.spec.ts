import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    // Check page title or heading
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    
    // Check form elements are present
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    // Try to submit empty form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show validation messages
    await expect(page.getByText(/email is required|please enter/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    
    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for error message (API should return 401)
    await expect(page.getByText(/invalid|unauthorized|incorrect/i)).toBeVisible({ timeout: 10000 });
  });

  test('should have link to register page', async ({ page }) => {
    // Find and click register link
    const registerLink = page.getByRole('link', { name: /sign up|register|create account/i });
    await expect(registerLink).toBeVisible();
    
    await registerLink.click();
    
    // Should navigate to register page
    await expect(page).toHaveURL(/register/);
  });

  test('should have link to forgot password', async ({ page }) => {
    // Find forgot password link
    const forgotLink = page.getByRole('link', { name: /forgot|reset/i });
    await expect(forgotLink).toBeVisible();
    
    await forgotLink.click();
    
    // Should navigate to forgot password page
    await expect(page).toHaveURL(/forgot/);
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);
    
    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click show password button
    const toggleButton = page.getByRole('button', { name: /show|hide|toggle/i });
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      
      // Password should now be visible
      await expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });
});

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should display registration form step 1', async ({ page }) => {
    // Check email step is displayed
    await expect(page.getByRole('heading', { name: /create|sign up|register/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    // Enter invalid email
    await page.getByLabel(/email/i).fill('invalid-email');
    
    // Try to proceed
    const continueBtn = page.getByRole('button', { name: /continue|next|send/i });
    await continueBtn.click();
    
    // Should show validation error
    await expect(page.getByText(/valid email|invalid email/i)).toBeVisible();
  });

  test('should have link to login page', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: /sign in|login|already have/i });
    await expect(loginLink).toBeVisible();
    
    await loginLink.click();
    
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
  });

  test('should display forgot password form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /reset|forgot|password/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('should validate email before sending reset code', async ({ page }) => {
    // Enter invalid email
    await page.getByLabel(/email/i).fill('invalid');
    
    // Try to submit
    await page.getByRole('button', { name: /send|reset|continue/i }).click();
    
    // Should show validation error
    await expect(page.getByText(/valid email|invalid/i)).toBeVisible();
  });

  test('should have link back to login', async ({ page }) => {
    const backLink = page.getByRole('link', { name: /back|login|sign in/i });
    await expect(backLink).toBeVisible();
  });
});
