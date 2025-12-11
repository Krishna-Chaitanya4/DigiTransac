import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/categories - Get all categories (tree structure)
router.get('/', async (_req, res) => {
  res.json({ message: 'Get all categories' });
});

// POST /api/categories - Create folder or category
router.post('/', async (_req, res) => {
  res.json({ message: 'Create category/folder' });
});

// PUT /api/categories/:id - Update category/folder
router.put('/:id', async (_req, res) => {
  res.json({ message: 'Update category/folder' });
});

// DELETE /api/categories/:id - Delete category/folder
router.delete('/:id', async (_req, res) => {
  res.json({ message: 'Delete category/folder' });
});

// POST /api/categories/:id/move - Move category/folder
router.post('/:id/move', async (_req, res) => {
  res.json({ message: 'Move category/folder' });
});

export default router;
