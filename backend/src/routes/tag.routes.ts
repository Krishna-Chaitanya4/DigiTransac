import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';
import { Tag, MongoFilter } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(authenticate);

// Helper function to ensure default tags exist
async function ensureDefaultTags(userId: string): Promise<void> {
  const tagsContainer = await cosmosDBService.getTagsContainer();

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
      const newTag: Tag = {
        id: uuidv4(),
        userId,
        name: defaultTag.name,
        color: defaultTag.color,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await tagsContainer.insertOne(newTag);
    }
  }
}

// GET /api/tags - Get all tags for a user
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    // Ensure default tags exist
    await ensureDefaultTags(userId);

    const tagsContainer = await cosmosDBService.getTagsContainer();
    const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();
    
    const tags = (await tagsContainer.find({ userId }).toArray()) as unknown as Tag[];

    // Calculate correct usage count for each tag from splits collection
    const tagsWithCorrectCount = await Promise.all(
      tags.map(async (tag) => {
        const splitsWithTag = await splitsContainer.find({
          userId,
          tags: tag.name,
        }).toArray();
        
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

    res.json({
      success: true,
      tags: tagsWithCorrectCount,
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tags',
    });
  }
});

// POST /api/tags - Create a new tag
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name, color } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Tag name is required',
      });
      return;
    }

    const tagsContainer = await cosmosDBService.getTagsContainer();

    // Check if tag already exists
    const existingTag = await tagsContainer.findOne({
      userId,
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (existingTag) {
      res.status(400).json({
        success: false,
        message: 'Tag with this name already exists',
      });
      return;
    }

    const newTag: Tag = {
      id: uuidv4(),
      userId,
      name: name.trim(),
      color,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await tagsContainer.insertOne(newTag);

    res.status(201).json({
      success: true,
      message: 'Tag created successfully',
      tag: newTag,
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating tag',
    });
  }
});

// PUT /api/tags/:id - Update a tag
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, color } = req.body;

    const tagsContainer = await cosmosDBService.getTagsContainer();

    const tag = await tagsContainer.findOne({ id, userId });
    if (!tag) {
      res.status(404).json({
        success: false,
        message: 'Tag not found',
      });
      return;
    }

    // Check if new name conflicts with existing tag
    if (name && name !== tag.name) {
      const existingTag = await tagsContainer.findOne({
        userId,
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        id: { $ne: id },
      });

      if (existingTag) {
        res.status(400).json({
          success: false,
          message: 'Tag with this name already exists',
        });
        return;
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
      const transactionsContainer = await cosmosDBService.getTransactionsContainer();
      await transactionsContainer.updateMany(
        { userId, tags: tag.name },
        { $set: { 'tags.$': name.trim() } }
      );
    }

    const updatedTag = await tagsContainer.findOne({ id, userId });

    res.json({
      success: true,
      message: 'Tag updated successfully',
      tag: updatedTag,
    });
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating tag',
    });
  }
});

// GET /api/tags/:id/usage - Check tag usage in transactions and budgets
router.get('/:id/usage', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const tagsContainer = await cosmosDBService.getTagsContainer();
    const tag = (await tagsContainer.findOne({ id, userId })) as unknown as Tag;
    
    if (!tag) {
      res.status(404).json({
        success: false,
        message: 'Tag not found',
      });
      return;
    }

    // Count transactions using this tag
    // Tags are stored in the transactionSplits collection, not in transactions
    const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();
    
    // Find all splits that have this tag
    const splitsWithTag = await splitsContainer.find({
      userId,
      tags: tag.name,
    }).toArray();
    
    // Get unique transaction IDs from splits
    const transactionIds = [...new Set(splitsWithTag.map((split: any) => split.transactionId))];
    const transactionCount = transactionIds.length;

    // Count budgets using this tag in include/exclude filters
    const budgetsContainer = await cosmosDBService.getBudgetsContainer();
    const budgets = await budgetsContainer.find({ userId }).toArray();
    
    const budgetsUsingTag = budgets.filter((budget: any) => {
      const includeTags = budget.filters?.includeTags || [];
      const excludeTags = budget.filters?.excludeTags || [];
      return includeTags.includes(tag.name) || excludeTags.includes(tag.name);
    });

    res.json({
      success: true,
      usage: {
        transactions: transactionCount,
        budgets: budgetsUsingTag.length,
        budgetNames: budgetsUsingTag.map((b: any) => b.name),
        canDelete: transactionCount === 0 && budgetsUsingTag.length === 0,
      },
    });
  } catch (error) {
    console.error('Error checking tag usage:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking tag usage',
    });
  }
});

// POST /api/tags/:id/replace - Replace a tag with another tag
router.post('/:id/replace', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { replacementTagId } = req.body;

    if (!replacementTagId) {
      res.status(400).json({
        success: false,
        message: 'Replacement tag ID is required',
      });
      return;
    }

    const tagsContainer = await cosmosDBService.getTagsContainer();
    
    // Get both tags
    const oldTag = (await tagsContainer.findOne({ id, userId })) as unknown as Tag;
    const newTag = (await tagsContainer.findOne({ id: replacementTagId, userId })) as unknown as Tag;
    
    if (!oldTag || !newTag) {
      res.status(404).json({
        success: false,
        message: 'Tag not found',
      });
      return;
    }

    // Replace in transactions (via splits collection)
    const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();
    const splitsWithOldTag = await splitsContainer.find({
      userId,
      tags: oldTag.name,
    }).toArray();

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
    const budgetsContainer = await cosmosDBService.getBudgetsContainer();
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
        await budgetsContainer.updateOne(
          { _id: budget._id },
          { $set: { filters } }
        );
      }
    }

    // Update usage counts
    await tagsContainer.updateOne(
      { id: newTag.id },
      { $inc: { usageCount: splitsWithOldTag.length } as any }
    );

    // Delete old tag
    await tagsContainer.deleteOne({ id: oldTag.id, userId });

    res.json({
      success: true,
      message: `Tag "${oldTag.name}" replaced with "${newTag.name}"`,
      replaced: {
        transactions: transactionIds.length,
        budgets: budgets.filter((b: any) => {
          const includeTags = b.filters?.includeTags || [];
          const excludeTags = b.filters?.excludeTags || [];
          return includeTags.includes(oldTag.name) || excludeTags.includes(oldTag.name);
        }).length,
      },
    });
  } catch (error) {
    console.error('Error replacing tag:', error);
    res.status(500).json({
      success: false,
      message: 'Error replacing tag',
    });
  }
});

// DELETE /api/tags/:id - Delete a tag (only if not in use)
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const tagsContainer = await cosmosDBService.getTagsContainer();

    const tag = (await tagsContainer.findOne({ id, userId })) as unknown as Tag;
    if (!tag) {
      res.status(404).json({
        success: false,
        message: 'Tag not found',
      });
      return;
    }

    // Check if tag is in use
    // Tags are stored in the transactionSplits collection
    const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();
    
    const splitsWithTag = await splitsContainer.find({
      userId,
      tags: tag.name,
    }).toArray();
    
    const transactionIds = [...new Set(splitsWithTag.map((split: any) => split.transactionId))];
    const transactionCount = transactionIds.length;

    const budgetsContainer = await cosmosDBService.getBudgetsContainer();
    const budgets = await budgetsContainer.find({ userId }).toArray();
    
    const budgetsUsingTag = budgets.filter((budget: any) => {
      const includeTags = budget.filters?.includeTags || [];
      const excludeTags = budget.filters?.excludeTags || [];
      return includeTags.includes(tag.name) || excludeTags.includes(tag.name);
    });

    if (transactionCount > 0 || budgetsUsingTag.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete tag that is in use',
        usage: {
          transactions: transactionCount,
          budgets: budgetsUsingTag.length,
          budgetNames: budgetsUsingTag.map((b: any) => b.name),
        },
      });
      return;
    }

    // Tag is not in use, safe to delete
    await tagsContainer.deleteOne({ id, userId });

    res.json({
      success: true,
      message: 'Tag deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting tag',
    });
  }
});

// GET /api/tags/suggestions - Get tag suggestions based on usage
router.get('/suggestions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { query } = req.query;

    const tagsContainer = await cosmosDBService.getTagsContainer();

    const filter: MongoFilter<Tag> = { userId };

    if (query) {
      filter.name = { $regex: query as string, $options: 'i' };
    }

    const tags = (await tagsContainer
      .find(filter)
      .sort({ usageCount: -1 })
      .limit(10)
      .toArray()) as unknown as Tag[];

    res.json({
      success: true,
      suggestions: tags.map((t) => t.name),
    });
  } catch (error) {
    console.error('Error fetching tag suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tag suggestions',
    });
  }
});

export default router;
