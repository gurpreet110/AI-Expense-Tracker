import express from 'express'
import { register, login, getMe } from "../controllers/authControllers.js"
import { protect } from "../middleware/authMiddleware.js"
const router = express.Router()

router.post("/register", register)
    .post("/login", login)
    .get("/me",protect, getMe)

export default  router