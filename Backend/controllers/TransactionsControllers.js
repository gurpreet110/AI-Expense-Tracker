
import pool from '../db.js';

// 1. GET ALL TRANSACTIONS
export const getTranscation = async (req, res) => {
    const {
        startDate,
        endDate,
        categoryId,
        type,
        search,
        limit = 50,
        offset = 0
    } = req.body;

    const conditions = ['t.user_id = $1'];
    const values = [req.userId];
    let idx = 2;

    if (startDate) {
        conditions.push(`t.transaction_date >= $${idx++}`);
        values.push(startDate);
    }

    if (endDate) {
        conditions.push(`t.transaction_date <= $${idx++}`);
        values.push(endDate);
    }

    if (categoryId) {
        conditions.push(`t.category_id = $${idx++}`);
        values.push(categoryId);
    }

    if (type) {
        conditions.push(`t.type = $${idx++}`);
        values.push(type);
    }

    if (search) {
        conditions.push(
            `(t.description ILIKE $${idx} OR t.notes ILIKE $${idx})`
        );
        values.push(`%${search}%`);
        idx++;
    }

    values.push(limit, offset);

    try {
        const result = await pool.query(
            `
            SELECT t.*,
                c.name AS category_name,
                c.icon AS category_icon,
                c.color AS category_color
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE ${conditions.join(' AND ')}
            ORDER BY t.transaction_date DESC, t.id DESC
            LIMIT $${idx++} OFFSET $${idx}
            `,
            values
        );

        res.json(result.rows);

    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};


// 2. CREATE TRANSACTION
export const createTransaction = async (req, res) => {
    const {
        categoryId,
        amount,
        type,
        description,
        notes,
        transactionDate
    } = req.body;

    if (
        amount === undefined ||
        amount === null ||
        !Number.isFinite(Number(amount)) ||
        Number(amount) <= 0 ||
        !type ||
        !transactionDate
    ) {
        return res.status(400).json({
            message: "Valid values required"
        });
    }

    if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({
            message: "Invalid transaction type"
        });
    }

    try {
        const result = await pool.query(
            `
            INSERT INTO transactions
            (user_id, category_id, amount, type,
             description, notes, transaction_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
            [
                req.userId,
                categoryId || null,
                amount,
                type,
                description || null,
                notes || null,
                transactionDate
            ]
        );

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};


// 3. GET TRANSACTION BY ID
export const getTransactionById = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `
            SELECT t.*,
                c.name AS category_name,
                c.icon AS category_icon,
                c.color AS category_color
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.id = $1 AND t.user_id = $2
            `,
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Transaction not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};


// 4. UPDATE TRANSACTION
export const updateTransaction = async (req, res) => {
    const { id } = req.params;

    const {
        categoryId,
        amount,
        type,
        description,
        notes,
        transactionDate
    } = req.body;

    if (type && !['income', 'expense'].includes(type)) {
        return res.status(400).json({
            message: "Invalid transaction type"
        });
    }

    try {
        const result = await pool.query(
            `
            UPDATE transactions
            SET
                category_id = COALESCE($1, category_id),
                amount = COALESCE($2, amount),
                type = COALESCE($3, type),
                description = COALESCE($4, description),
                notes = COALESCE($5, notes),
                transaction_date = COALESCE($6, transaction_date)
            WHERE id = $7 AND user_id = $8
            RETURNING *
            `,
            [
                categoryId,
                amount,
                type,
                description,
                notes,
                transactionDate,
                id,
                req.userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Transaction not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};


// 5. DELETE TRANSACTION
export const deleteTransaction = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `
            DELETE FROM transactions
            WHERE id = $1 AND user_id = $2
            RETURNING *
            `,
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Transaction not found"
            });
        }

        res.status(200).json({
            message: "Transaction deleted successfully",
            transaction: result.rows[0]
        });

    } catch (error) {
        console.log("Error deleting transaction:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
