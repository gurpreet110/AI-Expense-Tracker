import express from 'express'
import{getTransactionById,createTransaction,getTranscation,updateTransaction,deleteTransaction} from '../controllers/TransactionsControllers.js'
import { getTransactionAnalysis } from '../controllers/insightsControllers.js'
import{protect} from '../middleware/authMiddleware.js'

const router=express.Router()
router.use(protect)

router.get('/',getTranscation)
router.post('/',createTransaction)
router.post('/analyze', getTransactionAnalysis)
router.get('/:id',getTransactionById)
router.put('/:id',updateTransaction)
router.patch('/:id',updateTransaction)
router.delete('/:id',deleteTransaction)

export default router