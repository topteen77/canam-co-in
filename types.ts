export type AgentCategory = 'Platinum' | 'Diamond' | 'Gold' | 'Silver' | 'Bronze' | 'Beginner';
export const AGENT_CATEGORIES: AgentCategory[] = ['Platinum', 'Diamond', 'Gold', 'Silver', 'Bronze', 'Beginner'];

export type LeadStatus = 'New' | 'In Pipeline' | 'ICP Qualified' | 'Portal Deactivated' | 'Onboarded' | 'Lost' | 'MOU Signature Pending' | 'Agent Portal Created' | 'Agent Portal Reactivated' | 'Not qualified' | 'Inquiry by mistake' | 'Training schedule' | 'Lost post onboarding' | 'Mismatched expectations';
export const LEAD_STATUSES: LeadStatus[] = ['New', 'In Pipeline', 'ICP Qualified', 'Portal Deactivated', 'Onboarded', 'Lost', 'MOU Signature Pending', 'Agent Portal Created', 'Agent Portal Reactivated', 'Not qualified', 'Inquiry by mistake', 'Training schedule', 'Lost post onboarding', 'Mismatched expectations'];

export type LeadSource = 'Website' | 'Referral' | 'Cold Call' | 'Email Campaign' | 'Social Media' | 'Trade Show' | 'Partner' | 'Advertisement' | 'Direct Mail' | 'Other';
export const LEAD_SOURCES: LeadSource[] = ['Website', 'Referral', 'Cold Call', 'Email Campaign', 'Social Media', 'Trade Show', 'Partner', 'Advertisement', 'Direct Mail', 'Other'];

export type FollowUpType = 'Call' | 'Meeting' | 'Email' | 'New Assessment' | 'Assessment Follow-up' | 'WhatsApp' | 'Onboarding meeting - Physical' | 'Onboarding meeting - Virtual' | 'Training meeting - Physical' | 'Training meeting - Virtual';
export const FOLLOW_UP_TYPES: FollowUpType[] = ['Call', 'Meeting', 'Email', 'New Assessment', 'Assessment Follow-up', 'WhatsApp', 'Onboarding meeting - Physical', 'Onboarding meeting - Virtual', 'Training meeting - Physical', 'Training meeting - Virtual'];
export type FollowUpStatus = 'Planned' | 'Done';

// Country options for interest selection
export const COUNTRY_OPTIONS = ['Canada', 'USA', 'Australia', 'UK', 'New Zealand', 'Singapore', 'Ireland', 'Germany', 'France', 'Netherland', 'UAE', 'Cyprus', 'Malta'];
// Country codes for flags (ISO 3166-1 alpha-2)
export const COUNTRY_CODES: Record<string, string> = {
  'Canada': 'ca',
  'USA': 'us',
  'Australia': 'au',
  'UK': 'gb',
  'New Zealand': 'nz',
  'Singapore': 'sg',
  'Ireland': 'ie',
  'Germany': 'de',
  'France': 'fr',
  'Netherland': 'nl',
  'UAE': 'ae',
  'Cyprus': 'cy',
  'Malta': 'mt'
};

export const COUNTRY_FLAGS: Record<string, string> = {
  'Canada': '🇨🇦',
  'USA': '🇺🇸',
  'Australia': '🇦🇺',
  'UK': '🇬🇧',
  'New Zealand': '🇳🇿',
  'Singapore': '🇸🇬',
  'Ireland': '🇮🇪',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Netherland': '🇳🇱',
  'UAE': '🇦🇪',
  'Cyprus': '🇨🇾',
  'Malta': '🇲🇹'
};

export interface Contact {
  id: string;
  name: string;
  role: string; // e.g., 'Director', 'Counselor', 'POC'
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  alternateMobile?: string; // Alternate mobile for agency
  pocName?: string; // POC name (optional)
  pocDesignation?: string; // POC designation (optional)
}

export interface FollowUp {
  id: string;
  type: FollowUpType;
  status: FollowUpStatus;
  date: string; // ISO string
  notes: string;
  assignedTo?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AgencyDocument {
  url: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
  isBase64?: boolean; // Indicates if the URL contains base64 data
  size?: number; // File size in bytes
}

export interface AgencyDocuments {
  companyRegistration?: AgencyDocument;
  panCard?: AgencyDocument;
  gstNumber?: AgencyDocument;
  mou?: AgencyDocument;
}

export interface Lead {
  id: string;
  agencyName: string;
  status: LeadStatus;
  agentCategory: AgentCategory;
  leadSource?: LeadSource;
  tags: string[]; // e.g., 'High Potential', 'UK Specialist'
  accountManager?: string;
  salesPerson?: string;
  contacts: Contact[];
  followUps: FollowUp[];
  createdAt: string; // ISO string
  createdBy?: string;
  onboardedBy?: string;
  onboardedDate?: string; // ISO string - date when status was marked as onboarded
  onboardingDate?: string; // ISO string - date of onboarding
  // Additional fields from new template
  lastLoggedIn?: string;
  loginEmail?: string;
  loginPassword?: string;
  country?: string;
  applicants?: string;
  applications?: string;
  offers?: string;
  applicantsWithOffers?: string;
  tfPaid?: string;
  refund?: string;
  visa?: string;
  remarks?: string;
  action?: string;
  // Website and documents
  websiteLink?: string;
  agencyDocuments?: AgencyDocuments;
  // Country interest (ordered array - highest to lowest priority)
  countryInterest?: string[]; // e.g., ['Canada', 'UK', 'USA']
  // ICP Score (1-10)
  icpScore?: number; // Ideal Customer Profile Score (1-10)
}

export type AttendanceStatus = 'started' | 'on-break' | 'ended';
export type AttendanceAction = 'start-day' | 'end-day' | 'on-break' | 'back-from-break';

export interface AttendanceRecord {
  id?: string;
  firebase_id?: string;
  username: string;
  date: string; // YYYY-MM-DD format
  checkInTime: string; // ISO string
  checkOutTime?: string; // ISO string
  status: AttendanceStatus;
  action: AttendanceAction;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  // Separate location fields for start and end of day
  startLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  endLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  workingHours?: number;
  deviceType?: string;
  breakStartTime?: string; // ISO string
  breakEndTime?: string; // ISO string
  totalBreakTime?: number; // in minutes
  createdBy?: string;
  createdAt?: string;
}

export interface PhotoMetadata {
  timestamp: string; // ISO string
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  type: 'meeting_start' | 'meeting_end';
}

export interface MeetingCheckInRecord {
  username: string;
  salesPersonName?: string;
  salesPersonEmail?: string;
  meetingType?: string;
  notes?: string;
  leadId?: string;
  leadName?: string;
  date: string; // YYYY-MM-DD format
  checkInTime: string; // ISO string
  checkOutTime?: string; // ISO string for meeting end
  meetingDuration?: number; // Duration in minutes
  meetingStatus?: 'active' | 'completed'; // Meeting status
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  // Enhanced photo upload fields
  checkInPhotos?: string[]; // URLs of photos uploaded during check-in
  completionPhotos?: string[]; // URLs of photos uploaded during completion
  checkInPhotoMetadata?: PhotoMetadata[]; // Metadata for check-in photos
  completionPhotoMetadata?: PhotoMetadata[]; // Metadata for completion photos
  photoUploadCount?: {
    checkIn: number; // Number of times photos uploaded during check-in today
    completion: number; // Number of times photos uploaded during completion today
  };
  meetingOutcome?: 'successful' | 'rescheduled' | 'cancelled' | 'no_show' | 'other';
  createdBy?: string;
  createdAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Inactive' | 'Pending';
  defaultPassword?: string;
  customPassword?: string;
  passwordGeneratedAt?: string; // ISO string
  password_set?: boolean;
  password_set_at?: string;
  created_at?: string;
  updated_at?: string;
  signup_method?: 'Google' | 'Email' | 'Manual';
  profile_picture?: string;
  phone?: string;
  email_notifications?: boolean;
  sms_notifications?: boolean;
}

export interface CallLog {
  id: string;
  phoneNumber: string;
  leadId?: string;
  leadName?: string;
  contactName?: string;
  callType: 'lead' | 'non-lead';
  timestamp: string; // ISO string when call was initiated
  duration: number; // Duration in seconds
  notes?: string;
  outcome?: 'answered' | 'no-answer' | 'busy' | 'voicemail' | 'other';
  userId: string;
  userEmail: string;
  userName: string;
  createdAt: string; // ISO string
}