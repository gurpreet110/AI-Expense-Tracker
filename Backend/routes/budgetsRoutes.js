import express  from 'express'

import {
    getBudgets,
    createBudget,
    deleteBudgets,
    updateBudgets
} from '../controllers/budgetsControllers.js';
import { getBudgetAnalysis } from '../controllers/insightsControllers.js';
import protect from '../middleware/authMiddleware.js';
const router=express.Router()
router.use(protect)

router.get('/',getBudgets)
router.post('/',createBudget)
router.post('/analyze', getBudgetAnalysis)
router.put('/:id',updateBudgets)
router.patch('/:id',updateBudgets)
router.delete('/:id',deleteBudgets)

export default router