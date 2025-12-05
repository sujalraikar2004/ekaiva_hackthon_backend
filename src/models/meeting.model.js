import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Meeting title is required"],
        trim: true,
        maxlength: [100, "Meeting title cannot exceed 100 characters"]
    },
    description: {
        type: String,
        required: [true, "Meeting description is required"],
        trim: true,
        maxlength: [500, "Meeting description cannot exceed 500 characters"]
    },
    hostId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, "Meeting host is required"]
    },
    participants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        status: {
            type: String,
            enum: ['invited', 'accepted', 'declined', 'attended', 'absent'],
            default: 'invited'
        },
        joinedAt: {
            type: Date
        },
        leftAt: {
            type: Date
        }
    }],
    meetingLink: {
        type: String,
        required: [true, "Meeting link is required"],
        trim: true,
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+/.test(v);
            },
            message: "Please provide a valid meeting link"
        }
    },
    meetingId: {
        type: String,
        trim: true,
        index: true
    },
    scheduledDateTime: {
        type: Date,
        required: [true, "Meeting date and time is required"],
        validate: {
            validator: function(v) {
                return v > new Date();
            },
            message: "Meeting must be scheduled for a future date and time"
        }
    },
    duration: {
        type: Number, // in minutes
        required: [true, "Meeting duration is required"],
        min: [15, "Meeting duration must be at least 15 minutes"],
        max: [480, "Meeting duration cannot exceed 8 hours"]
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    status: {
        type: String,
        enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    actualStartTime: {
        type: Date
    },
    actualEndTime: {
        type: Date
    },
    meetingNotes: {
        type: String,
        maxlength: [2000, "Meeting notes cannot exceed 2000 characters"]
    },
    actionItems: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ActionItem'
    }],
    attachments: [{
        fileName: String,
        fileUrl: String,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurringPattern: {
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
        },
        interval: {
            type: Number,
            min: 1
        },
        endDate: Date
    },
    emailSent: {
        type: Boolean,
        default: false
    },
    remindersSent: [{
        type: {
            type: String,
            enum: ['24h', '1h', '15m']
        },
        sentAt: {
            type: Date,
            default: Date.now
        }
    }],
    meetingTranscription: [{
        name: {
            type: String,
            trim: true
        },
        text: {
            type: String,
            trim: true
        }
    }],
    transcriptionBotId: {
        type: String
    },
    transcriptionBotStarted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for efficient queries
meetingSchema.index({ hostId: 1, scheduledDateTime: 1 });
meetingSchema.index({ 'participants.userId': 1 });
meetingSchema.index({ status: 1, scheduledDateTime: 1 });
meetingSchema.index({ meetingId: 1 });

// Virtual for meeting end time
meetingSchema.virtual('scheduledEndTime').get(function() {
    return new Date(this.scheduledDateTime.getTime() + (this.duration * 60000));
});

// Method to add participant
meetingSchema.methods.addParticipant = function(userId) {
    const existingParticipant = this.participants.find(p => p.userId.toString() === userId.toString());
    if (!existingParticipant) {
        this.participants.push({ userId });
    }
    return this.save();
};

// Method to remove participant
meetingSchema.methods.removeParticipant = function(userId) {
    this.participants = this.participants.filter(p => p.userId.toString() !== userId.toString());
    return this.save();
};

// Method to update participant status
meetingSchema.methods.updateParticipantStatus = function(userId, status, timestamp = new Date()) {
    const participant = this.participants.find(p => p.userId.toString() === userId.toString());
    if (participant) {
        participant.status = status;
        if (status === 'attended') {
            participant.joinedAt = timestamp;
        } else if (status === 'absent') {
            participant.leftAt = timestamp;
        }
    }
    return this.save();
};

// Method to start meeting
meetingSchema.methods.startMeeting = function() {
    this.status = 'ongoing';
    this.actualStartTime = new Date();
    return this.save();
};

// Method to end meeting
meetingSchema.methods.endMeeting = function(notes = '') {
    this.status = 'completed';
    this.actualEndTime = new Date();
    if (notes) {
        this.meetingNotes = notes;
    }
    return this.save();
};

// Static method to find meetings by host
meetingSchema.statics.findByHost = function(hostId, status = null) {
    const query = { hostId };
    if (status) {
        query.status = status;
    }
    return this.find(query)
        .populate('hostId', 'fullName email role department')
        .populate('participants.userId', 'fullName email role department avatar')
        .sort({ scheduledDateTime: 1 });
};

// Static method to find meetings by participant
meetingSchema.statics.findByParticipant = function(userId, status = null) {
    const query = { 'participants.userId': userId };
    if (status) {
        query.status = status;
    }
    return this.find(query)
        .populate('hostId', 'fullName email role department')
        .populate('participants.userId', 'fullName email role department avatar')
        .sort({ scheduledDateTime: 1 });
};

// Static method to find upcoming meetings
meetingSchema.statics.findUpcoming = function(userId = null) {
    const query = {
        scheduledDateTime: { $gte: new Date() },
        status: { $in: ['scheduled', 'ongoing'] }
    };
    
    if (userId) {
        query.$or = [
            { hostId: userId },
            { 'participants.userId': userId }
        ];
    }
    
    return this.find(query)
        .populate('hostId', 'fullName email role department')
        .populate('participants.userId', 'fullName email role department avatar')
        .sort({ scheduledDateTime: 1 });
};

// Pre-save middleware to validate host is a manager
meetingSchema.pre('save', async function(next) {
    if (this.isNew || this.isModified('hostId')) {
        const User = mongoose.model('User');
        const host = await User.findById(this.hostId);
        
        if (!host) {
            return next(new Error('Invalid host ID'));
        }
        
        if (host.role !== 'manager') {
            return next(new Error('Only managers can host meetings'));
        }
    }
    
    // Extract meetingId from meetingLink
    if (this.isNew || this.isModified('meetingLink')) {
        if (this.meetingLink) {
            // Extract Google Meet ID from URL
            // Examples: 
            // https://meet.google.com/ewg-oaeu-fjk -> ewg-oaeu-fjk
            // https://meet.google.com/lookup/ewg-oaeu-fjk -> ewg-oaeu-fjk
            const meetIdMatch = this.meetingLink.match(/meet\.google\.com\/(?:lookup\/)?([a-z]{3}-[a-z]{4}-[a-z]{3})/);
            if (meetIdMatch) {
                this.meetingId = meetIdMatch[1];
            }
        }
    }
    
    next();
});

export const Meeting = mongoose.model("Meeting", meetingSchema);
