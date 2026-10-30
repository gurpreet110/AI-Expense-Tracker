import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()
import authRoutes from "./routes/authRoutes.js"
import categoriesRoutes from "./routes/categoriesRoutes.js"
import transactionRoutes from "./routes/transactionRoutes.js"
import budgetRoutes from './routes/budgetsRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import insightsRoutes from './routes/insightsRoutes.js'

const app=express()

const PORT=process.env.PORT||5000

app.use(cors())
app.use(express.json())

app.get('/',(req,res)=>{
    res.json({
        message:"running"
    })
})

app.use("/api/auth",authRoutes)
app.use("/api/categories",categoriesRoutes)
app.use("/api/transactions",transactionRoutes)
app.use('/api/budgets',budgetRoutes)
app.use('/api/dashboard',dashboardRoutes)
app.use('/api/insights',insightsRoutes)


app.listen(PORT,()=>{
    console.log("App running on",PORT);
    
})
