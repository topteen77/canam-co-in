import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

interface WebsiteSignupLead {
  id: string;
  email: string;
  phone?: string;
  fullName?: string;
  agencyName?: string;
  companyAddress?: string;
  stage: 'Signed Up' | 'OTP Verified' | 'Details Submitted' | 'MOU Signed' | 'Signup Completed';
  otpVerified: boolean;
  addressProofUrl?: string;
  companyProofUrl?: string;
  mouSignature?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
  leadSource: 'Website';
  status: 'New' | 'In Pipeline';
}

interface WebsiteSignupLeadsProps {
  onConvertToLead?: (signupLead: WebsiteSignupLead) => void;
}

const WebsiteSignupLeads: React.FC<WebsiteSignupLeadsProps> = ({ onConvertToLead }) => {
  const [signupLeads, setSignupLeads] = useState<WebsiteSignupLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<string>('All');
  const [error, setError] = useState<string | null>(null);

  const stages: Array<WebsiteSignupLead['stage'] | 'All'> = [
    'All',
    'Signed Up',
    'OTP Verified',
    'Details Submitted',
    'MOU Signed',
    'Signup Completed',
  ];

  useEffect(() => {
    loadSignupLeads();
  }, []);

  const loadSignupLeads = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/website-signup-leads');
      const list = Array.isArray(res.data) ? res.data : [];
      setSignupLeads(list.map((row: any) => ({
        id: row.id || row.email || '',
        email: row.email,
        phone: row.phone,
        fullName: row.name,
        stage: row.stage || 'Signed Up',
        otpVerified: false,
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
        leadSource: 'Website',
        status: 'New',
        ...row,
      })));
      setError(null);
    } catch (err: any) {
      console.error('Error loading signup leads:', err);
      setError(err?.response?.data?.error || 'Failed to load signup leads.');
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage: WebsiteSignupLead['stage']) => {
    switch (stage) {
      case 'Signed Up':
        return 'bg-blue-100 text-blue-700';
      case 'OTP Verified':
        return 'bg-purple-100 text-purple-700';
      case 'Details Submitted':
        return 'bg-yellow-100 text-yellow-700';
      case 'MOU Signed':
        return 'bg-orange-100 text-orange-700';
      case 'Signup Completed':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (date: string | undefined | null) => {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return d.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  const filteredLeads = selectedStage === 'All'
    ? signupLeads
    : signupLeads.filter(lead => lead.stage === selectedStage);

  const handleConvertToLead = (signupLead: WebsiteSignupLead) => {
    if (onConvertToLead) {
      onConvertToLead(signupLead);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-slate-600">Loading website signup leads...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Leads from Website</h2>
            <p className="text-sm text-slate-500">All partner signups from iApply website</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-indigo-600">{signupLeads.length}</div>
            <div className="text-sm text-slate-500">Total Signups</div>
          </div>
        </div>

        {/* Stage Filter */}
        <div className="flex flex-wrap gap-2">
          {stages.map((stage) => (
            <button
              key={stage}
              onClick={() => setSelectedStage(stage)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedStage === stage
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {stage}
              {stage !== 'All' && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {signupLeads.filter(l => l.stage === stage).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {filteredLeads.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl block mb-3">📋</span>
            <p className="text-slate-500">No signup leads found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Agency Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Contact Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Signed Up</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">MOU Signed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-800">{lead.email}</div>
                      {lead.phone && (
                        <div className="text-xs text-slate-500">{lead.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-800">
                        {lead.agencyName || <span className="text-slate-400 italic">Not provided</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-800">
                        {lead.fullName || <span className="text-slate-400 italic">Not provided</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStageColor(lead.stage)}`}>
                        {lead.stage}
                      </span>
                      {lead.otpVerified && (
                        <span className="ml-2 text-green-500 text-xs font-medium">✓ Verified</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                      {lead.mouSignature ? (
                        <div>
                          <div className="text-green-600 font-medium">✓ Signed</div>
                          <div className="text-xs text-slate-500 truncate max-w-[100px]" title={lead.mouSignature}>{lead.mouSignature}</div>
                          {lead.signedAt && (
                            <div className="text-xs text-slate-400">{formatDate(lead.signedAt)}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {lead.stage === 'Signup Completed' && (
                        <button
                          onClick={() => handleConvertToLead(lead)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                        >
                          Convert to Lead
                        </button>
                      )}
                      {lead.stage !== 'Signup Completed' && (
                        <span className="text-slate-400 text-xs italic">In Progress</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebsiteSignupLeads;