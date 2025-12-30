# Migration Examples

## Quick Reference: How to Update Your Code

### 🔧 **Backend Route Migration**

#### Example 1: Simple GET endpoint

**❌ Old Code**:
```typescript
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const categoriesContainer = await mongoDBService.getCategoriesContainer();
    const categories = await categoriesContainer.find({ userId }).toArray();

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
    });
  }
});
```

**✅ New Code**:
```typescript
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';
import { DbHelper } from '../utils/dbHelpers';

router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const categoriesContainer = await mongoDBService.getCategoriesContainer();
  const categories = await DbHelper.findAllByUser(categoriesContainer, userId);
  
  ApiResponse.success(res, { categories });
}));
```

#### Example 2: GET by ID with validation

**❌ Old Code**:
```typescript
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const container = await mongoDBService.getTransactionsContainer();
    
    const transaction = await container.findOne({ id, userId });
    
    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
      return;
    }

    res.json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction',
    });
  }
});
```

**✅ New Code**:
```typescript
router.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.userId!;
  const container = await mongoDBService.getTransactionsContainer();
  
  const transaction = await DbHelper.findByIdAndUser(container, id, userId);
  if (!transaction) return ApiResponse.notFound(res, 'Transaction not found');
  
  ApiResponse.success(res, { transaction });
}));
```

#### Example 3: POST with validation

**❌ Old Code**:
```typescript
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name, type } = req.body;

    if (!name || !type) {
      res.status(400).json({
        success: false,
        message: 'Name and type are required',
      });
      return;
    }

    const container = await mongoDBService.getAccountsContainer();
    
    const newAccount = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name,
      type,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await container.insertOne(newAccount);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      account: newAccount,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating account',
    });
  }
});
```

**✅ New Code**:
```typescript
router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { name, type } = req.body;

  if (!name || !type) {
    return ApiResponse.badRequest(res, 'Name and type are required');
  }

  const container = await mongoDBService.getAccountsContainer();
  const newAccount = await DbHelper.createDocument(container, {
    userId,
    name,
    type,
  }, 'acc');

  ApiResponse.created(res, { account: newAccount }, 'Account created successfully');
}));
```

#### Example 4: PUT/Update

**❌ Old Code**:
```typescript
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, type } = req.body;
    const container = await mongoDBService.getAccountsContainer();

    const existing = await container.findOne({ id, userId });
    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
      });
      return;
    }

    await container.updateOne(
      { id, userId },
      { $set: { name, type, updatedAt: new Date() } }
    );

    const updated = await container.findOne({ id, userId });

    res.json({
      success: true,
      message: 'Account updated successfully',
      account: updated,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating account',
    });
  }
});
```

**✅ New Code**:
```typescript
router.put('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.userId!;
  const { name, type } = req.body;
  const container = await mongoDBService.getAccountsContainer();

  const existing = await DbHelper.findByIdAndUser(container, id, userId);
  if (!existing) return ApiResponse.notFound(res, 'Account not found');

  const updated = await DbHelper.updateByIdAndUser(container, id, userId, { name, type });
  const account = await DbHelper.findByIdAndUser(container, id, userId);

  ApiResponse.success(res, { account }, 'Account updated successfully');
}));
```

#### Example 5: DELETE

**❌ Old Code**:
```typescript
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const container = await mongoDBService.getAccountsContainer();

    const existing = await container.findOne({ id, userId });
    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
      });
      return;
    }

    await container.deleteOne({ id, userId });

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting account',
    });
  }
});
```

**✅ New Code**:
```typescript
router.delete('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.userId!;
  const container = await mongoDBService.getAccountsContainer();

  const deleted = await DbHelper.deleteByIdAndUser(container, id, userId);
  if (!deleted) return ApiResponse.notFound(res, 'Account not found');

  ApiResponse.success(res, null, 'Account deleted successfully');
}));
```

---

### ⚛️ **Frontend Component Migration**

#### Example 1: Simple Data Fetching

**❌ Old Code**:
```typescript
const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get('/api/categories');
      setCategories(response.data.categories);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to fetch categories';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {categories.map(cat => <div key={cat.id}>{cat.name}</div>)}
    </div>
  );
};
```

**✅ New Code**:
```typescript
import { useCategories } from '../hooks/useApi';

const Categories = () => {
  const { data, isLoading, error } = useCategories();

  if (isLoading) return <Loading />;
  if (error) return <div>Error: {error.message}</div>;

  const categories = data?.categories || [];

  return (
    <div>
      {categories.map(cat => <div key={cat.id}>{cat.name}</div>)}
    </div>
  );
};
```

#### Example 2: CRUD Operations

**❌ Old Code**:
```typescript
const TransactionList = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/transactions');
      setTransactions(res.data.transactions);
    } catch (err) {
      showToast('Failed to fetch transactions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleCreate = async (data: Partial<Transaction>) => {
    try {
      await axios.post('/api/transactions', data);
      showToast('Transaction created', 'success');
      fetchTransactions(); // Refetch
    } catch (err) {
      showToast('Failed to create transaction', 'error');
    }
  };

  const handleUpdate = async (id: string, data: Partial<Transaction>) => {
    try {
      await axios.put(`/api/transactions/${id}`, data);
      showToast('Transaction updated', 'success');
      fetchTransactions(); // Refetch
    } catch (err) {
      showToast('Failed to update transaction', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/api/transactions/${id}`);
      showToast('Transaction deleted', 'success');
      fetchTransactions(); // Refetch
    } catch (err) {
      showToast('Failed to delete transaction', 'error');
    }
  };

  return (
    // ... JSX
  );
};
```

**✅ New Code**:
```typescript
import { 
  useTransactions, 
  useCreateTransaction, 
  useUpdateTransaction, 
  useDeleteTransaction 
} from '../hooks/useApi';

const TransactionList = () => {
  const { data, isLoading } = useTransactions();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const handleCreate = (data: Partial<Transaction>) => {
    createMutation.mutate(data); // Auto-refetch, auto-toast
  };

  const handleUpdate = (id: string, data: Partial<Transaction>) => {
    updateMutation.mutate({ id, data });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  if (isLoading) return <Loading />;

  const transactions = data?.transactions || [];

  return (
    // ... JSX with handleCreate, handleUpdate, handleDelete
  );
};
```

#### Example 3: Filters & Search

**❌ Old Code**:
```typescript
const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    fetchTransactions();
  }, [searchQuery, startDate, endDate]); // Refetch on filter change

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await axios.get(`/api/transactions?${params}`);
      setTransactions(res.data.transactions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    // ... JSX
  );
};
```

**✅ New Code**:
```typescript
import { useTransactions } from '../hooks/useApi';

const Transactions = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Automatically refetches when filters change
  const { data, isLoading } = useTransactions({ 
    search: searchQuery, 
    startDate, 
    endDate 
  });

  const transactions = data?.transactions || [];

  return (
    // ... JSX
  );
};
```

#### Example 4: Optimistic Updates

**✅ New Code** (Advanced):
```typescript
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateTransaction } from '../hooks/useApi';
import { queryKeys } from '../utils/queryClient';

const TransactionItem = ({ transaction }) => {
  const queryClient = useQueryClient();
  const updateMutation = useUpdateTransaction();

  const handleToggleStatus = () => {
    const newStatus = transaction.reviewStatus === 'approved' ? 'pending' : 'approved';

    updateMutation.mutate(
      { id: transaction.id, data: { reviewStatus: newStatus } },
      {
        // Optimistic update - UI updates immediately
        onMutate: async (variables) => {
          // Cancel outgoing refetches
          await queryClient.cancelQueries({ queryKey: queryKeys.transactions() });

          // Snapshot previous value
          const previousTransactions = queryClient.getQueryData(queryKeys.transactions());

          // Optimistically update UI
          queryClient.setQueryData(queryKeys.transactions(), (old: any) => ({
            ...old,
            transactions: old.transactions.map((t: any) =>
              t.id === transaction.id ? { ...t, reviewStatus: newStatus } : t
            ),
          }));

          return { previousTransactions };
        },
        // Rollback on error
        onError: (err, variables, context) => {
          queryClient.setQueryData(queryKeys.transactions(), context?.previousTransactions);
        },
      }
    );
  };

  return (
    <button onClick={handleToggleStatus}>
      {transaction.reviewStatus}
    </button>
  );
};
```

---

### 📝 **Common Patterns Quick Reference**

#### Backend Response Patterns

```typescript
// Success with data
ApiResponse.success(res, { items });

// Success with message
ApiResponse.success(res, { item }, 'Created successfully');

// Created (201)
ApiResponse.created(res, { item });

// No content (204)
ApiResponse.noContent(res);

// Bad request (400)
ApiResponse.badRequest(res, 'Invalid input');

// Unauthorized (401)
ApiResponse.unauthorized(res);

// Not found (404)
ApiResponse.notFound(res, 'Item not found');

// Conflict (409)
ApiResponse.conflict(res, 'Item already exists');

// Internal error (500)
ApiResponse.internalError(res, error, req);
```

#### Frontend Hook Patterns

```typescript
// Simple fetch
const { data, isLoading, error, refetch } = useTransactions();

// With filters
const { data } = useTransactions({ type: 'debit', startDate: '2025-01-01' });

// Create
const createMutation = useCreateTransaction();
createMutation.mutate({ description: 'Grocery', amount: 100 });

// Update
const updateMutation = useUpdateTransaction();
updateMutation.mutate({ id: '123', data: { amount: 150 } });

// Delete
const deleteMutation = useDeleteTransaction();
deleteMutation.mutate('123');

// Check mutation status
if (createMutation.isPending) return <Spinner />;
if (createMutation.isError) return <Error error={createMutation.error} />;
if (createMutation.isSuccess) return <Success />;
```

---

**Ready to migrate? Start with one route/component and gradually update the rest!** 🚀
