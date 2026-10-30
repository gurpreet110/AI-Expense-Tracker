
import pool from '../db.js';

// Calculate percentage change
const pctChange = (curr, prev) => {
    if (prev === 0) return curr === 0 ? 0 : 100;

    return ((curr - prev) / prev) * 100;
};


// Get dashboard summary
export const getSummary = async (req, res) => {
    try {
        const result = await pool.query(
            `
            WITH monthly AS (
                SELECT
                    DATE_TRUNC('month', transaction_date) AS month,
                    type,
                    SUM(amount) AS total

                FROM transactions

                WHERE user_id = $1
                AND transaction_date >=
                    DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'

                GROUP BY 1, 2
            )

            SELECT
                COALESCE(
                    SUM(CASE
                        WHEN month = DATE_TRUNC('month', CURRENT_DATE)
                        AND type = 'income'
                        THEN total
                    END), 0
                ) AS income_this_month,

                COALESCE(
                    SUM(CASE
                        WHEN month = DATE_TRUNC('month', CURRENT_DATE)
                        AND type = 'expense'
                        THEN total
                    END), 0
                ) AS expense_this_month,

                COALESCE(
                    SUM(CASE
                        WHEN month = DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                        AND type = 'income'
                        THEN total
                    END), 0
                ) AS income_last_month,

                COALESCE(
                    SUM(CASE
                        WHEN month = DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                        AND type = 'expense'
                        THEN total
                    END), 0
                ) AS expense_last_month

            FROM monthly;
            `,
            [req.userId]
        );

        const row = result.rows[0];

        const incomeThisMonth = parseFloat(row.income_this_month);
        const expenseThisMonth = parseFloat(row.expense_this_month);
        const incomeLastMonth = parseFloat(row.income_last_month);
        const expenseLastMonth = parseFloat(row.expense_last_month);

        const balance = incomeThisMonth - expenseThisMonth;

        const savingsRate = incomeThisMonth > 0
            ? (balance / incomeThisMonth) * 100
            : 0;

        res.json({
            incomeThisMonth,
            expenseThisMonth,
            balance,
            savingsRate,

            incomeDelta: pctChange(
                incomeThisMonth,
                incomeLastMonth
            ),

            expenseDelta: pctChange(
                expenseThisMonth,
                expenseLastMonth
            )
        });

    } catch (error) {
        console.error('GetSummary error:', error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};


// Get category-wise expense breakdown
export const getCategoryBreakDown = async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                c.id AS category_id,
                c.name AS category_name,
                c.icon AS category_icon,
                c.color AS category_color,
                SUM(t.amount) AS total,
                COUNT(t.id) AS transaction_count

            FROM transactions t

            JOIN categories c
                ON c.id = t.category_id

            WHERE t.user_id = $1
            AND t.type = 'expense'
            AND t.transaction_date >= DATE_TRUNC('month', CURRENT_DATE)

            GROUP BY
                c.id,
                c.name,
                c.icon,
                c.color

            ORDER BY total DESC;
            `,
            [req.userId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Category breakdown error:', error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};


export const getMonthlyTrend = async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                TO_CHAR(
                    DATE_TRUNC('month', transaction_date),
                    'YYYY-MM'
                ) AS month,

                SUM(
                    CASE
                        WHEN type = 'income'
                        THEN amount
                        ELSE 0
                    END
                ) AS income,

                SUM(
                    CASE
                        WHEN type = 'expense'
                        THEN amount
                        ELSE 0
                    END
                ) AS expense

            FROM transactions

            WHERE user_id = $1
            AND transaction_date >=
                DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'

            GROUP BY 1

            ORDER BY 1;
            `,
            [req.userId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('GetMonthlyTrend error:', error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};

