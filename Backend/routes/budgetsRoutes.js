import express  from 'express'
import {getBudgets,createBudget,deleteBudgets,updateBudgets} from '../controllers/budgetsControllers'
import protect from '../middleware/authMiddleware'
const router=express.Router()
router.use(protect)



router.get('/',getBudgets)
router.get('/',createBudget)
router.patch('/:id',updateBudgets)
router.delete('/:id',deleteBudgets)

export default router