import apiClient from './apiClient';

console.log('🔧 CTA Tracking Service (SQL) loaded');

export interface CTAActivity {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'call' | 'whatsapp' | 'email';
  contactInfo: string;
  leadId?: string;
  leadName?: string;
  device: 'mobile' | 'desktop';
  timestamp: string;
  endTimestamp?: string;
  duration?: number;
  messageText?: string;
  details: {
    phone?: string;
    email?: string;
    contactName?: string;
    agencyName?: string;
    uniqueId?: string;
    callDuration?: number;
    whatsappMessage?: string;
  };
}

// Helper: Detect Device
const getDeviceType = (): 'mobile' | 'desktop' => {
  return window.innerWidth <= 768 ? 'mobile' : 'desktop';
};

// 1. Track CTA Activity (Base Function)
export const trackCTAActivity = async (
  userId: string,
  userName: string,
  action: 'call' | 'whatsapp' | 'email',
  contactInfo: string,
  leadId?: string,
  leadName?: string,
  contactName?: string,
  agencyName?: string
): Promise<string> => {
  const timestamp = new Date().toISOString();
  
  try {
    const details: any = {
      contactName: contactName || 'Unknown Contact',
      agencyName: agencyName || 'Unknown Agency'
    };

    if (action === 'call' || action === 'whatsapp') details.phone = contactInfo;
    if (action === 'email') details.email = contactInfo;

    const activityData = {
      userId,
      userName,
      userEmail: userId, // Assuming ID is email or passed separately
      action,
      contactInfo,
      leadId,
      leadName,
      device: getDeviceType(),
      timestamp,
      details
    };

    console.log('📤 Sending CTA to SQL:', activityData);
    
    // Call Node.js Backend
    const response = await apiClient.post('/cta/add', activityData);
    
    console.log('✅ CTA Saved, ID:', response.data.id);
    return response.data.id;
  } catch (error) {
    console.error('❌ Error tracking CTA:', error);
    return ''; // Return empty string on failure so UI doesn't crash
  }
};

// 2. Track Call Action
export const trackCallAction = async (
  userId: string,
  userName: string,
  phoneNumber: string,
  leadId?: string,
  leadName?: string,
  contactName?: string,
  agencyName?: string
) => {
  return trackCTAActivity(userId, userName, 'call', phoneNumber, leadId, leadName, contactName, agencyName);
};

// 3. Track WhatsApp Action
export const trackWhatsAppAction = async (
  userId: string,
  userName: string,
  phoneNumber: string,
  leadId?: string,
  leadName?: string,
  contactName?: string,
  agencyName?: string
) => {
  return trackCTAActivity(userId, userName, 'whatsapp', phoneNumber, leadId, leadName, contactName, agencyName);
};

// 4. Track Email Action
export const trackEmailAction = async (
  userId: string,
  userName: string,
  emailAddress: string,
  leadId?: string,
  leadName?: string,
  contactName?: string,
  agencyName?: string
) => {
  return trackCTAActivity(userId, userName, 'email', emailAddress, leadId, leadName, contactName, agencyName);
};

// 5. Track Call End (Update Duration)
export const trackCallEnd = async (ctaActivityId: string, duration: number) => {
  if (!ctaActivityId) return;

  try {
    await apiClient.put(`/cta/update/${ctaActivityId}`, {
      endTimestamp: new Date().toISOString(),
      duration: duration
    });
    console.log('📞 Call duration updated in SQL:', duration);
    return true;
  } catch (error) {
    console.error('❌ Error updating call duration:', error);
    return false;
  }
};

// 6. Track WhatsApp Message Content
export const trackWhatsAppMessage = async (
  userId: string,
  userName: string,
  phoneNumber: string,
  messageText: string,
  leadId?: string,
  leadName?: string,
  contactName?: string,
  agencyName?: string
) => {
  try {
    // First create the activity
    const docId = await trackCTAActivity(userId, userName, 'whatsapp', phoneNumber, leadId, leadName, contactName, agencyName);
    
    // Then update with message text
    if (docId) {
      await apiClient.put(`/cta/update/${docId}`, {
        messageText: messageText
      });
      console.log('💬 WhatsApp message updated in SQL');
    }
    return docId;
  } catch (error) {
    console.error('❌ Error tracking WhatsApp message:', error);
    throw error;
  }
};