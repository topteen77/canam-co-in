// Utility functions for WhatsApp integration
// Ensures phone numbers have proper country codes for WhatsApp

/**
 * Normalizes a phone number for WhatsApp by ensuring it has a country code
 * @param phone - The phone number to normalize (can include spaces, dashes, +, etc.)
 * @param defaultCountryCode - Default country code to use if missing (default: '91' for India)
 * @returns Normalized phone number with country code (digits only, no + sign for WhatsApp URL)
 */
export const normalizePhoneForWhatsApp = (phone: string, defaultCountryCode: string = '91'): string => {
  if (!phone) return '';
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If empty after cleaning, return empty
  if (!cleaned) return '';
  
  // If already starts with country code (91 for India, or other 2-digit codes)
  if (cleaned.startsWith('91') && cleaned.length >= 12) {
    // Already has India country code
    return cleaned;
  }
  
  // If starts with 0 (common in India), remove it and add country code
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return defaultCountryCode + cleaned.substring(1);
  }
  
  // If it's exactly 10 digits and starts with 6-9 (Indian mobile number format)
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    return defaultCountryCode + cleaned;
  }
  
  // If it's 10 digits but doesn't start with 6-9, still add country code (might be landline)
  if (cleaned.length === 10) {
    return defaultCountryCode + cleaned;
  }
  
  // If it's already 11-15 digits, assume it already has country code
  if (cleaned.length >= 11 && cleaned.length <= 15) {
    return cleaned;
  }
  
  // For any other case, try to add country code if it's less than 11 digits
  if (cleaned.length < 11 && !cleaned.startsWith(defaultCountryCode)) {
    return defaultCountryCode + cleaned;
  }
  
  // Return as-is if we can't determine
  return cleaned;
};

/**
 * Formats phone number for WhatsApp URL (removes + sign, keeps only digits with country code)
 * @param phone - The phone number to format
 * @returns Phone number formatted for WhatsApp URL (e.g., "919998003442")
 */
export const formatPhoneForWhatsAppUrl = (phone: string): string => {
  return normalizePhoneForWhatsApp(phone);
};

/**
 * Creates a WhatsApp URL with proper phone number formatting
 * @param phone - The phone number
 * @param message - Optional pre-filled message
 * @returns WhatsApp URL
 */
export const createWhatsAppUrl = (phone: string, message?: string): string => {
  const formattedPhone = formatPhoneForWhatsAppUrl(phone);
  
  if (!formattedPhone) {
    throw new Error('Invalid phone number');
  }
  
  let url = `https://wa.me/${formattedPhone}`;
  
  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }
  
  return url;
};

