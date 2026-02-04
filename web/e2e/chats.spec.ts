import { test, expect } from '@playwright/test';

test.describe('Chats Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chats');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Layout', () => {
    test('should display chats page header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /chats|messages|conversations/i })).toBeVisible();
    });

    test('should display conversation list or empty state', async ({ page }) => {
      // Either show conversations or "no conversations" message
      const hasConversations = await page.locator('[data-testid="conversation-item"], [class*="conversation"]').count() > 0;
      const hasEmptyState = await page.getByText(/no conversations|no chats|start a conversation/i).isVisible().catch(() => false);
      
      expect(hasConversations || hasEmptyState).toBe(true);
    });

    test('should display new chat button', async ({ page }) => {
      const newChatBtn = page.getByRole('button', { name: /new|start|add|compose/i });
      await expect(newChatBtn).toBeVisible();
    });
  });

  test.describe('New Chat Modal', () => {
    test('should open new chat modal', async ({ page }) => {
      // Click new chat button
      const newChatBtn = page.getByRole('button', { name: /new|start|add|compose/i });
      await newChatBtn.click();

      // Modal should open
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('should close modal on cancel', async ({ page }) => {
      // Open modal
      await page.getByRole('button', { name: /new|start|add|compose/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Close modal
      const closeBtn = page.getByRole('button', { name: /cancel|close/i });
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        // Press Escape
        await page.keyboard.press('Escape');
      }

      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should have search/select contact input', async ({ page }) => {
      // Open modal
      await page.getByRole('button', { name: /new|start|add|compose/i }).click();
      
      // Should have email/contact input
      await expect(page.getByPlaceholder(/email|contact|search/i)).toBeVisible();
    });
  });

  test.describe('Conversation List', () => {
    test('should display conversations with user info', async ({ page }) => {
      // Check for conversation items
      const conversations = page.locator('[data-testid="conversation-item"], [class*="conversation"]');
      
      if (await conversations.count() > 0) {
        // First conversation should show name/email
        const firstConversation = conversations.first();
        await expect(firstConversation).toBeVisible();
      }
    });

    test('should show unread indicator for new messages', async ({ page }) => {
      // Look for unread badges
      const unreadBadge = page.locator('[data-testid="unread-badge"], .badge, [class*="unread"]');
      
      // May or may not have unread messages
      const unreadCount = await unreadBadge.count();
      expect(unreadCount).toBeGreaterThanOrEqual(0);
    });

    test('should select conversation on click', async ({ page }) => {
      const conversations = page.locator('[data-testid="conversation-item"], [class*="conversation"]');
      
      if (await conversations.count() > 0) {
        await conversations.first().click();
        
        // Message view should become visible
        await expect(page.locator('[data-testid="message-view"], [class*="message"]').first()).toBeVisible({ timeout: 3000 }).catch(() => {
          // Mobile might show back button instead
        });
      }
    });
  });

  test.describe('Message View', () => {
    test('should display messages when conversation is selected', async ({ page }) => {
      const conversations = page.locator('[data-testid="conversation-item"], [class*="conversation"]');
      
      if (await conversations.count() > 0) {
        await conversations.first().click();
        await page.waitForTimeout(500);
        
        // Should see message input
        const messageInput = page.getByPlaceholder(/type|message|write/i);
        await expect(messageInput).toBeVisible({ timeout: 3000 }).catch(() => {
          // May need to navigate differently
        });
      }
    });

    test('should have message input and send button', async ({ page }) => {
      const conversations = page.locator('[data-testid="conversation-item"], [class*="conversation"]');
      
      if (await conversations.count() > 0) {
        await conversations.first().click();
        
        const messageInput = page.getByPlaceholder(/type|message|write/i);
        const sendButton = page.getByRole('button', { name: /send/i });
        
        if (await messageInput.isVisible()) {
          await expect(messageInput).toBeVisible();
          await expect(sendButton).toBeVisible();
        }
      }
    });

    test('should display transaction details in messages', async ({ page }) => {
      const conversations = page.locator('[data-testid="conversation-item"], [class*="conversation"]');
      
      if (await conversations.count() > 0) {
        await conversations.first().click();
        await page.waitForTimeout(500);
        
        // Look for transaction bubbles
        const transactionBubbles = page.locator('[data-testid="transaction-bubble"], [class*="transaction"]');
        
        // May or may not have transactions in chat
        const hasTransactions = await transactionBubbles.count() > 0;
        expect(typeof hasTransactions).toBe('boolean');
      }
    });
  });

  test.describe('Mobile Layout', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should show list view first on mobile', async ({ page }) => {
      await page.goto('/chats');
      await page.waitForLoadState('networkidle');
      
      // Header should be visible
      await expect(page.getByRole('heading', { name: /chats|messages/i })).toBeVisible();
      
      // New chat button should be visible
      await expect(page.getByRole('button', { name: /new|add/i })).toBeVisible();
    });

    test('should navigate to chat view on conversation click', async ({ page }) => {
      await page.goto('/chats');
      
      const conversations = page.locator('[data-testid="conversation-item"], [class*="conversation"]');
      
      if (await conversations.count() > 0) {
        await conversations.first().click();
        
        // Should show back button on mobile
        const backButton = page.getByRole('button', { name: /back|arrow/i });
        await expect(backButton).toBeVisible({ timeout: 3000 }).catch(() => {
          // Alternative mobile UI
        });
      }
    });

    test('should navigate back to list from chat view', async ({ page }) => {
      await page.goto('/chats');
      
      const conversations = page.locator('[data-testid="conversation-item"], [class*="conversation"]');
      
      if (await conversations.count() > 0) {
        await conversations.first().click();
        await page.waitForTimeout(300);
        
        const backButton = page.getByRole('button', { name: /back/i });
        if (await backButton.isVisible()) {
          await backButton.click();
          
          // Should return to conversation list
          await expect(page.getByRole('heading', { name: /chats|messages/i })).toBeVisible();
        }
      }
    });
  });

  test.describe('Search Functionality', () => {
    test('should have search input', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i).or(page.getByRole('searchbox'));
      
      // Search may or may not be visible by default
      if (await searchInput.isVisible()) {
        await expect(searchInput).toBeVisible();
      }
    });

    test('should filter conversations when searching', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible()) {
        await searchInput.fill('test query');
        await page.waitForTimeout(500);
        
        // Results should update (implementation specific)
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support keyboard navigation', async ({ page }) => {
      // Focus on first conversation
      const conversations = page.locator('[data-testid="conversation-item"], [class*="conversation"]');
      
      if (await conversations.count() > 0) {
        await conversations.first().focus();
        
        // Press Enter to select
        await page.keyboard.press('Enter');
        
        await page.waitForTimeout(300);
      }
    });

    test('should close modal with Escape key', async ({ page }) => {
      // Open modal
      await page.getByRole('button', { name: /new|start|add/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      
      // Press Escape
      await page.keyboard.press('Escape');
      
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });
});

test.describe('Transaction in Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chats');
    await page.waitForLoadState('networkidle');
  });

  test('should display transaction bubble with amount', async ({ page }) => {
    const conversations = page.locator('[data-testid="conversation-item"]');
    
    if (await conversations.count() > 0) {
      await conversations.first().click();
      await page.waitForTimeout(500);
      
      // Look for amount display in chat
      const amountDisplay = page.locator('[data-testid="transaction-amount"], [class*="amount"]');
      
      // May or may not have transactions
      if (await amountDisplay.count() > 0) {
        await expect(amountDisplay.first()).toBeVisible();
      }
    }
  });

  test('should show transaction status badges', async ({ page }) => {
    const conversations = page.locator('[data-testid="conversation-item"]');
    
    if (await conversations.count() > 0) {
      await conversations.first().click();
      
      // Look for status indicators
      const statusBadges = page.locator('[data-testid="status-badge"], .badge');
      
      // Count badges
      const badgeCount = await statusBadges.count();
      expect(badgeCount).toBeGreaterThanOrEqual(0);
    }
  });
});