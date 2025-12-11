import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Folder as FolderIcon,
  Category as CategoryIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Category {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  isFolder: boolean;
  icon?: string;
  color?: string;
  path: string[];
  createdAt: string;
  updatedAt: string;
}

interface CategoryNode extends Category {
  children: CategoryNode[];
  level: number;
}

const Categories: React.FC = () => {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [treeData, setTreeData] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    isFolder: false,
    parentId: '',
    color: '#667eea',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (categories.length > 0) {
      buildTree();
    }
  }, [categories]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(response.data.categories || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const buildTree = () => {
    const nodeMap = new Map<string, CategoryNode>();
    
    // Create nodes
    categories.forEach((cat) => {
      nodeMap.set(cat.id, { ...cat, children: [], level: cat.path.length });
    });
    
    // Build hierarchy
    const roots: CategoryNode[] = [];
    categories.forEach((cat) => {
      const node = nodeMap.get(cat.id)!;
      if (cat.parentId && nodeMap.has(cat.parentId)) {
        const parent = nodeMap.get(cat.parentId)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });
    
    setTreeData(roots);
  };

  const handleOpenDialog = (parent?: Category) => {
    setFormData({
      name: '',
      isFolder: false,
      parentId: parent?.id || '',
      color: '#667eea',
    });
    setEditingCategory(null);
    setOpenDialog(true);
  };

  const handleEditCategory = (category: Category) => {
    setFormData({
      name: category.name,
      isFolder: category.isFolder,
      parentId: category.parentId || '',
      color: category.color || '#667eea',
    });
    setEditingCategory(category);
    setOpenDialog(true);
    setAnchorEl(null);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCategory(null);
    setFormData({ name: '', isFolder: false, parentId: '', color: '#667eea' });
  };

  const handleSubmit = async () => {
    try {
      if (editingCategory) {
        await axios.put(
          `${API_URL}/api/categories/${editingCategory.id}`,
          { name: formData.name, color: formData.color },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `${API_URL}/api/categories`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      fetchCategories();
      handleCloseDialog();
    } catch (err: any) {
      console.error('Error saving category:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save category';
      setError(errorMessage);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!window.confirm(`Are you sure you want to delete "${category.name}"?`)) {
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/categories/${category.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCategories();
      setAnchorEl(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, category: Category) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedCategory(category);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCategory(null);
  };

  const renderTree = (nodes: CategoryNode[]) => {
    return nodes.map((node) => (
      <Box key={node.id}>
        <ListItem
          disablePadding
          sx={{
            pl: node.level * 4,
            borderLeft: node.level > 0 ? '2px solid rgba(102, 126, 234, 0.1)' : 'none',
          }}
        >
          <ListItemButton
            sx={{
              borderRadius: 1,
              mb: 0.5,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <ListItemIcon>
              {node.isFolder ? (
                <FolderIcon sx={{ color: node.color || '#667eea' }} />
              ) : (
                <CategoryIcon sx={{ color: node.color || '#667eea' }} />
              )}
            </ListItemIcon>
            <ListItemText
              primary={node.name}
              secondary={node.isFolder ? `${node.children.length} items` : 'Category'}
            />
            {node.isFolder && node.children.length > 0 && (
              <ChevronRightIcon sx={{ color: 'text.secondary' }} />
            )}
            <IconButton
              size="small"
              onClick={(e) => handleMenuOpen(e, node)}
              sx={{ ml: 1 }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        </ListItem>
        {node.children.length > 0 && (
          <List disablePadding>{renderTree(node.children)}</List>
        )}
      </Box>
    ));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>
          Categories
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #63408a 100%)',
            },
          }}
        >
          New Category
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card
        sx={{
          background: (theme) =>
            theme.palette.mode === 'light'
              ? 'rgba(255, 255, 255, 0.9)'
              : 'rgba(30, 30, 30, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: 2,
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        }}
      >
        <CardContent>
          {treeData.length === 0 ? (
            <Box textAlign="center" py={6}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No categories yet
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Create your first category or folder to get started
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Create Category
              </Button>
            </Box>
          ) : (
            <List>{renderTree(treeData)}</List>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCategory ? 'Edit Category' : 'Create New Category'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoFocus
            />
            
            {!editingCategory && (
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isFolder}
                    onChange={(e) => setFormData({ ...formData, isFolder: e.target.checked })}
                  />
                }
                label="Create as Folder (can contain subcategories)"
              />
            )}

            <TextField
              label="Color"
              type="color"
              fullWidth
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.name}
          >
            {editingCategory ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedCategory && handleEditCategory(selectedCategory)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        {selectedCategory?.isFolder && (
          <MenuItem onClick={() => { handleOpenDialog(selectedCategory); handleMenuClose(); }}>
            <ListItemIcon>
              <AddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add Subcategory</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => selectedCategory && handleDeleteCategory(selectedCategory)}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Categories;
