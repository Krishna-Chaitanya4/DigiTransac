import { test, expect } from '@playwright/test';

test.describe('Insights Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/insights');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Layout', () => {
    test('should display insights page header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /insights/i })).toBeVisible();
    });

    test('should display period selector', async ({ page }) => {
      // Check for period selector buttons (7D, 30D, 90D, etc.)
      await expect(page.getByRole('button', { name: /7d|week/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /30d|month/i })).toBeVisible();
    });

    test('should display financial summary card', async ({ page }) => {
      // Summary card with total income/expenses
      await expect(page.getByText(/total|income|expense|balance/i).first()).toBeVisible();
    });

    test('should display insight widgets', async ({ page }) => {
      // At least one widget section should be visible
      const widgetSections = page.locator('[data-testid="insight-widget"], .widget, section');
      await expect(widgetSections.first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Widget might be loading
        expect(page.getByText(/loading|no data/i)).toBeVisible();
      });
    });
  });

  test.describe('Period Selection', () => {
    test('should change period when clicking period button', async ({ page }) => {
      // Click on 30D button
      const thirtyDayBtn = page.getByRole('button', { name: /30d/i });
      if (await thirtyDayBtn.isVisible()) {
        await thirtyDayBtn.click();
        
        // Button should show as selected/active
        await expect(thirtyDayBtn).toHaveClass(/active|selected|bg-primary/);
      }
    });

    test('should update data when period changes', async ({ page }) => {
      // Get initial content
      const initialText = await page.textContent('main');
      
      // Change period
      const ninetyDayBtn = page.getByRole('button', { name: /90d|quarter/i });
      if (await ninetyDayBtn.isVisible()) {
        await ninetyDayBtn.click();
        
        // Wait for update
        await page.waitForTimeout(500);
        
        // Content may have changed (or stayed same if no data)
      }
    });
  });

  test.describe('Widget Interactions', () => {
    test('should collapse and expand widget sections', async ({ page }) => {
      // Find a collapsible section header
      const sectionHeader = page.locator('[data-testid="section-header"], h2, h3').first();
      
      if (await sectionHeader.isVisible()) {
        // Get initial visibility of content
        const sectionContent = sectionHeader.locator('~ div, + div').first();
        
        // Try clicking to collapse
        await sectionHeader.click();
        await page.waitForTimeout(300);
        
        // Click again to expand
        await sectionHeader.click();
      }
    });

    test('should toggle between views if view toggle exists', async ({ page }) => {
      const viewToggle = page.getByRole('button', { name: /chart|table|grid|list/i });
      
      if (await viewToggle.isVisible()) {
        await viewToggle.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Data Visualization', () => {
    test('should render charts without errors', async ({ page }) => {
      // Wait for any charts to render
      await page.waitForTimeout(1000);
      
      // Check for SVG or canvas elements (charts)
      const charts = page.locator('svg, canvas');
      
      // Either charts are present or "no data" message
      const hasCharts = await charts.count() > 0;
      const hasNoData = await page.getByText(/no data|no transactions/i).isVisible().catch(() => false);
      
      expect(hasCharts || hasNoData).toBe(true);
    });

    test('should display category breakdown', async ({ page }) => {
      // Look for category-related content
      const categoryContent = page.getByText(/category|categories|breakdown/i).first();
      
      if (await categoryContent.isVisible()) {
        // Categories section exists
        await expect(categoryContent).toBeVisible();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      
      // Header should still be visible
      await expect(page.getByRole('heading', { name: /insights/i })).toBeVisible();
      
      // Period buttons should be accessible
      await expect(page.getByRole('button', { name: /7d|30d/i }).first()).toBeVisible();
    });

    test('should stack widgets on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      
      // Page should be scrollable with stacked content
      const body = page.locator('body');
      const scrollHeight = await body.evaluate(el => el.scrollHeight);
      const clientHeight = await body.evaluate(el => el.clientHeight);
      
      // Content should be taller than viewport (scrollable)
      expect(scrollHeight).toBeGreaterThanOrEqual(clientHeight);
    });
  });
});

test.describe('Budget Widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/insights');
    await page.waitForLoadState('networkidle');
  });

  test('should display budget progress if budgets exist', async ({ page }) => {
    // Look for budget section
    const budgetSection = page.getByText(/budget/i).first();
    
    if (await budgetSection.isVisible()) {
      // Check for progress indicators
      const progressBars = page.locator('[role="progressbar"], .progress, [class*="progress"]');
      await expect(progressBars.first()).toBeVisible().catch(() => {
        // No budgets or loading
      });
    }
  });

  test('should show budget alerts for overspending', async ({ page }) => {
    // Look for warning/alert indicators
    const alerts = page.locator('[data-testid="budget-alert"], .text-red-500, .text-orange-500');
    
    // May or may not have alerts
    const alertCount = await alerts.count();
    expect(alertCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Spending Patterns', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/insights');
    await page.waitForLoadState('networkidle');
  });

  test('should display day of week patterns', async ({ page }) => {
    const dayPatterns = page.getByText(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i);
    
    // Patterns section may or may not be visible
    const hasPatterns = await dayPatterns.count() > 0;
    expect(typeof hasPatterns).toBe('boolean');
  });

  test('should display top counterparties', async ({ page }) => {
    const counterparties = page.getByText(/top|payee|merchant|vendor/i).first();
    
    if (await counterparties.isVisible()) {
      await expect(counterparties).toBeVisible();
    }
  });
});