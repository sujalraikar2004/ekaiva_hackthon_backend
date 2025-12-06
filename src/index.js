import dotenv from "dotenv";
import connectdb from "./db/db.js";
import app from "./app.js";
import path from "path";
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


dotenv.config({ path: path.join(__dirname, '../.env') });



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
