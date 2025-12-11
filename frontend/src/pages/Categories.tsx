import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  Card,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Collapse,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Label as LabelIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  CreateNewFolder as CreateNewFolderIcon,
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
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentForNew, setParentForNew] = useState<Category | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    isFolder: false,
    color: '#667eea',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (categories.length > 0) {
      buildTree();
    } else {
      setTreeData([]);
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
    
    categories.forEach((cat) => {
      nodeMap.set(cat.id, { ...cat, children: [], level: cat.path.length });
    });
    
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
    
    // Sort: folders first, then alphabetically
    const sortNodes = (nodes: CategoryNode[]) => {
      nodes.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach(node => {
        if (node.children.length > 0) sortNodes(node.children);
      });
    };
    
    sortNodes(roots);
    setTreeData(roots);
    
    // Auto-expand all folders initially
    const allFolderIds = new Set<string>();
    categories.forEach(cat => {
      if (cat.isFolder) allFolderIds.add(cat.id);
    });
    setExpandedNodes(allFolderIds);
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleOpenDialog = (parent?: Category) => {
    setFormData({
      name: '',
      isFolder: false,
      color: '#667eea',
    });
    setEditingCategory(null);
    setParentForNew(parent || null);
    setOpenDialog(true);
  };

  const handleEditCategory = (category: Category) => {
    setFormData({
      name: category.name,
      isFolder: category.isFolder,
      color: category.color || '#667eea',
    });
    setEditingCategory(category);
    setParentForNew(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCategory(null);
    setParentForNew(null);
    setFormData({ name: '', isFolder: false, color: '#667eea' });
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
          { ...formData, parentId: parentForNew?.id || null },
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
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const renderTree = (nodes: CategoryNode[]) => {
    return nodes.map((node) => (
      <Box key={node.id}>
        {/* Tree Node */}
        <Box
          sx={{
            pl: node.level * 3,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            borderLeft: node.level > 0 ? '2px solid rgba(102, 126, 234, 0.15)' : 'none',
            ml: node.level > 0 ? 2 : 0,
            '&:hover': {
              bgcolor: 'rgba(102, 126, 234, 0.05)',
              borderRadius: 1,
            },
          }}
        >
          {/* Expand/Collapse Button */}
          {node.isFolder && (
            <IconButton
              size="small"
              onClick={() => toggleNode(node.id)}
              sx={{ mr: 0.5 }}
            >
              <ExpandMoreIcon
                fontSize="small"
                sx={{
                  transform: expandedNodes.has(node.id) ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </IconButton>
          )}
          
          {/* Icon */}
          <Box sx={{ mr: 1.5, display: 'flex', alignItems: 'center', ml: !node.isFolder ? 4 : 0 }}>
            {node.isFolder ? (
              <FolderOpenIcon sx={{ color: node.color || '#667eea' }} />
            ) : (
              <LabelIcon sx={{ color: node.color || '#667eea' }} />
            )}
          </Box>

          {/* Name */}
          <Typography
            variant="body1"
            sx={{
              flexGrow: 1,
              fontWeight: node.isFolder ? 600 : 400,
            }}
          >
            {node.name}
          </Typography>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 0.5, opacity: 0.7, '&:hover': { opacity: 1 } }}>
            {node.isFolder && (
              <Tooltip title="Add subcategory">
                <IconButton
                  size="small"
                  onClick={() => handleOpenDialog(node)}
                  sx={{ color: '#667eea' }}
                >
                  <CreateNewFolderIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={() => handleEditCategory(node)}
                sx={{ color: '#667eea' }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => handleDeleteCategory(node)}
                sx={{ color: '#f44336' }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Children (Collapsible) */}
        {node.isFolder && node.children.length > 0 && (
          <Collapse in={expandedNodes.has(node.id)} timeout="auto">
            {renderTree(node.children)}
          </Collapse>
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<FolderOpenIcon />}
            onClick={() => {
              setFormData({ name: '', color: '#667eea', isFolder: true });
              setParentForNew(null);
              setOpenDialog(true);
            }}
            sx={{
              borderColor: '#667eea',
              color: '#667eea',
              '&:hover': {
                borderColor: '#5568d3',
                bgcolor: 'rgba(102, 126, 234, 0.05)',
              },
            }}
          >
            New Folder
          </Button>
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
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          background: (theme) =>
            theme.palette.mode === 'light'
              ? 'rgba(255, 255, 255, 0.9)'
              : 'rgba(30, 30, 30, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: 2,
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          p: 2,
          minHeight: '400px',
        }}
      >
        {treeData.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight="300px"
          >
            <FolderOpenIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No categories yet
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3} textAlign="center">
              Create folders and categories to organize your expenses.<br />
              Folders can contain subcategories for better hierarchy.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<FolderOpenIcon />}
                onClick={() => {
                  setFormData({ name: '', color: '#667eea', isFolder: true });
                  setParentForNew(null);
                  setOpenDialog(true);
                }}
              >
                Create Folder
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Create Category
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ py: 1 }}>
            {renderTree(treeData)}
          </Box>
        )}
      </Box>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCategory 
            ? 'Edit Category' 
            : parentForNew 
            ? `Add to "${parentForNew.name}"` 
            : 'Create New Category'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {parentForNew && (
              <Alert severity="info" sx={{ mb: 1 }}>
                Creating subcategory under <strong>{parentForNew.name}</strong>
              </Alert>
            )}
            
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

            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Color
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  style={{
                    width: '60px',
                    height: '40px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                />
                <TextField
                  size="small"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  sx={{ flex: 1 }}
                />
              </Box>
            </Box>
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
    </Box>
  );
};

export default Categories;
