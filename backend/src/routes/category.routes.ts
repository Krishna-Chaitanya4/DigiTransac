import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { mongoDBService } from '../config/mongodb';
import { Category } from '../models/types';

const router = Router();

router.use(authenticate);

// GET /api/categories - Get all categories (tree structure)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const categoriesContainer = await mongoDBService.getCategoriesContainer();

    const categories = (await categoriesContainer
      .find({ userId })
      .toArray()) as unknown as Category[];

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

// POST /api/categories - Create folder or category
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('📝 Creating category:', req.body);
    const userId = req.userId!;
    const { name, parentId, isFolder, icon, color } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
      return;
    }

    const categoriesContainer = await mongoDBService.getCategoriesContainer();

    // Build path array
    let path: string[] = [];
    if (parentId) {
      const parent = (await categoriesContainer.findOne({
        id: parentId,
        userId,
      })) as Category | null;
      if (!parent) {
        res.status(404).json({
          success: false,
          message: 'Parent category not found',
        });
        return;
      }

      // Cannot create category under a non-folder parent
      if (!parent.isFolder) {
        res.status(400).json({
          success: false,
          message: 'Cannot create subcategory under a category. Parent must be a folder.',
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
      updatedAt: new Date(),
    };

    await categoriesContainer.insertOne(newCategory);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: newCategory,
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category',
    });
  }
});

// PUT /api/categories/:id - Update category/folder
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, icon, color, parentId } = req.body;

    const categoriesContainer = await mongoDBService.getCategoriesContainer();

    const category = (await categoriesContainer.findOne({ id, userId })) as Category | null;
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    // If parentId is being changed
    if (parentId !== undefined) {
      // Prevent self-parenting
      if (parentId === id) {
        res.status(400).json({
          success: false,
          message: 'Category cannot be its own parent',
        });
        return;
      }

      // If setting a parent (not null)
      if (parentId) {
        const newParent = (await categoriesContainer.findOne({
          id: parentId,
          userId,
        })) as Category | null;
        if (!newParent) {
          res.status(404).json({
            success: false,
            message: 'Parent category not found',
          });
          return;
        }

        // Parent must be a folder
        if (!newParent.isFolder) {
          res.status(400).json({
            success: false,
            message: 'Parent must be a folder',
          });
          return;
        }

        // Prevent circular reference: check if newParent is a descendant of this category
        if (category.isFolder) {
          const isDescendant = await checkIfDescendant(categoriesContainer, userId, id, parentId);
          if (isDescendant) {
            res.status(400).json({
              success: false,
              message: 'Cannot move category under its own descendant (circular reference)',
            });
            return;
          }
        }
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name) updateData.name = name;
    if (icon) updateData.icon = icon;
    if (color) updateData.color = color;

    // Handle parent change and path recalculation
    if (parentId !== undefined && parentId !== category.parentId) {
      updateData.parentId = parentId;

      // Recalculate path
      let newPath: string[] = [];
      if (parentId) {
        const parent = (await categoriesContainer.findOne({
          id: parentId,
          userId,
        })) as Category | null;
        if (parent) {
          newPath = [...parent.path, parent.id];
        }
      }
      updateData.path = newPath;

      // Update this category
      await categoriesContainer.updateOne({ id, userId }, { $set: updateData });

      // If this is a folder, recursively update all descendants' paths
      if (category.isFolder) {
        await updateDescendantPaths(categoriesContainer, userId, id, newPath);
      }
    } else {
      // No parent change, just update other fields
      await categoriesContainer.updateOne({ id, userId }, { $set: updateData });
    }

    const updatedCategory = await categoriesContainer.findOne({ id, userId });

    res.json({
      success: true,
      message: 'Category updated successfully',
      category: updatedCategory,
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating category',
    });
  }
});

/**
 * Check if targetId is a descendant of categoryId (prevents circular references)
 */
async function checkIfDescendant(
  container: any,
  userId: string,
  categoryId: string,
  targetId: string
): Promise<boolean> {
  const target = (await container.findOne({ id: targetId, userId })) as Category | null;
  if (!target) return false;

  // Check if categoryId is in the target's path
  return target.path.includes(categoryId);
}

/**
 * Recursively update paths for all descendants when a folder is moved
 */
async function updateDescendantPaths(
  container: any,
  userId: string,
  folderId: string,
  newParentPath: string[]
): Promise<void> {
  // Get all direct children
  const children = (await container.find({ parentId: folderId, userId }).toArray()) as Category[];

  for (const child of children) {
    // New path for this child
    const newPath = [...newParentPath, folderId];

    await container.updateOne(
      { id: child.id, userId },
      { $set: { path: newPath, updatedAt: new Date() } }
    );

    // If child is also a folder, recursively update its children
    if (child.isFolder) {
      await updateDescendantPaths(container, userId, child.id, newPath);
    }
  }
}

// DELETE /api/categories/:id - Delete category/folder
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const categoriesContainer = await mongoDBService.getCategoriesContainer();

    const category = (await categoriesContainer.findOne({ id, userId })) as Category | null;
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    // Check if folder has children
    if (category.isFolder) {
      const children = await categoriesContainer.countDocuments({ parentId: id, userId });
      if (children > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete folder with subcategories. Delete or move them first.',
        });
        return;
      }
    }

    // Check if category has expenses (transaction splits)
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();
    const expenseCount = await splitsContainer.countDocuments({ categoryId: id, userId });
    if (expenseCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete category with ${expenseCount} expense(s). Reassign or delete them first.`,
      });
      return;
    }

    await categoriesContainer.deleteOne({ id, userId });

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
    });
  }
});

// POST /api/categories/:id/move - Move category/folder
router.post('/:id/move', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { newParentId } = req.body;

    const categoriesContainer = await mongoDBService.getCategoriesContainer();

    const category = (await categoriesContainer.findOne({ id, userId })) as Category | null;
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    // Build new path
    let newPath: string[] = [];
    if (newParentId) {
      const newParent = (await categoriesContainer.findOne({
        id: newParentId,
        userId,
      })) as Category | null;
      if (!newParent) {
        res.status(404).json({
          success: false,
          message: 'New parent category not found',
        });
        return;
      }

      if (!newParent.isFolder) {
        res.status(400).json({
          success: false,
          message: 'New parent must be a folder',
        });
        return;
      }

      // Prevent circular reference
      if (newParent.path.includes(id)) {
        res.status(400).json({
          success: false,
          message: 'Cannot move folder into its own subfolder',
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
          updatedAt: new Date(),
        },
      }
    );

    // Update all descendants' paths if it's a folder
    if (category.isFolder) {
      const descendants = (await categoriesContainer
        .find({
          userId,
          path: { $elemMatch: { $eq: id } },
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
              updatedAt: new Date(),
            },
          }
        );
      }
    }

    const updatedCategory = await categoriesContainer.findOne({ id, userId });

    res.json({
      success: true,
      message: 'Category moved successfully',
      category: updatedCategory,
    });
  } catch (error) {
    console.error('Error moving category:', error);
    res.status(500).json({
      success: false,
      message: 'Error moving category',
    });
  }
});

// GET /api/categories/stats - Get categories with usage statistics
router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const categoriesContainer = await mongoDBService.getCategoriesContainer();
    const transactionsContainer = await mongoDBService.getTransactionsContainer();

    // Fetch all categories
    const categories = (await categoriesContainer
      .find({ userId })
      .toArray()) as unknown as Category[];

    // Fetch transaction counts per category (approved only)
    const pipeline = [
      {
        $match: {
          userId,
          reviewStatus: 'approved',
          'splits.categoryId': { $exists: true, $ne: null },
        },
      },
      { $unwind: '$splits' },
      {
        $group: {
          _id: '$splits.categoryId',
          count: { $sum: 1 },
          lastUsed: { $max: '$date' },
          totalAmount: { $sum: '$splits.amount' },
        },
      },
    ];

    const statsResult = await transactionsContainer.aggregate(pipeline).toArray();

    // Create a map for quick lookup
    const statsMap = new Map(
      statsResult.map((stat: any) => [
        stat._id,
        {
          transactionCount: stat.count,
          lastUsed: stat.lastUsed,
          totalAmount: stat.totalAmount,
        },
      ])
    );

    // Enrich categories with stats
    const enrichedCategories = categories.map((cat) => {
      const stats = statsMap.get(cat.id);
      return {
        ...cat,
        transactionCount: stats?.transactionCount || 0,
        lastUsed: stats?.lastUsed || null,
        totalAmount: stats?.totalAmount || 0,
      };
    });

    res.json({
      success: true,
      categories: enrichedCategories,
    });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category statistics',
    });
  }
});

export default router;
