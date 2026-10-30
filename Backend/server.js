import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

const app=express()

const PORT=process.env.PORT||5000

app.use(cors())
app.use(express.json())

app.get('/',(req,res)=>{
    res.json({
        message:"running"
    })
})
app.listen(PORT,()=>{
    console.log("App running on",PORT);
    
})