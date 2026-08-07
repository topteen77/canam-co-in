import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { Modal } from './Modal';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  firebaseProjectId: string;
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  settings: {
    customLeadStatuses: string[];
    customAgentCategories: string[];
    customLeadSources: string[];
    customFollowUpTypes: string[];
    enableAttendanceTracking: boolean;
    enableMeetingPhotos: boolean;
    enableCallLogging: boolean;
    enableTravelClaims: boolean;
    enableReports: boolean;
    enableDataExport: boolean;
  };
  subscription: {
    plan: 'basic' | 'professional' | 'enterprise';
    maxUsers: number;
    maxLeads: number;
    maxStorage: number;
    status: 'active' | 'expired' | 'cancelled';
    nextBillingDate: string;
    price: number;
  };
}

interface FirebaseProject {
  id: string;
  name: string;
  projectId: string;
  status: 'available' | 'in-use';
  createdAt: string;
}

// 🟢 SAFE FIX: Robust date formatter
const formatDate = (dateString: any): string => {
  if (!dateString) return 'N/A';
  try {
    // Handle Firestore Timestamp objects if they slip through
    if (dateString && typeof dateString === 'object' && dateString.toDate) {
      return dateString.toDate().toLocaleDateString();
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString();
  } catch (e) {
    return 'Error';
  }
};

const CompanyManagement: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [firebaseProjects, setFirebaseProjects] = useState<FirebaseProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState({
    totalCompanies: 0,
    activeCompanies: 0,
    totalUsers: 0,
    totalLeads: 0,
  });

  useEffect(() => {
    loadCompanies();
    loadFirebaseProjects();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/companies');
      const rows = Array.isArray(data) ? data : [];
      const companiesData = rows.map((row: any) => ({
          id: row.id ?? row.firebase_id ?? '',
          name: row.name || 'Unknown Company',
          subdomain: row.subdomain || '',
          contactEmail: (row.contact_email ?? row.contactEmail) || '',
          contactPhone: (row.contact_phone ?? row.contactPhone) || '',
          address: row.address || '',
          city: row.city || '',
          state: row.state || '',
          country: row.country || '',
          status: row.status || 'inactive',
          createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
          updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
          createdBy: (row.created_by ?? row.createdBy) || '',
          firebaseProjectId: (row.firebase_project_id ?? row.firebaseProjectId) || '',
          firebaseConfig: (row.firebase_config ?? row.firebaseConfig) || {},
          settings: row.settings || {
            customLeadStatuses: [],
            customAgentCategories: [],
            customLeadSources: [],
            customFollowUpTypes: [],
            enableAttendanceTracking: false,
            enableMeetingPhotos: false,
            enableCallLogging: false,
            enableTravelClaims: false,
            enableReports: false,
            enableDataExport: false,
          },
          subscription: row.subscription || {
            plan: 'basic',
            maxUsers: 0,
            maxLeads: 0,
            maxStorage: 0,
            status: 'active',
            nextBillingDate: '',
            price: 0
          }
        } as Company));
      
      setCompanies(companiesData);
      
      // Calculate stats safely
      const activeCompanies = companiesData.filter(c => c.status === 'active').length;
      setStats({
        totalCompanies: companiesData.length,
        activeCompanies,
        totalUsers: 0, // Will be calculated per company
        totalLeads: 0, // Will be calculated per company
      });
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFirebaseProjects = async () => {
    try {
      const { data } = await apiClient.get('/firebase-projects');
      const rows = Array.isArray(data) ? data : [];
      const projectsData = rows.map((row: any) => ({
        id: row.id ?? '',
        name: row.project_name ?? row.projectName ?? '',
        projectId: row.project_id ?? row.projectId ?? '',
        status: row.status ?? 'available',
        createdAt: row.created_at ?? row.createdAt ?? '',
      })) as FirebaseProject[];
      setFirebaseProjects(projectsData);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const handleCreateCompany = async (companyData: any) => {
    try {
      const payload = {
        name: companyData.name,
        subdomain: companyData.subdomain,
        contact_email: companyData.contactEmail ?? companyData.contact_email,
        contact_phone: companyData.contactPhone ?? companyData.contact_phone,
        address: companyData.address,
        city: companyData.city,
        state: companyData.state,
        country: companyData.country,
        status: companyData.status ?? 'active',
      };
      await apiClient.post('/companies', payload);
      await loadCompanies();
      setIsCreateCompanyOpen(false);
    } catch (error) {
      console.error('Error creating company:', error);
      alert('Failed to create company. Please try again.');
    }
  };

  const handleCompanyAction = async (companyId: string, action: 'suspend' | 'activate' | 'delete') => {
    try {
      if (action === 'delete') {
        if (confirm('Are you sure you want to delete this company? This action cannot be undone.')) {
          await apiClient.delete('/companies/' + companyId);
          await loadCompanies();
        }
      } else {
        const status = action === 'suspend' ? 'suspended' : 'active';
        await apiClient.put('/companies/' + companyId, { status, updatedAt: new Date().toISOString() });
        await loadCompanies();
      }
    } catch (error) {
      console.error(`Error ${action} company:`, error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-gray-600 bg-gray-100';
      case 'suspended': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Company Management</h2>
          <p className="text-gray-600">Manage multi-tenant CRM companies and their Firebase systems</p>
        </div>
        <button
          onClick={() => setIsCreateCompanyOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
        >
          Create New Company
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Companies</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalCompanies}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Companies</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeCompanies}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available Firebase Projects</p>
              <p className="text-2xl font-semibold text-gray-900">
                {/* 🟢 SAFE FIX: Array check */}
                {Array.isArray(firebaseProjects) ? firebaseProjects.filter(p => p.status === 'available').length : 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">System Status</p>
              <p className="text-2xl font-semibold text-green-600">LIVE</p>
            </div>
          </div>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Companies</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subdomain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Firebase Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* 🟢 SAFE FIX: Map over safe array */}
              {(Array.isArray(companies) ? companies : []).map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{company.name}</div>
                        <div className="text-sm text-gray-500">{company.contactEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {company.subdomain}.canamcrm.com
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {company.firebaseProjectId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(company.status)}`}>
                      {company.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(company.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedCompany(company)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View
                      </button>
                      <button
                        onClick={() => window.open(`https://${company.subdomain}.canamcrm.com`, '_blank')}
                        className="text-green-600 hover:text-green-900"
                      >
                        Access CRM
                      </button>
                      {company.status === 'active' ? (
                        <button
                          onClick={() => handleCompanyAction(company.id, 'suspend')}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCompanyAction(company.id, 'activate')}
                          className="text-green-600 hover:text-green-900"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => handleCompanyAction(company.id, 'delete')}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Company Modal */}
      {isCreateCompanyOpen && (
        <Modal
          isOpen={isCreateCompanyOpen}
          onClose={() => setIsCreateCompanyOpen(false)}
          title="Create New Company"
        >
          <CreateCompanyForm
            onComplete={handleCreateCompany}
            onCancel={() => setIsCreateCompanyOpen(false)}
            firebaseProjects={firebaseProjects}
          />
        </Modal>
      )}

      {/* Company Details Modal */}
      {selectedCompany && (
        <Modal
          isOpen={!!selectedCompany}
          onClose={() => setSelectedCompany(null)}
          title={`${selectedCompany.name} Details`}
        >
          <CompanyDetails company={selectedCompany} />
        </Modal>
      )}
    </div>
  );
};

// Create Company Form Component
interface CreateCompanyFormProps {
  onComplete: (companyData: any) => void;
  onCancel: () => void;
  firebaseProjects: FirebaseProject[];
}

const CreateCompanyForm: React.FC<CreateCompanyFormProps> = ({ onComplete, onCancel, firebaseProjects }) => {
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    city: '',
    state: '',
    country: 'US',
    timezone: 'America/New_York',
    currency: 'USD',
    language: 'en',
    primaryColor: '#4f46e5',
    secondaryColor: '#06b6d4',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    plan: 'professional' as 'basic' | 'professional' | 'enterprise',
    maxUsers: 25,
    maxLeads: 2500,
    maxStorage: 2000,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const generateSubdomain = (companyName: string) => {
    return companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleCompanyNameChange = (name: string) => {
    handleInputChange('name', name);
    if (!formData.subdomain) {
      handleInputChange('subdomain', generateSubdomain(name));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) newErrors.name = 'Company name is required';
    if (!formData.subdomain) newErrors.subdomain = 'Subdomain is required';
    if (!formData.contactEmail) newErrors.contactEmail = 'Contact email is required';
    if (!formData.adminName) newErrors.adminName = 'Admin name is required';
    if (!formData.adminEmail) newErrors.adminEmail = 'Admin email is required';
    if (!formData.adminPassword) newErrors.adminPassword = 'Admin password is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onComplete(formData);
    }
  };

  // 🟢 SAFE FIX: Ensure we are filtering a valid array
  const availableProjects = (Array.isArray(firebaseProjects) ? firebaseProjects : []).filter(p => p.status === 'available');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleCompanyNameChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="ABC Immigration Services"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subdomain *
          </label>
          <div className="flex">
            <input
              type="text"
              value={formData.subdomain}
              onChange={(e) => handleInputChange('subdomain', e.target.value)}
              className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                errors.subdomain ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="abc-immigration"
            />
            <span className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-r-md">
              .canamcrm.com
            </span>
          </div>
          {errors.subdomain && <p className="mt-1 text-sm text-red-600">{errors.subdomain}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contact Email *
          </label>
          <input
            type="email"
            value={formData.contactEmail}
            onChange={(e) => handleInputChange('contactEmail', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              errors.contactEmail ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="admin@abcimmigration.com"
          />
          {errors.contactEmail && <p className="mt-1 text-sm text-red-600">{errors.contactEmail}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contact Phone
          </label>
          <input
            type="tel"
            value={formData.contactPhone}
            onChange={(e) => handleInputChange('contactPhone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="+1 (555) 123-4567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Admin Name *
          </label>
          <input
            type="text"
            value={formData.adminName}
            onChange={(e) => handleInputChange('adminName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              errors.adminName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="John Smith"
          />
          {errors.adminName && <p className="mt-1 text-sm text-red-600">{errors.adminName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Admin Email *
          </label>
          <input
            type="email"
            value={formData.adminEmail}
            onChange={(e) => handleInputChange('adminEmail', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              errors.adminEmail ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="john@abcimmigration.com"
          />
          {errors.adminEmail && <p className="mt-1 text-sm text-red-600">{errors.adminEmail}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Admin Password *
          </label>
          <input
            type="password"
            value={formData.adminPassword}
            onChange={(e) => handleInputChange('adminPassword', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              errors.adminPassword ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter secure password"
          />
          {errors.adminPassword && <p className="mt-1 text-sm text-red-600">{errors.adminPassword}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subscription Plan
          </label>
          <select
            value={formData.plan}
            onChange={(e) => handleInputChange('plan', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="basic">Basic - $29/month</option>
            <option value="professional">Professional - $79/month</option>
            <option value="enterprise">Enterprise - $199/month</option>
          </select>
        </div>
      </div>

      {/* Firebase Project Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Available Firebase Projects
        </label>
        {availableProjects.length > 0 ? (
          <div className="space-y-2">
            {availableProjects.map(project => (
              <div key={project.id} className="flex items-center p-3 border border-gray-200 rounded-md">
                <input
                  type="radio"
                  name="firebaseProject"
                  value={project.id}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">{project.name}</div>
                  <div className="text-sm text-gray-500">Project ID: {project.projectId}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              No available Firebase projects. Please add more Firebase projects first.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={availableProjects.length === 0}
          className={`px-4 py-2 rounded-md transition-colors ${
            availableProjects.length === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          Create Company
        </button>
      </div>
    </form>
  );
};

// Company Details Component
interface CompanyDetailsProps {
  company: Company;
}

const CompanyDetails: React.FC<CompanyDetailsProps> = ({ company }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Company Name</label>
          <p className="mt-1 text-sm text-gray-900">{company.name}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Subdomain</label>
          <p className="mt-1 text-sm text-gray-900">{company.subdomain}.canamcrm.com</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Contact Email</label>
          <p className="mt-1 text-sm text-gray-900">{company.contactEmail}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            company.status === 'active' ? 'bg-green-100 text-green-800' :
            company.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
            'bg-red-100 text-red-800'
          }`}>
            {company.status}
          </span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Firebase Project</label>
          <p className="mt-1 text-sm text-gray-900">{company.firebaseProjectId}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Created</label>
          <p className="mt-1 text-sm text-gray-900">{formatDate(company.createdAt)}</p>
        </div>
      </div>
      
      <div className="pt-4 border-t">
        <div className="flex space-x-4">
          <button
            onClick={() => window.open(`https://${company.subdomain}.canamcrm.com`, '_blank')}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Access Company CRM
          </button>
          <button
            onClick={() => window.close()}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyManagement;