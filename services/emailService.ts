import apiClient from './apiClient';

interface EmailData {
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
}

// Send email via backend API
export const sendEmail = async (emailData: EmailData): Promise<boolean> => {
    try {
    console.log('📧 Attempting to send email:', {
      to: emailData.to,
      subject: emailData.subject,
      attachments: emailData.attachments?.length || 0
    });

    // Determine if body is HTML
    const isHtml = emailData.body.includes('<') && emailData.body.includes('>');
    
    const response = await apiClient.post('/email/send', {
      to: emailData.to,
      subject: emailData.subject,
      body: emailData.body,
      isHtml: isHtml,
      attachments: emailData.attachments || []
    });

    if (response.data && response.data.success) {
      console.log('✅ Email sent successfully to:', emailData.to);
      return true;
    } else {
      const msg = (response.data && response.data.error) ? response.data.error : 'Check email service configuration.';
      console.error('❌ API returned error:', response.data);
      throw new Error(msg);
    }
  } catch (error: any) {
    console.error('❌ Error sending email:', error);
    const message = error.response?.data?.error || error.message || 'Failed to send email.';
    if (!error.response) {
      alert('Cannot connect to email server. Check that the server is running and your internet connection.');
    } else {
      alert(`❌ ${message}`);
    }
    return false;
  }
};

// Send travel claim notification to admin
export const sendTravelClaimNotification = async (claim: any): Promise<boolean> => {
  const emailData: EmailData = {
    to: 'admin@yourcompany.com', // Replace with actual admin email or fetch from settings
    subject: `Travel Claim Submitted - ${claim.userName} - ${claim.month}`,
    body: `
      <h3>Travel Claim Submitted</h3>
      <p>A new travel claim has been submitted and requires your review.</p>
      
      <h4>Claim Details:</h4>
      <ul>
        <li><strong>User:</strong> ${claim.userName} (${claim.userEmail})</li>
        <li><strong>Month:</strong> ${claim.month}</li>
        <li><strong>Total Meetings:</strong> ${claim.totalMeetings}</li>
        <li><strong>Eligible Meetings:</strong> ${claim.eligibleMeetings}</li>
        <li><strong>Total Distance:</strong> ${claim.totalDistance} km</li>
        <li><strong>Travel Cost:</strong> ₹${claim.totalTravelCost}</li>
      </ul>
      
      <h4>Outcomes:</h4>
      <p><strong>Expected:</strong> ${claim.expectedOutcome}</p>
      <p><strong>Actual:</strong> ${claim.actualOutcome}</p>
      
      <p><strong>Supporting Documents:</strong> ${claim.attachments?.length || 0} files uploaded</p>
      
      <p>Please review this claim in the admin panel.</p>
      <br>
      <p>Best regards,<br>Iapply CRM System</p>
    `,
    attachments: claim.attachments
  };

  return await sendEmail(emailData);
};

// Send approved claim to accounts for payment
export const sendClaimToAccounts = async (claim: any): Promise<boolean> => {
  const emailData: EmailData = {
    to: 'accounts@yourcompany.com', // Replace with actual accounts email
    subject: `PAYMENT REQUEST: Travel Claim - ${claim.userName} - ${claim.month}`,
    body: `
      <h3>Travel Claim Approved</h3>
      <p>An approved travel claim is ready for payment processing.</p>
      
      <h4>Payment Details:</h4>
      <ul>
        <li><strong>User:</strong> ${claim.userName} (${claim.userEmail})</li>
        <li><strong>Month:</strong> ${claim.month}</li>
        <li><strong>Amount to Pay:</strong> ₹${claim.totalTravelCost}</li>
        <li><strong>Approved By:</strong> ${claim.approvedBy}</li>
        <li><strong>Approved On:</strong> ${new Date().toLocaleDateString()}</li>
      </ul>
      
      <p>Please process payment for this claim.</p>
      <br>
      <p>Best regards,<br>Iapply CRM System</p>
    `,
    attachments: claim.attachments
  };

  return await sendEmail(emailData);
};

// Send claim rejection notification to user
export const sendClaimRejectionNotification = async (claim: any, reason: string): Promise<boolean> => {
  const emailData: EmailData = {
    to: claim.userEmail,
    subject: `Travel Claim Update - ${claim.month}`,
    body: `
      <h3>Travel Claim Rejected</h3>
      <p>Your travel claim for <strong>${claim.month}</strong> has been rejected.</p>
      
      <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; border: 1px solid #ef4444; color: #991b1b;">
        <strong>Rejection Reason:</strong><br/>
        ${reason}
      </div>
      
      <p>Please contact the admin if you have questions.</p>
      <br>
      <p>Best regards,<br>Iapply CRM System</p>
    `
  };

  return await sendEmail(emailData);
};

// Send claim approval notification to user
export const sendClaimApprovalNotification = async (claim: any): Promise<boolean> => {
  const emailData: EmailData = {
    to: claim.userEmail,
    subject: `Travel Claim Approved - ${claim.month}`,
    body: `
      <h3>Travel Claim Approved!</h3>
      <p>Your travel claim for <strong>${claim.month}</strong> has been approved.</p>
      
      <ul>
        <li><strong>Approved Amount:</strong> ₹${claim.totalTravelCost}</li>
        <li><strong>Approved By:</strong> ${claim.approvedBy}</li>
      </ul>
      
      <p>Payment will be processed by the accounts team shortly.</p>
      <br>
      <p>Best regards,<br>Iapply CRM System</p>
    `
  };

  return await sendEmail(emailData);
};