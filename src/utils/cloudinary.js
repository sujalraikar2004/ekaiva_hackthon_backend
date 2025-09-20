import {v2 as cloudinary} from "cloudinary"
import fs from "fs"

const uploadonCloudinary = async (filepath) => {
    // Force the correct Cloudinary configuration (override system env vars)
    const cloudinaryConfig = {
        cloud_name: "derz8ikfc",
        api_key: "561939495576736",
        api_secret: "k0ZD40fMhllYhoqqmhJXwPoKKgU"
    };

    console.log("Cloudinary Config Debug:");
    console.log("Using cloud_name:", cloudinaryConfig.cloud_name);
    console.log("Using api_key:", cloudinaryConfig.api_key);
    console.log("Using api_secret:", cloudinaryConfig.api_secret ? "***SET***" : "NOT SET");

    cloudinary.config(cloudinaryConfig);

    try {
        const response = await cloudinary.uploader.upload(filepath, {
            resource_type:"auto" // Automatically detect the resource type (image, video, etc.)
        })

        console.log("file uploaded to cloudinary",response.url);
        return response;
    } catch (error) {
        fs.unlinkSync(filepath);
        throw error;
    }
}
export { uploadonCloudinary };


