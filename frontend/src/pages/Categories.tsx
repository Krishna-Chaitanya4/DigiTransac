import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Box,
  Button,
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
  MenuItem,
  InputAdornment,
  Chip,
  Menu,
  ListItemIcon,
  ListItemText,
  Fade,
  Zoom,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  FolderOpen as FolderOpenIcon,
  Label as LabelIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  CreateNewFolder as CreateNewFolderIcon,
  Search as SearchIcon,
  UnfoldMore as ExpandAllIcon,
  UnfoldLess as CollapseAllIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface Category {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  isFolder: boolean;
  icon?: string;
  color?: string;
  path: string[];
  transactionCount?: number;
  lastUsed?: string | null;
  totalAmount?: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoryNode extends Category {
  children: CategoryNode[];
  level: number;
  isMatch?: boolean; // Indicates if this node matches the search query
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
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'folder' | 'category'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'recent'>('name');
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    category: CategoryNode | null;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    isFolder: false,
    color: '#667eea',
    parentId: null as string | null,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  // Debounce search query (performance optimization - industry standard)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (categories.length > 0) {
      buildTree();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, debouncedSearchQuery, filterType, sortBy]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      // Fetch categories with usage statistics
      const response = await axios.get(`/api/categories/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Normalize data: ensure all categories have required fields
      const normalizedCategories = (response.data.categories || []).map((cat: any) => ({
        ...cat,
        path: cat.path || [], // Ensure path is always an array
        transactionCount: cat.transactionCount || 0,
        lastUsed: cat.lastUsed || null,
        totalAmount: cat.totalAmount || 0,
      }));
      
      setCategories(normalizedCategories);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const buildTree = useCallback(() => {
    if (categories.length === 0) {
      return;
    }

    // If searching, show flattened list with breadcrumbs (industry standard)
    if (debouncedSearchQuery) {
      // Find all categories that match the search query and type filter
      const matchingCategories = categories.filter((cat) => {
        const matchesSearch = cat.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
        const matchesType =
          filterType === 'all' ||
          (filterType === 'folder' && cat.isFolder) ||
          (filterType === 'category' && !cat.isFolder);
        return matchesSearch && matchesType;
      });

      // Sort matching categories
      const sorted = matchingCategories.sort((a, b) => {
        if (sortBy === 'usage') {
          return (b.transactionCount || 0) - (a.transactionCount || 0);
        } else if (sortBy === 'recent') {
          const aDate = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
          const bDate = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
          return bDate - aDate;
        }
        // Default: sort by name
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      // Convert to flat list (no tree structure when searching)
      const flatList: CategoryNode[] = sorted.map((cat) => ({
        ...cat,
        children: [],
        level: 0, // All at same level in flat list
        isMatch: true,
      }));

      setTreeData(flatList);
      setExpandedNodes(new Set()); // No expansion needed in flat view
    } else {
      // Normal view: filter by type only
      let filtered = categories.filter((cat) => {
        const matchesType =
          filterType === 'all' ||
          (filterType === 'folder' && cat.isFolder) ||
          (filterType === 'category' && !cat.isFolder);
        return matchesType;
      });

      // Sort categories
      filtered = filtered.sort((a, b) => {
        if (sortBy === 'usage') {
          return (b.transactionCount || 0) - (a.transactionCount || 0);
        } else if (sortBy === 'recent') {
          const aDate = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
          const bDate = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
          return bDate - aDate;
        }
        // Default: sort by name
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      const nodeMap = new Map<string, CategoryNode>();

      filtered.forEach((cat) => {
        nodeMap.set(cat.id, { ...cat, children: [], level: cat.path.length, isMatch: false });
      });

      const roots: CategoryNode[] = [];
      filtered.forEach((cat) => {
        const node = nodeMap.get(cat.id)!;
        if (cat.parentId && nodeMap.has(cat.parentId)) {
          const parent = nodeMap.get(cat.parentId)!;
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      });

      // Sort children recursively
      const sortNodes = (nodes: CategoryNode[]) => {
        nodes.sort((a, b) => {
          if (sortBy === 'usage') {
            return (b.transactionCount || 0) - (a.transactionCount || 0);
          } else if (sortBy === 'recent') {
            const aDate = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
            const bDate = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
            return bDate - aDate;
          }
          if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        nodes.forEach((node) => {
          if (node.children.length > 0) sortNodes(node.children);
        });
      };

      sortNodes(roots);
      setTreeData(roots);
    }
  }, [categories, debouncedSearchQuery, filterType, sortBy]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleExpandAll = useCallback(() => {
    const allFolderIds = new Set<string>();
    categories.forEach((cat) => {
      if (cat.isFolder) allFolderIds.add(cat.id);
    });
    setExpandedNodes(allFolderIds);
  }, [categories]);

  const handleCollapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  const handleContextMenu = (event: React.MouseEvent, category: CategoryNode) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      category,
    });
  };

  // Get breadcrumb path for a category
  const getBreadcrumbPath = useCallback(
    (category: Category): string => {
      if (!category.parentId) return '';
      const path: string[] = [];
      let current = categories.find((c) => c.id === category.parentId);
      while (current) {
        path.unshift(current.name);
        current = categories.find((c) => c.id === current!.parentId);
      }
      return path.join(' > ');
    },
    [categories]
  );

  // Highlight matching text in search results (memoized for performance)
  const highlightText = useCallback((text: string, query: string) => {
    if (!query) return text;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);
    
    return (
      <>
        {before}
        <Box component="span" sx={{ bgcolor: 'rgba(102, 126, 234, 0.3)', fontWeight: 600 }}>
          {match}
        </Box>
        {after}
      </>
    );
  }, []);

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleOpenDialog = (parent?: Category) => {
    setFormData({
      name: '',
      isFolder: false,
      color: '#667eea',
      parentId: parent?.id || null,
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
      parentId: category.parentId,
    });
    setEditingCategory(category);
    setParentForNew(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCategory(null);
    setParentForNew(null);
    setFormData({ name: '', isFolder: false, color: '#667eea', parentId: null });
  };

  const handleSubmit = async () => {
    try {
      if (editingCategory) {
        await axios.put(
          `/api/categories/${editingCategory.id}`,
          {
            name: formData.name,
            color: formData.color,
            parentId: formData.parentId,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `/api/categories`,
          { ...formData, parentId: formData.parentId },
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
      await axios.delete(`/api/categories/${category.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const renderTree = (nodes: CategoryNode[]) => {
    return nodes.map((node) => (
      <Box key={node.id} onContextMenu={(e) => handleContextMenu(e, node)}>
        {/* Tree Node */}
        <Box
          sx={{
            pl: debouncedSearchQuery ? 2 : node.level * 3,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            borderLeft: !debouncedSearchQuery && node.level > 0 ? '2px solid rgba(102, 126, 234, 0.15)' : 'none',
            ml: !debouncedSearchQuery && node.level > 0 ? 2 : 0,
            cursor: 'pointer',
            borderBottom: debouncedSearchQuery ? '1px solid rgba(0, 0, 0, 0.06)' : 'none',
            '&:hover': {
              bgcolor: 'rgba(102, 126, 234, 0.05)',
              borderRadius: 1,
            },
          }}
        >
          {/* Expand/Collapse Button */}
          {node.isFolder && (
            <IconButton size="small" onClick={() => toggleNode(node.id)} sx={{ mr: 0.5 }}>
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

          {/* Name with usage stats and breadcrumb */}
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: node.isFolder ? 600 : 400,
                }}
              >
                {debouncedSearchQuery ? highlightText(node.name, debouncedSearchQuery) : node.name}
              </Typography>
              {(node.transactionCount || 0) > 0 && (
                <Chip
                  label={node.transactionCount}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.75rem',
                    bgcolor: node.color || '#667eea',
                    color: 'white',
                    opacity: 0.7,
                  }}
                />
              )}
            </Box>
            {/* Breadcrumb path when searching */}
            {debouncedSearchQuery && getBreadcrumbPath(node) && (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                }}
              >
                {getBreadcrumbPath(node)}
              </Typography>
            )}
          </Box>

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
      {/* Enhanced Animated Header */}
      <Fade in timeout={600}>
        <Box
          sx={{
            mb: 4,
            p: 4,
            borderRadius: 4,
            position: 'relative',
            overflow: 'hidden',
            background: (theme) =>
              theme.palette.mode === 'light'
                ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 50%, ${theme.palette.primary.dark} 100%)`
                : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.dark} 50%, ${theme.palette.primary.dark} 100%)`,
            boxShadow: (theme) => `0 8px 32px ${theme.palette.primary.main}40`,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2) 0%, transparent 50%)',
              animation: 'pulse 4s ease-in-out infinite',
            },
            '@keyframes pulse': {
              '0%, 100%': { opacity: 0.6 },
              '50%': { opacity: 1 },
            },
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Avatar
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(10px)',
                      width: 56,
                      height: 56,
                    }}
                  >
                    <LabelIcon sx={{ fontSize: 32 }} />
                  </Avatar>
                  <Typography
                    variant="h4"
                    fontWeight={800}
                    sx={{
                      color: 'white',
                      letterSpacing: '-0.02em',
                      textShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    }}
                  >
                    Categories & Tags
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, ml: 9 }}>
                  {categories.length} categories • {categories.filter(c => c.isFolder).length} folders • {categories.filter(c => !c.isFolder).length} items
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Zoom in timeout={800}>
                  <Button
                    variant="outlined"
                    startIcon={<FolderOpenIcon />}
                    onClick={() => {
                      setFormData({ name: '', color: '#14b8a6', isFolder: true, parentId: null });
                      setParentForNew(null);
                      setOpenDialog(true);
                    }}
                    sx={{
                      bgcolor: 'white',
                      borderColor: 'white',
                      color: 'primary.main',
                      fontWeight: 600,
                      '&:hover': {
                        borderColor: 'white',
                        bgcolor: 'rgba(255,255,255,0.95)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                      },
                    }}
                  >
                    New Folder
                  </Button>
                </Zoom>
                <Zoom in timeout={900}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                    sx={{
                      bgcolor: 'white',
                      color: 'primary.main',
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.95)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                      },
                    }}
                  >
                    New Category
                  </Button>
                </Zoom>
              </Box>
            </Box>
          </Box>
        </Box>
      </Fade>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Search and Controls */}
      <Fade in timeout={800}>
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 3,
            background: (theme) =>
              theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                : 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            border: (theme) =>
              theme.palette.mode === 'light'
                ? `1px solid ${theme.palette.primary.main}1A`
                : `1px solid ${theme.palette.primary.main}33`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          }}
        >
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          {/* Search */}
          <TextField
            size="small"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery('')}
                    edge="end"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          {debouncedSearchQuery && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {treeData.length} {treeData.length === 1 ? 'result' : 'results'}
            </Typography>
          )}

          {/* Filter by Type */}
          <TextField
            select
            size="small"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            sx={{ minWidth: 130 }}
            label="Type"
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="folder">Folders Only</MenuItem>
            <MenuItem value="category">Categories Only</MenuItem>
          </TextField>

          {/* Sort By */}
          <TextField
            select
            size="small"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            sx={{ minWidth: 150 }}
            label="Sort By"
          >
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="usage">Most Used</MenuItem>
            <MenuItem value="recent">Recently Used</MenuItem>
          </TextField>

          {/* Expand/Collapse All */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Expand All">
              <IconButton size="small" onClick={handleExpandAll} color="primary">
                <ExpandAllIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Collapse All">
              <IconButton size="small" onClick={handleCollapseAll} color="primary">
                <CollapseAllIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        </Box>
      </Fade>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          background: (theme) =>
            theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(30, 30, 30, 0.9)',
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
              {debouncedSearchQuery ? `No results for "${debouncedSearchQuery}"` : 'No categories yet'}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3} textAlign="center">
              {debouncedSearchQuery ? (
                'Try a different search term or clear the filter.'
              ) : (
                <>
                  Create folders and categories to organize your expenses.
                  <br />
                  Folders can contain subcategories for better hierarchy.
                </>
              )}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<FolderOpenIcon />}
                onClick={() => {
                  setFormData({ name: '', color: '#667eea', isFolder: true, parentId: null });
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
          <Box sx={{ py: 1 }}>{renderTree(treeData)}</Box>
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

            <TextField
              select
              label="Parent Folder"
              fullWidth
              value={formData.parentId || ''}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value || null })}
              helperText={
                editingCategory
                  ? 'Change parent to reorganize category hierarchy'
                  : 'Select a parent folder or leave empty for root level'
              }
            >
              <MenuItem value="">
                <em>Root Level (No Parent)</em>
              </MenuItem>
              {categories
                .filter((cat) => {
                  // Only show folders
                  if (!cat.isFolder) return false;
                  // When editing, exclude self and descendants to prevent circular refs
                  if (editingCategory) {
                    if (cat.id === editingCategory.id) return false;
                    if (cat.path?.includes(editingCategory.id)) return false;
                  }
                  return true;
                })
                .map((folder) => (
                  <MenuItem key={folder.id} value={folder.id}>
                    {'  '.repeat(folder.path?.length || 0)} 📁 {folder.name}
                  </MenuItem>
                ))}
            </TextField>

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
          <Button onClick={handleSubmit} variant="contained" disabled={!formData.name}>
            {editingCategory ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {contextMenu?.category && contextMenu.category.isFolder && (
          <MenuItem
            onClick={() => {
              handleOpenDialog(contextMenu.category!);
              handleCloseContextMenu();
            }}
          >
            <ListItemIcon>
              <CreateNewFolderIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add Subcategory</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            handleEditCategory(contextMenu?.category!);
            handleCloseContextMenu();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleDeleteCategory(contextMenu?.category!);
            handleCloseContextMenu();
          }}
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
