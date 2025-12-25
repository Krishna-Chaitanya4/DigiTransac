# Offline Support

DigiTransac now includes comprehensive offline support, allowing you to use the app without an internet connection.

## Features

### 1. **Offline Data Storage**
- All transactions, categories, accounts, and budgets are cached locally using IndexedDB
- Data persists even after closing the app
- Automatic cache updates when online

### 2. **Optimistic UI Updates**
- Changes appear instantly in the UI
- Automatic synchronization happens in the background
- No waiting for network requests

### 3. **Background Sync**
- Changes made offline are queued automatically
- Syncs when internet connection is restored
- Retry mechanism for failed syncs (up to 5 attempts)
- Manual sync available via pull-to-refresh

### 4. **Offline Indicator**
- Visual banner shows when you're offline
- Displays number of pending changes
- Success notification when back online and synced

### 5. **PWA Installation**
- Install as a native app on mobile and desktop
- Runs in standalone mode (no browser UI)
- Automatic updates when new versions are available

## How It Works

### Offline Data Flow
```
User Action → IndexedDB (immediate) → Sync Queue → Server (when online)
                    ↓
                UI Updates
```

### Online Data Flow  
```
User Action → Server → IndexedDB (cache) → UI Updates
```

### Conflict Resolution
- **Last-write-wins**: Server changes override local changes
- **Retry logic**: Failed syncs retry up to 5 times
- **Manual override**: Users can manually trigger sync

## Using Offline Features

### In Code

```typescript
import { offlineAPI } from '@/utils/offline';
import { useOffline } from '@/hooks/useOffline';

function MyComponent() {
  const { isOnline, queueSize, manualSync } = useOffline();

  const handleCreateTransaction = async () => {
    // Works offline - automatically queued for sync
    const transaction = await offlineAPI.createTransaction({
      amount: 100,
      type: 'expense',
      category: 'food',
      description: 'Lunch',
      date: new Date().toISOString(),
    });
    
    // UI updates immediately
    // Syncs automatically when online
  };

  return (
    <div>
      {!isOnline && <p>Offline mode - {queueSize} changes pending</p>}
      <button onClick={manualSync}>Sync Now</button>
    </div>
  );
}
```

### API Methods

#### Transactions
```typescript
// Get all transactions (from server or cache)
const transactions = await offlineAPI.getTransactions(userId);

// Create (works offline)
const created = await offlineAPI.createTransaction(data);

// Update (works offline)
const updated = await offlineAPI.updateTransaction(id, updates);

// Delete (works offline)
await offlineAPI.deleteTransaction(id);
```

#### Categories, Accounts, Budgets
Similar pattern - all methods work offline with automatic sync.

## Testing Offline Features

### Chrome DevTools
1. Open DevTools → Network tab
2. Select "Offline" from throttling dropdown
3. Test creating/editing transactions
4. Go back online
5. Watch automatic sync in console

### Mobile
1. Enable airplane mode
2. Use the app normally
3. Disable airplane mode
4. Watch sync notification appear

## IndexedDB Structure

### Stores
- **transactions**: All user transactions
- **categories**: Expense and income categories  
- **accounts**: Bank accounts and wallets
- **budgets**: Budget allocations
- **syncQueue**: Pending changes to sync
- **metadata**: Last sync timestamps, settings

### Indexes
- `userId`: All stores indexed by user ID
- `date`: Transactions indexed by date
- `category`: Transactions indexed by category
- `type`: Transactions and categories indexed by type

## Sync Queue

Changes made offline are stored in a sync queue:

```typescript
interface SyncQueueItem {
  id: string;              // Auto-generated
  type: 'create' | 'update' | 'delete';
  entity: 'transaction' | 'category' | 'account' | 'budget';
  data: any;               // The actual data to sync
  timestamp: number;       // When queued
  retryCount: number;      // Number of failed attempts
}
```

### Sync Process
1. Changes added to queue immediately
2. Auto-sync every 30 seconds when online
3. Manual sync via pull-to-refresh
4. Background sync when app reopens
5. Failed items retry with exponential backoff
6. Items removed after 5 failed attempts

## Performance

### Cache Strategy
- **Static assets**: Cache-first (instant load)
- **API requests**: Network-first, cache fallback
- **Offline**: IndexedDB-only (no network calls)

### Storage Limits
- IndexedDB: ~50MB on mobile, ~100MB on desktop
- Automatic cleanup of old data (configurable)
- Manual clear via settings

## Security

- All data encrypted in transit (HTTPS)
- IndexedDB data stored unencrypted locally
- Sensitive data (passwords) never cached
- Clear all data on logout

## Browser Support

- ✅ Chrome 67+
- ✅ Edge 79+
- ✅ Firefox 62+
- ✅ Safari 14+
- ✅ Chrome Android
- ✅ Safari iOS 14+

## Troubleshooting

### Sync not working
1. Check network connection
2. Check browser console for errors
3. Try manual sync (pull-to-refresh)
4. Clear cache and re-login if persistent

### Data missing offline
1. Ensure you've used the app online at least once
2. Check IndexedDB in DevTools → Application tab
3. Verify not in incognito mode (IndexedDB disabled)

### Too many pending changes
1. Go online to sync
2. Check server connectivity
3. Review failed sync items in console
4. Contact support if issues persist

## Future Enhancements

- ⏳ Conflict resolution UI
- ⏳ Selective sync (choose what to sync)
- ⏳ Compression for large datasets
- ⏳ Encrypted local storage
- ⏳ Multi-device sync status
