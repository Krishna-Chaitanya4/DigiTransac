import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';
import { Tag } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(authenticate);

// GET /api/tags - Get all tags for a user
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    
    const tagsContainer = await cosmosDBService.getTagsContainer();
    const tags = (await tagsContainer
      .find({ userId })
      .toArray()) as unknown as Tag[];

    // Sort in-memory to avoid composite index requirement
    tags.sort((a, b) => {
      if (a.usageCount !== b.usageCount) {
        return b.usageCount - a.usageCount; // Descending by usageCount
      }
      return a.name.localeCompare(b.name); // Ascending by name
    });

    res.json({
      success: true,
      tags
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tags'
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
        message: 'Tag name is required'
      });
      return;
    }

    const tagsContainer = await cosmosDBService.getTagsContainer();

    // Check if tag already exists
    const existingTag = await tagsContainer.findOne({ 
      userId, 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });

    if (existingTag) {
      res.status(400).json({
        success: false,
        message: 'Tag with this name already exists'
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
      updatedAt: new Date()
    };

    await tagsContainer.insertOne(newTag);

    res.status(201).json({
      success: true,
      message: 'Tag created successfully',
      tag: newTag
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating tag'
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
        message: 'Tag not found'
      });
      return;
    }

    // Check if new name conflicts with existing tag
    if (name && name !== tag.name) {
      const existingTag = await tagsContainer.findOne({ 
        userId, 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        id: { $ne: id }
      });

      if (existingTag) {
        res.status(400).json({
          success: false,
          message: 'Tag with this name already exists'
        });
        return;
      }
    }

    const updateData: Partial<Tag> = {
      ...(name && { name: name.trim() }),
      ...(color !== undefined && { color }),
      updatedAt: new Date()
    };

    await tagsContainer.updateOne(
      { id, userId },
      { $set: updateData }
    );

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
      tag: updatedTag
    });
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating tag'
    });
  }
});

// DELETE /api/tags/:id - Delete a tag
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const tagsContainer = await cosmosDBService.getTagsContainer();

    const tag = await tagsContainer.findOne({ id, userId }) as unknown as Tag;
    if (!tag) {
      res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
      return;
    }

    // Remove tag from all transactions
    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    await transactionsContainer.updateMany(
      { userId, tags: tag.name },
      { $pull: { tags: tag.name } as any }
    );

    await tagsContainer.deleteOne({ id, userId });

    res.json({
      success: true,
      message: 'Tag deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting tag'
    });
  }
});

// GET /api/tags/suggestions - Get tag suggestions based on usage
router.get('/suggestions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { query } = req.query;
    
    const tagsContainer = await cosmosDBService.getTagsContainer();
    
    let filter: any = { userId };
    
    if (query) {
      filter.name = { $regex: query, $options: 'i' };
    }
    
    const tags = (await tagsContainer
      .find(filter)
      .sort({ usageCount: -1 })
      .limit(10)
      .toArray()) as unknown as Tag[];

    res.json({
      success: true,
      suggestions: tags.map(t => t.name)
    });
  } catch (error) {
    console.error('Error fetching tag suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tag suggestions'
    });
  }
});

export default router;
