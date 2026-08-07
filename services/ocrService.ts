// OCR Service using Tesseract.js (Client-side OCR)
// Best-in-class OCR with image preprocessing and optimized settings
// Extracts text and structured information from visiting cards and screenshots

import { createWorker } from 'tesseract.js';

console.log('🔧 OCR Service loaded');

export interface ExtractedLeadData {
  agencyName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  alternateMobile?: string;
  pocDesignation?: string;
  websiteLink?: string;
  remarks?: string;
}

// Advanced image preprocessing for better OCR accuracy
const preprocessImage = (imageFile: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = () => {
      try {
        // Set canvas size
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Apply preprocessing: Grayscale + Contrast Enhancement + Noise Reduction
        for (let i = 0; i < data.length; i += 4) {
          // Convert to grayscale using luminance formula
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          
          // Enhance contrast (increase difference between light and dark)
          let enhanced = gray;
          if (gray < 128) {
            // Darken dark pixels
            enhanced = Math.max(0, gray - 20);
          } else {
            // Lighten light pixels
            enhanced = Math.min(255, gray + 20);
          }
          
          // Apply threshold to make text sharper (binary threshold)
          const threshold = 128;
          const binary = enhanced > threshold ? 255 : 0;
          
          // Set RGB to grayscale value
          data[i] = binary;     // R
          data[i + 1] = binary; // G
          data[i + 2] = binary; // B
          // Alpha stays the same
        }
        
        // Put processed image data back
        ctx.putImageData(imageData, 0, 0);
        
        // Convert to blob and then to file
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to process image'));
            return;
          }
          
          // Convert blob to data URL
    const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read processed image'));
          reader.readAsDataURL(blob);
        }, 'image/png');
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(imageFile);
  });
};

// Extract text from image using Tesseract.js with optimal settings
export const extractTextFromImage = async (imageFile: File): Promise<string> => {
  let worker: any = null;
  try {
    console.log('🔍 Starting high-accuracy OCR extraction...');
    
    // Preprocess image for better OCR accuracy
    console.log('🖼️ Preprocessing image (grayscale, contrast, threshold)...');
    const processedImageDataUrl = await preprocessImage(imageFile);
    
    // Convert data URL back to File/Blob for Tesseract
    const response = await fetch(processedImageDataUrl);
    const blob = await response.blob();
    const processedFile = new File([blob], imageFile.name, { type: 'image/png' });
    
    // Create worker with optimal settings for business cards
    worker = await createWorker('eng', 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    
    console.log('✅ Tesseract worker created');
    
    // Set optimal parameters for business card OCR
    // PSM 6 = Assume a single uniform block of text (best for business cards)
    // PSM 11 = Sparse text (alternative if 6 doesn't work well)
    await worker.setParameters({
      tessedit_pageseg_mode: '6', // Uniform text block
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.-+()/:, ', // Common characters
    });
    
    console.log('🔍 Recognizing text with optimized settings...');
    
    // Perform OCR on preprocessed image
    const { data: { text } } = await worker.recognize(processedFile);
    
    // If first attempt yields poor results, try with different PSM mode
    let finalText = text.trim();
    if (!finalText || finalText.length < 10) {
      console.log('⚠️ First OCR attempt yielded poor results, trying alternative mode...');
      await worker.setParameters({
        tessedit_pageseg_mode: '11', // Sparse text
      });
      const retryResult = await worker.recognize(processedFile);
      if (retryResult.data.text && retryResult.data.text.length > finalText.length) {
        finalText = retryResult.data.text.trim();
        console.log('✅ Retry with alternative mode improved results');
      }
    }
    
    if (!finalText || finalText.length === 0) {
      throw new Error('No text could be extracted from the image. Please ensure the image is clear and contains readable text.');
    }
    
    // Post-process text to fix common OCR errors
    finalText = fixCommonOCRErrors(finalText);
    
    console.log('✅ OCR extraction completed');
    return finalText;
  } catch (error) {
    console.error('❌ Error extracting text from image:', error);
    
    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('worker') || error.message.includes('load') || error.message.includes('fetch')) {
        throw new Error('Failed to load OCR engine. Please check your internet connection and try again.');
      }
      if (error.message.includes('language') || error.message.includes('eng') || error.message.includes('traineddata')) {
        throw new Error('Failed to load OCR language data. Please check your internet connection and refresh the page.');
      }
      if (error.message.includes('No text')) {
        throw error;
      }
      throw new Error(`OCR Error: ${error.message}`);
    }
    throw new Error('Failed to extract text from image. Please ensure the image is clear and contains readable text.');
  } finally {
    // Always terminate worker to free resources
    if (worker) {
      try {
        await worker.terminate();
        console.log('✅ Worker terminated');
      } catch (terminateError) {
        console.warn('⚠️ Error terminating worker:', terminateError);
      }
    }
  }
};

// Fix common OCR errors
const fixCommonOCRErrors = (text: string): string => {
  let fixed = text;
  
  // Fix common character misrecognitions
  // Fix rn -> m (common OCR error in words)
  fixed = fixed.replace(/rn(?=[a-z])/gi, 'm');
  
  // Fix vv -> w
  fixed = fixed.replace(/vv/gi, 'w');
  
  // Fix cl -> d (in certain contexts)
  fixed = fixed.replace(/cl(?=[a-z])/gi, 'd');
  
  // Fix spacing issues
  fixed = fixed.replace(/\s+/g, ' '); // Multiple spaces to single
  fixed = fixed.replace(/([a-z])([A-Z])/g, '$1 $2'); // Add space between lowercase and uppercase
  
  // Fix common number/letter confusions in context
  // This is done more carefully to avoid breaking valid text
  fixed = fixed.replace(/\b([A-Z])[|1]([a-z])/g, '$1I$2'); // | or 1 between letters -> I
  
  return fixed.trim();
};

// Parse extracted text to structured lead data with enhanced parsing
export const parseLeadDataFromText = async (extractedText: string): Promise<ExtractedLeadData> => {
  return parseLeadDataAdvanced(extractedText);
};

// Advanced parsing with better pattern matching
const parseLeadDataAdvanced = (text: string): ExtractedLeadData => {
  const data: ExtractedLeadData = {};

  // Preserve original text with line breaks for better parsing
  const originalLines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Clean text for pattern matching (single spaces)
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const lines = originalLines;
  
  console.log('📝 Parsing text with', lines.length, 'lines');

  // Extract email (most reliable)
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i;
  const emailMatch = cleanText.match(emailPattern);
  if (emailMatch) {
    data.email = emailMatch[0].toLowerCase();
    console.log('✅ Found email:', data.email);
  }

  // Extract phone numbers with improved patterns
  const phonePatterns = [
    /\b\+?91[\s\-]?[6-9]\d{9}\b/g,                    // +91 format
    /\b\+?91[\s\-]?\d{2}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, // +91 XX XXXX XXXX
    /\b[6-9]\d{9}\b/g,                                 // 10 digits starting with 6-9
    /\b\d{2}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,             // XX XXXX XXXX
    /\b\d{10}\b/g,                                     // Any 10 digits
    /\b\+?1[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}\b/g, // US format
  ];
  
  const phoneNumbers: string[] = [];
  phonePatterns.forEach(pattern => {
    const matches = cleanText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const digits = match.replace(/\D/g, '');
        if (digits.length >= 10) {
          const phone = digits.slice(-10); // Take last 10 digits
          // Validate Indian phone number (should start with 6-9)
          if (phone.match(/^[6-9]\d{9}$/)) {
            if (!phoneNumbers.includes(phone)) {
              phoneNumbers.push(phone);
            }
          }
        }
      });
    }
  });
  
  // Also check individual lines for phone numbers
  lines.forEach(line => {
    const linePhones = line.match(/\b[6-9]\d{9}\b/g);
    if (linePhones) {
      linePhones.forEach(phone => {
        if (!phoneNumbers.includes(phone)) {
          phoneNumbers.push(phone);
        }
      });
    }
  });

  if (phoneNumbers.length > 0) {
    data.phone = phoneNumbers[0];
    if (phoneNumbers.length > 1) {
      data.alternateMobile = phoneNumbers[1];
    }
    console.log('✅ Found phone:', data.phone);
  }

  // Extract website URLs
  const urlPatterns = [
    /(https?:\/\/[^\s]+)/gi,
    /(www\.[^\s]+)/gi,
    /\b([a-z0-9-]+\.(com|net|org|in|co\.in|io|edu|gov|co|us|uk)[^\s]*)/gi
  ];
  
  for (const pattern of urlPatterns) {
    const urlMatch = cleanText.match(pattern);
  if (urlMatch) {
      let url = urlMatch[0].trim().replace(/[.,;]+$/, ''); // Remove trailing punctuation
      if (!url.startsWith('http')) {
        url = `https://${url}`;
      }
      data.websiteLink = url;
      console.log('✅ Found website:', data.websiteLink);
      break;
    }
  }

  // Extract company/agency name (improved logic)
  const businessKeywords = /(Pvt|Ltd|Limited|Inc|Incorporated|LLC|Corp|Corporation|Agency|Travel|Solutions|Services|Group|Company|Consultancy|Consulting|Enterprises|International|Global)/i;
  
  // Strategy 1: Look for line with business keywords
  let companyLine = lines.find(line => businessKeywords.test(line));
  
  // Strategy 2: First substantial line (not email, phone, or address-like)
  if (!companyLine) {
    for (const line of lines.slice(0, 5)) {
      // Skip if it's clearly not a company name
      if (emailMatch && line.includes(emailMatch[0])) continue;
      if (phoneNumbers.some(p => line.includes(p))) continue;
      if (line.match(/^\d+/) && line.length < 20) continue; // Likely address number
      if (line.match(/^(Ph|Tel|Mobile|Email|E-mail|Web|www)/i)) continue; // Labels
      
      // Good candidate if it has reasonable length and capitalization
      if (line.length > 5 && line.length < 60) {
        // Check if it starts with capital letter(s)
        if (line.match(/^[A-Z]/)) {
          companyLine = line;
          break;
        }
      }
    }
  }
  
  // Strategy 3: First line as fallback
  if (!companyLine && lines.length > 0) {
    const firstLine = lines[0];
    if (!firstLine.includes('@') && !phoneNumbers.some(p => firstLine.includes(p)) && firstLine.length > 3) {
      companyLine = firstLine;
    }
  }
  
  if (companyLine) {
    // Clean up company name
    data.agencyName = companyLine
      .replace(/^(Company|Firm|Agency|Business):?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    console.log('✅ Found company name:', data.agencyName);
  }

  // Extract person name (improved)
  const namePatterns = [
    /(?:Mr|Mrs|Ms|Miss|Dr|Prof|Shri|Shrimati)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)$/m,
  ];
  
  for (const pattern of namePatterns) {
    const nameMatch = text.match(pattern);
    if (nameMatch) {
      const name = (nameMatch[1] || nameMatch[0]).trim();
      // Validate it's not a company name
      if (!businessKeywords.test(name) && name.length < 50 && name.split(' ').length <= 4) {
        data.contactName = name;
        console.log('✅ Found contact name:', data.contactName);
        break;
      }
    }
  }
  
  // Fallback: Look for capitalized name patterns in first few lines
  if (!data.contactName) {
    for (const line of lines.slice(0, 4)) {
      const words = line.split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 2 && words.length <= 4) {
        // Check if all words start with capital letter
        const allCapitalized = words.every(w => /^[A-Z][a-z]+$/.test(w));
        if (allCapitalized && !businessKeywords.test(line) && !line.includes('@') && line.length < 40) {
          data.contactName = line;
          console.log('✅ Found contact name (fallback):', data.contactName);
          break;
        }
      }
    }
  }

  // Extract designation
  const designationKeywords = [
    /(Managing Director|General Manager|Sales Manager|Business Development Manager|Marketing Manager)/i,
    /(Director|Manager|CEO|CTO|CFO|President|Owner|Proprietor|Partner|Head|Lead|Executive|Officer|Coordinator|Representative|Consultant)/i,
  ];
  
  for (const pattern of designationKeywords) {
    const match = cleanText.match(pattern);
    if (match) {
      // Try to get full designation with context
      const matchIndex = cleanText.indexOf(match[0]);
      const context = cleanText.substring(Math.max(0, matchIndex - 40), matchIndex + match[0].length + 40);
      const fullDesignation = context.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Director|Manager|CEO|CTO|CFO|President|Owner|Proprietor|Partner|Head|Lead|Executive|Officer|Coordinator|Representative|Consultant))/i);
      if (fullDesignation) {
        data.pocDesignation = fullDesignation[0].trim();
        console.log('✅ Found designation:', data.pocDesignation);
        break;
      } else {
        data.pocDesignation = match[0].trim();
        console.log('✅ Found designation (short):', data.pocDesignation);
        break;
      }
    }
  }

  // Extract address (improved patterns)
  const addressPatterns = [
    /(SCO\s*\d+[^\n]*)/i,
    /(\d+[^\n]*(?:Floor|Sector|Street|Road|Avenue|Lane|Drive|Boulevard|Colony|Nagar|Area|Locality|Phase)[^\n]*)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*(?:Sector|Phase|Area)[^\n]*)/i,
  ];
  
  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match) {
      const address = match[0].trim();
      if (address.length > 10 && !address.includes('@') && address.length < 150) {
        data.address = address;
        console.log('✅ Found address:', data.address);
        break;
      }
    }
  }
  
  // Fallback: Look for lines with address indicators
  if (!data.address) {
    for (const line of lines) {
      if ((line.includes('Sector') || line.includes('Floor') || line.includes('Road') || line.includes('Street')) 
          && /\d/.test(line) && line.length > 10 && line.length < 100) {
        data.address = line;
        console.log('✅ Found address (fallback):', data.address);
        break;
      }
    }
  }

  // Extract city
  const cityMatch = cleanText.match(/\b(Mumbai|Delhi|Bangalore|Bengaluru|Chennai|Kolkata|Hyderabad|Pune|Ahmedabad|Jaipur|Surat|Lucknow|Kanpur|Nagpur|Indore|Thane|Bhopal|Visakhapatnam|Patna|Vadodara|Ghaziabad|Ludhiana|Agra|Nashik|Faridabad|Meerut|Rajkot|Varanasi|Srinagar|Amritsar|Dhanbad|Allahabad|Coimbatore|Jabalpur|Gwalior|Vijayawada|Jodhpur|Madurai|Raipur|Kota|Guwahati|Chandigarh|Solapur|Hubli|Bareilly|Moradabad|Gurgaon|Gurugram|Aligarh|Jalandhar|Tiruchirappalli|Bhubaneswar|Salem|Mysore|Warangal|Guntur|Bhiwandi|Saharanpur|Gorakhpur|Bikaner|Amravati|Noida|Jamshedpur|Bhilai|Cuttack|Firozabad|Kochi|Nellore|Bhavnagar|Dehradun|Durgapur|Asansol|Rourkela|Nanded|Kolhapur|Ajmer|Gulbarga|Jamnagar|Ujjain|Loni|Siliguri|Jhansi|Ulhasnagar|Jammu|Sangli-Miraj|Mangalore|Erode|Belgaum|Ambattur|Tirunelveli|Malegaon|Gaya|Jalgaon|Udaipur|Maheshtala|Tirupur|Davanagere|Kozhikode|Akola|Kurnool|Bokaro|Rajahmundry|Ballari|Agartala|Bhagalpur|Latur|Dhule|Korba|Bhilwara|Sagar|Hajipur|Jalna|Bhimavaram|Kadapa|Karnal|Bidar|Munger|Barasat|Rampur|Shivamogga|Ratlam|Modinagar|Durg|Shillong|Imphal|Hapur|Ranipet|Anantapur|Arrah|Karimnagar|Parbhani|Etawah|Bharatpur|Begusarai|New Delhi|Gandhinagar|Baranagar|Tumkur|Khammam|Ozhukarai|Bihar Sharif|Panipat|Darbhanga|Bally|Aizawl|Dewas|Ichalkaranji|Tiruvottiyur)\b/i);
  if (cityMatch) {
    data.city = cityMatch[0];
    console.log('✅ Found city:', data.city);
  }

  // Extract remarks (remaining text that doesn't match other patterns)
  const remarks: string[] = [];
  for (const line of lines) {
    // Skip if line matches other extracted data
    if (data.email && line.includes(data.email)) continue;
    if (data.phone && line.includes(data.phone)) continue;
    if (data.agencyName && line.toLowerCase().includes(data.agencyName.toLowerCase())) continue;
    if (data.contactName && line.includes(data.contactName)) continue;
    if (data.address && line.includes(data.address.substring(0, 10))) continue;
    if (data.websiteLink && line.includes(data.websiteLink)) continue;
    
    // Skip common labels
    if (line.match(/^(Ph|Tel|Mobile|Email|E-mail|Web|www|Address|City|State|Country)/i)) continue;
    
    // Add as remark if it's substantial text
    if (line.length > 5 && line.length < 100 && !line.match(/^\d+$/) && !line.match(/^[A-Z\s]+$/)) {
      remarks.push(line);
    }
  }
  
  if (remarks.length > 0) {
    data.remarks = remarks.join('; ');
  }

  console.log('📋 Final parsed data:', data);
  return data;
};

// Main function: Extract and parse lead data from image
export const extractLeadFromImage = async (imageFile: File): Promise<ExtractedLeadData> => {
  try {
    console.log('🚀 Starting high-accuracy OCR extraction process...');
    
    // Step 1: Extract text from image with preprocessing
    const extractedText = await extractTextFromImage(imageFile);
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text could be extracted from the image. Please ensure the image is clear and contains readable text.');
    }

    console.log('📝 Extracted text:', extractedText.substring(0, 300) + '...');

    // Step 2: Parse text to structured data with advanced parsing
    const leadData = await parseLeadDataAdvanced(extractedText);
    
    console.log('✅ OCR extraction completed successfully');
    return leadData;
  } catch (error) {
    console.error('❌ Error extracting lead from image:', error);
    throw error;
  }
};