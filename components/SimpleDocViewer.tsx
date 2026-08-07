import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';

interface SimpleDocViewerProps {
  document: any;
  isOpen: boolean;
  onClose: () => void;
  documentLabel: string;
}

export const SimpleDocViewer: React.FC<SimpleDocViewerProps> = ({
  document,
  isOpen,
  onClose,
  documentLabel
}) => {
  const [zoom, setZoom] = useState(100);
  const [imgError, setImgError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset state when document changes
  useEffect(() => {
    if (isOpen) {
      setZoom(100);
      setImgError(false);
      setIsLoading(true);
    }
  }, [document, isOpen]);

  if (!document) return null;

  const fileType = document.fileType || '';
  const isImage = fileType.startsWith('image/');
  const isPDF = fileType === 'application/pdf';

  const handleDownload = () => {
    try {
      const link = window.document.createElement('a');
      link.href = document.fileData || document.url;
      link.download = document.fileName || 'download';
      link.target = '_blank'; // Fallback for some mobile browsers
      window.document.body.appendChild(link); // Required for Firefox
      link.click();
      window.document.body.removeChild(link);
    } catch (e) {
      console.error("Download failed", e);
      alert("Could not download file. Please try again.");
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleResetZoom = () => setZoom(100);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`View Document: ${documentLabel}`} maxWidth="max-w-4xl">
      <div className="p-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 break-all">{document.fileName || 'Unknown File'}</h3>
            <p className="text-sm text-slate-600">
              Uploaded on {document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString() : 'Unknown date'} 
              {document.uploadedBy ? ` by ${document.uploadedBy}` : ''}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              📥 Download
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Document Content */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 min-h-[300px] flex items-center justify-center relative">
          {isImage ? (
            <div className="relative w-full h-full flex items-center justify-center overflow-auto p-4">
              {imgError ? (
                <div className="text-center p-8">
                  <div className="text-4xl mb-2">⚠️</div>
                  <p className="text-slate-500">Failed to load image preview.</p>
                  <button onClick={handleDownload} className="mt-2 text-indigo-600 hover:underline">Download to view</button>
                </div>
              ) : (
                <>
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  )}
                  <img
                    src={document.fileData || document.url}
                    alt={document.fileName}
                    className="max-w-full h-auto object-contain transition-transform duration-200 ease-out"
                    style={{
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: 'center center'
                    }}
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                        setIsLoading(false);
                        setImgError(true);
                    }}
                  />
                  
                  {/* Zoom Controls */}
                  <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg p-1.5 shadow-lg flex gap-1 z-20">
                    <button
                      onClick={handleZoomOut}
                      className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded"
                      title="Zoom Out"
                    >
                      −
                    </button>
                    <span className="px-2 py-1 text-xs font-medium text-slate-600 min-w-[3rem] text-center flex items-center justify-center">
                      {zoom}%
                    </span>
                    <button
                      onClick={handleZoomIn}
                      className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded"
                      title="Zoom In"
                    >
                      +
                    </button>
                    <div className="w-px bg-slate-200 mx-1 my-1"></div>
                    <button
                      onClick={handleResetZoom}
                      className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                      title="Reset Zoom"
                    >
                      Reset
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : isPDF ? (
            <div className="w-full h-[600px] bg-white">
              <iframe
                src={document.fileData || document.url}
                className="w-full h-full border-0"
                title={document.fileName}
              />
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4 opacity-50">📄</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">{document.fileName}</h3>
              <p className="text-slate-600 mb-6">
                This file type cannot be previewed in the browser.
              </p>
              <button
                onClick={handleDownload}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm font-medium"
              >
                📥 Download File
              </button>
            </div>
          )}
        </div>

        {/* File Details Footer */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-lg">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-600">
            <div>
              <span className="font-semibold block text-slate-700">File Type</span>
              <span className="truncate block" title={fileType}>{fileType || 'Unknown'}</span>
            </div>
            <div>
              <span className="font-semibold block text-slate-700">File Size</span>
              <span>
                {document.compressedSize 
                  ? `${(document.compressedSize / 1024).toFixed(1)} KB` 
                  : document.originalSize 
                    ? `${(document.originalSize / 1024).toFixed(1)} KB`
                    : 'Unknown'}
              </span>
            </div>
            <div>
              <span className="font-semibold block text-slate-700">Uploaded By</span>
              <span className="truncate block">{document.uploadedBy || 'System'}</span>
            </div>
            <div>
              <span className="font-semibold block text-slate-700">Status</span>
              <span className="text-green-600 font-medium">Stored Securely</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};