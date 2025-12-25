# Migration from Legacy merchantMappings to MerchantLearning

## Background
Previously, merchant-to-category mappings were stored in `user.emailIntegration.merchantMappings[]`. This has been **superseded** by the new `MerchantLearning` collection.

## Why Migrate?

### Legacy System (Deprecated)
- ❌ Stored in user document (poor scalability)
- ❌ Email-only (doesn't work for SMS imports)
- ❌ Manual keyword-based (requires user setup)
- ❌ No usage tracking or confidence scoring
- ❌ Embedded array (query performance issues)

### New System (Recommended)
- ✅ Separate collection (scales independently)
- ✅ Multi-source (SMS, email, Gmail polling)
- ✅ Auto-learns from approvals (zero setup)
- ✅ Usage tracking and recency (confidence scoring)
- ✅ Indexed queries (fast merchant lookup)
- ✅ Per-merchant precision (not keyword matching)

## Current State (Backward Compatible)

The system uses a **fallback hierarchy**:

```typescript
// Priority order:
1. MerchantLearning (new system) ← Checked first
2. merchantMappings (legacy)     ← Fallback if no learning
3. Empty/Uncategorized           ← Last resort
```

**Result**: Existing users with `merchantMappings` continue to work, but new approvals create `MerchantLearning` entries.

## Migration Path

### Option 1: Natural Migration (Recommended)
No action needed! As users approve transactions:
- New `MerchantLearning` entries are created
- These take priority over legacy `merchantMappings`
- Legacy mappings remain as fallback

**Timeline**: 2-4 weeks for active users

### Option 2: One-Time Data Migration (Optional)
Convert existing `merchantMappings` to `MerchantLearning`:

```typescript
// Migration script (to be implemented)
async function migrateMerchantMappings(userId: string) {
  const user = await getUserById(userId);
  
  if (user.emailIntegration?.merchantMappings) {
    for (const mapping of user.emailIntegration.merchantMappings) {
      await learnFromTransaction(
        userId,
        mapping.merchantKeyword, // Convert keyword to merchant name
        mapping.categoryId,
        '' // No account info in legacy system
      );
    }
    
    // Optionally clear legacy mappings
    await updateUser(userId, {
      'emailIntegration.merchantMappings': []
    });
  }
}
```

## API Changes

### No Breaking Changes
All existing endpoints continue to work:
- `POST /api/email/import` - Uses fallback hierarchy
- Gmail polling - Uses fallback hierarchy
- Transaction approval - Auto-creates learning

### Deprecated Fields
```typescript
// These still work but are marked @deprecated:
interface EmailIntegration {
  merchantMappings?: MerchantCategoryMapping[]; // @deprecated
}

interface MerchantCategoryMapping { // @deprecated
  merchantKeyword: string;
  categoryId: string;
  createdAt: Date;
}
```

## Timeline for Removal

### Phase 1: Deprecation (Current)
- ✅ Mark `merchantMappings` as deprecated
- ✅ Add deprecation warnings in code
- ✅ Document migration path
- ✅ Keep fallback support

### Phase 2: Migration Period (3-6 months)
- Notify users of deprecation
- Provide migration tools
- Monitor usage of legacy system
- Collect feedback

### Phase 3: Removal (6+ months)
- Remove `merchantMappings` field
- Remove `suggestCategory()` method
- Clean up fallback logic
- Update API docs

## For Developers

### When Building New Features
```typescript
// ✅ DO: Use MerchantLearning
import { getLearnedMapping } from './services/merchantLearning.service';
const learned = await getLearnedMapping(userId, merchantName);

// ❌ DON'T: Use merchantMappings
const legacy = emailParserService.suggestCategory(merchant, user.emailIntegration?.merchantMappings);
```

### Testing
Ensure fallback behavior works:
1. Test with no learning (uses legacy)
2. Test with learning (ignores legacy)
3. Test with neither (uses uncategorized)

## Questions?

- **Q: Will my old mappings stop working?**  
  A: No, they continue as fallback until overridden by new learning.

- **Q: Do I need to do anything?**  
  A: No, the system auto-migrates as you use it.

- **Q: Can I clear old mappings?**  
  A: Yes, but wait until you have enough `MerchantLearning` data (check after 2-3 weeks of usage).

- **Q: What about SMS imports?**  
  A: They never used `merchantMappings`, so they immediately benefit from `MerchantLearning`.

## Benefits Summary

After migration (automatic or manual):
- ✅ Faster queries (indexed collection vs embedded array)
- ✅ Better accuracy (exact merchant match vs keyword)
- ✅ Auto-learning (no manual setup)
- ✅ Multi-source support (SMS + email + Gmail)
- ✅ Usage insights (track which merchants are common)
- ✅ Account learning (not just category)
