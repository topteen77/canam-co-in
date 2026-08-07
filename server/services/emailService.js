import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// --- CONFIGURE EMAIL TRANSPORTER ---
// Update these settings in your .env file
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com', // e.g., smtp.gmail.com
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, 
    auth: {
        user: process.env.SMTP_USER, 
        pass: process.env.SMTP_PASS  
    }
});

// --- SEND EMAIL FUNCTION ---
export const sendEmail = async (data) => {
    try {
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        if (!user || !pass) {
            console.error('❌ SMTP not configured: SMTP_USER and SMTP_PASS must be set in server .env');
            return { success: false, error: 'Email service not configured. Add SMTP_USER and SMTP_PASS to server .env (e.g. Gmail app password for smtp.gmail.com).' };
        }

        console.log('📨 Sending email to:', data.to);

        // Prepare Attachments for Nodemailer
        // Frontend sends: { name, url, type }
        const formattedAttachments = (data.attachments || []).map(att => ({
            filename: att.name,
            path: att.url // Nodemailer handles Data URIs and URLs automatically
        }));

        const mailOptions = {
            from: process.env.SMTP_FROM || '"CRM System" <no-reply@crm.com>',
            to: data.to,
            subject: data.subject,
            // Use 'html' if isHtml is true, otherwise 'text'
            [data.isHtml ? 'html' : 'text']: data.body,
            attachments: formattedAttachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent:', info.messageId);
        
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending email:', error.message);
        // Don't throw error to crash server, just return failure
        return { success: false, error: error.message };
    }
};