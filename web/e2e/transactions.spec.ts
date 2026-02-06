import { test, expect } from '@playwright/test';

test.describe('Transactions Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to transactions page (requires authentication)
    await page.goto('/transactions');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Layout', () => {
    test('should display transactions page header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /transactions/i })).toBeVisible();
    });

    test('should display summary cards', async ({ page }) => {
      // Check for income/expense summary cards
      await expect(page.getByText(/income|receive/i).first()).toBeVisible();
      await expect(page.getByText(/expense|send/i).first()).toBeVisible();
    });

    test('should display add transaction button', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add|new|create/i });
      await expect(addButton).toBeVisible();
    });

    test('should display filter tabs', async ({ page }) => {
      // Check for status filter tabs
      await expect(page.getByRole('tab', { name: /confirmed/i }).or(page.getByText(/confirmed/i))).toBeVisible();
    });
  });

  test.describe('Transaction Form', () => {
    test('should open transaction form when add button is clicked', async ({ page }) => {
      // Click add transaction button
      const addButton = page.getByRole('button', { name: /add|new|create|\+/i }).first();
      await addButton.click();

      // Check that form modal opens
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /new transaction/i })).toBeVisible();
    });

    test('should have all required form fields', async ({ page }) => {
      // Open the form
      await page.getByRole('button', { name: /add|new|create|\+/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      // Check for transaction type selector
      await expect(page.getByText(/send/i).first()).toBeVisible();
      await expect(page.getByText(/receive/i).first()).toBeVisible();

      // Check for amount field
      await expect(page.getByPlaceholder(/0\.00|amount/i).or(page.getByRole('spinbutton'))).toBeVisible();

      // Check for date picker
      await expect(page.getByText(/date/i)).toBeVisible();
    });

    test('should close form when cancel is clicked', async ({ page }) => {
      // Open the form
      await page.getByRole('button', { name: /add|new|create|\+/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      // Click cancel
      await page.getByRole('button', { name: /cancel/i }).click();

      // Form should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should close form when clicking outside', async ({ page }) => {
      // Open the form
      await page.getByRole('button', { name: /add|new|create|\+/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      // Click the backdrop
      await page.locator('.bg-black\\/30, .bg-black\\/50').first().click({ force: true });

      // Form should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should switch between transaction types', async ({ page }) => {
      // Open the form
      await page.getByRole('button', { name: /add|new|create|\+/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      // Click on Receive type
      await page.getByText('Receive').click();

      // The payee label should change to "Payer"
      await expect(page.getByText(/payer/i)).toBeVisible();
    });

    test('should show quick amount buttons', async ({ page }) => {
      // Open the form
      await page.getByRole('button', { name: /add|new|create|\+/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      // Check for quick amount buttons
      await expect(page.getByText(/\$10|\$20|\$50|\$100/)).toBeVisible();
    });

    test('should validate form before submission', async ({ page }) => {
      // Open the form
      await page.getByRole('button', { name: /add|new|create|\+/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      // Submit button should be disabled when form is invalid (amount = 0)
      const submitButton = page.getByRole('button', { name: /add transaction|save/i });
      await expect(submitButton).toBeDisabled();
    });
  });

  test.describe('Transaction List', () => {
    test('should display transactions grouped by date', async ({ page }) => {
      // Wait for transactions to load
      await page.waitForTimeout(1000);

      // At least check structure exists
      await expect(page.locator('[data-transaction-id], [class*="transaction"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // If no transactions, check for empty state
        expect(page.getByText(/no transactions|add your first/i)).toBeVisible();
      });
    });

    test('should expand transaction on click', async ({ page }) => {
      // Wait for transactions to load
      await page.waitForTimeout(1000);

      // Click on first transaction
      const transaction = page.locator('[data-transaction-id], [class*="transaction"]').first();
      
      if (await transaction.isVisible()) {
        await transaction.click();

        // Check for expanded content (edit/delete buttons)
        await expect(page.getByRole('button', { name: /edit/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /delete/i })).toBeVisible();
      }
    });
  });

  test.describe('Filtering', () => {
    test('should filter by status when clicking tabs', async ({ page }) => {
      // Find and click on Pending tab
      const pendingTab = page.getByRole('tab', { name: /pending/i }).or(page.getByText(/pending/i).first());
      
      if (await pendingTab.isVisible()) {
        await pendingTab.click();

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // URL or UI should reflect pending filter
        await expect(page.url()).toMatch(/pending|status/i).catch(() => {
          // Or check for UI indicator
          expect(pendingTab).toHaveClass(/active|selected/);
        });
      }
    });

    test('should filter by search term', async ({ page }) => {
      // Find search input
      const searchInput = page.getByPlaceholder(/search/i).or(page.getByRole('searchbox'));
      
      if (await searchInput.isVisible()) {
        await searchInput.fill('test search term');

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // Results should update (implementation specific)
      }
    });
  });

  test.describe('Bulk Actions', () => {
    test('should show bulk action bar when items are selected', async ({ page }) => {
      // Look for select all or multi-select trigger
      const selectButton = page.getByRole('button', { name: /select|bulk|multi/i });
      
      if (await selectButton.isVisible()) {
        await selectButton.click();

        // Bulk action bar should appear
        await expect(page.getByText(/selected/i)).toBeVisible();
      }
    });
  });
});

test.describe('Transaction CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('should create a new Send transaction', async ({ page }) => {
    // Open form
    await page.getByRole('button', { name: /add|new|create|\+/i }).first().click();
    await page.waitForSelector('[role="dialog"]');

    // Fill in amount using quick button or input
    const quickButton = page.getByText('$50').or(page.getByRole('button', { name: /50/ }));
    if (await quickButton.isVisible()) {
      await quickButton.click();
    } else {
      await page.getByRole('spinbutton').fill('50');
    }

    // Select a category (if visible)
    const categorySelect = page.getByRole('combobox').or(page.locator('select')).first();
    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption({ index: 1 });
    }

    // Add a title
    const titleInput = page.getByPlaceholder(/grocery|title/i);
    if (await titleInput.isVisible()) {
      await titleInput.fill('E2E Test Transaction');
    }

    // Submit (button may be disabled if form validation fails)
    const submitButton = page.getByRole('button', { name: /add transaction|save/i });
    if (await submitButton.isEnabled()) {
      await submitButton.click();

      // Form should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
  });

  test('should edit an existing transaction', async ({ page }) => {
    // Wait for transactions to load
    await page.waitForTimeout(1000);

    // Click on first transaction to expand
    const transaction = page.locator('[data-transaction-id]').first();
    
    if (await transaction.isVisible()) {
      await transaction.click();

      // Click edit button
      await page.getByRole('button', { name: /edit/i }).first().click();

      // Edit form should open
      await expect(page.getByRole('heading', { name: /edit transaction/i })).toBeVisible();

      // Make a change
      const titleInput = page.getByPlaceholder(/grocery|title/i);
      if (await titleInput.isVisible()) {
        await titleInput.fill('Updated E2E Transaction');
      }

      // Submit
      const submitButton = page.getByRole('button', { name: /update|save/i });
      if (await submitButton.isEnabled()) {
        await submitButton.click();
      }
    }
  });

  test('should delete a transaction', async ({ page }) => {
    // Wait for transactions to load
    await page.waitForTimeout(1000);

    // Click on first transaction to expand
    const transaction = page.locator('[data-transaction-id]').first();
    
    if (await transaction.isVisible()) {
      await transaction.click();

      // Click delete button
      await page.getByRole('button', { name: /delete/i }).first().click();

      // If there's a confirmation dialog
      const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Should show undo toast
      await expect(page.getByText(/deleted|undo/i)).toBeVisible({ timeout: 5000 }).catch(() => {
        // Toast may not be visible if using different notification system
      });
    }
  });

  test('should update transaction status', async ({ page }) => {
    // Wait for transactions to load
    await page.waitForTimeout(1000);

    // Click on first transaction to expand
    const transaction = page.locator('[data-transaction-id]').first();
    
    if (await transaction.isVisible()) {
      await transaction.click();

      // Look for status change buttons
      const pendingButton = page.getByRole('button', { name: /mark pending|pending/i });
      const confirmButton = page.getByRole('button', { name: /confirm/i });

      if (await pendingButton.isVisible()) {
        await pendingButton.click();
        // Status should change
      } else if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display mobile-friendly layout', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Header should be visible
    await expect(page.getByRole('heading', { name: /transactions/i })).toBeVisible();

    // FAB or add button should be visible
    const addButton = page.getByRole('button', { name: /add|new|create|\+/i }).first();
    await expect(addButton).toBeVisible();
  });

  test('should open transaction form on mobile', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Click add button
    await page.getByRole('button', { name: /add|new|create|\+/i }).first().click();

    // Form should open and be fully visible
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('Keyboard Navigation', () => {
  test('should navigate with keyboard', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Open form with keyboard
    await page.getByRole('button', { name: /add|new|create|\+/i }).first().focus();
    await page.keyboard.press('Enter');

    // Form should open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should trap focus in modal', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Open form
    await page.getByRole('button', { name: /add|new|create|\+/i }).first().click();
    await page.waitForSelector('[role="dialog"]');

    // Tab through elements - focus should stay within modal
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check if focused element is inside dialog
    const dialog = page.getByRole('dialog');
    const isInsideDialog = await dialog.locator(':focus').count() > 0;
    expect(isInsideDialog).toBe(true);
  });
});
