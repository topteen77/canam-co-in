import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import type { CallLog } from '../types';
import apiClient from '../services/apiClient';

interface CallLoggingModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: string;
  leadId?: string;
  leadName?: string;
  contactName?: string;
  currentUser: { email: string; name: string } | null; // 🟢 SAFE FIX: Allow null type for safety check
}

export const CallLoggingModal: React.FC<CallLoggingModalProps> = ({
  isOpen,
  onClose,
  phoneNumber,
  leadId,
  leadName,
  contactName,
  currentUser
}) => {
  const [callStartTime] = useState(new Date().toISOString());
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [durationSeconds, setDurationSeconds] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [outcome, setOutcome] = useState<'answered' | 'no-answer' | 'busy' | 'voicemail' | 'other'>('answered');
  const [isSaving, setIsSaving] = useState(false);
  const [autoTimer, setAutoTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setAutoTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = () => {
    setIsTimerRunning(true);
  };

  const handleStopTimer = () => {
    setIsTimerRunning(false);
    const mins = Math.floor(autoTimer / 60);
    const secs = autoTimer % 60;
    setDurationMinutes(mins.toString());
    setDurationSeconds(secs.toString());
  };

  const handleSaveCall = async () => {
    // 🟢 SAFE FIX: Robust user check
    if (!currentUser || !currentUser.email) {
      alert('User not authenticated. Please log in again.');
      return;
    }

    // Calculate total duration in seconds
    let totalDuration = 0;
    if (isTimerRunning || autoTimer > 0) {
      totalDuration = autoTimer;
    } else {
      // 🟢 SAFE FIX: Prevent NaN
      const mins = parseInt(durationMinutes || '0', 10);
      const secs = parseInt(durationSeconds || '0', 10);
      totalDuration = (isNaN(mins) ? 0 : mins * 60) + (isNaN(secs) ? 0 : secs);
    }

    if (totalDuration === 0) {
      alert('Please enter call duration or use the timer');
      return;
    }

    setIsSaving(true);
    try {
      const callLog = {
        phoneNumber: phoneNumber || 'Unknown',
        leadId: leadId || null,
        leadName: leadName || 'Unknown Lead',
        contactName: contactName || 'Unknown Contact',
        callType: leadId ? 'lead' : 'non-lead',
        timestamp: callStartTime,
        duration: totalDuration,
        notes: notes ? notes.trim() : '',
        outcome,
        userId: currentUser.email,
        userEmail: currentUser.email,
        userName: currentUser.name || currentUser.email,
      };

      await apiClient.post('/call-logs', callLog);

      alert('✅ Call logged successfully!');
      onClose();
    } catch (error) {
      console.error('Error logging call:', error);
      alert('❌ Failed to log call. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    if (confirm('Skip logging this call? Call details will not be saved.')) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal title="📞 Log Call Details" onClose={handleSkip} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Call Information */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-sm font-bold text-blue-900 mb-2">Call Information</h3>
          <div className="space-y-1 text-sm">
            <p><span className="font-semibold">Phone:</span> {phoneNumber}</p>
            {leadName && <p><span className="font-semibold">Lead:</span> {leadName}</p>}
            {contactName && <p><span className="font-semibold">Contact:</span> {contactName}</p>}
            {!leadId && <p className="text-orange-600 font-semibold">⚠️ Non-Lead Call</p>}
          </div>
        </div>

        {/* Auto Timer */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-200">
          <h3 className="text-sm font-bold text-indigo-900 mb-3">⏱️ Call Timer</h3>
          <div className="flex items-center justify-between">
            <div className="text-4xl font-mono font-bold text-indigo-900">
              {formatTime(autoTimer)}
            </div>
            <div className="flex gap-2">
              {!isTimerRunning ? (
                <button
                  onClick={handleStartTimer}
                  disabled={autoTimer > 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-sm"
                >
                  ▶️ Start Timer
                </button>
              ) : (
                <button
                  onClick={handleStopTimer}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm"
                >
                  ⏹️ Stop Timer
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-indigo-600 mt-2">Start timer when call begins, stop when call ends</p>
        </div>

        {/* Manual Duration Entry */}
        {!isTimerRunning && autoTimer === 0 && (
          <div className="bg-white p-4 rounded-lg border border-slate-300">
            <h3 className="text-sm font-bold text-slate-800 mb-3">⏰ Or Enter Duration Manually</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Minutes</label>
                <input
                  type="number"
                  min="0"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Seconds</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Call Outcome */}
        <div className="bg-white p-4 rounded-lg border border-slate-300">
          <label className="block text-sm font-bold text-slate-800 mb-2">📊 Call Outcome</label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as any)}
            className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
          >
            <option value="answered">✅ Answered</option>
            <option value="no-answer">📵 No Answer</option>
            <option value="busy">🔴 Busy</option>
            <option value="voicemail">📧 Voicemail</option>
            <option value="other">❓ Other</option>
          </select>
        </div>

        {/* Notes */}
        <div className="bg-white p-4 rounded-lg border border-slate-300">
          <label className="block text-sm font-bold text-slate-800 mb-2">📝 Call Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
            placeholder="Enter any important details from the call..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between gap-3 pt-4 border-t">
          <button
            onClick={handleSkip}
            disabled={isSaving}
            className="px-6 py-2 text-sm font-bold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 border-2 border-slate-300 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
          <button
            onClick={handleSaveCall}
            disabled={isSaving}
            className="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg hover:from-indigo-700 hover:to-blue-700 border-2 border-indigo-600 shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
          >
            {isSaving ? '⏳ Saving...' : '✅ Save Call Log'}
          </button>
        </div>
      </div>
    </Modal>
  );
};