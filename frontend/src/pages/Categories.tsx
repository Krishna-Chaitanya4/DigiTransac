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
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Label as LabelIcon,
  LocalOffer as TagIcon,
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

interface Tag {
  id: string;
  name: string;
  color?: string;
  usageCount: number;
  lastUsed?: string | null;
  createdAt: string;
  updatedAt: string;
}

const Categories: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  
  // Category state
  const [categories, setCategories] = useState<Category[]>([]);
  const [treeData, setTreeData] = useState<CategoryNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentForNew, setParentForNew] = useState<Category | null>(null);
  
  // Tag state
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [openTagDialog, setOpenTagDialog] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagFormData, setTagFormData] = useState({
    name: '',
    color: '#667eea',
  });
  
  // Tag deletion state
  const [deleteTagDialog, setDeleteTagDialog] = useState<{
    open: boolean;
    tag: Tag | null;
    usage: {
      transactions: number;
      budgets: number;
      budgetNames: string[];
      canDelete: boolean;
    } | null;
    loading: boolean;
  }>({
    open: false,
    tag: null,
    usage: null,
    loading: false,
  });
  const [replaceTagId, setReplaceTagId] = useState<string>('');
  
  // Search and filter state (Categories)
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'folder' | 'category'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'recent'>('name');
  
  // Search and sort state (Tags)
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [debouncedTagSearchQuery, setDebouncedTagSearchQuery] = useState('');
  const [tagSortBy, setTagSortBy] = useState<'name' | 'usage' | 'recent'>('name');
  
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
    fetchTags(); // Fetch tags on page load for accurate count
  }, []);

  // Debounce search query (performance optimization - industry standard)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounce tag search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTagSearchQuery(tagSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [tagSearchQuery]);

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

  const handleOpenDialog = (parent?: Category, isFolder: boolean = false) => {
    setFormData({
      name: '',
      isFolder: isFolder,
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

  // ============= TAG MANAGEMENT FUNCTIONS =============
  
  const fetchTags = async () => {
    try {
      setTagsLoading(true);
      const response = await axios.get('/api/tags', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTags(response.data.tags || response.data);
    } catch (err: any) {
      console.error('Error fetching tags:', err);
      setError('Failed to fetch tags');
    } finally {
      setTagsLoading(false);
    }
  };

  const handleOpenTagDialog = (tag?: Tag) => {
    if (tag) {
      setEditingTag(tag);
      setTagFormData({
        name: tag.name,
        color: tag.color || '#667eea',
      });
    } else {
      setEditingTag(null);
      setTagFormData({
        name: '',
        color: '#667eea',
      });
    }
    setOpenTagDialog(true);
  };

  const handleCloseTagDialog = () => {
    setOpenTagDialog(false);
    setEditingTag(null);
    setTagFormData({
      name: '',
      color: '#667eea',
    });
  };

  const handleSubmitTag = async () => {
    if (!tagFormData.name.trim()) {
      setError('Tag name is required');
      return;
    }

    try {
      if (editingTag) {
        await axios.put(`/api/tags/${editingTag.id}`, tagFormData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post('/api/tags', tagFormData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      handleCloseTagDialog();
      fetchTags();
    } catch (err: any) {
      console.error('Error saving tag:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save tag';
      setError(errorMessage);
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    // Open dialog and check usage
    setDeleteTagDialog({
      open: true,
      tag,
      usage: null,
      loading: true,
    });
    setReplaceTagId('');

    try {
      const response = await axios.get(`/api/tags/${tag.id}/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setDeleteTagDialog({
        open: true,
        tag,
        usage: response.data.usage,
        loading: false,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to check tag usage');
      setDeleteTagDialog({
        open: false,
        tag: null,
        usage: null,
        loading: false,
      });
    }
  };

  const handleConfirmDeleteTag = async () => {
    if (!deleteTagDialog.tag) return;

    try {
      await axios.delete(`/api/tags/${deleteTagDialog.tag.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setDeleteTagDialog({
        open: false,
        tag: null,
        usage: null,
        loading: false,
      });
      fetchTags();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete tag');
    }
  };

  const handleReplaceTag = async () => {
    if (!deleteTagDialog.tag || !replaceTagId) return;

    try {
      const response = await axios.post(
        `/api/tags/${deleteTagDialog.tag.id}/replace`,
        { replacementTagId: replaceTagId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setDeleteTagDialog({
        open: false,
        tag: null,
        usage: null,
        loading: false,
      });
      setReplaceTagId('');
      fetchTags();
      
      // Show success message
      setError(''); // Clear any previous errors
      setTimeout(() => {
        setError(response.data.message);
      }, 100);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to replace tag');
    }
  };

  // Filter and sort tags
  const getFilteredAndSortedTags = () => {
    let filtered = [...tags];

    // Search filter
    if (debouncedTagSearchQuery) {
      const searchLower = debouncedTagSearchQuery.toLowerCase();
      filtered = filtered.filter((tag) =>
        tag.name.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      if (tagSortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (tagSortBy === 'usage') {
        return (b.usageCount || 0) - (a.usageCount || 0);
      } else if (tagSortBy === 'recent') {
        const dateA = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
        const dateB = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });

    return filtered;
  };

  // ============= END TAG MANAGEMENT FUNCTIONS =============


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
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${node.color || '#667eea'} 0%, ${node.color || '#764ba2'} 100%)`,
                  boxShadow: `0 4px 12px ${node.color || '#667eea'}40`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 6px 16px ${node.color || '#667eea'}60`,
                  },
                }}
              >
                {expandedNodes.has(node.id) ? (
                  <FolderOpenIcon sx={{ color: 'white', fontSize: 22 }} />
                ) : (
                  <FolderIcon sx={{ color: 'white', fontSize: 22 }} />
                )}
              </Box>
            ) : (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${node.color || '#667eea'}15 0%, ${node.color || '#667eea'}25 100%)`,
                  border: `2px solid ${node.color || '#667eea'}`,
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px) scale(1.05)',
                    boxShadow: `0 4px 12px ${node.color || '#667eea'}40`,
                  },
                }}
              >
                <TagIcon sx={{ color: node.color || '#667eea', fontSize: 20 }} />
              </Box>
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
          <Box sx={{ display: 'flex', gap: 1 }}>
            {node.isFolder && (
              <Tooltip title="Add subcategory" arrow>
                <IconButton
                  size="small"
                  onClick={() => handleOpenDialog(node)}
                  sx={{
                    width: 32,
                    height: 32,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px #667eea60',
                    },
                  }}
                >
                  <CreateNewFolderIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Edit" arrow>
              <IconButton
                size="small"
                onClick={() => handleEditCategory(node)}
                sx={{
                  width: 32,
                  height: 32,
                  background: 'linear-gradient(135deg, #667eea15 0%, #667eea25 100%)',
                  border: '1.5px solid #667eea',
                  color: '#667eea',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderColor: 'transparent',
                    transform: 'translateY(-2px) rotate(5deg)',
                    boxShadow: '0 4px 12px #667eea60',
                  },
                }}
              >
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete" arrow>
              <IconButton
                size="small"
                onClick={() => handleDeleteCategory(node)}
                sx={{
                  width: 32,
                  height: 32,
                  background: 'linear-gradient(135deg, #f4433615 0%, #f4433625 100%)',
                  border: '1.5px solid #f44336',
                  color: '#f44336',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                    color: 'white',
                    borderColor: 'transparent',
                    transform: 'translateY(-2px) scale(1.1)',
                    boxShadow: '0 4px 12px #f4433660',
                  },
                }}
              >
                <DeleteIcon sx={{ fontSize: 16 }} />
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
                  {categories.length + tags.length} {(categories.length + tags.length) === 1 ? 'item' : 'items'} • {categories.filter(c => c.isFolder).length} {categories.filter(c => c.isFolder).length === 1 ? 'folder' : 'folders'} • {categories.filter(c => !c.isFolder).length} {categories.filter(c => !c.isFolder).length === 1 ? 'category' : 'categories'} • {tags.length} {tags.length === 1 ? 'tag' : 'tags'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {activeTab === 0 ? (
                  <>
                    <Zoom in timeout={800}>
                      <Button
                        variant="contained"
                        startIcon={<FolderOpenIcon />}
                        onClick={() => {
                          setFormData({ name: '', color: '#14b8a6', isFolder: true, parentId: null });
                          setParentForNew(null);
                          setOpenDialog(true);
                        }}
                        sx={{
                          bgcolor: 'white',
                          color: 'primary.main',
                          fontWeight: 600,
                          px: 3,
                          py: 1,
                          borderRadius: 3,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                          '&:hover': {
                            bgcolor: '#ffffff',
                            color: 'primary.main',
                            transform: 'translateY(-3px) scale(1.02)',
                            boxShadow: '0 8px 28px rgba(20, 184, 166, 0.3), 0 0 40px rgba(20, 184, 166, 0.2)',
                          },
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        New Folder
                      </Button>
                    </Zoom>
                    <Zoom in timeout={900}>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenDialog(undefined, false)}
                        sx={{
                          bgcolor: 'white',
                          color: 'primary.main',
                          fontWeight: 600,
                          px: 3,
                          py: 1,
                          borderRadius: 3,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                          '&:hover': {
                            bgcolor: '#ffffff',
                            color: 'primary.main',
                            transform: 'translateY(-3px) scale(1.02)',
                            boxShadow: '0 8px 28px rgba(20, 184, 166, 0.3), 0 0 40px rgba(20, 184, 166, 0.2)',
                          },
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        New Category
                      </Button>
                    </Zoom>
                  </>
                ) : (
                  <Zoom in timeout={800}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenTagDialog()}
                      sx={{
                        bgcolor: 'white',
                        color: 'primary.main',
                        fontWeight: 600,
                        px: 3,
                        py: 1,
                        borderRadius: 3,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        '&:hover': {
                          bgcolor: '#ffffff',
                          color: 'primary.main',
                          transform: 'translateY(-3px) scale(1.02)',
                          boxShadow: '0 8px 28px rgba(20, 184, 166, 0.3), 0 0 40px rgba(20, 184, 166, 0.2)',
                        },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      New Tag
                    </Button>
                  </Zoom>
                )}
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

      {/* Tabs for Categories and Tags */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              minHeight: 56,
              px: 4,
              '&.Mui-selected': {
                color: 'primary.main',
              },
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LabelIcon sx={{ fontSize: 20 }} />
                Categories
                <Chip 
                  label={categories.length} 
                  size="small" 
                  sx={{ 
                    height: 20, 
                    minWidth: 28,
                    bgcolor: activeTab === 0 ? 'primary.main' : 'grey.300',
                    color: 'white',
                    fontSize: '0.75rem',
                  }} 
                />
              </Box>
            }
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TagIcon sx={{ fontSize: 20 }} />
                Tags
                <Chip 
                  label={tags.length} 
                  size="small" 
                  sx={{ 
                    height: 20,
                    minWidth: 28,
                    bgcolor: activeTab === 1 ? 'primary.main' : 'grey.300',
                    color: 'white',
                    fontSize: '0.75rem',
                  }} 
                />
              </Box>
            }
          />
        </Tabs>
      </Box>

      {/* Categories Tab Content */}
      {activeTab === 0 && (
        <>
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
                onClick={() => handleOpenDialog(undefined, false)}
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
        <DialogTitle
          sx={{
            background: (theme) => theme.palette.gradient.primary,
            color: 'white',
            py: 3,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-50%',
              right: '-10%',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}>
            <Avatar
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 48,
                height: 48,
              }}
            >
              <LabelIcon />
            </Avatar>
            <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
              {editingCategory
                ? `Edit ${editingCategory.isFolder ? 'Folder' : 'Category'}`
                : parentForNew
                  ? `Add to "${parentForNew.name}"`
                  : formData.isFolder
                    ? 'Create New Folder'
                    : 'Create New Category'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
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

            <Box>
              <Typography variant="body2" fontWeight={600} color="primary" gutterBottom>
                Category Color
              </Typography>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  background: (theme) =>
                    theme.palette.mode === 'light'
                      ? 'rgba(248, 250, 252, 0.8)'
                      : 'rgba(30, 30, 30, 0.5)',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {/* Preset Colors */}
                <Typography variant="caption" color="text.secondary" gutterBottom display="block" mb={1}>
                  Quick Select
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {[
                    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
                    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
                    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
                  ].map((presetColor) => (
                    <Box
                      key={presetColor}
                      onClick={() => setFormData({ ...formData, color: presetColor })}
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1.5,
                        bgcolor: presetColor,
                        cursor: 'pointer',
                        border: '3px solid',
                        borderColor: formData.color === presetColor ? 'primary.main' : 'transparent',
                        transition: 'all 0.2s ease',
                        boxShadow: formData.color === presetColor ? '0 0 0 2px rgba(20, 184, 166, 0.2)' : 'none',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                        },
                      }}
                    />
                  ))}
                </Box>

                <Typography variant="caption" color="text.secondary" gutterBottom display="block" mb={1}>
                  Custom Color
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Box
                    sx={{
                      position: 'relative',
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '3px solid',
                      borderColor: 'background.paper',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'scale(1.05)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
                      },
                    }}
                  >
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    />
                  </Box>
                  <TextField
                    size="small"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#667eea"
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      },
                    }}
                    InputProps={{
                      startAdornment: (
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            bgcolor: formData.color,
                            mr: 1,
                            border: '2px solid',
                            borderColor: 'divider',
                          }}
                        />
                      ),
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2.5,
            gap: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            backgroundColor: (theme) =>
              theme.palette.mode === 'light'
                ? 'rgba(248, 250, 252, 0.8)'
                : 'rgba(15, 15, 15, 0.8)',
          }}
        >
          <Button
            onClick={handleCloseDialog}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.name}
            sx={{
              borderRadius: 2,
              px: 4,
              textTransform: 'none',
              fontWeight: 600,
              background: (theme) => theme.palette.gradient.primary,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: 4,
                transition: 'all 0.2s ease',
              },
            }}
          >
            {editingCategory ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
        </>
      )}

      {/* Tags Tab Content */}
      {activeTab === 1 && (
        <Box>
          {/* Search and Sort Controls for Tags */}
          <Box
            sx={{
              mb: 3,
              p: 3,
              borderRadius: 3,
              bgcolor: (theme) =>
                theme.palette.mode === 'light' ? 'rgba(102, 126, 234, 0.03)' : 'rgba(102, 126, 234, 0.08)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search */}
              <TextField
                placeholder="Search tags..."
                value={tagSearchQuery}
                onChange={(e) => setTagSearchQuery(e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: tagSearchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setTagSearchQuery('')}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  flex: 1,
                  minWidth: 250,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                  },
                }}
              />

              {/* Sort */}
              <TextField
                select
                value={tagSortBy}
                onChange={(e) => setTagSortBy(e.target.value as any)}
                size="small"
                label="Sort by"
                sx={{
                  minWidth: 150,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                  },
                }}
              >
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="usage">Most Used</MenuItem>
                <MenuItem value="recent">Recently Used</MenuItem>
              </TextField>
            </Box>
          </Box>

          {tagsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : tags.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                px: 3,
                borderRadius: 3,
                bgcolor: 'background.paper',
                border: '2px dashed',
                borderColor: 'divider',
              }}
            >
              <TagIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom color="text.secondary">
                No tags yet
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Create tags to organize your transactions better
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenTagDialog()}
                sx={{
                  background: (theme) => theme.palette.gradient.primary,
                }}
              >
                Create Your First Tag
              </Button>
            </Box>
          ) : getFilteredAndSortedTags().length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                px: 3,
                borderRadius: 3,
                bgcolor: 'background.paper',
                border: '2px dashed',
                borderColor: 'divider',
              }}
            >
              <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom color="text.secondary">
                No tags found
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Try adjusting your search or filters
              </Typography>
              <Button
                variant="outlined"
                onClick={() => setTagSearchQuery('')}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                Clear Search
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
              {getFilteredAndSortedTags().map((tag) => (
                <Fade in key={tag.id}>
                  <Card
                    sx={{
                      borderRadius: 2.5,
                      transition: 'all 0.3s ease',
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                        borderColor: tag.color || 'primary.main',
                      },
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `linear-gradient(135deg, ${tag.color || '#667eea'} 0%, ${tag.color || '#764ba2'} 100%)`,
                            boxShadow: `0 4px 12px ${tag.color || '#667eea'}40`,
                          }}
                        >
                          <TagIcon sx={{ color: 'white', fontSize: 24 }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" fontWeight={600}>
                            {tag.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {tag.usageCount} {tag.usageCount === 1 ? 'transaction' : 'transactions'}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleOpenTagDialog(tag)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteTag(tag)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                          color: 'error.main',
                        }}
                      >
                        Delete
                      </Button>
                    </CardActions>
                  </Card>
                </Fade>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Tag Dialog */}
      <Dialog
        open={openTagDialog}
        onClose={handleCloseTagDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle
          sx={{
            background: (theme) => theme.palette.gradient.primary,
            color: 'white',
            py: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
              <TagIcon />
            </Avatar>
            <Typography variant="h5" fontWeight={700}>
              {editingTag ? 'Edit Tag' : 'Create New Tag'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField
              label="Tag Name"
              fullWidth
              value={tagFormData.name}
              onChange={(e) => setTagFormData({ ...tagFormData, name: e.target.value })}
              placeholder="e.g., Work, Personal, Urgent"
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />

            {/* Color Picker */}
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                Tag Color
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                {['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b'].map((presetColor) => (
                  <Box
                    key={presetColor}
                    onClick={() => setTagFormData({ ...tagFormData, color: presetColor })}
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: presetColor,
                      cursor: 'pointer',
                      border: '3px solid',
                      borderColor: tagFormData.color === presetColor ? 'primary.main' : 'transparent',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'scale(1.1)',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                      },
                    }}
                  />
                ))}
              </Box>

              <Typography variant="caption" color="text.secondary" gutterBottom display="block" mb={1}>
                Custom Color
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box
                  sx={{
                    position: 'relative',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '3px solid',
                    borderColor: 'background.paper',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="color"
                    value={tagFormData.color}
                    onChange={(e) => setTagFormData({ ...tagFormData, color: e.target.value })}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  />
                </Box>
                <TextField
                  value={tagFormData.color}
                  onChange={(e) => setTagFormData({ ...tagFormData, color: e.target.value })}
                  size="small"
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            bgcolor: tagFormData.color,
                          }}
                        />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button
            onClick={handleCloseTagDialog}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmitTag}
            variant="contained"
            disabled={!tagFormData.name.trim()}
            sx={{
              borderRadius: 2,
              px: 4,
              textTransform: 'none',
              fontWeight: 600,
              background: (theme) => theme.palette.gradient.primary,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: 4,
              },
              transition: 'all 0.2s ease',
            }}
          >
            {editingTag ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Smart Tag Deletion Dialog */}
      <Dialog
        open={deleteTagDialog.open}
        onClose={() => setDeleteTagDialog({ open: false, tag: null, usage: null, loading: false })}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle
          sx={{
            background: (theme) => deleteTagDialog.usage?.canDelete 
              ? theme.palette.gradient.primary 
              : 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
            color: 'white',
            pb: 2,
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <DeleteIcon />
            <Typography variant="h6" fontWeight={600}>
              {deleteTagDialog.loading ? 'Checking Tag Usage...' : 'Delete Tag'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          {deleteTagDialog.loading ? (
            <Box display="flex" flexDirection="column" alignItems="center" py={3}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary" mt={2}>
                Checking where this tag is used...
              </Typography>
            </Box>
          ) : deleteTagDialog.usage?.canDelete ? (
            // Tag is not in use - simple confirmation
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                This tag is not currently in use and can be safely deleted.
              </Alert>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to delete the tag{' '}
                <Chip
                  label={deleteTagDialog.tag?.name}
                  size="small"
                  sx={{
                    bgcolor: deleteTagDialog.tag?.color || '#667eea',
                    color: 'white',
                    fontWeight: 600,
                  }}
                />
                ?
              </Typography>
            </Box>
          ) : (
            // Tag is in use - show usage and offer replacement
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This tag cannot be deleted because it's currently in use.
              </Alert>
              
              <Typography variant="body1" gutterBottom fontWeight={600}>
                Tag{' '}
                <Chip
                  label={deleteTagDialog.tag?.name}
                  size="small"
                  sx={{
                    bgcolor: deleteTagDialog.tag?.color || '#667eea',
                    color: 'white',
                    fontWeight: 600,
                  }}
                />{' '}
                is used in:
              </Typography>
              
              <Box sx={{ pl: 2, mt: 2, mb: 3 }}>
                {deleteTagDialog.usage && deleteTagDialog.usage.transactions > 0 && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    • {deleteTagDialog.usage.transactions} transaction{deleteTagDialog.usage.transactions !== 1 ? 's' : ''}
                  </Typography>
                )}
                {deleteTagDialog.usage && deleteTagDialog.usage.budgets > 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      • {deleteTagDialog.usage.budgets} budget{deleteTagDialog.usage.budgets !== 1 ? 's' : ''}:
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      {deleteTagDialog.usage.budgetNames.map((name) => (
                        <Typography key={name} variant="caption" color="text.secondary" display="block">
                          - {name}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>

              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Replace with another tag:
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                  Select a tag to replace all occurrences of "{deleteTagDialog.tag?.name}" in your transactions and budgets.
                </Typography>
                <TextField
                  select
                  fullWidth
                  value={replaceTagId}
                  onChange={(e) => setReplaceTagId(e.target.value)}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                  SelectProps={{
                    displayEmpty: true,
                  }}
                >
                  <MenuItem value="" disabled>
                    Select a tag...
                  </MenuItem>
                  {tags
                    .filter((t) => t.id !== deleteTagDialog.tag?.id)
                    .map((tag) => (
                      <MenuItem key={tag.id} value={tag.id}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: tag.color || '#667eea',
                            }}
                          />
                          {tag.name}
                          <Typography variant="caption" color="text.secondary" ml="auto">
                            ({tag.usageCount} uses)
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                </TextField>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button
            onClick={() => setDeleteTagDialog({ open: false, tag: null, usage: null, loading: false })}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
          {deleteTagDialog.usage?.canDelete ? (
            <Button
              onClick={handleConfirmDeleteTag}
              variant="contained"
              color="error"
              sx={{
                borderRadius: 2,
                px: 4,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Delete Tag
            </Button>
          ) : (
            <Button
              onClick={handleReplaceTag}
              variant="contained"
              disabled={!replaceTagId}
              sx={{
                borderRadius: 2,
                px: 4,
                textTransform: 'none',
                fontWeight: 600,
                background: (theme) => theme.palette.gradient.primary,
              }}
            >
              Replace & Delete
            </Button>
          )}
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
