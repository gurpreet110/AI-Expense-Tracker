
import pool from '../db.js';

export const getBudgets = async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                b.id,
                b.category_id,
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
export const createBudget= async(req,res)=>{
    const {categoryId,amount,period}=req.body
    if(!categoryId ||!amoount){
        res.status(401).json({
            message:"value required"
        })
    }
    if(!['monthly','weekly'].includes(period)){
        res.status(401).json({
            message:"only valid entry please"
        })
    }
    try{
        const today=new Date();
        const monthStart=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`
        const effectiveStart=startDate||monthStart
        const result=await pool.query(`
            INSERT INTO budgets (user_id,ategory_id,amount,period,start_date)
            VALUES ($1,$2,$3,$4,$5)
            RETURNING *
            `[req.userId,categoryId,amount,period,effectiveStart]
        )
        res.status(201).json(result.rows[0])
    }catch(error){
        console.log("error occured ",error)
        res.status(502).json({
            message:"cant created budgets"
        })
    }
}


export const updateBudgets=async(req,res)=>{
    const {id}=req.params
    const {amount,period}=req.body

    try{
        const result = await pool.query(
            `
            update budgets set amount=coalesce($1,name),
            period= coalesce($2,period),
            where id=$3 and user_id=$4
            returning *`

            [amount,period,id,req.userId]
        )
        if(result.rows.length===0){
            res.status(402).json({
                message:"budget not found"
            })
        }
        res.json(result.rows[0])
    }catch(error){
        console.log("server error",error)
        res.status(592).json({
            message:"server not vaidating results"
        })
    }

}

export const deleteBudgets=async(req,res)=>{
    const {id}=req.params
    try{
        const result = pool.query(
            `delete from budgets where id=$1 and user_id=$2 returning id`,
            [id,user.id]
        )
        if(results.rows.length===0){
            res.status(401).json({
                message:"budgets not found"
            })
            res.json({
                message:"budget deleted"
            })
        }

    }
    catch(error){
        console.log("deletion error",error)
        res.status(501).json({
            message:"Server error"
        })
    }
}

