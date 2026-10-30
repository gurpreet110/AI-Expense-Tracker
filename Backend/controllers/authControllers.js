
import bcrypt from 'bcrypt';
import pool from '../db.js';
import { defaultCategories } from '../utils/defaultCategories.js';
import jwt from 'jsonwebtoken';

// Generate JWT
const signToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_TOKEN,
        { expiresIn: '7d' }
    );
};

// REGISTER
export const register = async (req, res) => {
    const { name, email, password, currency = 'INR' } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            message: 'Invalid entry'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            message: 'Minimum 6 characters password required'
        });
    }

    let client;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        const existing = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                message: 'Email already exists'
            });
        }

        await client.query('BEGIN');
        transactionStarted = true;

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const userResult = await client.query(
            `INSERT INTO users (name, email, password_hash, currency)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, currency, created_at`,
            [name, email, passwordHash, currency]
        );

        const user = userResult.rows[0];

        for (const cat of defaultCategories) {
            await client.query(
                `INSERT INTO categories
                 (user_id, name, type, icon, color, is_default)
                 VALUES ($1, $2, $3, $4, $5, true)`,
                [user.id, cat.name, cat.type, cat.icon, cat.color]
            );
        }

        await client.query('COMMIT');
        transactionStarted = false;

        const token = signToken(user.id);

        return res.status(201).json({
            user,
            token
        });

    } catch (error) {
        if (client && transactionStarted) {
            await client.query('ROLLBACK');
        }

        console.error('Registration error:', error);

        return res.status(500).json({
            message: 'Server error'
        });

    } finally {
        if (client) {
            client.release();
        }
    }
};

// LOGIN
export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: 'Enter email and password'
        });
    }

    try {
        const result = await pool.query(
            `SELECT id, name, email, password_hash, currency
             FROM users
             WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        const user = result.rows[0];

        const match = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!match) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        const token = signToken(user.id);

        return res.status(200).json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                currency: user.currency
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);

        return res.status(500).json({
            message: 'Server error'
        });
    }
};

// GET CURRENT USER
export const getMe = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, currency, created_at
             FROM users
             WHERE id = $1`,
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        return res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error('GetMe error:', error);

        return res.status(500).json({
            message: 'Server error'
        });
    }
};
