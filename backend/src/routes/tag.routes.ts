import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { mongoDBService } from '../config/mongodb';
import { Tag, MongoFilter } from '../models/types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';
import { DbHelper } from '../utils/dbHelpers';

const router = Router();

router.use(authenticate);

// Helper function to ensure default tags exist
async function ensureDefaultTags(userId: string): Promise<void> {
  const tagsContainer = await mongoDBService.getTagsContainer();

  const defaultTags = [
    { name: 'expense', color: '#f44336' },
    { name: 'income', color: '#4caf50' },
  ];

  for (const defaultTag of defaultTags) {
    const exists = await tagsContainer.findOne({
      userId,
      name: defaultTag.name,
    });

    if (!exists) {
      await DbHelper.createDocument<Tag>(tagsContainer, {
        userId,
        name: defaultTag.name,
        color: defaultTag.color,
        usageCount: 0,
      });
    }
  }
}

// GET /api/tags - Get all tags for a user
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    // Ensure default tags exist
    await ensureDefaultTags(userId);

    const tagsContainer = await mongoDBService.getTagsContainer();
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();

    const tags = await DbHelper.findAllByUser<Tag>(tagsContainer, userId);

    // Calculate correct usage count for each tag from splits collection
    const tagsWithCorrectCount = await Promise.all(
      tags.map(async (tag) => {
        const splitsWithTag = await splitsContainer
          .find({
            userId,
            tags: tag.name,
          })
          .toArray();

        // Get unique transaction IDs
        const transactionIds = [...new Set(splitsWithTag.map((split: any) => split.transactionId))];

        return {
          ...tag,
          usageCount: transactionIds.length,
        };
      })
    );

    // Sort by usage count
    tagsWithCorrectCount.sort((a, b) => {
      if (a.usageCount !== b.usageCount) {
        return b.usageCount - a.usageCount;
      }
      return a.name.localeCompare(b.name);
    });

    logger.info({ userId, count: tagsWithCorrectCount.length }, 'Tags fetched successfully');
    ApiResponse.success(res, { tags: tagsWithCorrectCount });
  })
);

// POST /api/tags - Create a new tag
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { name, color } = req.body;

    if (!name) {
      return ApiResponse.badRequest(res, 'Tag name is required');
    }

    const tagsContainer = await mongoDBService.getTagsContainer();

    // Check if tag already exists
    const existingTag = await tagsContainer.findOne({
      userId,
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (existingTag) {
      return ApiResponse.badRequest(res, 'Tag with this name already exists');
    }

    const newTag = await DbHelper.createDocument<Tag>(tagsContainer, {
      userId,
      name: name.trim(),
      color,
      usageCount: 0,
    });

    logger.info({ userId, tagId: newTag.id, tagName: newTag.name }, 'Tag created successfully');
    ApiResponse.created(res, { tag: newTag }, 'Tag created successfully');
  })
);

// PUT /api/tags/:id - Update a tag
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, color } = req.body;

    const tagsContainer = await mongoDBService.getTagsContainer();

    const tag = await tagsContainer.findOne({ id, userId });
    if (!tag) {
      return ApiResponse.notFound(res, 'Tag not found');
    }

    // Check if new name conflicts with existing tag
    if (name && name !== tag.name) {
      const existingTag = await tagsContainer.findOne({
        userId,
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        id: { $ne: id },
      });

      if (existingTag) {
        return ApiResponse.badRequest(res, 'Tag with this name already exists');
      }
    }

    const updateData: Partial<Tag> = {
      ...(name && { name: name.trim() }),
      ...(color !== undefined && { color }),
      updatedAt: new Date(),
    };

    await tagsContainer.updateOne({ id, userId }, { $set: updateData });

    // If name changed, update all transactions using this tag
    if (name && name !== tag.name) {
      const transactionsContainer = await mongoDBService.getTransactionsContainer();
      await transactionsContainer.updateMany(
        { userId, tags: tag.name },
        { $set: { 'tags.$': name.trim() } }
      );
    }

    const updatedTag = await tagsContainer.findOne({ id, userId });

    logger.info({ userId, tagId: id }, 'Tag updated successfully');
    ApiResponse.success(res, { tag: updatedTag }, 'Tag updated successfully');
  })
);

// GET /api/tags/:id/usage - Check tag usage in transactions and budgets
router.get(
  '/:id/usage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;

    const tagsContainer = await mongoDBService.getTagsContainer();
    const tag = (await tagsContainer.findOne({ id, userId })) as unknown as Tag;

    if (!tag) {
      return ApiResponse.notFound(res, 'Tag not found');
    }

    // Count transactions using this tag
    // Tags are stored in the transactionSplits collection, not in transactions
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();

    // Find all splits that have this tag
    const splitsWithTag = await splitsContainer
      .find({
        userId,
        tags: tag.name,
      })
      .toArray();

    // Get unique transaction IDs from splits
    const transactionIds = [...new Set(splitsWithTag.map((split: any) => split.transactionId))];
    const transactionCount = transactionIds.length;

    // Count budgets using this tag in include/exclude filters
    const budgetsContainer = await mongoDBService.getBudgetsContainer();
    const budgets = await budgetsContainer.find({ userId }).toArray();

    const budgetsUsingTag = budgets.filter((budget: any) => {
      const includeTags = budget.filters?.includeTags || [];
      const excludeTags = budget.filters?.excludeTags || [];
      return includeTags.includes(tag.name) || excludeTags.includes(tag.name);
    });

    logger.info(
      { userId, tagId: id, transactionCount, budgetCount: budgetsUsingTag.length },
      'Tag usage checked'
    );
    ApiResponse.success(res, {
      usage: {
        transactions: transactionCount,
        budgets: budgetsUsingTag.length,
        budgetNames: budgetsUsingTag.map((b: any) => b.name),
        canDelete: transactionCount === 0 && budgetsUsingTag.length === 0,
      },
    });
  })
);

// POST /api/tags/:id/replace - Replace a tag with another tag
router.post(
  '/:id/replace',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;
    const { replacementTagId } = req.body;

    if (!replacementTagId) {
      return ApiResponse.badRequest(res, 'Replacement tag ID is required');
    }

    const tagsContainer = await mongoDBService.getTagsContainer();

    // Get both tags
    const oldTag = (await tagsContainer.findOne({ id, userId })) as unknown as Tag;
    const newTag = (await tagsContainer.findOne({
      id: replacementTagId,
      userId,
    })) as unknown as Tag;

    if (!oldTag || !newTag) {
      return ApiResponse.notFound(res, 'Tag not found');
    }

    // Replace in transactions (via splits collection)
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();
    const splitsWithOldTag = await splitsContainer
      .find({
        userId,
        tags: oldTag.name,
      })
      .toArray();

    for (const split of splitsWithOldTag) {
      const tags = split.tags || [];
      const updatedTags = tags
        .filter((t: string) => t !== oldTag.name)
        .concat(newTag.name)
        .filter((t: string, index: number, self: string[]) => self.indexOf(t) === index); // Remove duplicates

      await splitsContainer.updateOne(
        { _id: split._id },
        { $set: { tags: updatedTags, updatedAt: new Date() } }
      );
    }

    // Get unique transaction count for response
    const transactionIds = [...new Set(splitsWithOldTag.map((split: any) => split.transactionId))];

    // Replace in budgets
    const budgetsContainer = await mongoDBService.getBudgetsContainer();
    const budgets = await budgetsContainer.find({ userId }).toArray();

    for (const budget of budgets) {
      let updated = false;
      const filters = budget.filters || {};

      if (filters.includeTags?.includes(oldTag.name)) {
        filters.includeTags = filters.includeTags
          .filter((t: string) => t !== oldTag.name)
          .concat(newTag.name)
          .filter((t: string, index: number, self: string[]) => self.indexOf(t) === index);
        updated = true;
      }

      if (filters.excludeTags?.includes(oldTag.name)) {
        filters.excludeTags = filters.excludeTags
          .filter((t: string) => t !== oldTag.name)
          .concat(newTag.name)
          .filter((t: string, index: number, self: string[]) => self.indexOf(t) === index);
        updated = true;
      }

      if (updated) {
        await budgetsContainer.updateOne({ _id: budget._id }, { $set: { filters } });
      }
    }

    // Update usage counts
    await tagsContainer.updateOne(
      { id: newTag.id },
      { $inc: { usageCount: splitsWithOldTag.length } as any }
    );

    // Delete old tag
    await tagsContainer.deleteOne({ id: oldTag.id, userId });

    const replaced = {
      transactions: transactionIds.length,
      budgets: budgets.filter((b: any) => {
        const includeTags = b.filters?.includeTags || [];
        const excludeTags = b.filters?.excludeTags || [];
        return includeTags.includes(oldTag.name) || excludeTags.includes(oldTag.name);
      }).length,
    };

    logger.info(
      { userId, oldTagId: id, newTagId: replacementTagId, replaced },
      `Tag "${oldTag.name}" replaced with "${newTag.name}"`
    );

    logger.info(
      { userId, oldTagId: id, newTagId: replacementTagId, replaced },
      `Tag "${oldTag.name}" replaced with "${newTag.name}"`
    );
    ApiResponse.success(res, {
      replaced,
      message: `Tag "${oldTag.name}" replaced with "${newTag.name}"`,
    });
  })
);

// DELETE /api/tags/:id - Delete a tag (only if not in use)
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;

    const tagsContainer = await mongoDBService.getTagsContainer();

    const tag = await DbHelper.findByIdAndUser<Tag>(tagsContainer, id, userId);
    if (!tag) {
      return ApiResponse.notFound(res, 'Tag not found');
    }

    // Check if tag is in use
    // Tags are stored in the transactionSplits collection
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();

    const splitsWithTag = await splitsContainer
      .find({
        userId,
        tags: tag.name,
      })
      .toArray();

    const transactionIds = [...new Set(splitsWithTag.map((split: any) => split.transactionId))];
    const transactionCount = transactionIds.length;

    const budgetsContainer = await mongoDBService.getBudgetsContainer();
    const budgets = await budgetsContainer.find({ userId }).toArray();

    const budgetsUsingTag = budgets.filter((budget: any) => {
      const includeTags = budget.filters?.includeTags || [];
      const excludeTags = budget.filters?.excludeTags || [];
      return includeTags.includes(tag.name) || excludeTags.includes(tag.name);
    });

    if (transactionCount > 0 || budgetsUsingTag.length > 0) {
      return ApiResponse.badRequest(res, 'Cannot delete tag that is in use', {
        usage: {
          transactions: transactionCount,
          budgets: budgetsUsingTag.length,
          budgetNames: budgetsUsingTag.map((b: any) => b.name),
        },
      });
    }

    // Tag is not in use, safe to delete
    await DbHelper.deleteByIdAndUser(tagsContainer, id, userId);

    logger.info({ userId, tagId: id, tagName: tag.name }, 'Tag deleted successfully');
    ApiResponse.success(res, null, 'Tag deleted successfully');
  })
);

// GET /api/tags/suggestions - Get tag suggestions based on usage
router.get(
  '/suggestions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { query } = req.query;

    const tagsContainer = await mongoDBService.getTagsContainer();

    const filter: MongoFilter<Tag> = { userId };

    if (query) {
      filter.name = { $regex: query as string, $options: 'i' };
    }

    const tags = (await tagsContainer
      .find(filter)
      .sort({ usageCount: -1 })
      .limit(10)
      .toArray()) as unknown as Tag[];

    logger.info({ userId, query, count: tags.length }, 'Tag suggestions fetched');
    ApiResponse.success(res, { suggestions: tags.map((t) => t.name) });
  })
);

export default router;
