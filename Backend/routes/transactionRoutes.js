import express from 'express'
import{getTransactionById,createTransaction,getTranscation,updateTransaction,deleteTransaction} from '../controllers/TransactionsControllers.js'
import{protect} from '../middleware/authMiddleware.js'

const route=express.Router()
router.use(protect)

router.get('/',getTranscation)
router.post('/',createTransaction)
router.get('/:id',getTransactionById)
router.patch('/:id',updateTransaction)
router.delete('/:id',deleteTransaction)

export default router