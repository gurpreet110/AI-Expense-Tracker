
import express from 'express';

import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
} from '../controllers/categoriesControllers.js';

import protect from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getCategories);
router.post('/', createCategory);
router.patch('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;
