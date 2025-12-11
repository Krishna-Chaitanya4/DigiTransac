import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';
import { Category } from '../models/types';

const router = Router();

router.use(authenticate);

// GET /api/categories - Get all categories (tree structure)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const categoriesContainer = await cosmosDBService.getCategoriesContainer();
    
    const categories = (await categoriesContainer
      .find({ userId })
      .sort({ createdAt: 1 })
      .toArray()) as unknown as Category[];

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
});

// POST /api/categories - Create folder or category
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name, parentId, isFolder, icon, color } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
      return;
    }

    const categoriesContainer = await cosmosDBService.getCategoriesContainer();

    // Build path array
    let path: string[] = [];
    if (parentId) {
      const parent = await categoriesContainer.findOne({ id: parentId, userId }) as Category | null;
      if (!parent) {
        res.status(404).json({
          success: false,
          message: 'Parent category not found'
        });
        return;
      }
      
      // Cannot create category under a non-folder parent
      if (!parent.isFolder) {
        res.status(400).json({
          success: false,
          message: 'Cannot create subcategory under a category. Parent must be a folder.'
        });
        return;
      }
      
      path = [...parent.path, parent.id];
    }

    const newCategory: Category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name,
      parentId: parentId || null,
      isFolder: isFolder || false,
      icon: icon || (isFolder ? 'folder' : 'category'),
      color: color || '#667eea',
      path,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await categoriesContainer.insertOne(newCategory);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: newCategory
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category'
    });
  }
});

// PUT /api/categories/:id - Update category/folder
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, icon, color } = req.body;

    const categoriesContainer = await cosmosDBService.getCategoriesContainer();
    
    const category = await categoriesContainer.findOne({ id, userId }) as Category | null;
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    const updateData: any = {
      updatedAt: new Date()
    };

    if (name) updateData.name = name;
    if (icon) updateData.icon = icon;
    if (color) updateData.color = color;

    await categoriesContainer.updateOne(
      { id, userId },
      { $set: updateData }
    );

    const updatedCategory = await categoriesContainer.findOne({ id, userId });

    res.json({
      success: true,
      message: 'Category updated successfully',
      category: updatedCategory
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating category'
    });
  }
});

// DELETE /api/categories/:id - Delete category/folder
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const categoriesContainer = await cosmosDBService.getCategoriesContainer();
    
    const category = await categoriesContainer.findOne({ id, userId }) as Category | null;
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    // Check if folder has children
    if (category.isFolder) {
      const children = await categoriesContainer.countDocuments({ parentId: id, userId });
      if (children > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete folder with subcategories. Delete or move them first.'
        });
        return;
      }
    }

    // Check if category has expenses
    const expensesContainer = await cosmosDBService.getExpensesContainer();
    const expenseCount = await expensesContainer.countDocuments({ categoryId: id, userId });
    if (expenseCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete category with ${expenseCount} expense(s). Reassign or delete them first.`
      });
      return;
    }

    await categoriesContainer.deleteOne({ id, userId });

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category'
    });
  }
});

// POST /api/categories/:id/move - Move category/folder
router.post('/:id/move', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { newParentId } = req.body;

    const categoriesContainer = await cosmosDBService.getCategoriesContainer();
    
    const category = await categoriesContainer.findOne({ id, userId }) as Category | null;
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    // Build new path
    let newPath: string[] = [];
    if (newParentId) {
      const newParent = await categoriesContainer.findOne({ id: newParentId, userId }) as Category | null;
      if (!newParent) {
        res.status(404).json({
          success: false,
          message: 'New parent category not found'
        });
        return;
      }

      if (!newParent.isFolder) {
        res.status(400).json({
          success: false,
          message: 'New parent must be a folder'
        });
        return;
      }

      // Prevent circular reference
      if (newParent.path.includes(id)) {
        res.status(400).json({
          success: false,
          message: 'Cannot move folder into its own subfolder'
        });
        return;
      }

      newPath = [...newParent.path, newParent.id];
    }

    // Update category
    await categoriesContainer.updateOne(
      { id, userId },
      {
        $set: {
          parentId: newParentId || null,
          path: newPath,
          updatedAt: new Date()
        }
      }
    );

    // Update all descendants' paths if it's a folder
    if (category.isFolder) {
      const descendants = (await categoriesContainer
        .find({
          userId,
          path: { $elemMatch: { $eq: id } }
        })
        .toArray()) as unknown as Category[];

      for (const desc of descendants) {
        const oldPathIndex = desc.path.indexOf(id);
        const updatedPath = [...newPath, id, ...desc.path.slice(oldPathIndex + 1)];
        
        await categoriesContainer.updateOne(
          { id: desc.id, userId },
          {
            $set: {
              path: updatedPath,
              updatedAt: new Date()
            }
          }
        );
      }
    }

    const updatedCategory = await categoriesContainer.findOne({ id, userId });

    res.json({
      success: true,
      message: 'Category moved successfully',
      category: updatedCategory
    });
  } catch (error) {
    console.error('Error moving category:', error);
    res.status(500).json({
      success: false,
      message: 'Error moving category'
    });
  }
});

export default router;
