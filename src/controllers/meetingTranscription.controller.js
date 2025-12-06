// src/controllers/meetingTranscription.controller.js
import { Meeting } from '../models/meeting.model.js';
import { User } from '../models/user.model.js';
import { processMeetingTranscription } from '../utils/llmService.js';

export const processTranscription = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { transcription } = req.body;

    // Get meeting and participants
    const meeting = await Meeting.findById(meetingId)
      .populate('participants.user', 'username fullName email');
    
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    // Get participant names for LLM
    const participantNames = meeting.participants.map(p => 
      p.user.fullName || p.user.username
    );

    // Process transcription with LLM
    const actionItems = await processMeetingTranscription(transcription, participantNames);

    // Map action items to user IDs
    const processedItems = await Promise.all(actionItems.map(async (item) => {
      const user = await User.findOne({
        $or: [
          { fullName: item.assignee },
          { username: item.assignee }
        ]
      });
      
      return {
        assignee: user?._id || null,
        task: item.task,
        dueDate: item.dueDate || null
      };
    }));

    // Update meeting with action items
    meeting.actionItems = processedItems;
    await meeting.save();

    res.status(200).json({
      success: true,
      data: meeting.actionItems
    });
  } catch (error) {
    next(error);
  }
};

export const getActionItems = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const actionItems = await Meeting.aggregate([
      { $unwind: '$actionItems' },
      { 
        $match: { 
          'actionItems.assignee': mongoose.Types.ObjectId(userId),
          'actionItems.status': { $ne: 'completed' }
        }
      },
      {
        $project: {
          _id: '$actionItems._id',
          task: '$actionItems.task',
          dueDate: '$actionItems.dueDate',
          status: '$actionItems.status',
          meeting: {
            title: '$title',
            meetingId: '$_id',
            date: '$scheduledDateTime'
          }
        }
      }
    ]);

    res.status(200).json({ success: true, data: actionItems });
  } catch (error) {
    next(error);
  }
};

export const updateActionItemStatus = async (req, res, next) => {
  try {
    const { meetingId, actionItemId } = req.params;
    const { status } = req.body;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const actionItem = meeting.actionItems.id(actionItemId);
    if (!actionItem) {
      return res.status(404).json({ success: false, message: 'Action item not found' });
    }

    actionItem.status = status;
    await meeting.save();

    res.status(200).json({ 
      success: true, 
      data: actionItem 
    });
  } catch (error) {
    next(error);
  }
};