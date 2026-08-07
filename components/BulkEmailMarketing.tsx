import React, { useState, useEffect, useMemo, useRef } from 'react';
import apiClient from '../services/apiClient';
import { getAllLeads } from '../services/leadsService';
import type { Lead } from '../types';
import { sendEmail } from '../services/emailService';
import { AGENT_CATEGORIES, LEAD_STATUSES, LEAD_SOURCES } from '../types';
import * as XLSX from 'xlsx';
import { normalizePhoneForWhatsApp, createWhatsAppUrl } from '../utils/whatsappUtils';

interface EmailTemplate {
  id?: string;
  name: string;
  subject: string;
  body: string;
  isSystemTemplate: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
  attachments?: Array<{
    name: string;
    data: string; // base64 encoded file data
    type: string; // MIME type
    size: number; // file size in bytes
  }>;
}

interface Campaign {
  id?: string;
  name: string;
  templateId: string;
  templateName: string;
  subject: string;
  body: string;
  filters: LeadFilters;
  scheduledDate?: string;
  scheduledTime?: string;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  recipientCount: number;
  createdBy: string;
  createdAt: any;
  sentAt?: any;
}

interface LeadFilters {
  categories?: string[];
  statuses?: string[];
  sources?: string[];
  followUpCount?: {
    min?: number;
    max?: number;
  };
  createdAtRange?: {
    start?: string;
    end?: string;
  };
  searchTerm?: string;
}

interface BulkEmailMarketingProps {
  currentUser: string;
  isAdmin: boolean;
}

// Image compression helper
const compressImage = (file: File, maxWidth: number = 1200, maxHeight: number = 1200, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Clean and format pasted HTML for email compatibility
const cleanPastedHtml = (html: string): string => {
  // Create a temporary div to parse and clean the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Remove problematic elements and attributes
  const elementsToRemove = ['script', 'style', 'meta', 'link', 'iframe', 'object', 'embed'];
  elementsToRemove.forEach(tag => {
    const elements = tempDiv.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });

  // Clean up all elements
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach((el: Element) => {
    // Remove problematic attributes but keep essential ones
    const allowedAttributes = ['href', 'src', 'alt', 'title', 'target', 'rel'];
    const attributesToRemove: string[] = [];
    
    Array.from(el.attributes).forEach(attr => {
      if (!allowedAttributes.includes(attr.name) && !attr.name.startsWith('data-')) {
        attributesToRemove.push(attr.name);
      }
    });
    
    attributesToRemove.forEach(attr => el.removeAttribute(attr));

    // Normalize block elements to paragraphs for better email compatibility
    const blockTags = ['div', 'section', 'article', 'aside'];
    if (blockTags.includes(el.tagName.toLowerCase())) {
      const p = document.createElement('p');
      p.innerHTML = el.innerHTML;
      // Preserve text alignment if it exists
      const textAlign = window.getComputedStyle(el as HTMLElement).textAlign;
      if (textAlign && textAlign !== 'start') {
        p.style.textAlign = textAlign;
      }
      // Preserve margin/padding for spacing
      const marginTop = window.getComputedStyle(el as HTMLElement).marginTop;
      const marginBottom = window.getComputedStyle(el as HTMLElement).marginBottom;
      if (marginTop && parseFloat(marginTop) > 0) {
        p.style.marginTop = marginTop;
      }
      if (marginBottom && parseFloat(marginBottom) > 0) {
        p.style.marginBottom = marginBottom;
      }
      el.replaceWith(p);
    }

    // Clean up inline styles - keep only email-safe styles
    if (el instanceof HTMLElement && el.style) {
      const cleanStyles: { [key: string]: string } = {};
      
      // Preserve text alignment
      if (el.style.textAlign) {
        cleanStyles.textAlign = el.style.textAlign;
      }
      
      // Preserve font weight (bold)
      if (el.style.fontWeight && (parseInt(el.style.fontWeight) >= 600 || el.style.fontWeight === 'bold')) {
        // Will be handled by <strong> or <b> tags
      }
      
      // Preserve font style (italic)
      if (el.style.fontStyle === 'italic') {
        // Will be handled by <em> or <i> tags
      }
      
      // Preserve text decoration (underline)
      if (el.style.textDecoration && el.style.textDecoration.includes('underline')) {
        // Will be handled by <u> tags
      }
      
      // Preserve color (but simplify)
      if (el.style.color && el.style.color !== 'rgb(0, 0, 0)' && el.style.color !== '#000000') {
        cleanStyles.color = el.style.color;
      }
      
      // Preserve background color for important elements
      if (el.style.backgroundColor && el.style.backgroundColor !== 'transparent' && el.style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        cleanStyles.backgroundColor = el.style.backgroundColor;
      }

      // Apply cleaned styles
      el.removeAttribute('style');
      if (Object.keys(cleanStyles).length > 0) {
        Object.entries(cleanStyles).forEach(([key, value]) => {
          el.style.setProperty(key, value);
        });
      }
    }

    // Normalize headings to strong + paragraph for better email compatibility
    const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    if (headingTags.includes(el.tagName.toLowerCase())) {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.innerHTML = el.innerHTML;
      p.appendChild(strong);
      p.style.fontSize = '1.2em';
      p.style.marginTop = '16px';
      p.style.marginBottom = '8px';
      el.replaceWith(p);
    }
  });

  // Clean up images - ensure they have proper styling
  const images = tempDiv.querySelectorAll('img');
  images.forEach(img => {
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';
    img.style.margin = '10px 0';
    // Remove width/height attributes that might cause issues
    img.removeAttribute('width');
    img.removeAttribute('height');
  });

  // Clean up links - ensure they open in new tab
  const links = tempDiv.querySelectorAll('a');
  links.forEach(link => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    // Remove problematic link styles
    link.style.color = '';
  });

  // Normalize line breaks and spacing
  let cleanedHtml = tempDiv.innerHTML;
  
  // Replace multiple consecutive <br> tags with paragraph breaks
  cleanedHtml = cleanedHtml.replace(/(<br\s*\/?>\s*){3,}/gi, '</p><p>');
  
  // Ensure proper paragraph structure
  cleanedHtml = cleanedHtml.replace(/<p>\s*<\/p>/gi, '');
  cleanedHtml = cleanedHtml.replace(/(<p>)([^<]+)(<\/p>)/gi, (match, open, content, close) => {
    // Don't wrap if it's already properly structured
    if (content.trim()) {
      return open + content.trim() + close;
    }
    return match;
  });

  // Remove empty paragraphs
  cleanedHtml = cleanedHtml.replace(/<p>\s*<\/p>/gi, '');
  
  // Clean up extra whitespace
  cleanedHtml = cleanedHtml.replace(/\s+/g, ' ');
  cleanedHtml = cleanedHtml.replace(/>\s+</g, '><');
  
  // Ensure proper spacing between elements
  cleanedHtml = cleanedHtml.replace(/<\/p><p>/gi, '</p>\n<p>');
  cleanedHtml = cleanedHtml.replace(/<\/div><div/gi, '</div>\n<div');
  
  return cleanedHtml.trim();
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const plainTextToHtml = (text: string): string =>
  escapeHtml(text).replace(/\n/g, '<br>');

const ensureHttpUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const BulkEmailMarketing: React.FC<BulkEmailMarketingProps> = ({ currentUser, isAdmin }) => {
  const [activeTab, setActiveTab] = useState<'compose' | 'templates' | 'campaigns'>('compose');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  
  // Compose state
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailBodyIsHtml, setEmailBodyIsHtml] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [filters, setFilters] = useState<LeadFilters>({});
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Template management state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [templateIsHtml, setTemplateIsHtml] = useState(true);
  const [templateBodySize, setTemplateBodySize] = useState(0);
  const [templateAttachments, setTemplateAttachments] = useState<Array<{
    name: string;
    data: string;
    type: string;
    size: number;
  }>>([]);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const emailEditorRef = useRef<HTMLDivElement | null>(null);
  const templateEditorRef = useRef<HTMLDivElement | null>(null);
  const emailPreviewHtml = useMemo(
    () => (emailBodyIsHtml ? cleanPastedHtml(emailBody || '') : plainTextToHtml(emailBody || '')),
    [emailBody, emailBodyIsHtml]
  );
  const templatePreviewHtml = useMemo(
    () => (templateIsHtml ? cleanPastedHtml(templateBody || '') : plainTextToHtml(templateBody || '')),
    [templateBody, templateIsHtml]
  );
  const insertHtmlSnippet = (
    editorRef: React.RefObject<HTMLDivElement>,
    setter: (html: string) => void,
    html: string
  ) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand('insertHTML', false, html);
    setTimeout(() => {
      setter(editor.innerHTML);
    }, 0);
  };

  const execEmailCommand = (command: string, value?: string) => {
    const editor = emailEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, value);
    setTimeout(() => setEmailBody(editor.innerHTML), 0);
  };

  const execTemplateCommand = (command: string, value?: string) => {
    const editor = templateEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, value);
    setTimeout(() => setTemplateBody(editor.innerHTML), 0);
  };

  const handleInsertImageFromDevice = (
    editorRef: React.RefObject<HTMLDivElement>,
    setter: (html: string) => void
  ) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      if (file.size > 10 * 1024 * 1024) {
        alert('❌ Image too large! Maximum size is 10MB. Please compress the image and try again.');
        return;
      }

      try {
        const compressedBase64 = await compressImage(file, 1200, 1200, 0.75);
        const html = `<img src="${compressedBase64}" alt="" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:8px;" />`;
        insertHtmlSnippet(editorRef, setter, html);
      } catch (error) {
        console.error('Error inserting image:', error);
        alert('Failed to insert image. Please try again with a different file.');
      } finally {
        target.value = '';
      }
    };
    input.click();
  };

  const handleInsertImageByUrl = (
    editorRef: React.RefObject<HTMLDivElement>,
    setter: (html: string) => void
  ) => {
    const rawUrl = prompt('Enter image URL (https://...):', 'https://');
    if (!rawUrl) return;
    const url = ensureHttpUrl(rawUrl);
    const altText = prompt('Optional: image alt text (displayed if image fails to load):', '') || '';
    const html = `<img src="${url}" alt="${escapeHtml(altText)}" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:8px;" />`;
    insertHtmlSnippet(editorRef, setter, html);
  };

  const handleInsertVideoLink = (
    editorRef: React.RefObject<HTMLDivElement>,
    setter: (html: string) => void
  ) => {
    const rawUrl = prompt('Enter video link (YouTube, Vimeo, Loom, etc.):', 'https://');
    if (!rawUrl) return;
    const url = ensureHttpUrl(rawUrl);
    const thumbnail = prompt('Optional: thumbnail image URL (leave blank to use a button):', '');

    let snippet = '';
    if (thumbnail) {
      const thumbUrl = ensureHttpUrl(thumbnail);
      snippet = `
        <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;">
          <img src="${thumbUrl}" alt="Video preview" style="max-width:100%;height:auto;border-radius:12px;display:block;margin:12px auto;" />
          <div style="text-align:center;margin-top:8px;">
            <span style="display:inline-block;padding:12px 20px;background-color:#4F46E5;color:#ffffff;border-radius:9999px;font-weight:600;">
              ▶ Watch Video
            </span>
          </div>
        </a>
      `;
    } else {
      snippet = `
        <a href="${url}" target="_blank" rel="noopener noreferrer"
          style="display:inline-block;padding:12px 20px;background-color:#4F46E5;color:#ffffff;border-radius:9999px;
          text-decoration:none;font-weight:600;">
          🎬 Watch Video
        </a>
      `;
    }
    insertHtmlSnippet(editorRef, setter, snippet);
  };

  const convertFilesToBase64 = async (files: File[]) =>
    Promise.all(
      files.map(
        (file) =>
          new Promise<{ name: string; url: string; type: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                name: file.name,
                url: reader.result as string,
                type: file.type || 'application/octet-stream'
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    );

  const buildHtmlBodyForSending = (body: string, isHtml: boolean) =>
    isHtml ? body : plainTextToHtml(body || '');

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  
  // Filtering helpers
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [showSourceFilter, setShowSourceFilter] = useState(false);
  const [showFollowUpFilter, setShowFollowUpFilter] = useState(false);
  const [showDateRangeFilter, setShowDateRangeFilter] = useState(false);
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [followUpMin, setFollowUpMin] = useState('');
  const [followUpMax, setFollowUpMax] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  
  // Manual lead selection
  const [manualLeadSelection, setManualLeadSelection] = useState<string[]>([]);
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [showLeadSelector, setShowLeadSelector] = useState(false);
  
  // WhatsApp modal state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppNumbers, setWhatsAppNumbers] = useState<Array<{phone: string, leadName: string, contactName: string}>>([]);

  useEffect(() => {
    loadTemplates();
    loadCampaigns();
    loadLeads();
  }, [currentUser]);

  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        setEmailSubject(template.subject);
        setEmailBody(template.body);
      setEmailBodyIsHtml(true);
      }
  } else {
    setEmailBodyIsHtml(true);
    }
  }, [selectedTemplate, templates]);

useEffect(() => {
  if (emailBodyIsHtml && emailEditorRef.current && emailEditorRef.current.innerHTML !== (emailBody || '')) {
    emailEditorRef.current.innerHTML = emailBody || '';
  }
}, [emailBody, emailBodyIsHtml]);

useEffect(() => {
  if (templateIsHtml && templateEditorRef.current && templateEditorRef.current.innerHTML !== (templateBody || '')) {
    templateEditorRef.current.innerHTML = templateBody || '';
  }
}, [templateBody, templateIsHtml]);

  // Calculate template body size
  useEffect(() => {
    const sizeInBytes = new Blob([templateBody]).size;
    setTemplateBodySize(sizeInBytes);
  }, [templateBody]);

  const loadTemplates = async () => {
    try {
      const { data } = await apiClient.get('/email-templates');
      const rows = Array.isArray(data) ? data : [];
      const allTemplatesList: EmailTemplate[] = rows.map((row: any) => {
        const rawAttachments = row.attachments;
        const attachments = Array.isArray(rawAttachments)
          ? rawAttachments
          : typeof rawAttachments === 'string' && rawAttachments.trim()
            ? (() => { try { const p = JSON.parse(rawAttachments); return Array.isArray(p) ? p : []; } catch { return []; } })()
            : [];
        return {
          id: row.id ?? row.firebase_id,
          name: row.name ?? '',
          subject: row.subject ?? '',
          body: row.body ?? row.body_html ?? row.body_text ?? '',
          isSystemTemplate: !!row.is_system_template || !!row.isSystemTemplate,
          createdBy: row.created_by ?? row.createdBy ?? '',
          createdAt: row.created_at ?? row.createdAt,
          updatedAt: row.updated_at ?? row.updatedAt,
          attachments,
        };
      }) as EmailTemplate[];
      allTemplatesList.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toMillis?.() ?? new Date(a.createdAt || 0).getTime();
        const bTime = (b.createdAt as any)?.toMillis?.() ?? new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setTemplates(allTemplatesList);
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplates([]);
    }
  };

  const loadCampaigns = async () => {
    try {
      const { data } = await apiClient.get('/email-campaigns');
      const rows = Array.isArray(data) ? data : [];
      let allCampaigns: Campaign[] = rows
        .filter((row: any) => (row.created_by ?? row.createdBy) === currentUser)
        .map((row: any) => ({
          id: row.id ?? row.firebase_id,
          name: row.name ?? '',
          templateId: row.template_id ?? row.templateId ?? '',
          templateName: row.template_name ?? row.templateName ?? '',
          subject: row.subject ?? '',
          body: row.body ?? '',
          filters: row.filters ?? {},
          scheduledDate: row.scheduled_date ?? row.scheduledDate,
          scheduledTime: row.scheduled_time ?? row.scheduledTime,
          status: row.status ?? 'draft',
          recipientCount: row.recipient_count ?? row.recipientCount ?? 0,
          createdBy: row.created_by ?? row.createdBy ?? '',
          createdAt: row.created_at ?? row.createdAt,
          sentAt: row.sent_at ?? row.sentAt,
        })) as Campaign[];
      allCampaigns.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toMillis?.() ?? new Date(a.createdAt || 0).getTime();
        const bTime = (b.createdAt as any)?.toMillis?.() ?? new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setCampaigns(allCampaigns);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      setCampaigns([]);
    }
  };

  const loadLeads = async () => {
    try {
      const allLeads = await getAllLeads();
      setLeads(allLeads);
    } catch (error) {
      console.error('Error loading leads:', error);
    }
  };

  const applyFilters = () => {
    const newFilters: LeadFilters = {};
    
    if (selectedCategories.length > 0) newFilters.categories = selectedCategories;
    if (selectedStatuses.length > 0) newFilters.statuses = selectedStatuses;
    if (selectedSources.length > 0) newFilters.sources = selectedSources;
    if (followUpMin || followUpMax) {
      newFilters.followUpCount = {};
      if (followUpMin) newFilters.followUpCount.min = parseInt(followUpMin);
      if (followUpMax) newFilters.followUpCount.max = parseInt(followUpMax);
    }
    if (dateRangeStart || dateRangeEnd) {
      newFilters.createdAtRange = {};
      if (dateRangeStart) newFilters.createdAtRange.start = dateRangeStart;
      if (dateRangeEnd) newFilters.createdAtRange.end = dateRangeEnd;
    }
    
    setFilters(newFilters);
  };

  const getFilteredLeads = () => {
    // 🟢 SAFE FIX: Robust filtering to prevent crashes
    let filtered = leads.filter(lead => {
      // Create safe accessors
      const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
      const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];

      // First, check if user owns this lead (skip for admins)
      if (!isAdmin && currentUser) {
        // Case-insensitive comparison
        const normalizeEmail = (email: string) => email?.toLowerCase().trim();
        const currentUserNormalized = normalizeEmail(currentUser);
        
        // Check if user is account manager, sales person, or creator
        const isAccountManager = normalizeEmail(lead.accountManager || '') === currentUserNormalized;
        const isSalesPerson = normalizeEmail(lead.salesPerson || '') === currentUserNormalized;
        const isCreator = normalizeEmail(lead.createdBy || '') === currentUserNormalized;
        
        // Check if user has follow-ups assigned to them
        const hasAssignedFollowUps = safeFollowUps.some(followUp => 
          normalizeEmail(followUp.assignedTo || '') === currentUserNormalized ||
          normalizeEmail(followUp.createdBy || '') === currentUserNormalized
        );
        
        const ownsLead = isAccountManager || isSalesPerson || isCreator || hasAssignedFollowUps;
        
        // User can only send emails to leads they own
        if (!ownsLead) return false;
      }
      
      // Must have email to send - Check safeContacts
      if (safeContacts.length === 0 || !safeContacts[0]?.email) return false;
      
      // Apply category filter
      if (filters.categories && filters.categories.length > 0) {
        if (!lead.agentCategory || !filters.categories.includes(lead.agentCategory)) return false;
      }
      
      // Apply status filter
      if (filters.statuses && filters.statuses.length > 0) {
        if (!lead.status || !filters.statuses.includes(lead.status)) return false;
      }
      
      // Apply source filter
      if (filters.sources && filters.sources.length > 0) {
        if (!lead.leadSource || !filters.sources.includes(lead.leadSource)) return false;
      }
      
      // Apply follow-up count filter
      if (filters.followUpCount) {
        const followUpCount = safeFollowUps.length;
        if (filters.followUpCount.min !== undefined && followUpCount < filters.followUpCount.min) return false;
        if (filters.followUpCount.max !== undefined && followUpCount > filters.followUpCount.max) return false;
      }
      
      // Apply date range filter
      if (filters.createdAtRange) {
        const leadDate = new Date(lead.createdAt);
        if (filters.createdAtRange.start && leadDate < new Date(filters.createdAtRange.start)) return false;
        if (filters.createdAtRange.end && leadDate > new Date(filters.createdAtRange.end)) return false;
      }
      
      return true;
    });
    
    // If manual selection is active, filter by selected IDs
    if (manualLeadSelection.length > 0) {
      filtered = filtered.filter(lead => manualLeadSelection.includes(lead.id));
    }
    
    return filtered;
  };
  
  const getLeadsForSelector = () => {
    return leads.filter(lead => {
      const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
      const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];

      // Must have email to send
      if (safeContacts.length === 0 || !safeContacts[0]?.email) return false;
      
      // Check if user owns this lead (skip for admins)
      if (!isAdmin && currentUser) {
        const normalizeEmail = (email: string) => email?.toLowerCase().trim();
        const currentUserNormalized = normalizeEmail(currentUser);
        const isAccountManager = normalizeEmail(lead.accountManager || '') === currentUserNormalized;
        const isSalesPerson = normalizeEmail(lead.salesPerson || '') === currentUserNormalized;
        const isCreator = normalizeEmail(lead.createdBy || '') === currentUserNormalized;
        const hasAssignedFollowUps = safeFollowUps.some(followUp => 
          normalizeEmail(followUp.assignedTo || '') === currentUserNormalized ||
          normalizeEmail(followUp.createdBy || '') === currentUserNormalized
        );
        return isAccountManager || isSalesPerson || isCreator || hasAssignedFollowUps;
      }
      return true;
    }).filter(lead => {
      // Apply search term
      if (!leadSearchTerm) return true;
      const searchLower = leadSearchTerm.toLowerCase();
      const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
      
      return (
        lead.agencyName?.toLowerCase().includes(searchLower) ||
        safeContacts[0]?.name?.toLowerCase().includes(searchLower) ||
        safeContacts[0]?.email?.toLowerCase().includes(searchLower) ||
        lead.phone?.includes(leadSearchTerm)
      );
    });
  };

  const handleSaveTemplate = async () => {
    if (!templateName || !templateSubject || !templateBody) {
      alert('Please fill in all template fields');
      return;
    }

    // Check size limit (Firestore max is ~1MB per document, but we need to account for all data)
    const MAX_SIZE = 950 * 1024; // 950KB for body + metadata to stay safe
    const bodySizeInBytes = new Blob([templateBody]).size;
    // Base64 data is ~33% larger than original, but we'll use the string length for calculation
    const attachmentsSize = templateAttachments.reduce((sum, att) => {
      // Base64 string length is approximately the encoded size
      return sum + att.data.length;
    }, 0);
    const totalSize = bodySizeInBytes + attachmentsSize;
    
    // Check body size
    if (bodySizeInBytes > MAX_SIZE) {
      const sizeInMB = (bodySizeInBytes / 1024 / 1024).toFixed(2);
      alert(`❌ Template body too large! Size: ${sizeInMB}MB\nMaximum allowed: 0.95MB\n\nPlease reduce images or text content.`);
      return;
    }

    // Warn if total size (body + attachments) is getting large
    if (totalSize > 900 * 1024) {
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
      if (!confirm(`⚠️ Template size is large (${totalSizeMB}MB). Saving may fail if it exceeds Firestore limits.\n\nContinue anyway?`)) {
        return;
      }
    }

    try {
      // Normalize currentUser to ensure consistency
      const normalizeUser = (user: string): string => {
        if (!user) return '';
        try {
          // If it's a JSON string, parse it
          if (user.startsWith('{')) {
            const parsed = JSON.parse(user);
            return parsed.email || parsed.id || user;
          }
          // Return normalized string
          return user.toLowerCase().trim();
        } catch {
          return user.toLowerCase().trim();
        }
      };

      const normalizedUser = normalizeUser(currentUser);
      console.log('💾 Saving template for user:', normalizedUser, '(original:', currentUser, ')');

      const templateData: Omit<EmailTemplate, 'id'> = {
        name: templateName,
        subject: templateSubject,
        body: templateBody,
        isSystemTemplate: false,
        createdBy: normalizedUser,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachments: templateAttachments.length > 0 ? templateAttachments : undefined
      };

      if (editingTemplate?.id) {
        const templateId = String(editingTemplate.id).trim();
        if (!templateId) {
          alert('Cannot update: template has no id. Try creating a new template instead.');
          return;
        }
        await apiClient.put('/email-templates/' + encodeURIComponent(templateId), { ...templateData, updatedAt: new Date().toISOString() });
        alert('Template updated successfully!');
      } else {
        await apiClient.post('/email-templates', templateData);
        alert('Template created successfully!');
      }

      setIsTemplateModalOpen(false);
      setEditingTemplate(null);
      setTemplateName('');
      setTemplateSubject('');
      setTemplateBody('');
      setTemplateIsHtml(true);
      setTemplateAttachments([]);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to save template: ${errorMessage}`);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const id = String(templateId ?? '').trim();
      if (!id) {
        alert('Cannot delete: template has no id.');
        return;
      }
      await apiClient.delete('/email-templates/' + encodeURIComponent(id));
      loadTemplates();
      alert('Template deleted successfully!');
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateSubject(template.subject);
    setTemplateBody(template.body);
    setTemplateIsHtml(true);
    setTemplateAttachments(template.attachments || []);
    setIsTemplateModalOpen(true);
  };


  const handleOpenWhatsApp = () => {
    const filteredLeads = getFilteredLeads();
    if (filteredLeads.length === 0) {
      alert('No leads match your filters. Please adjust your filters.');
      return;
    }

    // Get all phone numbers from filtered leads
    const phoneNumbers: Array<{phone: string, leadName: string, contactName: string}> = [];
    
    filteredLeads.forEach(lead => {
      // 🟢 SAFE FIX: Contacts check
      const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
      const firstContact = safeContacts[0] || {};
      
      const phone = firstContact.phone || lead.phone || '';
      
      if (phone && phone.trim()) {
        const normalized = normalizePhoneForWhatsApp(phone);
        if (normalized) {
          phoneNumbers.push({
            phone: normalized,
            leadName: lead.agencyName || 'Unknown',
            contactName: firstContact.name || ''
          });
        }
      }
    });

    if (phoneNumbers.length === 0) {
      alert('No valid phone numbers found in selected leads.');
      return;
    }

    // Remove duplicates based on phone number
    const uniqueNumbers = phoneNumbers.filter((item, index, self) =>
      index === self.findIndex(t => t.phone === item.phone)
    );

    setWhatsAppNumbers(uniqueNumbers);
    setShowWhatsAppModal(true);
  };

  const handleOpenWhatsAppChat = (phone: string, message?: string) => {
    try {
      // Clean email body for WhatsApp message if no message provided
      let cleanMessage = message || emailBody || '';
      if (!message && emailBodyIsHtml) {
        cleanMessage = cleanMessage.replace(/<[^>]*>/g, '');
        const textarea = document.createElement('textarea');
        textarea.innerHTML = cleanMessage;
        cleanMessage = textarea.value;
      }
      // Limit message length and clean newlines
      if (cleanMessage) {
        cleanMessage = cleanMessage.replace(/\n/g, ' ').substring(0, 1000);
      }
      const whatsappUrl = createWhatsAppUrl(phone, cleanMessage || undefined);
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Error creating WhatsApp URL:', error);
      alert('Invalid phone number. Please ensure the phone number has a valid format.');
    }
  };

  const handleOpenAllWhatsAppSequentially = () => {
    if (whatsAppNumbers.length === 0) return;
    
    const confirmMessage = `This will open ${whatsAppNumbers.length} WhatsApp chats in sequence.\n\nClick "OK" to start. A new chat will open every 2 seconds.\n\nYou can close the modal and continue in the background.`;
    if (!confirm(confirmMessage)) return;

    let index = 0;
    const openNext = () => {
      if (index < whatsAppNumbers.length) {
        const item = whatsAppNumbers[index];
        handleOpenWhatsAppChat(item.phone);
        index++;
        if (index < whatsAppNumbers.length) {
          setTimeout(openNext, 2000); // 2 second delay between opens
        }
      }
    };
    openNext();
  };

  const handleCopyAllNumbers = () => {
    const numbersText = whatsAppNumbers.map(item => `${item.leadName} - ${item.phone}`).join('\n');
    navigator.clipboard.writeText(numbersText).then(() => {
      alert(`✅ Copied ${whatsAppNumbers.length} phone numbers to clipboard!`);
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = numbersText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert(`✅ Copied ${whatsAppNumbers.length} phone numbers to clipboard!`);
    });
  };

  const handleOpenInGmail = async () => {
    const filteredLeads = getFilteredLeads();
    if (filteredLeads.length === 0) {
      alert('No leads match your filters. Please adjust your filters.');
      return;
    }

    // Get all emails from filtered leads
    const emails = filteredLeads
      .map(lead => {
         const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
         return safeContacts[0]?.email;
      })
      .filter((email): email is string => !!email && email.includes('@'));

    if (emails.length === 0) {
      alert('No valid email addresses found in selected leads.');
      return;
    }

    // Check if we have stored chunks from a previous batch
    const storedChunks = (window as any).gmailChunks as string[][] | undefined;
    const currentIndex = (window as any).currentChunkIndex as number | undefined || 0;
    
    let chunks: string[][];
    let chunkToOpen: string[];
    let chunkIndex: number;

    if (storedChunks && storedChunks.length > 0) {
      // Continue with next stored chunk
      chunks = storedChunks;
      chunkToOpen = storedChunks[0];
      chunkIndex = currentIndex;
      
      // Remove the chunk we're about to open from stored chunks
      (window as any).gmailChunks = storedChunks.slice(1);
      (window as any).currentChunkIndex = currentIndex + 1;
      
      const remaining = storedChunks.length - 1;
      if (remaining > 0) {
        const message = `Opening batch ${chunkIndex + 1} (${chunkToOpen.length} recipients)\n\n${remaining} batch(es) remaining after this.`;
        if (!confirm(message)) {
          // Restore the chunk we were about to open
          (window as any).gmailChunks = storedChunks;
          (window as any).currentChunkIndex = currentIndex;
          return;
        }
      }
    } else {
      // Start fresh - split into chunks of 50
      const CHUNK_SIZE = 50;
      chunks = [];
      
      for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
        chunks.push(emails.slice(i, i + CHUNK_SIZE));
      }

      chunkToOpen = chunks[0];
      chunkIndex = 0;

      // Store remaining chunks for next batch
      if (chunks.length > 1) {
        const message = `You have ${emails.length} leads selected.\n\nThis will be split into ${chunks.length} batches of up to 50 recipients each.\n\nGmail will open with the first batch (${chunkToOpen.length} recipients). After sending, click "Open in Gmail" again to open the next batch.`;
        
        if (!confirm(message)) return;

        (window as any).gmailChunks = chunks.slice(1);
        (window as any).currentChunkIndex = 1;
        (window as any).totalEmails = emails.length;
      }
    }

    // Clean email body - remove HTML tags and convert to plain text
    let cleanBody = emailBody || '';
    if (emailBodyIsHtml) {
      // Remove HTML tags
      cleanBody = cleanBody.replace(/<[^>]*>/g, '');
      // Decode HTML entities
      const textarea = document.createElement('textarea');
      textarea.innerHTML = cleanBody;
      cleanBody = textarea.value;
    }
    
    // Prepare Gmail URL
    const bccEmails = chunkToOpen.join(',');
    const subject = emailSubject ? encodeURIComponent(emailSubject) : '';
    
    // Encode full body (no truncation)
    const encodedBody = cleanBody ? encodeURIComponent(cleanBody) : '';
    
    // Build base URL without body first to check length
    const baseUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=cm&bcc=${encodeURIComponent(bccEmails)}${subject ? `&su=${subject}` : ''}`;
    
    // Gmail URL has practical limits (~2000 chars total), so we need to check
    // If URL would be too long, we'll copy body to clipboard and open with just subject
    const fullUrl = baseUrl + (encodedBody ? `&body=${encodedBody}` : '');
    const MAX_URL_LENGTH = 1800; // Safe limit for Gmail URLs
    
    if (fullUrl.length > MAX_URL_LENGTH && encodedBody) {
      // URL too long - copy body to clipboard and open with just subject
      try {
        await navigator.clipboard.writeText(cleanBody);
        const gmailUrl = baseUrl; // Open without body in URL
        const gmailWindow = window.open(gmailUrl, '_blank', 'noopener,noreferrer');
        
        if (!gmailWindow || gmailWindow.closed || typeof gmailWindow.closed === 'undefined') {
          window.location.href = gmailUrl;
        }
        
        setTimeout(() => {
          alert(`✅ Gmail opened!\n\n📋 Email body copied to clipboard (${cleanBody.length} characters).\n\nPlease paste (Ctrl+V or Cmd+V) in the Gmail compose window.`);
        }, 500);
      } catch (clipboardError) {
        // Fallback: still try to open with truncated body
        const truncatedBody = cleanBody.substring(0, 1500); // Truncate for URL
        const truncatedEncoded = encodeURIComponent(truncatedBody);
        const gmailUrl = `${baseUrl}&body=${truncatedEncoded}`;
        const gmailWindow = window.open(gmailUrl, '_blank', 'noopener,noreferrer');
        
        if (!gmailWindow || gmailWindow.closed || typeof gmailWindow.closed === 'undefined') {
          window.location.href = gmailUrl;
        }
        
        alert(`⚠️ Email body is very long. Only first ${truncatedBody.length} characters are pre-filled.\n\nFull body length: ${cleanBody.length} characters.\n\nPlease copy the full body from the compose window above if needed.`);
      }
    } else {
      // URL is fine - include full body
      const gmailUrl = fullUrl;
      const gmailWindow = window.open(gmailUrl, '_blank', 'noopener,noreferrer');
      
      if (!gmailWindow || gmailWindow.closed || typeof gmailWindow.closed === 'undefined') {
        window.location.href = gmailUrl;
      }
    }

    // Show notification about remaining chunks
    const remainingChunks = (window as any).gmailChunks as string[][] | undefined;
    if (remainingChunks && remainingChunks.length > 0) {
      const totalSent = ((window as any).currentChunkIndex as number) * 50;
      const total = (window as any).totalEmails as number || emails.length;
      const remaining = total - totalSent;
      
      setTimeout(() => {
        alert(`✅ Gmail opened with batch ${chunkIndex + 1} (${chunkToOpen.length} recipients)\n\n📊 Progress: ${Math.min(totalSent, total)}/${total} recipients\n📦 Remaining: ${remaining} recipients in ${remainingChunks.length} batch(es)\n\n💡 After sending this email, click "Open in Gmail" again to continue with the next batch.`);
      }, 500);
    } else if (chunks.length === 1 || (remainingChunks && remainingChunks.length === 0)) {
      // All chunks processed
      setTimeout(() => {
        alert(`✅ Gmail opened with all remaining recipients (${chunkToOpen.length})\n\n🎉 All batches processed!`);
      }, 500);
      // Clear stored data
      delete (window as any).gmailChunks;
      delete (window as any).currentChunkIndex;
      delete (window as any).totalEmails;
    }
  };

  const handleSendTestEmail = async () => {
    const trimmedEmail = testEmail.trim();
    if (!trimmedEmail) {
      alert('Enter an email address to send the test message.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      alert('The test email address looks invalid. Please double-check it.');
      return;
    }
    if (!emailSubject && !confirm('Subject line is empty. Send the test email without a subject?')) {
      return;
    }
    if (!emailBody) {
      alert('Email body is empty. Add content before sending a test email.');
      return;
    }

    setIsSendingTest(true);
    try {
      const attachmentsData = attachments.length > 0 ? await convertFilesToBase64(attachments) : [];
      const htmlBody = buildHtmlBodyForSending(emailBody, emailBodyIsHtml);
      const sent = await sendEmail({
        to: trimmedEmail,
        subject: emailSubject ? `[TEST] ${emailSubject}` : '[TEST] Email Preview',
        body: htmlBody,
        attachments: attachmentsData.length > 0 ? attachmentsData : undefined
      });
      if (sent) {
        alert(`✅ Test email sent to ${trimmedEmail}. Check your inbox (and spam folder).`);
      } else {
        alert('❌ Failed to send test email. Check email service configuration.');
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      alert('❌ Failed to send the test email. Please try again.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendEmails = async () => {
    if (!emailSubject || !emailBody) {
      alert('Please enter both subject and body');
      return;
    }

    const filteredLeads = getFilteredLeads();
    if (filteredLeads.length === 0) {
      alert('No leads match your filters. Please adjust your filters.');
      return;
    }

    if (!confirm(`Send email to ${filteredLeads.length} leads?`)) return;

    setIsSending(true);

    try {
      let successCount = 0;
      let failCount = 0;

      // Check campaign body size
      const campaignBodySize = new Blob([emailBody]).size;
      console.log('📊 Campaign body size:', campaignBodySize, 'bytes');
      
      if (campaignBodySize > 950 * 1024) {
        const sizeInMB = (campaignBodySize / 1024 / 1024).toFixed(2);
        alert(`❌ Campaign body too large! Size: ${sizeInMB}MB\nMaximum allowed: 0.95MB\n\nPlease reduce images or use smaller content.`);
        setIsSending(false);
        return;
      }

      // Save campaign
      const template = templates.find(t => t.id === selectedTemplate);
      
      // Clean filters object to remove undefined values
      const cleanFilters: any = {};
      if (filters.categories && filters.categories.length > 0) cleanFilters.categories = filters.categories;
      if (filters.statuses && filters.statuses.length > 0) cleanFilters.statuses = filters.statuses;
      if (filters.sources && filters.sources.length > 0) cleanFilters.sources = filters.sources;
      if (filters.followUpCount) {
        cleanFilters.followUpCount = {};
        if (filters.followUpCount.min !== undefined) cleanFilters.followUpCount.min = filters.followUpCount.min;
        if (filters.followUpCount.max !== undefined) cleanFilters.followUpCount.max = filters.followUpCount.max;
      }
      if (filters.createdAtRange) {
        cleanFilters.createdAtRange = {};
        if (filters.createdAtRange.start) cleanFilters.createdAtRange.start = filters.createdAtRange.start;
        if (filters.createdAtRange.end) cleanFilters.createdAtRange.end = filters.createdAtRange.end;
      }
      
      const campaignData: any = {
        name: emailSubject,
        templateId: selectedTemplate || '',
        templateName: template?.name || 'Custom',
        subject: emailSubject,
        body: emailBody,
        filters: cleanFilters,
        status: isScheduled ? 'scheduled' : 'sent',
        recipientCount: filteredLeads.length,
        createdBy: currentUser,
        createdAt: new Date().toISOString()
      };

      // Only add scheduled fields if actually scheduled
      if (isScheduled && scheduledDate) {
        campaignData.scheduledDate = scheduledDate;
      }
      if (isScheduled && scheduledTime) {
        campaignData.scheduledTime = scheduledTime;
      }
      if (!isScheduled) {
        campaignData.sentAt = new Date().toISOString();
      }

      const campaignRes = await apiClient.post('/email-campaigns', campaignData);
      const campaignId = (campaignRes.data as any)?.id ?? (campaignRes.data as any)?.firebase_id;

      // Convert attachments to base64 for sending
      const attachmentsData = await convertFilesToBase64(attachments);

      // Send emails with personalization
      for (const lead of filteredLeads) {
        try {
          // 🟢 SAFE FIX: Pre-calculate contact safely
          const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
          const firstContact = safeContacts[0] || {};

          // Replace placeholders with lead data
          let personalizedSubject = emailSubject;
          let personalizedBody = emailBody;

          // Common placeholders
          const contactName = firstContact.name || 'Valued Lead';
          const contactEmail = firstContact.email || '';
          const contactPhone = firstContact.phone || '';
          
          personalizedSubject = personalizedSubject.replace(/\{name\}/g, contactName);
          
          // Handle HTML or text body replacement
          if (emailBodyIsHtml) {
            // For HTML, replace in the HTML content
            personalizedBody = personalizedBody.replace(/\{name\}/g, contactName);
            personalizedBody = personalizedBody.replace(/\{phone\}/g, contactPhone);
            personalizedBody = personalizedBody.replace(/\{email\}/g, contactEmail);
            personalizedBody = personalizedBody.replace(/\{company\}/g, lead.agencyName || '');
            personalizedBody = personalizedBody.replace(/\{status\}/g, lead.status || '');
          } else {
            // For plain text
            personalizedBody = personalizedBody.replace(/\{name\}/g, contactName);
            personalizedBody = personalizedBody.replace(/\{phone\}/g, contactPhone);
            personalizedBody = personalizedBody.replace(/\{email\}/g, contactEmail);
            personalizedBody = personalizedBody.replace(/\{company\}/g, lead.agencyName || '');
            personalizedBody = personalizedBody.replace(/\{status\}/g, lead.status || '');
          }

          const emailResult = await sendEmail({
            to: contactEmail,
            subject: personalizedSubject,
            body: personalizedBody,
            attachments: attachmentsData.length > 0 ? attachmentsData : undefined
          });

          if (emailResult) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error('Error sending email to', lead.contacts?.[0]?.email, error);
          failCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('📊 Email sending complete:', { successCount, failCount });

      if (campaignId) {
        try {
          await apiClient.put('/email-campaigns/' + campaignId, { status: 'sent', sentAt: new Date().toISOString() });
        } catch (updateError) {
          console.error('Failed to update campaign status:', updateError);
        }
      }

      alert(`✅ Campaign sent!\nSuccess: ${successCount}\nFailed: ${failCount}`);
      loadCampaigns();
      setSelectedTemplate('');
      setEmailSubject('');
      setEmailBody('');
      setEmailBodyIsHtml(true);
      setAttachments([]);
      setFilters({});
      setSelectedCategories([]);
      setSelectedStatuses([]);
      setSelectedSources([]);
    } catch (error) {
      console.error('❌ Error sending campaign:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorMessage);
      alert(`Failed to send campaign: ${errorMessage}\n\nPlease check the console for details.`);
    } finally {
      setIsSending(false);
    }
  };

  const filteredLeads = getFilteredLeads();

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">📧 Bulk Email Marketing</h1>
          <p className="text-slate-600">Create, send, and track email campaigns to your leads</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="border-b border-slate-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('compose')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'compose'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                ✏️ Compose
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'templates'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                📝 Templates
              </button>
              <button
                onClick={() => setActiveTab('campaigns')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'campaigns'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                📊 Campaigns
              </button>
            </nav>
          </div>
        </div>

        {/* Compose Tab */}
        {activeTab === 'compose' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Filters Panel */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4">🔍 Filter Leads</h2>
                
                {/* Template Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    📋 Select Template
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option value="">Custom (No Template)</option>
                    {templates.length === 0 ? (
                      <option disabled>No templates available - Click Refresh</option>
                    ) : (
                      templates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))
                    )}
                  </select>
                  {templates.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {templates.length} template{templates.length !== 1 ? 's' : ''} available
                    </p>
                  )}
                </div>

                {/* Category Filter */}
                <div className="mb-4">
                  <button
                    onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                    className="w-full text-left flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-sm font-semibold text-slate-700"
                  >
                    <span>🏷️ Category</span>
                    <span>{showCategoryFilter ? '▲' : '▼'}</span>
                  </button>
                  {showCategoryFilter && (
                    <div className="mt-2 space-y-2 pl-3">
                      {AGENT_CATEGORIES.map(cat => (
                        <label key={cat} className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories([...selectedCategories, cat]);
                              } else {
                                setSelectedCategories(selectedCategories.filter(c => c !== cat));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          {cat}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status Filter */}
                <div className="mb-4">
                  <button
                    onClick={() => setShowStatusFilter(!showStatusFilter)}
                    className="w-full text-left flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-sm font-semibold text-slate-700"
                  >
                    <span>📊 Status</span>
                    <span>{showStatusFilter ? '▲' : '▼'}</span>
                  </button>
                  {showStatusFilter && (
                    <div className="mt-2 space-y-2 pl-3 max-h-48 overflow-y-auto">
                      {LEAD_STATUSES.map(status => (
                        <label key={status} className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedStatuses.includes(status)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStatuses([...selectedStatuses, status]);
                              } else {
                                setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          {status}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Source Filter */}
                <div className="mb-4">
                  <button
                    onClick={() => setShowSourceFilter(!showSourceFilter)}
                    className="w-full text-left flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-sm font-semibold text-slate-700"
                  >
                    <span>🔍 Source</span>
                    <span>{showSourceFilter ? '▲' : '▼'}</span>
                  </button>
                  {showSourceFilter && (
                    <div className="mt-2 space-y-2 pl-3">
                      {LEAD_SOURCES.map(source => (
                        <label key={source} className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedSources.includes(source)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSources([...selectedSources, source]);
                              } else {
                                setSelectedSources(selectedSources.filter(s => s !== source));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          {source}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Follow-up Count Filter */}
                <div className="mb-4">
                  <button
                    onClick={() => setShowFollowUpFilter(!showFollowUpFilter)}
                    className="w-full text-left flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-sm font-semibold text-slate-700"
                  >
                    <span>📞 Follow-ups</span>
                    <span>{showFollowUpFilter ? '▲' : '▼'}</span>
                  </button>
                  {showFollowUpFilter && (
                    <div className="mt-2 space-y-2 pl-3">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Min"
                          value={followUpMin}
                          onChange={(e) => setFollowUpMin(e.target.value)}
                          className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                        <span className="self-center text-slate-500">to</span>
                        <input
                          type="number"
                          placeholder="Max"
                          value={followUpMax}
                          onChange={(e) => setFollowUpMax(e.target.value)}
                          className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Date Range Filter */}
                <div className="mb-4">
                  <button
                    onClick={() => setShowDateRangeFilter(!showDateRangeFilter)}
                    className="w-full text-left flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-sm font-semibold text-slate-700"
                  >
                    <span>📅 Onboarding Date</span>
                    <span>{showDateRangeFilter ? '▲' : '▼'}</span>
                  </button>
                  {showDateRangeFilter && (
                    <div className="mt-2 space-y-2 pl-3">
                      <input
                        type="date"
                        value={dateRangeStart}
                        onChange={(e) => setDateRangeStart(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                      <input
                        type="date"
                        value={dateRangeEnd}
                        onChange={(e) => setDateRangeEnd(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={applyFilters}
                  className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                >
                  Apply Filters
                </button>

                {/* Manual Lead Selection */}
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-700">OR Select Leads</label>
                    {manualLeadSelection.length > 0 && (
                      <button
                        onClick={() => {
                          setManualLeadSelection([]);
                          setShowLeadSelector(false);
                        }}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Clear ({manualLeadSelection.length})
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowLeadSelector(!showLeadSelector)}
                    className="w-full px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors text-sm"
                  >
                    {showLeadSelector ? '🔼 Hide Lead Selector' : '🔽 Search & Select Leads'}
                  </button>
                </div>

                {showLeadSelector && (
                  <div className="mt-4 border border-slate-300 rounded-lg p-3 bg-slate-50 max-h-96 overflow-hidden flex flex-col">
                    <input
                      type="text"
                      value={leadSearchTerm}
                      onChange={(e) => setLeadSearchTerm(e.target.value)}
                      placeholder="🔍 Search by name, email, phone..."
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm mb-3"
                    />
                    <div className="flex-1 overflow-y-auto">
                      {getLeadsForSelector().map(lead => (
                        <label
                          key={lead.id}
                          className="flex items-start gap-2 p-2 hover:bg-white rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={manualLeadSelection.includes(lead.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setManualLeadSelection([...manualLeadSelection, lead.id]);
                              } else {
                                setManualLeadSelection(manualLeadSelection.filter(id => id !== lead.id));
                              }
                            }}
                            className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1 text-xs">
                            <div className="font-medium text-slate-800">{lead.agencyName}</div>
                            {/* 🟢 SAFE FIX: Contact Access */}
                            <div className="text-slate-600">{(Array.isArray(lead.contacts) ? lead.contacts : [])[0]?.email}</div>
                          </div>
                        </label>
                      ))}
                      {getLeadsForSelector().length === 0 && (
                        <p className="text-center text-slate-500 text-xs py-4">No leads found</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
                  <p className="text-sm text-indigo-800 font-semibold">
                    📊 {filteredLeads.length} leads will receive the email
                  </p>
                </div>
              </div>
            </div>

            {/* Email Composer */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4">✍️ Compose Email</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Enter email subject..."
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-slate-700">
                        Email Body
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEmailBodyIsHtml(false)}
                          className={`px-3 py-1 text-xs rounded ${!emailBodyIsHtml ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                        >
                          Text
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailBodyIsHtml(true)}
                          className={`px-3 py-1 text-xs rounded ${emailBodyIsHtml ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                        >
                          Rich HTML
                        </button>
                      </div>
                    </div>
                    
                    {emailBodyIsHtml ? (
                      <div>
                        {/* Rich Text Editor Toolbar */}
                        <div className="mb-2 flex flex-wrap gap-1 p-2 bg-slate-50 rounded border border-slate-200">
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execEmailCommand('bold')}
                            className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                            title="Bold"
                          >
                            <strong>B</strong>
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execEmailCommand('italic')}
                            className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                            title="Italic"
                          >
                            <em>I</em>
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execEmailCommand('underline')}
                            className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                            title="Underline"
                          >
                            <u>U</u>
                          </button>
                          <div className="border-r border-slate-300 mx-1"></div>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              const url = prompt('Enter URL:', 'https://');
                              if (url) {
                                execEmailCommand('createLink', ensureHttpUrl(url));
                              }
                            }}
                            className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                            title="Insert Link"
                          >
                            🔗 Link
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              const url = prompt('Enter URL for unsubscribe link:', 'https://');
                              if (url) {
                                const unsubscribeHtml = `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;"><a href="${ensureHttpUrl(url)}" style="color: #9ca3af;">Unsubscribe</a></div>`;
                                insertHtmlSnippet(emailEditorRef, setEmailBody, unsubscribeHtml);
                              }
                            }}
                            className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                            title="Add Unsubscribe Link"
                          >
                            📧 Unsubscribe
                          </button>
                          <div className="border-r border-slate-300 mx-1"></div>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleInsertImageFromDevice(emailEditorRef, setEmailBody)}
                            className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                            title="Insert image from your device"
                          >
                            🖼️ Upload Image
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleInsertImageByUrl(emailEditorRef, setEmailBody)}
                            className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                            title="Insert image by URL"
                          >
                            🌐 Image URL
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleInsertVideoLink(emailEditorRef, setEmailBody)}
                            className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                            title="Insert video link preview"
                          >
                            🎬 Video Link
                          </button>
                        </div>
                        
                        <div
                          id="email-body-editor"
                          ref={emailEditorRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={(e) => setEmailBody(e.currentTarget.innerHTML)}
                          onBlur={(e) => setEmailBody(e.currentTarget.innerHTML)}
                          onPaste={async (e) => {
                            e.preventDefault();
                            const clipboardData = e.clipboardData;
                            if (!clipboardData) return;
                            const items = clipboardData.items;

                            for (let i = 0; i < items.length; i++) {
                              const item = items[i];
                              if (item.type.indexOf('image') !== -1) {
                                const blob = item.getAsFile();
                                if (blob) {
                                  if (blob.size > 10 * 1024 * 1024) {
                                    alert('❌ Image too large! Maximum size is 10MB. Please compress the image and try again.');
                                    return;
                                  }
                                  try {
                                    const compressedBase64 = await compressImage(blob, 1200, 1200, 0.7);
                                    const html = `<img src="${compressedBase64}" alt="" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:8px;" />`;
                                    insertHtmlSnippet(emailEditorRef, setEmailBody, html);
                                  } catch (compressError) {
                                    console.error('Error compressing image:', compressError);
                                    alert('Failed to compress image. Please try a different image.');
                                  }
                                  return;
                                }
                              }
                            }

                            const html = clipboardData.getData('text/html');
                            const plainText = clipboardData.getData('text/plain');

                            if (html) {
                              const cleaned = cleanPastedHtml(html);
                              insertHtmlSnippet(emailEditorRef, setEmailBody, cleaned);
                            } else if (plainText) {
                              insertHtmlSnippet(emailEditorRef, setEmailBody, plainTextToHtml(plainText));
                            }
                          }}
                          style={{
                            minHeight: '220px',
                            padding: '12px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '0.5rem',
                            outline: 'none',
                            backgroundColor: 'white'
                          }}
                          className="w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 prose max-w-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          💡 Drag & drop images, paste rich content, or use the toolbar to insert links, media, or unsubscribe blocks.
                        </p>
                        <div className="mt-4 border border-slate-200 rounded-lg bg-white shadow-sm">
                          <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-700">Live Preview</span>
                            <span className="text-xs text-slate-500">Desktop friendly view</span>
                          </div>
                          <div
                            className="p-4 prose prose-sm max-w-none text-slate-800"
                            dangerouslySetInnerHTML={{
                              __html:
                                emailPreviewHtml && emailPreviewHtml.trim().length > 0
                                  ? emailPreviewHtml
                                  : '<p style="color:#94a3b8;">Start typing to preview your email.</p>'
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <textarea
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          placeholder="Enter email body... Use {name}, {phone}, {email}, {company}, {status} for personalization"
                          rows={15}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Placeholders: {"{"}name{"}"}, {"{"}phone{"}"}, {"{"}email{"}"}, {"{"}company{"}"}, {"{"}status{"}"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Attachments Section */}
                  <div className="border border-slate-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      📎 Attachments ({attachments.length})
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setAttachments([...attachments, ...files]);
                      }}
                      className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    {attachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {attachments.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                            <span className="text-sm text-slate-700 truncate flex-1">
                              📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                            <button
                              type="button"
                              onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                              className="ml-2 text-red-600 hover:text-red-800 text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Test Email */}
                  <div className="border border-indigo-100 rounded-lg p-4 bg-indigo-50/40">
                    <h3 className="text-sm font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                      🧪 Send Test Email
                    </h3>
                    <p className="text-xs text-indigo-700 mb-3">
                      Preview how this email looks by sending it to yourself (subject, body, and attachments included).
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleSendTestEmail}
                        disabled={isSendingTest}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
                      >
                        {isSendingTest ? 'Sending…' : 'Send Test Email'}
                      </button>
                    </div>
                    <p className="text-xs text-indigo-600 mt-2">
                      Tip: Add <code>[TEST]</code> to recognize the message in your inbox. Check spam if you don’t see it.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="schedule"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="schedule" className="text-sm font-semibold text-slate-700">
                      Schedule for later
                    </label>
                  </div>

                  {isScheduled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Date
                        </label>
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Time
                        </label>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button
                        onClick={handleOpenInGmail}
                        disabled={filteredLeads.length === 0}
                        className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        <span>📧</span>
                        <span>Open in Gmail ({filteredLeads.length} leads)</span>
                      </button>
                      <button
                        onClick={async () => {
                          const filteredLeads = getFilteredLeads();
                          if (filteredLeads.length === 0) {
                            alert('No leads match your filters. Please adjust your filters.');
                            return;
                          }

                          // Get all emails from filtered leads
                          const emails = filteredLeads
                            .map(lead => {
                               const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
                               return safeContacts[0]?.email;
                            })
                            .filter((email): email is string => !!email && email.includes('@'));

                          if (emails.length === 0) {
                            alert('No valid email addresses found in selected leads.');
                            return;
                          }

                          // Clean email body - remove HTML tags and convert to plain text
                          let cleanBody = emailBody || '';
                          if (emailBodyIsHtml) {
                            cleanBody = cleanBody.replace(/<[^>]*>/g, '');
                            const textarea = document.createElement('textarea');
                            textarea.innerHTML = cleanBody;
                            cleanBody = textarea.value;
                          }
                          
                          // Prepare mailto URL for Outlook desktop
                          const bccEmails = emails.join(',');
                          const subject = emailSubject ? encodeURIComponent(emailSubject) : '';
                          
                          // mailto: protocol has practical limits, so we'll handle long content
                          const encodedBody = cleanBody ? encodeURIComponent(cleanBody) : '';
                          const baseMailtoUrl = `mailto:?bcc=${encodeURIComponent(bccEmails)}${subject ? `&subject=${subject}` : ''}`;
                          const fullMailtoUrl = baseMailtoUrl + (encodedBody ? `&body=${encodedBody}` : '');
                          
                          const MAX_MAILTO_LENGTH = 1800;
                          
                          if (fullMailtoUrl.length > MAX_MAILTO_LENGTH && encodedBody) {
                            try {
                              await navigator.clipboard.writeText(cleanBody);
                              window.location.href = baseMailtoUrl; // Open without body
                              
                              setTimeout(() => {
                                alert(`📧 Outlook opened with ${emails.length} recipients in BCC!\n\n📋 Email body copied to clipboard (${cleanBody.length} characters).\n\nPlease paste (Ctrl+V) in the Outlook compose window.`);
                              }, 500);
                            } catch (clipboardError) {
                              const truncatedBody = cleanBody.substring(0, 1200);
                              const truncatedEncoded = encodeURIComponent(truncatedBody);
                              window.location.href = `${baseMailtoUrl}&body=${truncatedEncoded}`;
                              
                              setTimeout(() => {
                                alert(`📧 Outlook opened!\n\n⚠️ Email body is very long. Only first ${truncatedBody.length} characters are pre-filled.\n\nFull body length: ${cleanBody.length} characters.\n\nPlease copy the full body from the compose window above if needed.`);
                              }, 500);
                            }
                          } else {
                            window.location.href = fullMailtoUrl;
                            
                            setTimeout(() => {
                              alert(`📧 Outlook opened with ${emails.length} recipients in BCC!\n\nSubject and email body are pre-filled. Please review and send.`);
                            }, 500);
                          }
                        }}
                        disabled={filteredLeads.length === 0}
                        className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        <span>📧</span>
                        <span>Open in Outlook ({filteredLeads.length} leads)</span>
                      </button>
                      <button
                        onClick={handleOpenWhatsApp}
                        disabled={filteredLeads.length === 0}
                        className="flex-1 px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        <span>💬</span>
                        <span>Open WhatsApp ({filteredLeads.length} leads)</span>
                      </button>
                    </div>
                    <button
                      onClick={handleSendEmails}
                      disabled={isSending || filteredLeads.length === 0}
                      className="w-full px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSending ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                          Sending...
                        </span>
                      ) : (
                        `🚀 Send via API (${filteredLeads.length})`
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    💡 <strong>Gmail:</strong> Opens Gmail compose window with selected leads in BCC (chunks of 50). <strong>Outlook:</strong> Opens desktop Outlook with selected leads in BCC. <strong>WhatsApp:</strong> Opens WhatsApp chats with pre-filled message for each lead's phone number.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            {/* ... template rendering logic remains unchanged ... */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">📝 Email Templates</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    console.log('🔄 Refreshing templates...');
                    loadTemplates();
                  }}
                  className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
                  title="Refresh templates"
                >
                  🔄 Refresh
                </button>
                <button
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateName('');
                    setTemplateSubject('');
                    setTemplateBody('');
                    setTemplateIsHtml(true);
                    setTemplateAttachments([]);
                    setIsTemplateModalOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  ➕ Create Template
                </button>
              </div>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600 mb-4">No templates created yet</p>
                <p className="text-xs text-slate-500 mb-2">Current user: {currentUser}</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      console.log('🔄 Manual refresh triggered');
                      loadTemplates();
                    }}
                    className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    🔄 Refresh
                  </button>
                  <button
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplateName('');
                      setTemplateSubject('');
                      setTemplateBody('');
                      setTemplateIsHtml(true);
                      setIsTemplateModalOpen(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Create Your First Template
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-bold text-lg text-slate-800 mb-2">{template.name}</h3>
                    <p className="text-sm text-slate-600 mb-3 truncate">{template.subject}</p>
                    <p className="text-xs text-slate-500 mb-4 line-clamp-3">{template.body}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 transition-colors"
                      >
                        ✏️ Edit
                      </button>
                      {!template.isSystemTemplate && (
                        <button
                          onClick={() => handleDeleteTemplate(template.id!)}
                          className="px-3 py-2 bg-red-600 text-white text-sm font-semibold rounded hover:bg-red-700 transition-colors"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
             {/* ... campaign rendering logic remains unchanged ... */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">📊 Campaign History</h2>
              {campaigns.length > 0 && (
                <button
                  onClick={() => {
                    loadCampaigns();
                  }}
                  className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
                  title="Refresh campaigns"
                >
                  🔄 Refresh
                </button>
              )}
            </div>

            {campaigns.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600 mb-2">No campaigns yet. Start composing your first campaign!</p>
                <p className="text-xs text-slate-500 mb-4">Current user: {currentUser}</p>
                <button
                  onClick={() => {
                    console.log('🔄 Manual refresh triggered');
                    loadCampaigns();
                  }}
                  className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
                >
                  🔄 Refresh
                </button>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-3xl font-bold text-blue-700">{campaigns.length}</div>
                    <div className="text-sm text-blue-800 font-medium">Total Campaigns</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                    <div className="text-3xl font-bold text-green-700">
                      {campaigns.filter(c => c.status === 'sent').length}
                    </div>
                    <div className="text-sm text-green-800 font-medium">Sent</div>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-4 rounded-lg border border-yellow-200">
                    <div className="text-3xl font-bold text-yellow-700">
                      {campaigns.filter(c => c.status === 'scheduled').length}
                    </div>
                    <div className="text-sm text-yellow-800 font-medium">Scheduled</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                    <div className="text-3xl font-bold text-purple-700">
                      {campaigns.reduce((sum, c) => sum + c.recipientCount, 0)}
                    </div>
                    <div className="text-sm text-purple-800 font-medium">Total Emails Sent</div>
                  </div>
                </div>

                {/* Download Buttons */}
                <div className="flex gap-2 mb-4 pb-4 border-b border-slate-200">
                  <button
                    onClick={() => {
                      // Export to CSV
                      const headers = ['Campaign Name', 'Subject', 'Template', 'Status', 'Recipients', 'Created', 'Sent At'];
                      const csvData = campaigns.map(c => [
                        c.name,
                        c.subject,
                        c.templateName || 'Custom',
                        c.status,
                        c.recipientCount,
                        new Date(c.createdAt).toLocaleString(),
                        c.sentAt ? new Date(c.sentAt).toLocaleString() : ''
                      ]);
                      const csvContent = [
                        headers.join(','),
                        ...csvData.map(row => row.map(cell => {
                          const value = String(cell);
                          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                            return `"${value.replace(/"/g, '""')}"`;
                          }
                          return value;
                        }).join(','))
                      ].join('\n');
                      
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `email_campaigns_${new Date().toISOString().split('T')[0]}.csv`;
                      link.click();
                    }}
                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    📥 Download CSV
                  </button>
                  <button
                    onClick={() => {
                      // Export to Excel
                      const exportData = campaigns.map(c => ({
                        'Campaign Name': c.name,
                        'Subject': c.subject,
                        'Template': c.templateName || 'Custom',
                        'Status': c.status,
                        'Recipients': c.recipientCount,
                        'Created': new Date(c.createdAt).toLocaleString(),
                        'Sent At': c.sentAt ? new Date(c.sentAt).toLocaleString() : ''
                      }));
                      
                      const ws = XLSX.utils.json_to_sheet(exportData);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, 'Campaign History');
                      XLSX.writeFile(wb, `email_campaigns_${new Date().toISOString().split('T')[0]}.xlsx`);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    📊 Download Excel
                  </button>
                </div>

                {/* Campaign List */}
                <div className="space-y-4">
                  {campaigns.map(campaign => (
                    <div
                      key={campaign.id}
                      className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-slate-800 mb-1">{campaign.name}</h3>
                          <p className="text-sm text-slate-600 mb-2">Template: {campaign.templateName}</p>
                          <p className="text-sm text-slate-600 mb-2">Recipients: {campaign.recipientCount}</p>
                          <p className="text-xs text-slate-500">
                            Created: {new Date(campaign.createdAt).toLocaleString()}
                          </p>
                          {campaign.sentAt && (
                            <p className="text-xs text-slate-500">
                              Sent: {new Date(campaign.sentAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            campaign.status === 'sent'
                              ? 'bg-green-100 text-green-800'
                              : campaign.status === 'scheduled'
                              ? 'bg-yellow-100 text-yellow-800'
                              : campaign.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {campaign.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* WhatsApp Modal */}
        {showWhatsAppModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">💬 WhatsApp Bulk Messaging</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {whatsAppNumbers.length} phone number(s) ready to message
                  </p>
                </div>
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="text-slate-500 hover:text-slate-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4 flex gap-2 flex-wrap">
                  <button
                    onClick={handleOpenAllWhatsAppSequentially}
                    className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
                  >
                    🚀 Open All Sequentially (2s delay)
                  </button>
                  <button
                    onClick={handleCopyAllNumbers}
                    className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    📋 Copy All Numbers
                  </button>
                </div>
                
                <div className="space-y-2">
                  {whatsAppNumbers.map((item, index) => (
                    <div
                      key={`${item.phone}-${index}`}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{item.leadName}</p>
                        {item.contactName && (
                          <p className="text-sm text-slate-600">Contact: {item.contactName}</p>
                        )}
                        <p className="text-sm text-slate-500 font-mono">{item.phone}</p>
                      </div>
                      <button
                        onClick={() => handleOpenWhatsAppChat(item.phone)}
                        className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                      >
                        <span>💬</span>
                        <span>Open Chat</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-4 border-t border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-600">
                  💡 <strong>Tip:</strong> Click "Open All Sequentially" to open chats one by one with a 2-second delay, or click individual "Open Chat" buttons. The message will be pre-filled from your email body above.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Template Modal */}
        {isTemplateModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">
                {editingTemplate ? '✏️ Edit Template' : '➕ Create Template'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    placeholder="Enter subject line..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Email Body
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTemplateIsHtml(false)}
                        className={`px-3 py-1 text-xs rounded ${!templateIsHtml ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                      >
                        Text
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplateIsHtml(true)}
                        className={`px-3 py-1 text-xs rounded ${templateIsHtml ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                      >
                        Rich HTML
                      </button>
                    </div>
                  </div>
                  
                  {templateIsHtml ? (
                    <div>
                      {/* Rich Text Editor Toolbar */}
                      <div className="mb-2 flex flex-wrap gap-1 p-2 bg-slate-50 rounded border border-slate-200">
                        {/* Text Formatting */}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execTemplateCommand('bold')}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100 font-bold"
                          title="Bold (Ctrl+B)"
                        >
                          <strong>B</strong>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execTemplateCommand('italic')}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100 italic"
                          title="Italic (Ctrl+I)"
                        >
                          <em>I</em>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execTemplateCommand('underline')}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Underline (Ctrl+U)"
                        >
                          <u>U</u>
                        </button>
                        <div className="border-r border-slate-300 mx-1"></div>
                        
                        {/* Hyperlink */}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const selection = window.getSelection();
                            const selectedText = selection?.toString().trim() || '';
                            let url = '';
                            let linkText = selectedText;

                            if (selectedText) {
                              url = prompt(`Enter URL for "${selectedText}":`, 'https://') || '';
                            } else {
                              linkText = prompt('Enter link text:', '') || '';
                              if (linkText) {
                                url = prompt('Enter URL:', 'https://') || '';
                              }
                            }

                            if (!url) return;
                            const sanitizedUrl = ensureHttpUrl(url);

                            if (selection && !selection.isCollapsed && linkText) {
                              execTemplateCommand('createLink', sanitizedUrl);
                            } else if (linkText) {
                              const linkHtml = `<a href="${sanitizedUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`;
                              insertHtmlSnippet(templateEditorRef, setTemplateBody, linkHtml);
                            }
                          }}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Insert Hyperlink (Select text first or click to insert new link)"
                        >
                          🔗 Link
                        </button>
                        
                        {/* Remove Link */}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execTemplateCommand('unlink')}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Remove Link"
                        >
                          🔗✕
                        </button>
                        <div className="border-r border-slate-300 mx-1"></div>
                        
                        {/* Text Alignment */}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execTemplateCommand('justifyLeft')}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Align Left"
                        >
                          ⬅️
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execTemplateCommand('justifyCenter')}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Align Center"
                        >
                          ⬌
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execTemplateCommand('justifyRight')}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Align Right"
                        >
                          ➡️
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execTemplateCommand('justifyFull')}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Justify"
                        >
                          ⬌⬌
                        </button>
                        <div className="border-r border-slate-300 mx-1"></div>
                        
                        {/* Lists */}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execTemplateCommand('insertUnorderedList')}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Bullet List"
                        >
                          •
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execTemplateCommand('insertOrderedList')}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Numbered List"
                        >
                          1.
                        </button>
                        <div className="border-r border-slate-300 mx-1"></div>
                        
                        {/* Indent Controls */}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execTemplateCommand('indent')}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Increase Indent"
                        >
                          ➡️➕
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execTemplateCommand('outdent')}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Decrease Indent"
                        >
                          ⬅️➖
                        </button>
                        <div className="border-r border-slate-300 mx-1"></div>
                        
                        {/* Text Color */}
                        <input
                          type="color"
                          onMouseDown={(e) => e.preventDefault()}
                          onChange={(e) => execTemplateCommand('foreColor', e.target.value)}
                          className="w-8 h-7 bg-white border border-slate-300 rounded cursor-pointer"
                          title="Text Color"
                        />
                        <div className="border-r border-slate-300 mx-1"></div>
                        
                        {/* Media */}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleInsertImageFromDevice(templateEditorRef, setTemplateBody)}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Insert image from device"
                        >
                          🖼️ Upload Image
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleInsertImageByUrl(templateEditorRef, setTemplateBody)}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Insert image by URL"
                        >
                          🌐 Image URL
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleInsertVideoLink(templateEditorRef, setTemplateBody)}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Insert video link preview"
                        >
                          🎬 Video Link
                        </button>
                        <div className="border-r border-slate-300 mx-1"></div>
                        
                        {/* Clear Formatting */}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const editor = templateEditorRef.current;
                            if (!editor) return;
                            const cleaned = cleanPastedHtml(editor.innerHTML);
                            editor.innerHTML = cleaned;
                            setTemplateBody(cleaned);
                            editor.focus();
                          }}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100"
                          title="Clean & Optimize Formatting for Email"
                        >
                          🧹 Clean
                        </button>
                      </div>
                      
                      {/* Rich Text Editor */}
                      <div
                        id="template-body-editor"
                        ref={templateEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const html = e.currentTarget.innerHTML;
                          setTemplateBody(html);
                        }}
                        onInput={(e) => {
                          const html = e.currentTarget.innerHTML;
                          setTemplateBody(html);
                        }}
                        onPaste={async (e) => {
                          e.preventDefault();
                          const clipboardData = e.clipboardData;
                          if (!clipboardData) return;
                          const items = clipboardData.items;

                          for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            if (item.type.indexOf('image') !== -1) {
                              const blob = item.getAsFile();
                              if (blob) {
                                if (blob.size > 10 * 1024 * 1024) {
                                  alert('❌ Image too large! Maximum size is 10MB. Please compress the image and try again.');
                                  return;
                                }
                                try {
                                  const compressedBase64 = await compressImage(blob, 1200, 1200, 0.7);
                                  const imgHtml = `<img src="${compressedBase64}" alt="" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:8px;" />`;
                                  insertHtmlSnippet(templateEditorRef, setTemplateBody, imgHtml);
                                } catch (compressError) {
                                  console.error('Error compressing image:', compressError);
                                  alert('Failed to compress image. Please try a different image.');
                                }
                                return;
                              }
                            }
                          }

                          const html = clipboardData.getData('text/html');
                          const plainText = clipboardData.getData('text/plain');

                          if (html) {
                            const cleanedHtml = cleanPastedHtml(html);
                            insertHtmlSnippet(templateEditorRef, setTemplateBody, cleanedHtml);
                          } else if (plainText) {
                            insertHtmlSnippet(templateEditorRef, setTemplateBody, plainTextToHtml(plainText));
                          }
                        }}
                        style={{
                          minHeight: '300px',
                          padding: '16px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '0.5rem',
                          outline: 'none',
                          backgroundColor: 'white',
                          lineHeight: '1.6',
                          fontFamily: 'inherit',
                          fontSize: '14px'
                        }}
                        className="w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 prose max-w-none"
                      />
                      <div className="mt-2">
                        <div className={`text-xs font-semibold ${
                          templateBodySize > 950 * 1024 ? 'text-red-600' :
                          templateBodySize > 800 * 1024 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          📦 Size: {(templateBodySize / 1024).toFixed(1)} KB {templateBodySize > 950 * 1024 && '(Too large!)'}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          💡 <strong>Paste Tip:</strong> When copying content from websites/emails, paste with Ctrl+V (Cmd+V on Mac) - formatting will be automatically cleaned and optimized for Gmail/Outlook. Images paste with auto-compression (max 0.95MB total). Select text and click 🔗 Link to add hyperlinks. Use 🧹 Clear to remove unwanted formatting.
                        </p>
                      </div>
                      <div className="mt-4 border border-slate-200 rounded-lg bg-white shadow-sm">
                        <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">Template Preview</span>
                          <span className="text-xs text-slate-500">Rendered view</span>
                        </div>
                        <div
                          className="p-4 prose prose-sm max-w-none text-slate-800"
                          dangerouslySetInnerHTML={{
                            __html:
                              templatePreviewHtml && templatePreviewHtml.trim().length > 0
                                ? templatePreviewHtml
                                : '<p style="color:#94a3b8;">Start typing to preview your template.</p>'
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <textarea
                        value={templateBody}
                        onChange={(e) => setTemplateBody(e.target.value)}
                        placeholder="Enter email body..."
                        rows={12}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Use placeholders: {"{"}name{"}"}, {"{"}phone{"}"}, {"{"}email{"}"}, {"{"}company{"}"}, {"{"}status{"}"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Attachments Section */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    📎 Attachments ({templateAttachments.length})
                  </label>
                  <input
                    type="file"
                    multiple
                    id="template-attachment-input"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;

                      // Check total size limit (Firestore has ~1MB limit, but we need space for body and metadata)
                      const MAX_ATTACHMENT_SIZE = 500 * 1024; // 500KB per file
                      const MAX_TOTAL_ATTACHMENTS = 2 * 1024 * 1024; // 2MB total for all attachments
                      
                      let totalSize = templateAttachments.reduce((sum, att) => sum + att.size, 0);
                      
                      const validFiles: File[] = [];
                      const errors: string[] = [];

                      for (const file of files) {
                        if (file.size > MAX_ATTACHMENT_SIZE) {
                          errors.push(`${file.name}: File too large (max ${(MAX_ATTACHMENT_SIZE / 1024).toFixed(0)}KB)`);
                          continue;
                        }
                        
                        if (totalSize + file.size > MAX_TOTAL_ATTACHMENTS) {
                          errors.push(`${file.name}: Total attachments size would exceed limit`);
                          continue;
                        }
                        
                        validFiles.push(file);
                        totalSize += file.size;
                      }

                      if (errors.length > 0) {
                        alert('⚠️ Some files could not be added:\n\n' + errors.join('\n'));
                      }

                      if (validFiles.length > 0) {
                        // Convert files to base64
                        const newAttachments = await Promise.all(
                          validFiles.map(file => {
                            return new Promise<{ name: string; data: string; type: string; size: number }>((resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = () => {
                                const base64 = reader.result as string;
                                resolve({
                                  name: file.name,
                                  data: base64,
                                  type: file.type || 'application/octet-stream',
                                  size: file.size
                                });
                              };
                              reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
                              reader.readAsDataURL(file);
                            });
                          })
                        );

                        setTemplateAttachments([...templateAttachments, ...newAttachments]);
                        alert(`✅ ${newAttachments.length} file(s) added successfully!`);
                      }

                      // Reset file input
                      e.target.value = '';
                    }}
                    className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                  {templateAttachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {templateAttachments.map((attachment, index) => (
                        <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-lg">📎</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-slate-700 truncate block font-medium">{attachment.name}</span>
                              <span className="text-xs text-slate-500">{(attachment.size / 1024).toFixed(1)} KB • {attachment.type}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTemplateAttachments(templateAttachments.filter((_, i) => i !== index));
                            }}
                            className="ml-2 text-red-600 hover:text-red-800 text-sm font-semibold px-2 py-1 rounded hover:bg-red-50"
                            title="Remove attachment"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <div className="text-xs text-slate-500 mt-2">
                        Total size: {(templateAttachments.reduce((sum, att) => sum + att.size, 0) / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    💡 Maximum file size: 500KB per file. Maximum total: 2MB. Attachments will be included when sending emails using this template.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleSaveTemplate}
                  disabled={templateBodySize > 950 * 1024}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  💾 Save Template {templateBodySize > 950 * 1024 && '(Too Large!)'}
                </button>
                <button
                  onClick={() => {
                    setIsTemplateModalOpen(false);
                    setEditingTemplate(null);
                  }}
                  className="px-6 py-3 bg-slate-300 text-slate-800 font-semibold rounded-lg hover:bg-slate-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkEmailMarketing;