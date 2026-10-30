import bcrypt from 'bcrypt'
import cors from 'cors'
import pool from '../db.js'
import { defaultCategories } from '../utils/defaultCategories.js'
import { sign } from 'jsonwebtoken'


const signToken = (userId) => {
    jwt.sign({ userId }, process.env.JWT_TOKEN, { expiresIn='7d' })
    export const register = async (req, res) => {
        const { name, email, password, currency = 'IN' } = req.body
        if (!name || !email || !password) {
            return res.staus(400).json({
                message: "invalid entry"
            })
        }
        if (!password.length < 6) {
            res.status(400).json({
                message: "minimum 6 digits password entry required"
            })
        }
        const client = await pool.connect()
        try {
            const existing = await client.query('select id from users where email=$1', [email])
            if (existing.rows.length > 0) {
                res.status(400).json({
                    message: "email is already existed"
                })
            }
            await client.query('BEGIN')
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt)

            const userResult = await client.query(
                `
                insert into users (name,email,password_hash,currency)
                values ($1,$2,$3,$4)
                RETURNING id , name,currency,created_at
                `
                [name, email, passwordHash, currency]
            );
            const users = userResult.rows[0]
            for (const cat of defaultCategories) {
                await client.query(`
                    insert into categories (userId,name,type,icon,color,its_default)
                    values ($1,$2,$3,$4,$5,true)`
                [user.id, cat.name, cat.type, cat.icon, cat.color]
                )
            }
            await client.query('COMMIT')
            const token = signToken(user.id)
            res.status(201).json({
                user, token
            })
        } catch (error) {
            await client.query('ROLLBACK');
            console.log('error occured -- Registered Error', error)
            res.status(500).json({
                message: "server error"
            })
        } finally {
            client.release()
        }

    }
}
export const login = async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) {
        return res.status(400).json({
            message: "enter email or password"
        })
    }
    try {
        const result = await pool.query(
            `select id,name,email,password_hash,currency from users where email=$1`
            [email]
        )
        if (result.rows.length === 0) {
            return res.status(400).json({
                message: "invalid creduntials"
            })
        }
        const user = result.rows[0]
        const match = await bcrypt.compare(password, user.password_hash)
        if (!match) {
            return res.status(400).json({
                message: "invalid creduntials"
            })
        }
        const token = signToken(user.id)
        res.json({
            user: {
                id=user.id,
                name=user.name,
                email=user.email,
                currency=user.currency,
            },

            token,
        }
        )


    }
    catch(error){
        console.log("Login error",error)
        res.status(500).json({
            message:"server error"
        })
    }

}
