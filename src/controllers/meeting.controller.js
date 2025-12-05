import { Meeting } from "../models/meeting.model.js";
import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asynvHandler.js";
import { sendMeetingInvitation, sendMeetingCancellation } from "../utils/emailService.js";
import { startTranscriptionBot, deleteTranscriptionBot, getTranscription } from "../utils/vexaService.js";

// Create a new meeting
const createMeeting = asyncHandler(async (req, res) => {
    const {
        title,
        description,
        meetingLink,
        scheduledDateTime,
        duration,
        timezone,
        participantIds,
        isRecurring,
        recurringPattern
    } = req.body;

    // Validation
    if (!title || !description || !meetingLink || !scheduledDateTime || !duration) {
        return res.status(400).json({
            success: false,
            message: "Title, description, meeting link, scheduled date/time, and duration are required"
        });
    }

    // Validate that user is a manager
    if (req.user.role !== 'manager') {
        return res.status(403).json({
            success: false,
            message: "Only managers can create meetings"
        });
    }

    // Validate participants are staff members under this manager
    if (participantIds && participantIds.length > 0) {
        const participants = await User.find({
            _id: { $in: participantIds },
            role: 'staff',
            managerId: req.user._id,
            isActive: true
        });

        if (participants.length !== participantIds.length) {
            return res.status(400).json({
                success: false,
                message: "Some selected participants are not valid staff members under your management"
            });
        }
    }

    // Create meeting data
    const meetingData = {
        title: title.trim(),
        description: description.trim(),
        hostId: req.user._id,
        meetingLink: meetingLink.trim(),
        scheduledDateTime: new Date(scheduledDateTime),
        duration: parseInt(duration),
        timezone: timezone || req.user.timezone || 'UTC',
        participants: participantIds ? participantIds.map(id => ({ userId: id })) : [],
        isRecurring: isRecurring || false
    };

    if (isRecurring && recurringPattern) {
        meetingData.recurringPattern = recurringPattern;
    }

    // Create meeting
    const meeting = await Meeting.create(meetingData);

    // Populate meeting with participant details
    const populatedMeeting = await Meeting.findById(meeting._id)
        .populate('hostId', 'fullName email role department')
        .populate('participants.userId', 'fullName email role department avatar');

    // Start Vexa AI transcription bot
    try {
        const botResult = await startTranscriptionBot(populatedMeeting.meetingLink, 'MeetingActionTracker');
        if (botResult.success) {
            console.log(`Transcription bot started for meeting: ${populatedMeeting.title}`);
            // Update meeting with bot info
            await Meeting.findByIdAndUpdate(meeting._id, { 
                transcriptionBotId: botResult.botId,
                transcriptionBotStarted: true 
            });
        } else {
            console.error('Failed to start transcription bot:', botResult.error);
        }
    } catch (botError) {
        console.error('Error starting transcription bot:', botError);
        // Don't fail meeting creation if bot fails
    }

    // Send email invitations if participants exist
    if (participantIds && participantIds.length > 0) {
        try {
            const participants = await User.find({ _id: { $in: participantIds } });
            await sendMeetingInvitation(populatedMeeting, participants, req.user);
            
            // Mark email as sent
            await Meeting.findByIdAndUpdate(meeting._id, { emailSent: true });
        } catch (emailError) {
            console.error('Failed to send meeting invitations:', emailError);
            // Don't fail the meeting creation if email fails
        }
    }

    return res.status(201).json({
        success: true,
        message: "Meeting created successfully",
        data: populatedMeeting
    });
});

// Get all meetings for the current user
const getMeetings = asyncHandler(async (req, res) => {
    const { status, upcoming } = req.query;
    let meetings;

    if (req.user.role === 'manager') {
        // Managers see meetings they host
        meetings = await Meeting.findByHost(req.user._id, status);
    } else {
        // Staff see meetings they're invited to
        meetings = await Meeting.findByParticipant(req.user._id, status);
    }

    // Filter for upcoming meetings if requested
    if (upcoming === 'true') {
        const now = new Date();
        meetings = meetings.filter(meeting => 
            new Date(meeting.scheduledDateTime) >= now && 
            meeting.status !== 'cancelled'
        );
    }

    return res.status(200).json({
        success: true,
        message: "Meetings retrieved successfully",
        data: meetings
    });
});

// Get specific meeting by ID
const getMeetingById = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;

    const meeting = await Meeting.findById(meetingId)
        .populate('hostId', 'fullName email role department')
        .populate('participants.userId', 'fullName email role department avatar');

    if (!meeting) {
        return res.status(404).json({
            success: false,
            message: "Meeting not found"
        });
    }

    // Check if user has access to this meeting
    const hasAccess = meeting.hostId._id.toString() === req.user._id.toString() ||
                     meeting.participants.some(p => p.userId._id.toString() === req.user._id.toString());

    if (!hasAccess) {
        return res.status(403).json({
            success: false,
            message: "You don't have access to this meeting"
        });
    }

    return res.status(200).json({
        success: true,
        message: "Meeting retrieved successfully",
        data: meeting
    });
});

// Update meeting (only host can update)
const updateMeeting = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const {
        title,
        description,
        meetingLink,
        scheduledDateTime,
        duration,
        timezone,
        participantIds
    } = req.body;

    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
        return res.status(404).json({
            success: false,
            message: "Meeting not found"
        });
    }

    // Check if user is the host
    if (meeting.hostId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
            success: false,
            message: "Only the meeting host can update the meeting"
        });
    }

    // Check if meeting can be updated (not completed or cancelled)
    if (meeting.status === 'completed' || meeting.status === 'cancelled') {
        return res.status(400).json({
            success: false,
            message: "Cannot update completed or cancelled meetings"
        });
    }

    // Update fields
    const updateData = {};
    if (title) updateData.title = title.trim();
    if (description) updateData.description = description.trim();
    if (meetingLink) updateData.meetingLink = meetingLink.trim();
    if (scheduledDateTime) updateData.scheduledDateTime = new Date(scheduledDateTime);
    if (duration) updateData.duration = parseInt(duration);
    if (timezone) updateData.timezone = timezone;

    // Handle participant updates
    if (participantIds) {
        // Validate participants
        const participants = await User.find({
            _id: { $in: participantIds },
            role: 'staff',
            managerId: req.user._id,
            isActive: true
        });

        if (participants.length !== participantIds.length) {
            return res.status(400).json({
                success: false,
                message: "Some selected participants are not valid staff members"
            });
        }

        updateData.participants = participantIds.map(id => ({ userId: id }));
    }

    const updatedMeeting = await Meeting.findByIdAndUpdate(
        meetingId,
        updateData,
        { new: true, runValidators: true }
    ).populate('hostId', 'fullName email role department')
     .populate('participants.userId', 'fullName email role department avatar');

    return res.status(200).json({
        success: true,
        message: "Meeting updated successfully",
        data: updatedMeeting
    });
});

// Cancel meeting
const cancelMeeting = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { reason } = req.body;

    const meeting = await Meeting.findById(meetingId)
        .populate('hostId', 'fullName email role department')
        .populate('participants.userId', 'fullName email role department avatar');

    if (!meeting) {
        return res.status(404).json({
            success: false,
            message: "Meeting not found"
        });
    }

    // Check if user is the host
    if (meeting.hostId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
            success: false,
            message: "Only the meeting host can cancel the meeting"
        });
    }

    // Check if meeting can be cancelled
    if (meeting.status === 'completed' || meeting.status === 'cancelled') {
        return res.status(400).json({
            success: false,
            message: "Cannot cancel completed or already cancelled meetings"
        });
    }

    // Update meeting status
    meeting.status = 'cancelled';
    await meeting.save();

    // Send cancellation emails
    if (meeting.participants.length > 0) {
        try {
            const participants = meeting.participants.map(p => p.userId);
            await sendMeetingCancellation(meeting, participants, meeting.hostId, reason);
        } catch (emailError) {
            console.error('Failed to send cancellation emails:', emailError);
        }
    }

    return res.status(200).json({
        success: true,
        message: "Meeting cancelled successfully",
        data: meeting
    });
});

// Start meeting
const startMeeting = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;

    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
        return res.status(404).json({
            success: false,
            message: "Meeting not found"
        });
    }

    // Check if user is the host
    if (meeting.hostId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
            success: false,
            message: "Only the meeting host can start the meeting"
        });
    }

    // Check if meeting is scheduled
    if (meeting.status !== 'scheduled') {
        return res.status(400).json({
            success: false,
            message: "Meeting is not in scheduled status"
        });
    }

    await meeting.startMeeting();

    return res.status(200).json({
        success: true,
        message: "Meeting started successfully",
        data: meeting
    });
});

// End meeting
const endMeeting = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { notes } = req.body;

    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
        return res.status(404).json({
            success: false,
            message: "Meeting not found"
        });
    }

    // Check if user is the host
    if (meeting.hostId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
            success: false,
            message: "Only the meeting host can end the meeting"
        });
    }

    // Check if meeting is ongoing
    if (meeting.status !== 'ongoing') {
        return res.status(400).json({
            success: false,
            message: "Meeting is not currently ongoing"
        });
    }

    // Get transcription before ending the meeting
    let transcriptionData = [];
    if (meeting.transcriptionBotStarted && meeting.meetingLink) {
        try {
            const transcriptionResult = await getTranscription(meeting.meetingLink);
            if (transcriptionResult.success && transcriptionResult.transcription) {
                // Extract name and text fields from the transcription response
                if (Array.isArray(transcriptionResult.transcription)) {
                    // If response is an array of transcription segments
                    transcriptionData.push(...transcriptionResult.transcription.map(segment => ({
                        name: segment.name || segment.speaker || 'Unknown',
                        text: segment.text || segment.content || ''
                    })));
                } else if (transcriptionResult.transcription.segments) {
                    // If response has segments property
                    transcriptionData.push(...transcriptionResult.transcription.segments.map(segment => ({
                        name: segment.name || segment.speaker || 'Unknown',
                        text: segment.text || segment.content || ''
                    })));
                } else if (transcriptionResult.transcription.name && transcriptionResult.transcription.text) {
                    // If response is a single object with name and text
                    transcriptionData.push({
                        name: transcriptionResult.transcription.name,
                        text: transcriptionResult.transcription.text
                    });
                }
                console.log(`Transcription retrieved for meeting: ${meeting.title}`);
            }
        } catch (transcriptionError) {
            console.error('Error retrieving transcription:', transcriptionError);
        }
    }

    // End the meeting
    await meeting.endMeeting(notes);

    // Update meeting with transcription data if available
    if (transcriptionData.length > 0) {
        await Meeting.findByIdAndUpdate(meetingId, {
            meetingTranscription: transcriptionData
        });
    }

    // Clean up transcription bot
    if (meeting.transcriptionBotStarted && meeting.meetingLink) {
        try {
            const deleteResult = await deleteTranscriptionBot(meeting.meetingLink);
            if (deleteResult.success) {
                console.log(`Transcription bot cleaned up for meeting: ${meeting.title}`);
                await Meeting.findByIdAndUpdate(meetingId, {
                    transcriptionBotStarted: false
                });
            }
        } catch (botError) {
            console.error('Error cleaning up transcription bot:', botError);
        }
    }

    return res.status(200).json({
        success: true,
        message: "Meeting ended successfully",
        data: {
            ...meeting.toObject(),
            transcription: transcriptionData.length > 0 ? "Transcription retrieved and stored" : "No transcription available"
        }
    });
});

// Get staff members for meeting invitation
const getAvailableStaff = asyncHandler(async (req, res) => {
    // Only managers can access this
    if (req.user.role !== 'manager') {
        return res.status(403).json({
            success: false,
            message: "Only managers can view staff members"
        });
    }

    const staffMembers = await User.findStaffByManager(req.user._id);

    return res.status(200).json({
        success: true,
        message: "Staff members retrieved successfully",
        data: staffMembers
    });
});

// Update participant status (for staff to accept/decline)
const updateParticipantStatus = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { status } = req.body;

    if (!['accepted', 'declined'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Status must be 'accepted' or 'declined'"
        });
    }

    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
        return res.status(404).json({
            success: false,
            message: "Meeting not found"
        });
    }

    // Check if user is a participant
    const participant = meeting.participants.find(p => 
        p.userId.toString() === req.user._id.toString()
    );

    if (!participant) {
        return res.status(403).json({
            success: false,
            message: "You are not invited to this meeting"
        });
    }

    await meeting.updateParticipantStatus(req.user._id, status);

    return res.status(200).json({
        success: true,
        message: `Meeting invitation ${status} successfully`,
        data: meeting
    });
});

// Get meeting transcription
const getMeetingTranscription = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;

    // Search by meetingId field (Google Meet ID) instead of MongoDB ObjectId
    const meeting = await Meeting.findOne({ meetingId: meetingId });

    if (!meeting) {
        return res.status(404).json({
            success: false,
            message: "Meeting not found"
        });
    }

    // Check if user has access to this meeting
    const hasAccess = meeting.hostId.toString() === req.user._id.toString() ||
                     meeting.participants.some(p => p.userId.toString() === req.user._id.toString());

    if (!hasAccess) {
        return res.status(403).json({
            success: false,
            message: "You don't have access to this meeting"
        });
    }

    // If meeting already has stored transcription, return it
    if (meeting.meetingTranscription && meeting.meetingTranscription.length > 0) {
        return res.status(200).json({
            success: true,
            message: "Transcription retrieved successfully",
            data: {
                meetingId: meeting.meetingId,
                mongoId: meeting._id,
                title: meeting.title,
                transcription: meeting.meetingTranscription,
                retrievedAt: meeting.updatedAt
            }
        });
    }

    // Try to get transcription from Vexa API
    if (meeting.meetingLink) {
        try {
            const transcriptionResult = await getTranscription(meeting.meetingLink);
            if (transcriptionResult.success && transcriptionResult.transcription) {
                // Extract name and text fields from the transcription response
                const transcriptionData = [];
                
                // Handle different response formats from Vexa API
                if (Array.isArray(transcriptionResult.transcription)) {
                    // If response is an array of transcription segments
                    transcriptionData.push(...transcriptionResult.transcription.map(segment => ({
                        name: segment.name || segment.speaker || 'Unknown',
                        text: segment.text || segment.content || ''
                    })));
                } else if (transcriptionResult.transcription.segments) {
                    // If response has segments property
                    transcriptionData.push(...transcriptionResult.transcription.segments.map(segment => ({
                        name: segment.name || segment.speaker || 'Unknown',
                        text: segment.text || segment.content || ''
                    })));
                } else if (transcriptionResult.transcription.name && transcriptionResult.transcription.text) {
                    // If response is a single object with name and text
                    transcriptionData.push({
                        name: transcriptionResult.transcription.name,
                        text: transcriptionResult.transcription.text
                    });
                }

                // Store transcription in meeting document
                if (transcriptionData.length > 0) {
                    await Meeting.findByIdAndUpdate(meeting._id, {
                        meetingTranscription: transcriptionData
                    });

                    return res.status(200).json({
                        success: true,
                        message: "Transcription retrieved and stored successfully",
                        data: {
                            meetingId: meeting.meetingId,
                            mongoId: meeting._id,
                            title: meeting.title,
                            transcription: transcriptionData,
                            retrievedAt: new Date()
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error retrieving transcription:', error);
            return res.status(500).json({
                success: false,
                message: "Error retrieving transcription from Vexa API",
                error: error.message
            });
        }
    }

    return res.status(404).json({
        success: false,
        message: "No transcription available for this meeting"
    });
});

export {
    createMeeting,
    getMeetings,
    getMeetingById,
    updateMeeting,
    cancelMeeting,
    startMeeting,
    endMeeting,
    getAvailableStaff,
    updateParticipantStatus,
    getMeetingTranscription
};
