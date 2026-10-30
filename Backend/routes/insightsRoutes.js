import express from 'express';
import {
    getMonthlyInsight,
    getBudgetAnalysis,
    getSavingsTips,
    getTransactionAnalysis,
    getBudgetAlert,
    getInsights,
    generateInsight
} from '../controllers/insightsControllers.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all insights endpoints with authentication middleware
router.use(protect);

// 1. History & unified generation (frontend support)
router.get('/', getInsights);
router.post('/generate', generateInsight);

// 2. Specific AI Insight endpoints
router.get('/monthly', getMonthlyInsight);
router.get('/budgets', getBudgetAnalysis);
router.post('/budgets', getBudgetAnalysis);
router.get('/savings-tips', getSavingsTips);
router.get('/transactions', getTransactionAnalysis);
router.post('/transactions', getTransactionAnalysis);
router.get('/budget-alert/:id', getBudgetAlert);

export default router;
