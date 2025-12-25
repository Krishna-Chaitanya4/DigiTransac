# Merchant Learning System

## Overview
The merchant learning system automatically remembers your category and account choices for each merchant, and auto-fills them on future imports.

## How It Works

### 1. Learning Phase (First Approval)
When you approve a pending transaction:
1. System extracts the merchant name (e.g., "Swiggy", "Zerodha")
2. Records the category you assigned (e.g., "Food & Dining")
3. Records the account you used (e.g., "HDFC Savings")
4. Saves this mapping: `Swiggy → Food & Dining + HDFC Savings`

### 2. Auto-Fill Phase (Future Imports)
When a new SMS/email is imported with the same merchant:
1. Parser recognizes the merchant name
2. Queries the learning database
3. Auto-fills the learned category and account
4. Creates transaction with pre-filled data
5. User just needs to review and approve (or modify if needed)

### 3. Learning Updates
- **First approval**: Creates new learning
- **Re-approval with changes**: Updates existing learning with new values
- **Usage tracking**: Counts how many times each mapping is used
- **Recency tracking**: Records last usage date for future confidence scoring

## Features

### Intelligent Matching
- **Exact match**: "Swiggy" matches "Swiggy"
- **Partial match**: "Swiggy Food" matches "Swiggy" (first word matching)
- **Normalized**: Case-insensitive, trimmed spaces

### Skip Generic Merchants
Doesn't learn from:
- "transfer", "cash", "unknown", "n/a"
- Prevents cluttering the learning database

### Per-User Learning
- Each user has their own learning database
- Your mappings don't affect other users

### Multi-Source Support
Works with:
- ✅ SMS imports via `/api/sms/parse`
- ✅ Email imports via `/api/email/import`
- ✅ Gmail polling service (background)

## Database Schema

```typescript
interface MerchantLearning {
  id: string;
  userId: string;
  merchantName: string; // Normalized (lowercase, trimmed)
  categoryId: string;
  accountId?: string;
  usageCount: number; // How many times used
  lastUsedAt: Date; // Most recent usage
  createdAt: Date;
  updatedAt: Date;
}
```

**Index**: `userId + merchantName` (unique)

## API Functions

### `learnFromTransaction(userId, merchantName, categoryId, accountId)`
Called when transaction is approved. Saves or updates merchant mapping.

### `getLearnedMapping(userId, merchantName)`
Returns learned category/account for a merchant. Tries exact match first, then partial match.

### `getUserLearnings(userId)`
Returns all learned mappings for a user (for admin UI or debugging).

### `deleteLearnedMapping(userId, merchantName)`
Removes a specific merchant mapping.

### `clearUserLearnings(userId)`
Clears all learned mappings for a user.

## Example Flow

### Scenario: First Swiggy Order

1. **SMS arrives**: "Rs. 350 debited from your HDFC account at SWIGGY"
2. **Parser creates pending transaction**:
   - Merchant: "Swiggy"
   - Tags: ['expense'] (auto-detected)
   - Category: Empty (no learning yet)
   - Account: Empty

3. **User reviews and fills**:
   - Category: "Food & Dining"
   - Account: "HDFC Savings"
   - Approves

4. **System learns**: `Swiggy → Food & Dining + HDFC Savings` (usageCount: 1)

### Scenario: Second Swiggy Order

1. **SMS arrives**: "Rs. 420 debited from your HDFC account at SWIGGY"
2. **Parser queries learning**: Finds `Swiggy → Food & Dining + HDFC Savings`
3. **Creates pending transaction**:
   - Merchant: "Swiggy"
   - Tags: ['expense'] (auto-detected)
   - **Category: "Food & Dining"** (auto-filled from learning)
   - **Account: "HDFC Savings"** (auto-filled from learning)
   - Split note: "Auto-filled from learning"

4. **User reviews**: Everything pre-filled correctly! Just clicks "Approve"

5. **System updates learning**: usageCount: 2, lastUsedAt: now

### Scenario: User Changes Their Mind

1. **Third Swiggy order**: Auto-filled with previous learning
2. **User decides**: "I want this in 'Dining Out' instead"
3. **User changes category**: "Dining Out"
4. **User approves**
5. **System updates learning**: `Swiggy → Dining Out + HDFC Savings`
6. **Future imports**: Will use "Dining Out" instead

## Benefits

### Time Savings
- **Before**: Fill category + account for every transaction
- **After**: Auto-filled on 2nd+ occurrence

### Consistency
- Same merchant always gets same category (unless you override)
- Reduces data entry errors

### Smart Defaults
- Combined with auto-tagging (investment, loan, transfer detection)
- Proper tags + learned category/account = complete transaction

### User Control
- Can override any auto-filled value
- Override becomes new learning
- Can clear learning if needed

## Future Enhancements

### Confidence Scoring (Planned)
- High confidence: usageCount > 5
- Show confidence indicator in UI
- Allow "suggest" mode instead of auto-fill

### Bulk Learning Import (Planned)
- Import existing transaction history
- Build learning database from past data
- One-time migration for existing users

### Learning Analytics (Planned)
- Show most frequent merchants
- Category distribution per merchant
- Learning accuracy metrics

### Account Number Matching (Planned)
- Match SMS account number to actual accounts
- Auto-select correct account based on last 4 digits

## Technical Details

### Implementation Files
- `backend/src/services/merchantLearning.service.ts` - Core learning logic
- `backend/src/models/types.ts` - MerchantLearning interface
- `backend/src/routes/transaction.routes.ts` - Learning trigger on approval
- `backend/src/services/smsParser.service.ts` - SMS parser integration
- `backend/src/services/emailParser.service.ts` - Email parser integration
- `backend/src/services/gmailPolling.service.ts` - Gmail polling integration
- `backend/src/config/cosmosdb.ts` - Service initialization

### Performance
- Indexed queries: Fast merchant lookup
- Async learning: Doesn't block transaction approval
- Normalized matching: Consistent results

### Error Handling
- Learning failures don't block transaction approval
- Logs errors for debugging
- Graceful fallback to empty values

## Testing Recommendations

1. **First approval**: Verify learning saves
2. **Second import**: Verify auto-fill works
3. **Override**: Verify learning updates
4. **Partial match**: "Swiggy Food" matches "Swiggy"
5. **Multiple merchants**: Each learns independently
6. **Different users**: Learnings are isolated

## Monitoring

Check logs for:
- `Learned mapping: swiggy → category=xxx, account=yyy`
- `Found learned mapping for swiggy`
- `Found partial match for swiggy food: swiggy`
