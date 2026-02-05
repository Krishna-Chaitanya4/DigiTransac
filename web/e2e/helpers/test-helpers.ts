import { Page, expect } from '@playwright/test';

/**
 * E2E Test Helpers
 * 
 * Reusable helper functions for common E2E test operations.
 */

/**
 * Wait for app to be fully loaded and interactive
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for React hydration
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  });
}

/**
 * Login with provided credentials
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await waitForAppReady(page);
  
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  
  // Wait for redirect after successful login
  await page.waitForURL(/dashboard|transactions|home/i, { timeout: 10000 });
}

/**
 * Logout and return to login page
 */
export async function logout(page: Page): Promise<void> {
  // Try to find and click logout button
  const profileMenu = page.getByRole('button', { name: /profile|settings|user/i });
  
  if (await profileMenu.isVisible()) {
    await profileMenu.click();
    
    const logoutBtn = page.getByRole('button', { name: /logout|sign out/i });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    }
  } else {
    // Try settings page
    await page.goto('/settings');
    const logoutBtn = page.getByRole('button', { name: /logout|sign out/i });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    }
  }
  
  // Should redirect to login
  await page.waitForURL(/login/);
}

/**
 * Navigate to a specific page with authentication check
 */
export async function navigateToPage(
  page: Page, 
  path: string, 
  options: { expectRedirect?: boolean } = {}
): Promise<void> {
  await page.goto(path);
  await waitForAppReady(page);
  
  if (options.expectRedirect) {
    await expect(page).toHaveURL(/login/);
  }
}

/**
 * Open the transaction form modal
 */
export async function openTransactionForm(page: Page): Promise<void> {
  const addButton = page.getByRole('button', { name: /add|new|create|\+/i }).first();
  await addButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/**
 * Close any open modal
 */
export async function closeModal(page: Page): Promise<void> {
  // Try escape key first
  await page.keyboard.press('Escape');
  
  // Wait for modal to close
  await page.waitForTimeout(300);
  
  // If still visible, try clicking cancel
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) {
    const cancelBtn = page.getByRole('button', { name: /cancel|close/i });
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    }
  }
}

/**
 * Fill in a transaction form
 */
export async function fillTransactionForm(
  page: Page,
  data: {
    type?: 'Send' | 'Receive' | 'Transfer';
    amount?: number;
    payee?: string;
    category?: string;
    notes?: string;
  }
): Promise<void> {
  // Select type if specified
  if (data.type) {
    await page.getByText(data.type).click();
  }
  
  // Fill amount
  if (data.amount) {
    const quickButton = page.getByRole('button', { name: new RegExp(`\\$${data.amount}`) });
    if (await quickButton.isVisible()) {
      await quickButton.click();
    } else {
      await page.getByRole('spinbutton').fill(String(data.amount));
    }
  }
  
  // Fill payee
  if (data.payee) {
    const payeeInput = page.getByPlaceholder(/payee|payer|title/i);
    if (await payeeInput.isVisible()) {
      await payeeInput.fill(data.payee);
    }
  }
  
  // Fill notes
  if (data.notes) {
    const notesInput = page.getByPlaceholder(/notes|description/i);
    if (await notesInput.isVisible()) {
      await notesInput.fill(data.notes);
    }
  }
}

/**
 * Wait for a toast notification
 */
export async function waitForToast(
  page: Page, 
  text: RegExp | string,
  options: { timeout?: number } = {}
): Promise<void> {
  const toast = page.getByRole('alert').or(page.locator('[class*="toast"]'));
  await expect(toast.filter({ hasText: text })).toBeVisible({ 
    timeout: options.timeout ?? 5000 
  });
}

/**
 * Check if element is in viewport
 */
export async function isInViewport(page: Page, selector: string): Promise<boolean> {
  return await page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  });
}

/**
 * Scroll to element and verify visibility
 */
export async function scrollToElement(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  await expect(element).toBeVisible();
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ 
    path: `playwright-report/screenshots/${name}-${timestamp}.png`,
    fullPage: true 
  });
}

/**
 * Check for accessibility violations (basic)
 */
export async function checkBasicA11y(page: Page): Promise<void> {
  // Check for alt text on images
  const images = await page.locator('img').all();
  for (const img of images) {
    const alt = await img.getAttribute('alt');
    const role = await img.getAttribute('role');
    expect(alt !== null || role === 'presentation').toBeTruthy();
  }
  
  // Check for button accessibility
  const buttons = await page.locator('button').all();
  for (const button of buttons) {
    const text = await button.textContent();
    const ariaLabel = await button.getAttribute('aria-label');
    const ariaLabelledBy = await button.getAttribute('aria-labelledby');
    expect(text?.trim() || ariaLabel || ariaLabelledBy).toBeTruthy();
  }
}

/**
 * Simulate slow network conditions
 */
export async function simulateSlowNetwork(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: 50 * 1024, // 50kb/s
    uploadThroughput: 50 * 1024,
    latency: 500, // 500ms latency
  });
}

/**
 * Reset network conditions to normal
 */
export async function resetNetwork(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  });
}

/**
 * Wait for API request to complete
 */
export async function waitForApiRequest(
  page: Page, 
  urlPattern: RegExp | string
): Promise<void> {
  await page.waitForResponse(
    response => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout: 10000 }
  );
}

/**
 * Get current auth state
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Check for auth token in localStorage
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  return token !== null;
}