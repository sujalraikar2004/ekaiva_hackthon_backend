import {v2 as cloudinary} from "cloudinary"
import fs from "fs"

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadonCloudinary = async (filepath) => {
    try {
        if (!filepath) return null;
        
        const response = await cloudinary.uploader.upload(filepath, {
            resource_type: "auto"
        });

        // Delete the local file after successful upload
        fs.unlinkSync(filepath);
        console.log("File uploaded to cloudinary:", response.url);
        return response;
    } catch (error) {
        // Delete the local file even if upload fails
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        console.error("Cloudinary upload error:", error);
        throw error;
    }
}

export { uploadonCloudinary };
