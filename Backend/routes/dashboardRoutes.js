import express from 'express'
import {getSummary,getCategoryBreakDown,getMonthlyTrend} from '../controllers/dashboardControllers.js'
import protect from '../middleware/authMiddleware.js'

const router=express.Router()
router.use(protect)
router.get('/summary',getSummary)
router.get('/summery',getSummary)
router.get('/category-breakdown',getCategoryBreakDown)
router.get('/monthly-trend',getMonthlyTrend)

export default router
