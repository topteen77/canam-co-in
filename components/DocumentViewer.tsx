import React, { useState } from 'react';
import { Modal } from './Modal';
import type { AgencyDocument } from '../types';

interface DocumentViewerProps {
  document: AgencyDocument;
  isOpen: boolean;
  onClose: () => void;
  documentLabel: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  isOpen,
  onClose,
  documentLabel
}) => {
  const [zoom, setZoom] = useState(100);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 🟢 SAFE FIX: Null checks for document properties
  if (!document) return null;

  const safeFileType = document.fileType || '';
  const safeFileName = document.fileName || 'Unknown File';
  const safeUrl = document.url || '';

  const isImage = safeFileType.startsWith('image/');
  const isPDF = safeFileType === 'application/pdf';

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleResetZoom = () => {
    setZoom(100);
    setPosition({ x: 0, y: 0 });
  };

  // 🟢 SAFE FIX: Robust Date Formatter
  const getFormattedDate = (dateString?: string) => {
    if (!dateString) return 'Unknown Date';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  const handleDownload = async () => {
    if (!safeUrl) {
      alert('Error: File URL is missing.');
      return;
    }

    try {
      if (document.isBase64) {
        // Handle base64 documents
        const link = document.createElement('a');
        link.href = safeUrl;
        link.download = safeFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Handle regular URL documents
        const response = await fetch(safeUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = safeFileName;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('❌ Download failed:', error);
      // Fallback
      window.open(safeUrl, '_blank');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 100) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 100) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen) return null;

  return (
    <Modal 
      title={documentLabel}
      onClose={onClose}
      maxWidth="max-w-6xl"
    >
      <div className="space-y-4">
        {/* Document Info */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-semibold text-slate-600">File Name:</span>
              <p className="text-slate-800 truncate" title={safeFileName}>{safeFileName}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-600">Type:</span>
              <p className="text-slate-800">{safeFileType || 'Unknown'}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-600">Uploaded:</span>
              <p className="text-slate-800">
                {getFormattedDate(document.uploadedAt)}
              </p>
            </div>
            <div>
              <span className="font-semibold text-slate-600">By:</span>
              <p className="text-slate-800 truncate">{document.uploadedBy || 'Unknown User'}</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-300">
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 25}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
            >
              🔍−
            </button>
            <span className="text-sm font-semibold text-slate-700 min-w-[60px] text-center">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 300}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
            >
              🔍+
            </button>
            <button
              onClick={handleResetZoom}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold text-sm"
            >
              Reset
            </button>
          </div>

          <button
            onClick={handleDownload}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm flex items-center gap-2"
          >
            <span>⬇</span>
            Download
          </button>
        </div>

        {/* Document Display */}
        <div 
          className="relative bg-slate-900 rounded-lg overflow-hidden"
          style={{ height: '500px' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="absolute inset-0 flex items-center justify-center overflow-auto">
            {isImage ? (
              <img
                src={safeUrl}
                alt={safeFileName}
                className={`max-w-none ${isDragging ? 'cursor-grabbing' : zoom > 100 ? 'cursor-grab' : 'cursor-default'}`}
                style={{
                  width: `${zoom}%`,
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  transition: isDragging ? 'none' : 'transform 0.2s ease'
                }}
                draggable={false}
              />
            ) : isPDF ? (
              <iframe
                src={`${safeUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                className="w-full h-full border-0"
                title={safeFileName}
              />
            ) : (
              <div className="text-center p-8">
                <div className="text-white mb-4">
                  <p className="text-lg font-semibold mb-2">Preview not available</p>
                  <p className="text-sm text-slate-300">
                    This file type cannot be previewed in the browser.
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
                >
                  Download to View
                </button>
              </div>
            )}
          </div>
        </div>

        {zoom > 100 && isImage && (
          <p className="text-xs text-center text-slate-500">
            💡 Click and drag to pan the image
          </p>
        )}
      </div>
    </Modal>
  );
};