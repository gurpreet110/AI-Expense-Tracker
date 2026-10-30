import express  from 'express'

import {
    getBudgets,
    createBudget,
    deleteBudgets,
    updateBudgets
} from '../controllers/budgetsControllers.js';
import protect from '../middleware/authMiddleware.js';
const router=express.Router()
router.use(protect)



router.get('/',getBudgets)
router.get('/',createBudget)
router.patch('/:id',updateBudgets)
router.delete('/:id',deleteBudgets)

export default router