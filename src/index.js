import dotenv from "dotenv";
import connectdb from "./db/db.js";
import app from "./app.js";
import path from "path";
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the project root
dotenv.config({ path: path.join(__dirname, '../.env') });

// Debug: Log the loaded environment variables
console.log("Environment variables loaded:");
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY);
console.log("PORT:", process.env.PORT);

connectdb()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`server is running on port ${process.env.PORT}`);
    })
    app.on("error", (err) => {
        console.log("server error", err);
    })
})
.catch((error) => {
    console.log("mongodb error", error);
})
