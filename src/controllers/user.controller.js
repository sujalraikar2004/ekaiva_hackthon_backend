import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asynvHandler.js";
import { uploadonCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

// Generate access and refresh tokens
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const { accessToken, refreshToken } = user.generateTokens();
        
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        
        return { accessToken, refreshToken };
    } catch (error) {
        throw new Error("Something went wrong while generating tokens");
    }
};

// Register user
const registerUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    // Validation
    if ([username, email, password].some(field => field?.trim() === "")) {
        return res.status(400).json({
            success: false,
            message: "All fields are required"
        });
    }

    // Check if image file is provided
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "Profile image is required"
        });
    }

    // Check if user already exists
    const existedUser = await User.findByEmailOrUsername(email);
    if (existedUser) {
        return res.status(409).json({
            success: false,
            message: "User with email or username already exists"
        });
    }

    // Handle avatar upload
    let avatarUrl = null;
    try {
        const avatarResponse = await uploadonCloudinary(req.file.path);
        avatarUrl = avatarResponse?.url;
        
        if (!avatarUrl) {
            return res.status(500).json({
                success: false,
                message: "Failed to upload profile image"
            });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Profile image upload failed"
        });
    }

    // Create user
    const user = await User.create({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password,
        avatar: avatarUrl
    });

    // Remove password and refresh token from response
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        return res.status(500).json({
            success: false,
            message: "Something went wrong while registering user"
        });
    }

    return res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: createdUser
    });
});

// Login user
const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    // Validation
    if (!(username || email)) {
        return res.status(400).json({
            success: false,
            message: "Username or email is required"
        });
    }

    if (!password) {
        return res.status(400).json({
            success: false,
            message: "Password is required"
        });
    }

    // Find user
    const user = await User.findByEmailOrUsername(username || email);
    if (!user) {
        return res.status(404).json({
            success: false,
            message: "User does not exist"
        });
    }

    // Check if user is active
    if (!user.isActive) {
        return res.status(403).json({
            success: false,
            message: "Account is deactivated"
        });
    }

    // Validate password
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        return res.status(401).json({
            success: false,
            message: "Invalid user credentials"
        });
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    // Update last login
    await user.updateLastLogin();

    // Get user without sensitive data
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // Cookie options
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, { ...options, maxAge: 15 * 60 * 1000 }) // 15 minutes
        .cookie("refreshToken", refreshToken, options)
        .json({
            success: true,
            message: "User logged in successfully",
            data: {
                user: loggedInUser,
                accessToken,
                refreshToken
            }
        });
});

// Logout user
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json({
            success: true,
            message: "User logged out successfully"
        });
});

// Refresh access token
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized request"
        });
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token"
            });
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            return res.status(401).json({
                success: false,
                message: "Refresh token is expired or used"
            });
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict"
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, { ...options, maxAge: 15 * 60 * 1000 })
            .cookie("refreshToken", refreshToken, { ...options, maxAge: 7 * 24 * 60 * 60 * 1000 })
            .json({
                success: true,
                message: "Access token refreshed",
                data: {
                    accessToken,
                    refreshToken
                }
            });
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: error?.message || "Invalid refresh token"
        });
    }
});

// Get current user
const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json({
        success: true,
        message: "User fetched successfully",
        data: req.user
    });
});

// Change password
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            message: "Old password and new password are required"
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: "New password must be at least 6 characters long"
        });
    }

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        return res.status(400).json({
            success: false,
            message: "Invalid old password"
        });
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
        success: true,
        message: "Password changed successfully"
    });
});

// Update account details
const updateAccountDetails = asyncHandler(async (req, res) => {
    const { username, email } = req.body;

    if (!username && !email) {
        return res.status(400).json({
            success: false,
            message: "At least one field is required"
        });
    }

    const updateFields = {};
    if (username) updateFields.username = username.toLowerCase();
    if (email) updateFields.email = email.toLowerCase();

    // Check if username or email already exists (excluding current user)
    if (username || email) {
        const existingUser = await User.findOne({
            $and: [
                { _id: { $ne: req.user._id } },
                {
                    $or: [
                        ...(username ? [{ username: username.toLowerCase() }] : []),
                        ...(email ? [{ email: email.toLowerCase() }] : [])
                    ]
                }
            ]
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Username or email already exists"
            });
        }
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: updateFields },
        { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json({
        success: true,
        message: "Account details updated successfully",
        data: user
    });
});

// Update user avatar
const updateUserAvatar = asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "Avatar file is required"
        });
    }

    try {
        const avatarResponse = await uploadonCloudinary(req.file.path);
        
        if (!avatarResponse?.url) {
            return res.status(500).json({
                success: false,
                message: "Error while uploading avatar"
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user?._id,
            { $set: { avatar: avatarResponse.url } },
            { new: true }
        ).select("-password -refreshToken");

        return res.status(200).json({
            success: true,
            message: "Avatar updated successfully",
            data: user
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error while uploading avatar"
        });
    }
});

// Deactivate account
const deactivateAccount = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        { $set: { isActive: false, refreshToken: null } },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json({
            success: true,
            message: "Account deactivated successfully"
        });
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    changeCurrentPassword,
    updateAccountDetails,
    updateUserAvatar,
    deactivateAccount
};