import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'

const app = express()

app.use(cors({
    credentials: true,
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json({
    limit: "16kb"
}))

app.use(express.urlencoded({
    extended: true,
    limit: "16kb"
}))

app.use(express.static("public"))

app.use(cookieParser())

// Import routes
import userRouter from './routes/user.routes.js'
import meetingRouter from './routes/meeting.routes.js'
import meetingTranscriptionRoutes from './routes/meetingTranscription.routes.js';

// Routes declaration
app.use("/api/v1/users", userRouter)
app.use('/api', meetingTranscriptionRoutes);
app.use("/api/v1/meetings", meetingRouter)

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    })
})

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global Error Handler:', err)
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    })
})

export default app