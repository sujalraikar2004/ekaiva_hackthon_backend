import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'

const app=express()
app.use(cors({
    credentials:true,
    origin:process.env.CORS_ORIGIN,

}))

app.use(express.json({
    limit:"16kb"
}))

app.use(express.urlencoded({
    extended:true,
    limit:"16kb"
}))

app.use(express.static("public"))

app.use(cookieParser())

// Import routes
import userRouter from './routes/user.routes.js'
import meetingRouter from './routes/meeting.routes.js'

// Routes declaration
app.use("/api/v1/users", userRouter)
app.use("/api/v1/meetings", meetingRouter)

export default app