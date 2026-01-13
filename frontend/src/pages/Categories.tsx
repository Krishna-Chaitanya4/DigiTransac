import React, { useState, useEffect, useContext } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  CircularProgress,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  FolderOpen as FolderOpenIcon,
  Folder as FolderIcon,
  SearchOff as SearchOffIcon,
} from '@mui/icons-material';
import { Category, CategoryType, CreateCategoryRequest, UpdateCategoryRequest } from '../types';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

interface CategoryNode extends Category {
  children?: CategoryNode[];
  isExpanded?: boolean;
}

interface DialogState {
  open: boolean;
  mode: 'create' | 'edit';
  category: Partial<Category>;
  parentId?: string;
}

const Categories: React.FC = () => {
  const auth = useContext(AuthContext);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Category' | 'Folder'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'recent'>('name');
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    mode: 'create',
    category: {},
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id?: string }>({ open: false });

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5253/api';

  // Fetch categories
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/v1/categories`, {
        headers: { Authorization: `Bearer ${auth?.token}` },
      });

      if (response.data.success && response.data.data) {
        const categoryList = Array.isArray(response.data.data) ? response.data.data : [];
        const hierarchical = buildHierarchy(categoryList);
        setCategories(hierarchical);
        applyFiltersAndSort(hierarchical);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load categories';
      setError(message);
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const buildHierarchy = (flatList: Category[]): CategoryNode[] => {
    const map = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];

    // First pass: create map
    flatList.forEach((cat) => {
      map.set(cat.id, { ...cat, children: [], isExpanded: false });
    });

    // Second pass: build hierarchy
    flatList.forEach((cat) => {
      const node = map.get(cat.id)!;
      if (cat.parentId && map.has(cat.parentId)) {
        const parent = map.get(cat.parentId)!;
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort each level by name
    const sortNodes = (nodes: CategoryNode[]) => {
      nodes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      nodes.forEach((node) => {
        if (node.children) sortNodes(node.children);
      });
    };
    sortNodes(roots);

    return roots;
  };

  const applyFiltersAndSort = (items: CategoryNode[]) => {
    let result = [...items];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filterRecursive = (nodes: CategoryNode[]): CategoryNode[] => {
        return nodes
          .filter((cat) => cat.name.toLowerCase().includes(term) || (cat.children && cat.children.length > 0))
          .map((cat) => ({
            ...cat,
            children: cat.children ? filterRecursive(cat.children) : [],
          }));
      };
      result = filterRecursive(result);
    }

    // Type filter
    if (filterType !== 'All') {
      const filterByType = (nodes: CategoryNode[]): CategoryNode[] => {
        return nodes
          .filter((cat) => cat.type === filterType)
          .map((cat) => ({
            ...cat,
            children: cat.children ? filterByType(cat.children) : [],
          }));
      };
      result = filterByType(result);
    }

    // Sort
    const sortRecursive = (nodes: CategoryNode[]) => {
      nodes.sort((a, b) => {
        if (sortBy === 'usage') {
          return (b.transactionCount || 0) - (a.transactionCount || 0);
        } else if (sortBy === 'recent') {
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        }
        return (a.name || '').localeCompare(b.name || '');
      });
      nodes.forEach((node) => {
        if (node.children) sortRecursive(node.children);
      });
    };
    sortRecursive(result);

    setFilteredCategories(result);
  };

  const handleToggleExpand = (id: string) => {
    const toggleNode = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes.map((node) => {
        if (node.id === id) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        return { ...node, children: node.children ? toggleNode(node.children) : [] };
      });
    };
    const updated = toggleNode(categories);
    setCategories(updated);
    applyFiltersAndSort(updated);
  };

  const handleOpenDialog = (mode: 'create' | 'edit', category?: Category, parentId?: string) => {
    setDialog({
      open: true,
      mode,
      category: mode === 'edit' && category ? { ...category } : { type: CategoryType.Category },
      parentId,
    });
  };

  const handleCloseDialog = () => {
    setDialog({ open: false, mode: 'create', category: {} });
  };

  const handleSaveCategory = async () => {
    try {
      const payload = {
        name: dialog.category.name,
        type: dialog.category.type || CategoryType.Category,
        icon: dialog.category.icon,
        color: dialog.category.color,
        parentId: dialog.parentId || dialog.category.parentId,
      };

      if (dialog.mode === 'create') {
        await axios.post(`${API_BASE_URL}/v1/categories`, payload, {
          headers: { Authorization: `Bearer ${auth?.token}` },
        });
      } else {
        await axios.put(`${API_BASE_URL}/v1/categories/${dialog.category.id}`, payload, {
          headers: { Authorization: `Bearer ${auth?.token}` },
        });
      }

      handleCloseDialog();
      fetchCategories();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save category';
      setError(message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await axios.delete(`${API_BASE_URL}/v1/categories/${id}`, {
        headers: { Authorization: `Bearer ${auth?.token}` },
      });
      setDeleteConfirm({ open: false });
      fetchCategories();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete category';
      setError(message);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, categoryId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedCategoryId(categoryId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCategoryId(null);
  };

  const renderCategoryTree = (nodes: CategoryNode[], depth = 0) => {
    return (
      <List sx={{ pl: depth * 2 }}>
        {nodes.map((node) => (
          <React.Fragment key={node.id}>
            <ListItem
              secondaryAction={
                <IconButton
                  edge="end"
                  onClick={(e) => handleMenuOpen(e, node.id)}
                  data-testid={`menu-btn-${node.id}`}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              }
              sx={{
                bgcolor: node.type === CategoryType.Folder ? 'action.hover' : 'background.paper',
                borderRadius: 1,
                mb: 0.5,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <ListItemButton
                onClick={() => node.children && node.children.length > 0 && handleToggleExpand(node.id)}
                sx={{ pl: 1 }}
              >
                {node.children && node.children.length > 0 ? (
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    {node.isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                  </ListItemIcon>
                ) : (
                  <ListItemIcon sx={{ minWidth: 24 }} />
                )}
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {node.type === CategoryType.Folder ? <FolderOpenIcon /> : <FolderIcon />}
                </ListItemIcon>
                <ListItemText
                  primary={node.name}
                  secondary={
                    node.transactionCount !== undefined
                      ? `${node.transactionCount} transactions`
                      : undefined
                  }
                />
              </ListItemButton>
            </ListItem>

            {node.children && node.children.length > 0 && node.isExpanded && (
              <Collapse in={node.isExpanded} timeout="auto" unmountOnExit>
                {renderCategoryTree(node.children, depth + 1)}
              </Collapse>
            )}
          </React.Fragment>
        ))}
      </List>
    );
  };

  if (loading) return <CircularProgress />;

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Categories
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog('create')}
            data-testid="create-category-btn"
          >
            New Category
          </Button>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Filters */}
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <TextField
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  applyFiltersAndSort(categories);
                }}
                fullWidth
                size="small"
                data-testid="search-input"
              />

              <Stack direction="row" spacing={1}>
                <Stack direction="row" spacing={1}>
                  {['All', 'Category', 'Folder'].map((type) => (
                    <Chip
                      key={type}
                      label={type}
                      onClick={() => {
                        setFilterType(type as 'All' | 'Category' | 'Folder');
                        applyFiltersAndSort(categories);
                      }}
                      variant={filterType === type ? 'filled' : 'outlined'}
                      color={filterType === type ? 'primary' : 'default'}
                      data-testid={`filter-${type}`}
                    />
                  ))}
                </Stack>

                <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                  {['name', 'usage', 'recent'].map((sort) => (
                    <Chip
                      key={sort}
                      label={sort.charAt(0).toUpperCase() + sort.slice(1)}
                      onClick={() => {
                        setSortBy(sort as 'name' | 'usage' | 'recent');
                        applyFiltersAndSort(categories);
                      }}
                      variant={sortBy === sort ? 'filled' : 'outlined'}
                      color={sortBy === sort ? 'primary' : 'default'}
                      data-testid={`sort-${sort}`}
                    />
                  ))}
                </Stack>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Category Tree */}
        <Paper>
          {filteredCategories.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              <SearchOffIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
              <Typography>No categories found</Typography>
            </Box>
          ) : (
            renderCategoryTree(filteredCategories)
          )}
        </Paper>
      </Stack>

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialog.open}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        data-testid="category-dialog"
      >
        <DialogTitle>
          {dialog.mode === 'create' ? 'Create Category' : 'Edit Category'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Name"
              value={dialog.category.name || ''}
              onChange={(e) => setDialog({ ...dialog, category: { ...dialog.category, name: e.target.value } })}
              fullWidth
              data-testid="category-name-input"
            />

            <TextField
              label="Icon"
              value={dialog.category.icon || ''}
              onChange={(e) => setDialog({ ...dialog, category: { ...dialog.category, icon: e.target.value } })}
              fullWidth
              placeholder="e.g., shopping_cart"
              data-testid="category-icon-input"
            />

            <TextField
              label="Color"
              type="color"
              value={dialog.category.color || '#1976d2'}
              onChange={(e) => setDialog({ ...dialog, category: { ...dialog.category, color: e.target.value } })}
              fullWidth
              data-testid="category-color-input"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSaveCategory}
            variant="contained"
            disabled={!dialog.category.name}
            data-testid="category-save-btn"
          >
            {dialog.mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        data-testid="category-menu"
      >
        <MenuItem
          onClick={() => {
            const cat = findCategoryById(categories, selectedCategoryId!);
            if (cat) handleOpenDialog('edit', cat);
            handleMenuClose();
          }}
          data-testid="menu-edit"
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteConfirm({ open: true, id: selectedCategoryId || undefined });
            handleMenuClose();
          }}
          data-testid="menu-delete"
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false })}>
        <DialogTitle>Delete Category?</DialogTitle>
        <DialogContent>
          <Typography>
            This will delete the category and all its subcategories. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false })}>Cancel</Button>
          <Button
            onClick={() => deleteConfirm.id && handleDeleteCategory(deleteConfirm.id)}
            variant="contained"
            color="error"
            data-testid="confirm-delete-btn"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Helper function to find category by ID
const findCategoryById = (nodes: CategoryNode[], id: string): CategoryNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findCategoryById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

export default Categories;
