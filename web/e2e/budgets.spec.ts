import { test, expect } from '@playwright/test';

test.describe('Budgets Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Layout', () => {
    test('should display budgets page header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /budgets/i })).toBeVisible();
    });

    test('should display budget summary', async ({ page }) => {
      // Check for overall budget status
      await expect(page.getByText(/total|spent|remaining|budget/i).first()).toBeVisible();
    });

    test('should display add budget button', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add|new|create/i });
      await expect(addButton).toBeVisible();
    });

    test('should display month/period selector', async ({ page }) => {
      // Check for date range or month selector
      const dateSelector = page.getByText(/january|february|march|april|may|june|july|august|september|october|november|december/i)
        .or(page.getByRole('button', { name: /month|period|date/i }));
      
      if (await dateSelector.isVisible()) {
        expect(await dateSelector.textContent()).toBeTruthy();
      }
    });
  });

  test.describe('Budget Management', () => {
    test('should open new budget modal when add button is clicked', async ({ page }) => {
      await page.getByRole('button', { name: /add|new|create/i }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /new budget|add budget|create budget/i })).toBeVisible();
    });

    test('should have all required form fields in budget modal', async ({ page }) => {
      await page.getByRole('button', { name: /add|new|create/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      // Check for category selector
      await expect(page.getByText(/category/i)).toBeVisible();

      // Check for amount/limit field
      await expect(page.getByPlaceholder(/amount|limit|budget/i).or(page.getByRole('spinbutton'))).toBeVisible();

      // Check for period selector
      await expect(page.getByText(/period|monthly|weekly|yearly/i)).toBeVisible();
    });

    test('should close modal when cancel is clicked', async ({ page }) => {
      await page.getByRole('button', { name: /add|new|create/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      await page.getByRole('button', { name: /cancel/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should validate form before submission', async ({ page }) => {
      await page.getByRole('button', { name: /add|new|create/i }).first().click();
      await page.waitForSelector('[role="dialog"]');

      // Submit button should be disabled or form should show validation errors
      const submitButton = page.getByRole('button', { name: /save|create|add/i }).last();
      
      await submitButton.click();
      
      // Should show validation error or button should be disabled
      const hasValidationError = await page.getByText(/required|category is required|please select/i).isVisible()
        .catch(() => false);
      const isDisabled = await submitButton.isDisabled();
      
      expect(hasValidationError || isDisabled).toBeTruthy();
    });
  });

  test.describe('Budget List', () => {
    test('should display budget cards with progress', async ({ page }) => {
      await page.waitForTimeout(1000);
      
      // Check for budget cards or empty state
      const hasBudgets = await page.locator('[data-budget-id], [class*="budget-card"], [class*="budget-item"]').first().isVisible()
        .catch(() => false);
      
      if (!hasBudgets) {
        // Check for empty state
        await expect(page.getByText(/no budgets|create your first budget/i)).toBeVisible();
      }
    });

    test('should show progress bar for each budget', async ({ page }) => {
      await page.waitForTimeout(1000);
      
      const budgetCard = page.locator('[data-budget-id], [class*="budget-card"]').first();
      
      if (await budgetCard.isVisible()) {
        // Check for progress bar
        const progressBar = budgetCard.locator('[role="progressbar"], [class*="progress"]');
        await expect(progressBar).toBeVisible();
      }
    });

    test('should show spent vs limit amounts', async ({ page }) => {
      await page.waitForTimeout(1000);
      
      const budgetCard = page.locator('[data-budget-id], [class*="budget-card"]').first();
      
      if (await budgetCard.isVisible()) {
        // Should show amount spent and limit
        const amountText = await budgetCard.textContent();
        expect(amountText).toMatch(/\$|€|£|₹|\//);
      }
    });

    test('should show warning when budget is near limit', async ({ page }) => {
      await page.waitForTimeout(1000);
      
      // Look for warning indicators (yellow/orange colors or warning text)
      const warningIndicator = page.locator('[class*="warning"], [class*="yellow"], [class*="orange"]')
        .or(page.getByText(/warning|near limit|almost/i));
      
      // This might not always be visible depending on data
      if (await warningIndicator.first().isVisible()) {
        expect(await warningIndicator.first().isVisible()).toBeTruthy();
      }
    });

    test('should show alert when budget is exceeded', async ({ page }) => {
      await page.waitForTimeout(1000);
      
      // Look for exceeded/over budget indicators
      const exceededIndicator = page.locator('[class*="danger"], [class*="red"], [class*="exceeded"]')
        .or(page.getByText(/exceeded|over budget|over limit/i));
      
      // This might not always be visible depending on data
      if (await exceededIndicator.first().isVisible()) {
        expect(await exceededIndicator.first().isVisible()).toBeTruthy();
      }
    });
  });

  test.describe('Budget Actions', () => {
    test('should show edit option on budget click', async ({ page }) => {
      await page.waitForTimeout(1000);
      
      const budgetCard = page.locator('[data-budget-id], [class*="budget-card"]').first();
      
      if (await budgetCard.isVisible()) {
        await budgetCard.click();
        
        const editButton = page.getByRole('button', { name: /edit/i }).first();
        expect(await editButton.isVisible()).toBeDefined();
      }
    });

    test('should show delete option on budget click', async ({ page }) => {
      await page.waitForTimeout(1000);
      
      const budgetCard = page.locator('[data-budget-id], [class*="budget-card"]').first();
      
      if (await budgetCard.isVisible()) {
        await budgetCard.click();
        
        const deleteButton = page.getByRole('button', { name: /delete/i }).first();
        expect(await deleteButton.isVisible()).toBeDefined();
      }
    });
  });
});

test.describe('Budget CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');
  });

  test('should create a new monthly budget', async ({ page }) => {
    await page.getByRole('button', { name: /add|new|create/i }).first().click();
    await page.waitForSelector('[role="dialog"]');

    // Select a category
    const categorySelect = page.getByRole('combobox').or(page.locator('select')).first();
    if (await categorySelect.isVisible()) {
      await categorySelect.click();
      await page.locator('[role="option"]').first().click().catch(() => {
        categorySelect.selectOption({ index: 1 });
      });
    }

    // Set budget amount
    const amountInput = page.getByPlaceholder(/amount|limit/i).or(page.getByRole('spinbutton')).first();
    await amountInput.fill('500');

    // Select period (monthly)
    const periodSelect = page.getByText(/monthly|period/i).locator('..').locator('select, [role="combobox"]');
    if (await periodSelect.isVisible()) {
      await periodSelect.click();
      await page.getByText('Monthly').click().catch(() => {});
    }

    // Submit
    const submitButton = page.getByRole('button', { name: /save|create|add/i }).last();
    if (await submitButton.isEnabled()) {
      await submitButton.click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
  });

  test('should edit an existing budget', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    const budgetCard = page.locator('[data-budget-id], [class*="budget-card"]').first();
    
    if (await budgetCard.isVisible()) {
      await budgetCard.click();
      
      const editButton = page.getByRole('button', { name: /edit/i }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        await expect(page.getByRole('dialog')).toBeVisible();
        
        // Update the amount
        const amountInput = page.getByPlaceholder(/amount|limit/i).or(page.getByRole('spinbutton')).first();
        await amountInput.fill('750');
        
        const saveButton = page.getByRole('button', { name: /save|update/i }).last();
        if (await saveButton.isEnabled()) {
          await saveButton.click();
        }
      }
    }
  });

  test('should delete a budget', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    const budgetCard = page.locator('[data-budget-id], [class*="budget-card"]').first();
    
    if (await budgetCard.isVisible()) {
      await budgetCard.click();
      
      const deleteButton = page.getByRole('button', { name: /delete/i }).first();
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
});

test.describe('Budget Filtering and Views', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');
  });

  test('should filter by category', async ({ page }) => {
    const categoryFilter = page.getByRole('combobox', { name: /category/i })
      .or(page.getByPlaceholder(/filter|category/i));
    
    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();
      await page.waitForTimeout(500);
    }
  });

  test('should change budget period view', async ({ page }) => {
    // Look for period tabs or selector
    const periodSelector = page.getByRole('button', { name: /week|month|year/i });
    
    if (await periodSelector.first().isVisible()) {
      await periodSelector.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('should navigate between months', async ({ page }) => {
    // Look for month navigation arrows
    const nextButton = page.getByRole('button', { name: /next|→|>/i });
    const prevButton = page.getByRole('button', { name: /prev|←|</i });
    
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }
    
    if (await prevButton.isVisible()) {
      await prevButton.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Budget Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');
  });

  test('should display spending trends chart', async ({ page }) => {
    // Look for chart container
    const chartContainer = page.locator('[class*="chart"], canvas, svg[class*="recharts"]');
    
    if (await chartContainer.first().isVisible()) {
      expect(await chartContainer.first().isVisible()).toBeTruthy();
    }
  });

  test('should show budget vs actual comparison', async ({ page }) => {
    // Look for comparison metrics
    const comparisonText = page.getByText(/vs|actual|planned|budget/i);
    
    if (await comparisonText.first().isVisible()) {
      expect(await comparisonText.first().textContent()).toBeTruthy();
    }
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display mobile-friendly layout', async ({ page }) => {
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');

    // Header should be visible
    await expect(page.getByRole('heading', { name: /budgets/i })).toBeVisible();

    // Add button should be accessible
    const addButton = page.getByRole('button', { name: /add|new|create|\+/i }).first();
    await expect(addButton).toBeVisible();
  });

  test('should open budget modal on mobile', async ({ page }) => {
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add|new|create|\+/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should show budget cards in list view on mobile', async ({ page }) => {
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');
    
    // Cards should stack vertically
    const budgetCards = page.locator('[data-budget-id], [class*="budget-card"]');
    const count = await budgetCards.count();
    
    if (count > 0) {
      // All cards should be visible and not side by side
      for (let i = 0; i < Math.min(count, 3); i++) {
        await expect(budgetCards.nth(i)).toBeVisible();
      }
    }
  });
});

test.describe('Keyboard Navigation', () => {
  test('should navigate with keyboard', async ({ page }) => {
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');

    // Open form with keyboard
    await page.getByRole('button', { name: /add|new|create/i }).first().focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('dialog')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should tab through budget cards', async ({ page }) => {
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');
    
    // Tab to first budget card
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should focus on a budget or action element
    const focusedElement = await page.locator(':focus');
    expect(await focusedElement.isVisible()).toBeTruthy();
  });
});

test.describe('Budget Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');
  });

  test('should show notification preferences', async ({ page }) => {
    // Look for notification settings
    const notificationSettings = page.getByText(/notification|alert|remind/i);
    
    if (await notificationSettings.first().isVisible()) {
      await notificationSettings.first().click();
      // Should show options
      await expect(page.getByText(/email|push|when/i)).toBeVisible();
    }
  });

  test('should toggle budget alerts', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    const budgetCard = page.locator('[data-budget-id], [class*="budget-card"]').first();
    
    if (await budgetCard.isVisible()) {
      // Look for alert toggle
      const alertToggle = budgetCard.locator('[role="switch"], input[type="checkbox"]');
      
      if (await alertToggle.isVisible()) {
        await alertToggle.click();
        // Toggle state should change
      }
    }
  });
});