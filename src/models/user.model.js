import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, "Username is required"],
        unique: true,
        lowercase: true,
        trim: true,
        minlength: [3, "Username must be at least 3 characters long"],
        maxlength: [20, "Username cannot exceed 20 characters"],
        match: [/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"]
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"]
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters long"]
    },
    fullName: {
        type: String,
        required: [true, "Full name is required"],
        trim: true,
        minlength: [2, "Full name must be at least 2 characters long"],
        maxlength: [50, "Full name cannot exceed 50 characters"]
    },
    role: {
        type: String,
        required: [true, "Role is required"],
        enum: {
            values: ["manager", "staff"],
            message: "Role must be either 'manager' or 'staff'"
        }
    },
    department: {
        type: String,
        required: [true, "Department is required"],
        trim: true,
        maxlength: [30, "Department name cannot exceed 30 characters"]
    },
    jobTitle: {
        type: String,
        required: [true, "Job title is required"],
        trim: true,
        maxlength: [50, "Job title cannot exceed 50 characters"]
    },
    employeeId: {
        type: String,
        required: [true, "Employee ID is required"],
        unique: true,
        trim: true,
        uppercase: true
    },
    refreshToken: {
        type: String
    },
    avatar: {
        type: String, // Cloudinary URL
        required: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: null
    },
    // Meeting-specific fields
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function() {
            return this.role === 'staff';
        }
    },
    teamMembers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }], // Only for managers - their team members
    timezone: {
        type: String,
        default: 'UTC'
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre("save", async function(next) {
    if (!this.isModified("password")) return next();
    
    try {
        const saltRounds = 10;
        this.password = await bcrypt.hash(this.password, saltRounds);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.isPasswordCorrect = async function(password) {
    return await bcrypt.compare(password, this.password);
};

// Generate access token
userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            role: this.role,
            department: this.department
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m"
        }
    );
};

// Generate refresh token
userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d"
        }
    );
};

// Generate both tokens
userSchema.methods.generateTokens = function() {
    const accessToken = this.generateAccessToken();
    const refreshToken = this.generateRefreshToken();
    
    return { accessToken, refreshToken };
};

// Update last login
userSchema.methods.updateLastLogin = function() {
    this.lastLogin = new Date();
    return this.save({ validateBeforeSave: false });
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.refreshToken;
    return userObject;
};

// Static method to find user by email or username
userSchema.statics.findByEmailOrUsername = function(identifier) {
    return this.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { username: identifier.toLowerCase() }
        ]
    });
};

// Static method to find managers
userSchema.statics.findManagers = function() {
    return this.find({ role: 'manager', isActive: true }).select('-password -refreshToken');
};

// Static method to find staff by manager
userSchema.statics.findStaffByManager = function(managerId) {
    return this.find({ 
        role: 'staff', 
        managerId: managerId, 
        isActive: true 
    }).select('-password -refreshToken');
};

// Method to check if user can manage another user
userSchema.methods.canManage = function(userId) {
    if (this.role !== 'manager') return false;
    return this.teamMembers.includes(userId);
};

export const User = mongoose.model("User", userSchema);