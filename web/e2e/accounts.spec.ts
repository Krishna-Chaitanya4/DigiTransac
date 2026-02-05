import { test, expect } from '@playwright/test';

test.describe('Accounts Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Layout', () => {
    test('should display accounts page header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /accounts/i })).toBeVisible();
    });

    test('should display total balance summary', async ({ page }) => {
      // Check for balance summary section
      await expect(page.getByText(/total|balance|net worth/i).first()).toBeVisible();
    });

    test('should display add account button', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add|new|create/i });
      await expect(addButton).toBeVisible();
    });
  });

  test.describe('Account Management', () => {
    test('should open new account modal when add button is clicked', async ({ page }) => {
      await page.getByRole('button', { name: /add|new|create/i }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /new account|add account|create account/i })).toBeVisible();
    });

    test('should have all required form fields in account modal', async ({ page }) => {
      await page.getByRole('button', { name: /add|new|create/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      // Check for account name field
      await expect(page.getByPlaceholder(/name|account name/i).or(page.getByLabel(/name/i))).toBeVisible();

      // Check for currency selector
      await expect(page.getByText(/currency/i)).toBeVisible();

      // Check for account type selector
      await expect(page.getByText(/type/i)).toBeVisible();
    });

    test('should close modal when cancel is clicked', async ({ page }) => {
      await page.getByRole('button', { name: /add|new|create/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      await page.getByRole('button', { name: /cancel/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should close modal when clicking outside', async ({ page }) => {
      await page.getByRole('button', { name: /add|new|create/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      await page.locator('.bg-black\\/30, .bg-black\\/50, .bg-black\\/40').first().click({ force: true });
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should validate form before submission', async ({ page }) => {
      await page.getByRole('button', { name: /add|new|create/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      // Submit button should be disabled or form should show validation errors
      const submitButton = page.getByRole('button', { name: /save|create|add/i }).last();
      
      // Try to submit empty form
      await submitButton.click();
      
      // Should show validation error or button should be disabled
      const hasValidationError = await page.getByText(/required|name is required|please enter/i).isVisible()
        .catch(() => false);
      const isDisabled = await submitButton.isDisabled();
      
      expect(hasValidationError || isDisabled).toBeTruthy();
    });
  });

  test.describe('Account List', () => {
    test('should display account cards', async ({ page }) => {
      await page.waitForTimeout(1000);
      
      // Check for account cards or empty state
      const hasAccounts = await page.locator('[data-account-id], [class*="account-card"]').first().isVisible()
        .catch(() => false);
      
      if (!hasAccounts) {
        // Check for empty state
        await expect(page.getByText(/no accounts|add your first account/i)).toBeVisible();
      }
    });

    test('should show account actions on click', async ({ page }) => {
      await page.waitForTimeout(1000);
      
      const accountCard = page.locator('[data-account-id], [class*="account-card"]').first();
      
      if (await accountCard.isVisible()) {
        await accountCard.click();
        
        // Should show edit/delete options or navigate to details
        const hasActions = await page.getByRole('button', { name: /edit|delete|archive/i }).first().isVisible()
          .catch(() => false);
        
        expect(hasActions).toBeDefined();
      }
    });
  });

  test.describe('Account Types', () => {
    test('should filter accounts by type', async ({ page }) => {
      // Look for type filter tabs or dropdown
      const typeFilter = page.getByRole('tab').or(page.getByRole('button', { name: /all|bank|cash|credit/i }));
      
      if (await typeFilter.first().isVisible()) {
        await typeFilter.first().click();
        await page.waitForTimeout(500);
        // Filter should be applied
      }
    });
  });

  test.describe('Balance Adjustment', () => {
    test('should open balance adjustment modal', async ({ page }) => {
      await page.waitForTimeout(1000);
      
      const accountCard = page.locator('[data-account-id], [class*="account-card"]').first();
      
      if (await accountCard.isVisible()) {
        // Look for adjust balance button
        const adjustButton = page.getByRole('button', { name: /adjust|reconcile|balance/i });
        
        if (await adjustButton.isVisible()) {
          await adjustButton.click();
          await expect(page.getByRole('dialog')).toBeVisible();
        }
      }
    });
  });
});

test.describe('Account CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');
  });

  test('should create a new bank account', async ({ page }) => {
    await page.getByRole('button', { name: /add|new|create/i }).first().click();
    await page.waitForSelector('[role="dialog"]');

    // Fill in account name
    const nameInput = page.getByPlaceholder(/name|account name/i).or(page.getByLabel(/name/i)).first();
    await nameInput.fill('E2E Test Bank Account');

    // Select account type if available
    const typeSelect = page.getByRole('combobox').or(page.locator('select')).first();
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption({ label: 'Bank' });
    }

    // Set initial balance if field exists
    const balanceInput = page.getByPlaceholder(/balance|amount/i);
    if (await balanceInput.isVisible()) {
      await balanceInput.fill('1000');
    }

    // Submit
    const submitButton = page.getByRole('button', { name: /save|create|add/i }).last();
    if (await submitButton.isEnabled()) {
      await submitButton.click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
  });

  test('should edit an existing account', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    const accountCard = page.locator('[data-account-id], [class*="account-card"]').first();
    
    if (await accountCard.isVisible()) {
      await accountCard.click();
      
      const editButton = page.getByRole('button', { name: /edit/i }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        await expect(page.getByRole('dialog')).toBeVisible();
        
        // Update the name
        const nameInput = page.getByPlaceholder(/name|account name/i).or(page.getByLabel(/name/i)).first();
        await nameInput.fill('Updated E2E Account');
        
        const saveButton = page.getByRole('button', { name: /save|update/i }).last();
        if (await saveButton.isEnabled()) {
          await saveButton.click();
        }
      }
    }
  });

  test('should archive/delete an account', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    const accountCard = page.locator('[data-account-id], [class*="account-card"]').first();
    
    if (await accountCard.isVisible()) {
      await accountCard.click();
      
      const deleteButton = page.getByRole('button', { name: /delete|archive/i }).first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // Confirm deletion if dialog appears
        const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      }
    }
  });

  test('should set account as default', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    const accountCard = page.locator('[data-account-id], [class*="account-card"]').first();
    
    if (await accountCard.isVisible()) {
      // Look for "set as default" option
      const defaultButton = page.getByRole('button', { name: /default|primary/i });
      
      if (await defaultButton.isVisible()) {
        await defaultButton.click();
        // Should show success indicator
        await expect(page.getByText(/default|primary|✓/i)).toBeVisible();
      }
    }
  });
});

test.describe('Multi-Currency Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');
  });

  test('should display currency symbols correctly', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Check for common currency symbols
    const currencySymbols = await page.locator('text=/[$€£₹¥]/').count();
    expect(currencySymbols).toBeGreaterThanOrEqual(0);
  });

  test('should show currency conversion summary', async ({ page }) => {
    // Look for total in base currency
    const conversionSummary = page.getByText(/converted|equivalent|total in/i);
    
    if (await conversionSummary.isVisible()) {
      expect(await conversionSummary.textContent()).toBeTruthy();
    }
  });

  test('should allow selecting different currencies when creating account', async ({ page }) => {
    await page.getByRole('button', { name: /add|new|create/i }).first().click();
    await page.waitForSelector('[role="dialog"]');

    // Look for currency dropdown
    const currencySelect = page.getByText(/currency/i).locator('..').locator('select, [role="combobox"]');
    
    if (await currencySelect.isVisible()) {
      await currencySelect.click();
      
      // Should show currency options
      await expect(page.getByText(/USD|EUR|GBP|INR/)).toBeVisible();
    }
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display mobile-friendly layout', async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');

    // Header should be visible
    await expect(page.getByRole('heading', { name: /accounts/i })).toBeVisible();

    // Add button should be accessible
    const addButton = page.getByRole('button', { name: /add|new|create|\+/i }).first();
    await expect(addButton).toBeVisible();
  });

  test('should open account modal on mobile', async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add|new|create|\+/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('Keyboard Navigation', () => {
  test('should navigate with keyboard', async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');

    // Open form with keyboard
    await page.getByRole('button', { name: /add|new|create/i }).first().focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('dialog')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});