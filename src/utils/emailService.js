import nodemailer from 'nodemailer';

// Create transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail', // You can change this to other services
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS // Use app password for Gmail
        }
    });
};

// Format date for email
const formatDateTime = (date, timezone = 'UTC') => {
    return new Date(date).toLocaleString('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
};

// Meeting invitation email template
const getMeetingInvitationTemplate = (meeting, participant, host) => {
    const scheduledTime = formatDateTime(meeting.scheduledDateTime, meeting.timezone);
    const endTime = formatDateTime(meeting.scheduledEndTime, meeting.timezone);
    
    return {
        subject: `Meeting Invitation: ${meeting.title}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .meeting-details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
                    .join-button { 
                        display: inline-block; 
                        background-color: #4CAF50; 
                        color: white; 
                        padding: 12px 24px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        margin: 15px 0;
                    }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Meeting Invitation</h1>
                    </div>
                    <div class="content">
                        <p>Hello ${participant.fullName},</p>
                        <p>You have been invited to join a meeting hosted by <strong>${host.fullName}</strong>.</p>
                        
                        <div class="meeting-details">
                            <h3>${meeting.title}</h3>
                            <p><strong>Description:</strong> ${meeting.description}</p>
                            <p><strong>Date & Time:</strong> ${scheduledTime}</p>
                            <p><strong>Duration:</strong> ${meeting.duration} minutes</p>
                            <p><strong>Host:</strong> ${host.fullName} (${host.email})</p>
                            <p><strong>Department:</strong> ${host.department}</p>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="${meeting.meetingLink}" class="join-button">Join Meeting</a>
                        </div>
                        
                        <p><strong>Meeting Link:</strong> <a href="${meeting.meetingLink}">${meeting.meetingLink}</a></p>
                        
                        <p>Please make sure to join the meeting on time. If you have any questions, feel free to contact the meeting host.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from Meeting Action Tracker System</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };
};

// Meeting reminder email template
const getMeetingReminderTemplate = (meeting, participant, host, reminderType) => {
    const scheduledTime = formatDateTime(meeting.scheduledDateTime, meeting.timezone);
    const reminderText = {
        '24h': '24 hours',
        '1h': '1 hour',
        '15m': '15 minutes'
    };
    
    return {
        subject: `Meeting Reminder: ${meeting.title} - Starting in ${reminderText[reminderType]}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .meeting-details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
                    .join-button { 
                        display: inline-block; 
                        background-color: #FF9800; 
                        color: white; 
                        padding: 12px 24px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        margin: 15px 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Meeting Reminder</h1>
                    </div>
                    <div class="content">
                        <p>Hello ${participant.fullName},</p>
                        <p>This is a reminder that your meeting "<strong>${meeting.title}</strong>" is starting in ${reminderText[reminderType]}.</p>
                        
                        <div class="meeting-details">
                            <h3>${meeting.title}</h3>
                            <p><strong>Date & Time:</strong> ${scheduledTime}</p>
                            <p><strong>Duration:</strong> ${meeting.duration} minutes</p>
                            <p><strong>Host:</strong> ${host.fullName}</p>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="${meeting.meetingLink}" class="join-button">Join Meeting Now</a>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `
    };
};

// Send meeting invitation
export const sendMeetingInvitation = async (meeting, participants, host) => {
    try {
        const transporter = createTransporter();
        const emailPromises = [];

        for (const participant of participants) {
            const emailTemplate = getMeetingInvitationTemplate(meeting, participant, host);
            
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: participant.email,
                subject: emailTemplate.subject,
                html: emailTemplate.html
            };

            emailPromises.push(transporter.sendMail(mailOptions));
        }

        await Promise.all(emailPromises);
        console.log(`Meeting invitations sent to ${participants.length} participants`);
        return { success: true, message: 'Invitations sent successfully' };
    } catch (error) {
        console.error('Error sending meeting invitations:', error);
        throw new Error('Failed to send meeting invitations');
    }
};

// Send meeting reminder
export const sendMeetingReminder = async (meeting, participants, host, reminderType) => {
    try {
        const transporter = createTransporter();
        const emailPromises = [];

        for (const participant of participants) {
            const emailTemplate = getMeetingReminderTemplate(meeting, participant, host, reminderType);
            
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: participant.email,
                subject: emailTemplate.subject,
                html: emailTemplate.html
            };

            emailPromises.push(transporter.sendMail(mailOptions));
        }

        await Promise.all(emailPromises);
        console.log(`Meeting reminders (${reminderType}) sent to ${participants.length} participants`);
        return { success: true, message: 'Reminders sent successfully' };
    } catch (error) {
        console.error('Error sending meeting reminders:', error);
        throw new Error('Failed to send meeting reminders');
    }
};

// Send meeting cancellation
export const sendMeetingCancellation = async (meeting, participants, host, reason = '') => {
    try {
        const transporter = createTransporter();
        const emailPromises = [];
        const scheduledTime = formatDateTime(meeting.scheduledDateTime, meeting.timezone);

        for (const participant of participants) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: participant.email,
                subject: `Meeting Cancelled: ${meeting.title}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f44336; color: white; padding: 20px; text-align: center;">
                            <h1>Meeting Cancelled</h1>
                        </div>
                        <div style="padding: 20px;">
                            <p>Hello ${participant.fullName},</p>
                            <p>The meeting "<strong>${meeting.title}</strong>" scheduled for ${scheduledTime} has been cancelled by ${host.fullName}.</p>
                            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                            <p>We apologize for any inconvenience caused.</p>
                        </div>
                    </div>
                `
            };

            emailPromises.push(transporter.sendMail(mailOptions));
        }

        await Promise.all(emailPromises);
        console.log(`Meeting cancellation notifications sent to ${participants.length} participants`);
        return { success: true, message: 'Cancellation notifications sent successfully' };
    } catch (error) {
        console.error('Error sending meeting cancellation:', error);
        throw new Error('Failed to send meeting cancellation notifications');
    }
};
