import axios from 'axios';

const VEXA_API_BASE_URL = 'https://api.cloud.vexa.ai';
const VEXA_API_KEY = process.env.VEXA_API_KEY || '9egYSErXw38N1ES617KlCf8rPnq2Z9KKsQH33cbf';

// Extract meeting ID from Google Meet link
const extractMeetingId = (meetingLink) => {
    try {
        // Google Meet URLs format: https://meet.google.com/abc-xyz-123
        const url = new URL(meetingLink);
        if (url.hostname === 'meet.google.com') {
            return url.pathname.substring(1); // Remove leading slash
        }
        throw new Error('Invalid Google Meet URL');
    } catch (error) {
        console.error('Error extracting meeting ID:', error);
        return null;
    }
};

// Start transcription bot for a meeting
export const startTranscriptionBot = async (meetingLink, botName = 'MeetingActionTracker') => {
    try {
        const nativeMeetingId = extractMeetingId(meetingLink);
        
        if (!nativeMeetingId) {
            throw new Error('Could not extract meeting ID from link');
        }

        const response = await axios.post(`${VEXA_API_BASE_URL}/bots`, {
            platform: 'google_meet',
            native_meeting_id: nativeMeetingId,
            bot_name: botName
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': VEXA_API_KEY
            }
        });

        console.log(`Transcription bot started for meeting: ${nativeMeetingId}`);
        return {
            success: true,
            botId: nativeMeetingId,
            data: response.data
        };
    } catch (error) {
        console.error('Error starting transcription bot:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
};

// Get transcription for a meeting
export const getTranscription = async (meetingLink) => {
    try {
        const nativeMeetingId = extractMeetingId(meetingLink);
        
        if (!nativeMeetingId) {
            throw new Error('Could not extract meeting ID from link');
        }

        const response = await axios.get(`${VEXA_API_BASE_URL}/transcripts/google_meet/${nativeMeetingId}`, {
            headers: {
                'X-API-Key':"cbQPa3WPxK1FlA9fMr2p4ihSWmuAqjPLpgMZgeFM"
                
            }
        });
        console.log(response)

        return {
            success: true,
            transcription: response.data,
            meetingId: nativeMeetingId
        };
    } catch (error) {
        console.error('Error getting transcription:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
};

// Delete transcription bot
export const deleteTranscriptionBot = async (meetingLink) => {
    try {
        const nativeMeetingId = extractMeetingId(meetingLink);
        
        if (!nativeMeetingId) {
            throw new Error('Could not extract meeting ID from link');
        }

        const response = await axios.delete(`${VEXA_API_BASE_URL}/bots/google_meet/${nativeMeetingId}`, {
            headers: {
                'X-API-Key': VEXA_API_KEY
            }
        });

        console.log(`Transcription bot deleted for meeting: ${nativeMeetingId}`);
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Error deleting transcription bot:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
};

export { extractMeetingId };
