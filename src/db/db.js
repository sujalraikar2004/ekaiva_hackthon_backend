import mongoose from "mongoose"
import {DB_NAME} from "../constants.js"
const dbconnect=async()=>{
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        console.log("mongodb connected\n",connectionInstance.connection.host,connectionInstance.connection.name);

    } catch (error) {
        console.log("mongodb error",error);
        
    }
}
export default dbconnect
