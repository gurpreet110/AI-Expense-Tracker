import pool from '../db.js';

export const getBudgets = async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                b.id,
                b.category_id,
                b.amount,
                b.amount AS budget_amount,
                b.period,
                b.start_date,

                c.name AS category_name,
                c.icon AS category_icon,
                c.color AS category_color,

                COALESCE(SUM(t.amount), 0) AS spent

            FROM budgets b

            JOIN categories c
                ON c.id = b.category_id

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

            GROUP BY
                b.id,
                c.name,
                c.icon,
                c.color

            ORDER BY c.name;
            `,
            [req.userId]
        );

        res.status(200).json(result.rows);

    } catch (error) {
        console.error("Error fetching budgets:", error);

        res.status(500).json({
            message: "Failed to fetch budgets"
        });
    }
};

export const createBudget = async (req, res) => {
    const { categoryId, amount, period = 'monthly', startDate } = req.body;

    if (!categoryId || amount === undefined || amount === null || Number(amount) <= 0) {
        return res.status(400).json({
            message: "Valid category and amount required"
        });
    }

    if (!['monthly', 'weekly'].includes(period)) {
        return res.status(400).json({
            message: "Period must be 'monthly' or 'weekly'"
        });
    }

    try {
        const today = new Date();
        const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        const effectiveStart = startDate || monthStart;

        const result = await pool.query(
            `
            INSERT INTO budgets (user_id, category_id, amount, period, start_date)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [req.userId, categoryId, amount, period, effectiveStart]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating budget:", error);
        res.status(500).json({
            message: "Could not create budget"
        });
    }
};

export const updateBudgets = async (req, res) => {
    const { id } = req.params;
    const { amount, period } = req.body;

    try {
        const result = await pool.query(
            `
            UPDATE budgets
            SET amount = COALESCE($1, amount),
                period = COALESCE($2, period)
            WHERE id = $3 AND user_id = $4
            RETURNING *
            `,
            [amount, period, id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Budget not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Update budget error:", error);
        res.status(500).json({
            message: "Server error updating budget"
        });
    }
};

export const deleteBudgets = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id`,
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Budget not found"
            });
        }

        res.status(200).json({
            message: "Budget deleted successfully"
        });
    } catch (error) {
        console.error("Deletion error:", error);
        res.status(500).json({
            message: "Server error deleting budget"
        });
    }
};

export default {
    getBudgets,
    createBudget,
    updateBudgets,
    deleteBudgets
};
