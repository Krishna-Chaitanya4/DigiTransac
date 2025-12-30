import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { mongoDBService } from '../config/mongodb';
import { Category } from '../models/types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';
import { DbHelper } from '../utils/dbHelpers';

const router = Router();

router.use(authenticate);

// GET /api/categories - Get all categories (tree structure)
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const categoriesContainer = await mongoDBService.getCategoriesContainer();
    const categories = await DbHelper.findAllByUser<Category>(categoriesContainer, userId);

    ApiResponse.success(res, { categories });
  })
);

// POST /api/categories - Create folder or category
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { name, parentId, isFolder, icon, color } = req.body;

    if (!name) {
      return ApiResponse.badRequest(res, 'Category name is required');
    }

    const categoriesContainer = await mongoDBService.getCategoriesContainer();

    // Build path array
    let path: string[] = [];
    if (parentId) {
      const parent = await DbHelper.findByIdAndUser<Category>(
        categoriesContainer,
        parentId,
        userId
      );

      if (!parent) {
        return ApiResponse.notFound(res, 'Parent category not found');
      }

      // Cannot create category under a non-folder parent
      if (!parent.isFolder) {
        return ApiResponse.badRequest(
          res,
          'Cannot create subcategory under a category. Parent must be a folder.'
        );
      }

      path = [...parent.path, parent.id];
    }

    const newCategory = await DbHelper.createDocument<Category>(
      categoriesContainer,
      {
        userId,
        name,
        parentId: parentId || null,
        isFolder: isFolder || false,
        icon: icon || (isFolder ? 'folder' : 'category'),
        color: color || '#667eea',
        path,
      } as any,
      'cat'
    );

    logger.info({ categoryId: newCategory.id, userId }, 'Category created');
    ApiResponse.created(res, { category: newCategory }, 'Category created successfully');
  })
);

// PUT /api/categories/:id - Update category/folder
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, icon, color, parentId } = req.body;

    const categoriesContainer = await mongoDBService.getCategoriesContainer();

    const category = await DbHelper.findByIdAndUser<Category>(categoriesContainer, id, userId);
    if (!category) {
      return ApiResponse.notFound(res, 'Category not found');
    }

    // If parentId is being changed
    if (parentId !== undefined) {
      // Prevent self-parenting
      if (parentId === id) {
        return ApiResponse.badRequest(res, 'Category cannot be its own parent');
      }

      // If setting a parent (not null)
      if (parentId) {
        const newParent = await DbHelper.findByIdAndUser<Category>(
          categoriesContainer,
          parentId,
          userId
        );

        if (!newParent) {
          return ApiResponse.notFound(res, 'Parent category not found');
        }

        // Parent must be a folder
        if (!newParent.isFolder) {
          return ApiResponse.badRequest(res, 'Parent must be a folder');
        }

        // Prevent circular reference: check if newParent is a descendant of this category
        if (category.isFolder) {
          const isDescendant = await checkIfDescendant(categoriesContainer, userId, id, parentId);
          if (isDescendant) {
            return ApiResponse.badRequest(
              res,
              'Cannot move category under its own descendant (circular reference)'
            );
          }
        }
      }
    }

    const updateData: any = {};

    if (name) updateData.name = name;
    if (icon) updateData.icon = icon;
    if (color) updateData.color = color;

    // Handle parent change and path recalculation
    if (parentId !== undefined && parentId !== category.parentId) {
      updateData.parentId = parentId;

      // Recalculate path
      let newPath: string[] = [];
      if (parentId) {
        const parent = await DbHelper.findByIdAndUser<Category>(
          categoriesContainer,
          parentId,
          userId
        );
        if (parent) {
          newPath = [...parent.path, parent.id];
        }
      }
      updateData.path = newPath;

      // Update this category
      await categoriesContainer.updateOne(
        { id, userId },
        { $set: { ...updateData, updatedAt: new Date() } }
      );

      // If this is a folder, recursively update all descendants' paths
      if (category.isFolder) {
        await updateDescendantPaths(categoriesContainer, userId, id, newPath);
      }
    } else {
      // No parent change, just update other fields
      await DbHelper.updateByIdAndUser(categoriesContainer, id, userId, updateData);
    }

    const updatedCategory = await DbHelper.findByIdAndUser<Category>(
      categoriesContainer,
      id,
      userId
    );

    logger.info({ categoryId: id, userId }, 'Category updated');
    ApiResponse.success(res, { category: updatedCategory }, 'Category updated successfully');
  })
);

/**
 * Check if targetId is a descendant of categoryId (prevents circular references)
 */
async function checkIfDescendant(
  container: any,
  userId: string,
  categoryId: string,
  targetId: string
): Promise<boolean> {
  const target = await DbHelper.findByIdAndUser<Category>(container, targetId, userId);
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
  const children = await DbHelper.findAllByUser<Category>(container, userId, {
    parentId: folderId,
  });

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
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { id } = req.params;

    const categoriesContainer = await mongoDBService.getCategoriesContainer();

    const category = await DbHelper.findByIdAndUser<Category>(categoriesContainer, id, userId);
    if (!category) {
      return ApiResponse.notFound(res, 'Category not found');
    }

    // Check if folder has children
    if (category.isFolder) {
      const hasChildren = await DbHelper.exists(categoriesContainer, { parentId: id, userId });
      if (hasChildren) {
        return ApiResponse.badRequest(
          res,
          'Cannot delete folder with subcategories. Delete or move them first.'
        );
      }
    }

    // Check if category has expenses (transaction splits)
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();
    const expenseCount = await splitsContainer.countDocuments({ categoryId: id, userId });
    if (expenseCount > 0) {
      return ApiResponse.badRequest(
        res,
        `Cannot delete category with ${expenseCount} expense(s). Reassign or delete them first.`
      );
    }

    const deleted = await DbHelper.deleteByIdAndUser(categoriesContainer, id, userId);
    if (!deleted) {
      return ApiResponse.notFound(res, 'Category not found');
    }

    logger.info({ categoryId: id, userId }, 'Category deleted');
    ApiResponse.success(res, null, 'Category deleted successfully');
  })
);

// POST /api/categories/:id/move - Move category/folder
router.post(
  '/:id/move',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { id } = req.params;
    const { newParentId } = req.body;

    const categoriesContainer = await mongoDBService.getCategoriesContainer();

    const category = await DbHelper.findByIdAndUser<Category>(categoriesContainer, id, userId);
    if (!category) {
      return ApiResponse.notFound(res, 'Category not found');
    }

    // Build new path
    let newPath: string[] = [];
    if (newParentId) {
      const newParent = await DbHelper.findByIdAndUser<Category>(
        categoriesContainer,
        newParentId,
        userId
      );

      if (!newParent) {
        return ApiResponse.notFound(res, 'New parent category not found');
      }

      if (!newParent.isFolder) {
        return ApiResponse.badRequest(res, 'New parent must be a folder');
      }

      // Prevent circular reference
      if (newParent.path.includes(id)) {
        return ApiResponse.badRequest(res, 'Cannot move folder into its own subfolder');
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

    const updatedCategory = await DbHelper.findByIdAndUser<Category>(
      categoriesContainer,
      id,
      userId
    );

    logger.info({ categoryId: id, userId, newParentId }, 'Category moved');
    ApiResponse.success(res, { category: updatedCategory }, 'Category moved successfully');
  })
);

// GET /api/categories/stats - Get categories with usage statistics
router.get(
  '/stats',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const categoriesContainer = await mongoDBService.getCategoriesContainer();
    const transactionsContainer = await mongoDBService.getTransactionsContainer();

    // Fetch all categories
    const categories = await DbHelper.findAllByUser<Category>(categoriesContainer, userId);

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

    ApiResponse.success(res, { categories: enrichedCategories });
  })
);

export default router;
