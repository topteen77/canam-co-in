import React, { useState, useRef } from 'react';

interface ImageUploadOCRProps {
  onExtractComplete: (data: any) => void;
  onError: (error: string) => void;
}

export const ImageUploadOCR: React.FC<ImageUploadOCRProps> = ({ onExtractComplete, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 🟢 SAFE FIX: Robust validation
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      onError('Please select a valid image file (JPG, PNG, or WebP)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      onError('Image size should be less than 10MB');
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingStatus('Loading OCR engine...');
      
      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
            setUploadedImage(e.target.result as string);
        }
      };
      reader.onerror = () => {
          throw new Error('Failed to read image file');
      };
      reader.readAsDataURL(file);

      // Extract text and parse to structured data
      setProcessingStatus('Initializing OCR...');
      
      // 🟢 SAFE FIX: Dynamic import with error handling
      let extractTextFromImage, parseLeadDataFromText;
      try {
          const ocrService = await import('../services/ocrService');
          extractTextFromImage = ocrService.extractTextFromImage;
          parseLeadDataFromText = ocrService.parseLeadDataFromText;
      } catch (importError) {
          throw new Error('OCR Service failed to load. Please check your internet connection.');
      }
      
      // Extract text first for display
      setProcessingStatus('Extracting text from image...');
      const text = await extractTextFromImage(file);
      
      if (!text || text.trim().length === 0) {
          throw new Error('No text could be extracted from this image. Please try a clearer image.');
      }

      setExtractedText(text);
      
      // Parse the extracted text to structured data
      setProcessingStatus('Parsing extracted data...');
      const leadData = await parseLeadDataFromText(text);

      setProcessingStatus('Complete!');
      // Callback with extracted data
      onExtractComplete(leadData);
      
    } catch (error) {
      console.error('OCR Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract information from image';
      setProcessingStatus(`Error: ${errorMessage}`);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
      // Clear status after a delay
      setTimeout(() => setProcessingStatus(''), 3000);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setExtractedText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border-2 border-purple-200">
        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
          📸 Upload Visiting Card or Screenshot
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Upload an image of a visiting card, business card, or office address screenshot. 
          Our OCR will automatically extract contact information and fill the form.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg, image/png, image/webp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isProcessing}
            />
            <div className={`
              w-full px-4 py-3 rounded-lg border-2 border-dashed text-center transition-all
              ${isProcessing 
                ? 'bg-gray-100 border-gray-300 cursor-not-allowed' 
                : 'bg-white border-purple-300 hover:border-purple-500 hover:bg-purple-50 cursor-pointer'
              }
            `}>
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                  <span className="text-sm font-medium text-purple-600">Processing image...</span>
                  {processingStatus && (
                    <span className="text-xs text-purple-500">{processingStatus}</span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl">📷</span>
                  <span className="text-sm font-semibold text-slate-700">
                    {uploadedImage ? 'Change Image' : 'Click to Upload Image'}
                  </span>
                  <span className="text-xs text-slate-500">JPG, PNG, or WebP (max 10MB)</span>
                </div>
              )}
            </div>
          </label>

          {uploadedImage && (
            <button
              type="button"
              onClick={handleRemoveImage}
              className="px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium text-sm border-2 border-red-300"
            >
              🗑️ Remove
            </button>
          )}
        </div>

        {uploadedImage && (
          <div className="mt-4">
            <div className="bg-white p-3 rounded-lg border border-purple-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Image Preview:</h4>
              <img 
                src={uploadedImage} 
                alt="Uploaded" 
                className="max-w-full h-auto max-h-48 rounded border border-slate-200"
              />
            </div>
          </div>
        )}

        {extractedText && (
          <div className="mt-4">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Extracted Text:</h4>
              <div className="text-xs text-blue-700 bg-white p-2 rounded border border-blue-200 max-h-32 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-mono">{extractedText}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};