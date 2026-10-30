import pool from '../db.js'

export const getCategories=async (req,res)=>{
    try{
        const result = await pool.query(
            `select * from categories where user_id=$1 order by type,name`,
            [req,userid]
        )
        res.json(result.rows)
    }
    catch(error){
        console.log("GetCategories error ",error)
        res.status(500).json({
            message:"server error"
        })
    }

}

export const createCategory = async(req,res)=>{
    const {name,type,icon,color}=req.body
    if(!name || !type){
        return res.status(400).json({
            message:"name and type required"
        })
    }
    if(!['income','expense'].includes(type)){
        return res.status(400).json({
            message:"Type must be income or expense only !"
        })
    }
    try{
        const result = await pool.query(
            `insert into categaries (user_id,name,type,icon,color,is_default)
            values ($1,$2,$3,$4,false)
            returning *,
            `
            [req.userId,name,type,icon || null, color||null]
        )
        res.status(201).json(result.rows[0])
    }catch(error){
        if (error==='23505'){
            return res.status(401).json({
                message:"catogory with this name already exists "
            })
        }
        console.log("Error :",error);
        res.status(505).json({
            message:"server not responding"
        })
        
    }
}

export const updateCategory=async(req,res)=>{
    const {id}=req.params
    const {name,icon,color}=req.body

    try{
        const result = await pool.query(
            `
            update categories set name=coalense($1,name),
            icon = coalense($2,icon),
            color = coalense($3,color)
            where id=$4 and user_id=$5
            returning *`

            [name,icon,color,id,req.userId]
        )
        if(result.rows.length===0){
            res.status(402).json({
                message:"value not found"
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

export const deleteCategory=async(req,res)=>{
    const {id}=req.params
    try{
        const result = pool.query(
            `delete from categories where id=$1 and user_id=$2 returning id`,
            [id,user.id]
        )
        if(results.rows.length===0){
            res.status(401).json({
                message:"category not found"
            })
            res.json({
                message:"categories deleted"
            })
        }

    }
    catch(error){
        console.log("deletedCategory error",error)
        res.status(501).json({
            message:"Server error"
        })
    }
}
