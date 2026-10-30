import pool from '../db.js';
import {
    generateMonthlyInsight,
    generateBudgetAlert,
    analyzeBudgetList,
    generateSavingsTips,
    analyzeTransactionList
} from '../utils/gemini.js';

/**
 * Fetch the authenticated user's preferred currency (defaults to USD)
 */
const getUserCurrency = async (userId) => {
    try {
        const result = await pool.query(
            'SELECT currency FROM users WHERE id = $1',
            [userId]
        );
        return result.rows[0]?.currency || 'USD';
    } catch (error) {
        console.error('Error fetching user currency:', error);
        return 'USD';
    }
};

/**
 * A. getMonthlyInsight
 * - Current month income & expenses
 * - Backend calculated savings rate
 * - Category-wise breakdown
 * - Previous months trend
 * - Gemini generateMonthlyInsight()
 */
export const getMonthlyInsight = async (req, res) => {
    try {
        const userId = req.userId;
        const currency = await getUserCurrency(userId);

        // 1. Fetch current month total income and expenses
        const summaryResult = await pool.query(
            `
            SELECT
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses
            FROM transactions
            WHERE user_id = $1
            AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
            `,
            [userId]
        );

        const totalIncome = parseFloat(summaryResult.rows[0]?.total_income || 0);
        const totalExpenses = parseFloat(summaryResult.rows[0]?.total_expenses || 0);
        const savings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

        // 2. Fetch category-wise expense breakdown for current month
        const categoryResult = await pool.query(
            `
            SELECT
                COALESCE(c.name, 'Uncategorized') AS category,
                COALESCE(SUM(t.amount), 0) AS amount
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = $1
            AND t.type = 'expense'
            AND t.transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
            GROUP BY COALESCE(c.name, 'Uncategorized')
            ORDER BY amount DESC
            `,
            [userId]
        );

        const expenseBreakdown = categoryResult.rows.map((row) => ({
            category: row.category,
            amount: parseFloat(row.amount)
        }));

        // 3. Fetch previous months income and expense trends (last 5 months prior to current)
        const trendResult = await pool.query(
            `
            SELECT
                TO_CHAR(DATE_TRUNC('month', transaction_date), 'YYYY-MM') AS month,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses
            FROM transactions
            WHERE user_id = $1
            AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
            AND transaction_date < DATE_TRUNC('month', CURRENT_DATE)
            GROUP BY 1
            ORDER BY 1
            `,
            [userId]
        );

        const previousMonths = trendResult.rows.map((row) => ({
            month: row.month,
            income: parseFloat(row.income),
            expenses: parseFloat(row.expenses)
        }));

        // Handle empty data gracefully without wasting Gemini calls
        if (totalIncome === 0 && totalExpenses === 0 && previousMonths.length === 0) {
            return res.status(200).json({
                summary: "No transactions recorded for this month yet. Start tracking your income and expenses to receive AI-powered monthly insights.",
                highlights: [],
                concerns: [],
                recommendations: [
                    { title: "Log your income", detail: "Add your monthly salary or any income sources to kick off your financial tracking." },
                    { title: "Track daily expenses", detail: "Record your daily expenses to see category-wise breakdown and health score." },
                    { title: "Set category budgets", detail: "Create budgets for Food, Rent, and other key areas to prevent overspending." }
                ],
                topSpendingCategory: null,
                estimatedMonthlySavings: 0,
                healthScore: 50
            });
        }

        // 4. Pass information to Gemini
        const insight = await generateMonthlyInsight({
            totalIncome,
            totalExpenses,
            savingsRate,
            expenseBreakdown,
            previousMonths,
            currency
        });

        // 5. Cache/store in ai_insights table for history
        try {
            await pool.query(
                `
                INSERT INTO ai_insights (user_id, insight_type, period_start, period_end, content_json)
                VALUES (
                    $1,
                    'monthly_summary',
                    DATE_TRUNC('month', CURRENT_DATE)::DATE,
                    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE,
                    $2
                )
                `,
                [userId, JSON.stringify(insight)]
            );
        } catch (dbErr) {
            console.error('Failed to save monthly insight to ai_insights table:', dbErr.message);
        }

        return res.status(200).json(insight);
    } catch (error) {
        console.error('getMonthlyInsight error:', error);
        return res.status(500).json({
            message: 'Failed to generate monthly insight. Please try again later.'
        });
    }
};

/**
 * B. getBudgetAnalysis
 * - Fetch all budgets for authenticated user
 * - Fetch actual spending against each budget
 * - Include category name, limit, spent
 * - analyzeBudgetList()
 */
export const getBudgetAnalysis = async (req, res) => {
    try {
        const userId = req.userId;
        const currency = await getUserCurrency(userId);

        const result = await pool.query(
            `
            SELECT
                b.id,
                b.category_id,
                b.amount AS budget_amount,
                b.period,
                b.start_date,
                COALESCE(c.name, 'Uncategorized') AS category_name,
                COALESCE(SUM(t.amount), 0) AS spent
            FROM budgets b
            LEFT JOIN categories c ON c.id = b.category_id
            LEFT JOIN transactions t
                ON t.category_id = b.category_id
                AND t.user_id = b.user_id
                AND t.type = 'expense'
                AND (
                    (
                        b.period = 'monthly'
                        AND t.transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
                    )
                    OR
                    (
                        b.period = 'weekly'
                        AND t.transaction_date >= DATE_TRUNC('week', CURRENT_DATE)
                    )
                )
            WHERE b.user_id = $1
            GROUP BY b.id, b.category_id, b.amount, b.period, b.start_date, c.name
            ORDER BY c.name
            `,
            [userId]
        );

        const formattedBudgets = result.rows.map((row) => ({
            budgetId: row.id,
            category: row.category_name,
            limit: parseFloat(row.budget_amount),
            spent: parseFloat(row.spent)
        }));

        const analysis = await analyzeBudgetList({
            budgets: formattedBudgets,
            currency
        });

        // Provide individual budget status mapping for frontend budget cards
        const analyses = formattedBudgets.map((b) => {
            const pct = b.limit > 0 ? ((b.spent / b.limit) * 100).toFixed(1) : '0';
            let status = 'good';
            if (b.spent > b.limit) status = 'concerning';
            else if (b.spent >= b.limit * 0.7) status = 'caution';

            return {
                budgetId: b.budgetId,
                status,
                message: `${b.category}: ${currency} ${b.spent.toFixed(2)} of ${currency} ${b.limit.toFixed(2)} spent (${pct}% used).`
            };
        });

        return res.status(200).json({
            ...analysis,
            analyses
        });
    } catch (error) {
        console.error('getBudgetAnalysis error:', error);
        return res.status(500).json({
            message: 'Failed to analyze budgets. Please try again later.'
        });
    }
};

/**
 * C. getSavingsTips
 * - Monthly income, expenses, category breakdown
 * - Calculate savings rate
 * - generateSavingsTips()
 */
export const getSavingsTips = async (req, res) => {
    try {
        const userId = req.userId;
        const currency = await getUserCurrency(userId);

        // 1. Fetch current month total income and expenses
        const summaryResult = await pool.query(
            `
            SELECT
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses
            FROM transactions
            WHERE user_id = $1
            AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
            `,
            [userId]
        );

        const totalIncome = parseFloat(summaryResult.rows[0]?.total_income || 0);
        const totalExpenses = parseFloat(summaryResult.rows[0]?.total_expenses || 0);
        const savings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

        // 2. Fetch category-wise breakdown
        const categoryResult = await pool.query(
            `
            SELECT
                COALESCE(c.name, 'Uncategorized') AS category,
                COALESCE(SUM(t.amount), 0) AS amount
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = $1
            AND t.type = 'expense'
            AND t.transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
            GROUP BY COALESCE(c.name, 'Uncategorized')
            ORDER BY amount DESC
            `,
            [userId]
        );

        const expenseBreakdown = categoryResult.rows.map((row) => ({
            category: row.category,
            amount: parseFloat(row.amount)
        }));

        if (totalIncome === 0 && totalExpenses === 0 && expenseBreakdown.length === 0) {
            return res.status(200).json({
                overallTip: "Start logging your income and daily expenses to unlock personalized AI savings tips.",
                tips: [
                    {
                        title: "Track daily expenses",
                        detail: "Logging daily expenses is the first step toward discovering spending leaks.",
                        category: "General",
                        potentialMonthlySaving: 0,
                        estimatedSavings: 0,
                        difficulty: "easy"
                    }
                ],
                totalPotentialSavings: 0,
                motivation: "Small tracking habits lead to big financial freedom."
            });
        }

        const tipsResult = await generateSavingsTips({
            totalIncome,
            totalExpenses,
            savingsRate,
            expenseBreakdown,
            currency
        });

        // Ensure frontend compatibility (InsightCard checks both estimatedSavings and potentialMonthlySaving)
        const responseData = {
            ...tipsResult,
            overallTip: tipsResult.overallTip || tipsResult.motivation,
            tips: (tipsResult.tips || []).map((tip) => ({
                ...tip,
                estimatedSavings: tip.estimatedSavings ?? tip.potentialMonthlySaving ?? 0
            }))
        };

        // Cache in ai_insights
        try {
            await pool.query(
                `
                INSERT INTO ai_insights (user_id, insight_type, period_start, period_end, content_json)
                VALUES (
                    $1,
                    'savings_tips',
                    DATE_TRUNC('month', CURRENT_DATE)::DATE,
                    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE,
                    $2
                )
                `,
                [userId, JSON.stringify(responseData)]
            );
        } catch (dbErr) {
            console.error('Failed to save savings tips to ai_insights table:', dbErr.message);
        }

        return res.status(200).json(responseData);
    } catch (error) {
        console.error('getSavingsTips error:', error);
        return res.status(500).json({
            message: 'Failed to generate savings tips. Please try again later.'
        });
    }
};

/**
 * D. getTransactionAnalysis
 * - Fetch user's transactions (date, type, category, amount, description)
 * - Sorted by latest date
 * - Limited to latest 100 transactions
 * - analyzeTransactionList()
 */
export const getTransactionAnalysis = async (req, res) => {
    try {
        const userId = req.userId;
        const currency = await getUserCurrency(userId);

        let query = `
            SELECT
                t.id,
                t.transaction_date AS date,
                t.type,
                COALESCE(c.name, 'Uncategorized') AS category,
                t.amount,
                COALESCE(t.description, '') AS description
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = $1
        `;
        const values = [userId];

        // Support optional transactionIds filter if provided in body
        if (req.body?.transactionIds && Array.isArray(req.body.transactionIds) && req.body.transactionIds.length > 0) {
            query += ' AND t.id = ANY($2::int[])';
            values.push(req.body.transactionIds);
        }

        query += ' ORDER BY t.transaction_date DESC, t.id DESC LIMIT 100';

        const result = await pool.query(query, values);

        const transactions = result.rows.map((row) => ({
            date: row.date,
            category: row.category,
            amount: parseFloat(row.amount),
            type: row.type,
            description: row.description
        }));

        if (transactions.length === 0) {
            return res.status(200).json({
                summary: 'No transactions found to analyze. Please add some transactions first.',
                patterns: [],
                unusualTransactions: [],
                recurringExpenses: [],
                recommendations: [],
                insight: 'No transactions found to analyze. Please add some transactions first.',
                highlight: 'No data'
            });
        }

        const analysis = await analyzeTransactionList({
            transactions,
            currency
        });

        return res.status(200).json({
            ...analysis,
            insight: analysis.summary || 'Spending pattern analyzed.',
            highlight: analysis.patterns?.[0]?.title || 'Transaction Analysis'
        });
    } catch (error) {
        console.error('getTransactionAnalysis error:', error);
        return res.status(500).json({
            message: 'Failed to analyze transactions. Please try again later.'
        });
    }
};

/**
 * E. getBudgetAlert
 * - Fetch specific budget belonging to authenticated user
 * - Calculate spending percentage and days elapsed in period
 * - generateBudgetAlert()
 */
export const getBudgetAlert = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ message: 'Valid budget ID is required' });
        }

        const currency = await getUserCurrency(userId);

        const result = await pool.query(
            `
            SELECT
                b.id,
                b.category_id,
                b.amount AS budget_amount,
                b.period,
                b.start_date,
                COALESCE(c.name, 'General') AS category_name,
                COALESCE(SUM(t.amount), 0) AS spent
            FROM budgets b
            LEFT JOIN categories c ON c.id = b.category_id
            LEFT JOIN transactions t
                ON t.category_id = b.category_id
                AND t.user_id = b.user_id
                AND t.type = 'expense'
                AND (
                    (
                        b.period = 'monthly'
                        AND t.transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
                    )
                    OR
                    (
                        b.period = 'weekly'
                        AND t.transaction_date >= DATE_TRUNC('week', CURRENT_DATE)
                    )
                )
            WHERE b.id = $1 AND b.user_id = $2
            GROUP BY b.id, b.category_id, b.amount, b.period, b.start_date, c.name
            `,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Budget not found' });
        }

        const budget = result.rows[0];
        const budgetAmount = parseFloat(budget.budget_amount);
        const spentAmount = parseFloat(budget.spent);

        // Calculate days elapsed and total period days
        const now = new Date();
        let totalPeriodDays = 30;
        let daysIntoPeriod = 1;

        if (budget.period === 'weekly') {
            totalPeriodDays = 7;
            const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
            daysIntoPeriod = dayOfWeek === 0 ? 7 : dayOfWeek;
        } else {
            // monthly
            const year = now.getFullYear();
            const month = now.getMonth();
            totalPeriodDays = new Date(year, month + 1, 0).getDate();
            daysIntoPeriod = Math.min(now.getDate(), totalPeriodDays);
        }

        const alert = await generateBudgetAlert({
            categoryName: budget.category_name,
            budgetAmount,
            spentAmount,
            daysIntoPeriod,
            totalPeriodDays,
            currency
        });

        return res.status(200).json(alert);
    } catch (error) {
        console.error('getBudgetAlert error:', error);
        return res.status(500).json({
            message: 'Failed to generate budget alert. Please try again later.'
        });
    }
};

/**
 * Fetch past generated AI insights for the user (from ai_insights table)
 */
export const getInsights = async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT * FROM ai_insights
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
            `,
            [req.userId]
        );
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('getInsights error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Unified generate endpoint (used by frontend /insights/generate)
 */
export const generateInsight = async (req, res) => {
    const { type } = req.body;
    if (type === 'savings_tips') {
        return getSavingsTips(req, res);
    }
    return getMonthlyInsight(req, res);
};

export default {
    getMonthlyInsight,
    getBudgetAnalysis,
    getSavingsTips,
    getTransactionAnalysis,
    getBudgetAlert,
    getInsights,
    generateInsight
};