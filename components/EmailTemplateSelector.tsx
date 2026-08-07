import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

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

interface EmailTemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  recipientEmail: string;
  recipientName?: string;
  agencyName?: string;
  currentUser: string;
  onSendEmail?: (emailClient: 'gmail' | 'outlook' | 'mailto', template?: EmailTemplate) => void;
}

export const EmailTemplateSelector: React.FC<EmailTemplateSelectorProps> = ({
  isOpen,
  onClose,
  recipientEmail,
  recipientName,
  agencyName,
  currentUser,
  onSendEmail
}) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [emailClient, setEmailClient] = useState<'gmail' | 'outlook' | 'mailto'>('gmail');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, currentUser]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/email-templates');
      const rows = Array.isArray(data) ? data : [];
      let allTemplates: EmailTemplate[] = rows.map((row: any) => ({
        id: row.id ?? row.firebase_id,
        name: row.name ?? '',
        subject: row.subject ?? '',
        body: row.body ?? '',
        isSystemTemplate: !!(row.is_system_template ?? row.isSystemTemplate),
        createdBy: row.created_by ?? row.createdBy ?? '',
        createdAt: row.created_at ?? row.createdAt,
        updatedAt: row.updated_at ?? row.updatedAt,
        attachments: row.attachments ?? [],
      })) as EmailTemplate[];
      allTemplates.sort((a, b) => {
        if (a.isSystemTemplate && !b.isSystemTemplate) return -1;
        if (!a.isSystemTemplate && b.isSystemTemplate) return 1;
        const aTime = (a.createdAt as any)?.toMillis?.() ?? new Date(a.createdAt || 0).getTime();
        const bTime = (b.createdAt as any)?.toMillis?.() ?? new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setTemplates(allTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const replaceTemplateVariables = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/\{\{AGENCY_NAME\}\}/g, agencyName || 'the agency')
      .replace(/\{\{CONTACT_NAME\}\}/g, recipientName || 'there')
      .replace(/\{\{EMAIL\}\}/g, recipientEmail || '');
  };

  // 🟢 SAFE FIX: Robust Clipboard Copy
  const copyToClipboard = async (text: string, isHtml = false) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText && !isHtml) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      
      // Fallback for HTML or if clipboard API fails
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      
      try {
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
      } catch (err) {
        document.body.removeChild(textarea);
        console.error('Fallback copy failed:', err);
        return false;
      }
    } catch (err) {
      console.error('Clipboard API failed:', err);
      return false;
    }
  };

  const openEmailClient = async (client: 'gmail' | 'outlook' | 'mailto', template?: EmailTemplate) => {
    const subject = template ? replaceTemplateVariables(template.subject) : '';
    let body = template ? replaceTemplateVariables(template.body) : '';
    const attachments = template?.attachments || [];
    
    // Check if body contains HTML
    const isHtml = body && /<[a-z][\s\S]*>/i.test(body);
    
    // Convert HTML to plain text while preserving line breaks and formatting
    let plainTextBody = body;
    if (isHtml && body) {
      // Create a temporary div to parse HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = body;
      
      // Convert HTML elements to plain text equivalents
      const htmlContent = tempDiv.innerHTML;
      let converted = htmlContent
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '• ')
        .replace(/<h[1-6]>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n');
      
      // Parse to extract text content
      tempDiv.innerHTML = converted;
      plainTextBody = tempDiv.textContent || tempDiv.innerText || '';
      
      // Clean up extra whitespace but preserve intentional line breaks
      plainTextBody = plainTextBody
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
    }
    
    // URL encode subject and body
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = plainTextBody ? encodeURIComponent(plainTextBody) : '';
    
    if (client === 'gmail') {
      const baseUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=cm&to=${encodeURIComponent(recipientEmail)}${subject ? `&su=${encodedSubject}` : ''}`;
      const fullUrl = baseUrl + (encodedBody ? `&body=${encodedBody}` : '');
      const MAX_URL_LENGTH = 1800;
      
      if (fullUrl.length > MAX_URL_LENGTH && encodedBody) {
        const copied = await copyToClipboard(plainTextBody);
        
        if (copied) {
            const gmailWindow = window.open(baseUrl, '_blank', 'noopener,noreferrer');
            if (!gmailWindow || gmailWindow.closed || typeof gmailWindow.closed === 'undefined') {
                window.location.href = baseUrl;
            }
            setTimeout(() => {
                alert(`✅ Gmail opened!\n\n📋 Email body copied to clipboard (${plainTextBody.length} characters).\n\nPlease paste (Ctrl+V or Cmd+V) in the Gmail compose window.`);
            }, 500);
        } else {
            // Last resort fallback
            const truncatedBody = plainTextBody.substring(0, 1500);
            const truncatedEncoded = encodeURIComponent(truncatedBody);
            const gmailUrl = `${baseUrl}&body=${truncatedEncoded}`;
            window.open(gmailUrl, '_blank', 'noopener,noreferrer');
            alert(`⚠️ Email body is very long and copy failed. Only first ${truncatedBody.length} characters are pre-filled.`);
        }
      } else {
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
      }
      
      if (attachments.length > 0) {
        setTimeout(() => {
          alert(`📎 Note: Gmail web doesn't support pre-filled attachments.\n\nYou have ${attachments.length} attachment(s) in this template:\n${attachments.map(a => ` • ${a.name}`).join('\n')}\n\nPlease attach them manually in the Gmail compose window.`);
        }, 500);
      }
    } else if (client === 'outlook') {
      const baseMailtoUrl = `mailto:${recipientEmail}`;
      let fullMailtoUrl = baseMailtoUrl + `?subject=${encodedSubject}`;
      if (encodedBody) fullMailtoUrl += `&body=${encodedBody}`;
      
      const MAX_MAILTO_LENGTH = 1800;
      
      if (fullMailtoUrl.length > MAX_MAILTO_LENGTH && encodedBody) {
         const copied = await copyToClipboard(plainTextBody);
         if (copied) {
            const mailtoUrl = baseMailtoUrl + (subject ? `?subject=${encodedSubject}` : '');
            window.location.href = mailtoUrl;
            
            setTimeout(async () => {
                let message = `📧 Outlook opened!\n\n📋 Email body copied to clipboard (${plainTextBody.length} characters).\n\nPlease paste (Ctrl+V) in the Outlook compose window.`;
                if (attachments.length > 0) {
                    message += `\n\n📎 Attachments to include:\n${attachments.map(a => ` • ${a.name} (${(a.size / 1024).toFixed(1)} KB)`).join('\n')}\n\nPlease attach these files manually in Outlook.`;
                }
                alert(message);
            }, 500);
         } else {
             // Fallback
             const truncatedBody = plainTextBody.substring(0, 1200);
             const truncatedEncoded = encodeURIComponent(truncatedBody);
             const mailtoUrl = `${baseMailtoUrl}?subject=${encodedSubject}&body=${truncatedEncoded}`;
             window.location.href = mailtoUrl;
             alert(`📧 Outlook opened!\n\n⚠️ Email body truncated due to length limits.`);
         }
      } else {
        window.location.href = fullMailtoUrl;
        
        if (attachments.length > 0) {
          setTimeout(async () => {
            const attachmentInfo = `Attachments to include:\n${attachments.map(a => ` • ${a.name} (${(a.size / 1024).toFixed(1)} KB)`).join('\n')}\n\nNote: Please attach these files manually in Outlook.`;
            await copyToClipboard(attachmentInfo);
            alert(`📎 Outlook opened!\n\n${attachmentInfo}\n\nAttachment list copied to clipboard.`);
          }, 500);
        }
      }
    } else {
      const mailtoUrl = `mailto:${recipientEmail}${subject ? `?subject=${encodedSubject}` : ''}${encodedBody ? `${subject ? '&' : '?'}body=${encodedBody}` : ''}`;
      window.location.href = mailtoUrl;
    }
    
    if (onSendEmail) {
      onSendEmail(client, template);
    }
    
    onClose();
  };

  const handleSendWithTemplate = () => {
    openEmailClient(emailClient, selectedTemplate || undefined);
  };

  const handleCopyHtml = async () => {
    if (!selectedTemplate) return;
    
    const body = replaceTemplateVariables(selectedTemplate.body);
    const isHtml = body && /<[a-z][\s\S]*>/i.test(body);
    
    if (isHtml) {
      try {
        if (navigator.clipboard && navigator.clipboard.write) {
          const type = "text/html";
          const blob = new Blob([body], { type });
          const data = [new ClipboardItem({ [type]: blob })];
          await navigator.clipboard.write(data);
          alert('✅ HTML template copied to clipboard!\n\nYou can now paste it into Gmail/Outlook compose window to preserve images and formatting.');
          return;
        }
      } catch (error) {
        console.warn('HTML copy failed, falling back to text copy', error);
      }
    }
    
    // Fallback to text copy
    const copied = await copyToClipboard(body);
    if (copied) {
         alert('✅ Template content copied to clipboard!');
    } else {
         alert('⚠️ Could not copy to clipboard. Please select and copy the template preview manually.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-2 sm:p-4" aria-modal="true" role="dialog" onClick={onClose}>
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 truncate pr-2">📧 Send Email to {recipientName || recipientEmail}</h2>
          <button 
            onClick={onClose} 
            className="text-slate-500 hover:text-slate-800 p-1 -m-1 flex-shrink-0" 
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="overflow-y-auto p-3 sm:p-6 flex-1">
      <div className="space-y-4">
        {/* Email Client Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Email Client</label>
          <div className="flex gap-2">
            <button
              onClick={() => setEmailClient('gmail')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                emailClient === 'gmail'
                  ? 'bg-red-100 text-red-800 border-2 border-red-500'
                  : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
              }`}
            >
              📧 Gmail
            </button>
            <button
              onClick={() => setEmailClient('outlook')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                emailClient === 'outlook'
                  ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
                  : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
              }`}
            >
              📧 Outlook
            </button>
            <button
              onClick={() => setEmailClient('mailto')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                emailClient === 'mailto'
                  ? 'bg-indigo-100 text-indigo-800 border-2 border-indigo-500'
                  : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
              }`}
            >
              📧 Default
            </button>
          </div>
        </div>

        {/* Template Selection */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-slate-600">Loading templates...</p>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Template (Optional)
              </label>
              {templates.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-slate-600">
                  <p>No templates available. You can create templates in the Bulk Email section.</p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-200 hover:bg-slate-50 transition-colors ${
                      selectedTemplate === null ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
                    }`}
                  >
                    <div className="font-medium text-slate-900">📝 No Template (Blank Email)</div>
                    <div className="text-xs text-slate-500 mt-1">Send a blank email</div>
                  </button>
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-200 hover:bg-slate-50 transition-colors ${
                        selectedTemplate?.id === template.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">{template.name}</div>
                          <div className="text-xs text-slate-600 mt-1">{template.subject}</div>
                          {!template.isSystemTemplate && template.createdBy && (
                            <div className="text-xs text-slate-500 mt-1">Created by: {template.createdBy.split('@')[0]}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {template.isSystemTemplate && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              System
                            </span>
                          )}
                          {template.createdBy === currentUser && !template.isSystemTemplate && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              Yours
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Template Preview */}
            {selectedTemplate && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-800">Template Preview:</h4>
                  {selectedTemplate.body && /<[a-z][\s\S]*>/i.test(selectedTemplate.body) && (
                    <button
                      onClick={handleCopyHtml}
                      className="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors font-medium"
                      title="Copy HTML template to clipboard (preserves images and formatting)"
                    >
                      📋 Copy HTML
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-slate-600">Subject:</span>
                    <p className="text-sm text-slate-900 mt-1">{replaceTemplateVariables(selectedTemplate.subject)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-600">Body:</span>
                    <div 
                      className="text-sm text-slate-700 mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap bg-white p-2 rounded border"
                      dangerouslySetInnerHTML={{ __html: replaceTemplateVariables(selectedTemplate.body) }}
                    />
                  </div>
                </div>
              </div>
            )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSendWithTemplate}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            {selectedTemplate ? `📧 Open ${emailClient === 'gmail' ? 'Gmail' : emailClient === 'outlook' ? 'Outlook' : 'Email'} with Template` : `📧 Open ${emailClient === 'gmail' ? 'Gmail' : emailClient === 'outlook' ? 'Outlook' : 'Email'}`}
          </button>
        </div>
        {selectedTemplate && selectedTemplate.body && /<[a-z][\s\S]*>/i.test(selectedTemplate.body) && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            💡 <strong>Tip:</strong> For templates with images/HTML, use "Copy HTML" button above, then paste (Ctrl+V) in Gmail/Outlook to preserve full formatting.
          </div>
        )}
          </>
        )}
      </div>
        </div>
      </div>
    </div>
  );
};