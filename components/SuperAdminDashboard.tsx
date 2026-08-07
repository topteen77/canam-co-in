import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { Modal } from './Modal';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  contactEmail: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  firebaseProjectId: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  customUrl?: string;
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  totalUsers?: number;
  activeUsers?: number;
}

interface FirebaseProject {
  id: string;
  name: string;
  projectId: string;
  status: 'available' | 'assigned';
  description: string;
  config: any;
}

const SuperAdminDashboard: React.FC = () => {
  console.log('🎯 SuperAdminDashboard: Component is rendering!');
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [firebaseProjects, setFirebaseProjects] = useState<FirebaseProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [refreshingProjects, setRefreshingProjects] = useState(false);

  // Create company form state
  const [createForm, setCreateForm] = useState({
    name: '',
    subdomain: '',
    contactEmail: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    firebaseProjectId: '',
    customUrl: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    useCustomDomain: false,
    customDomain: '',
    domainProvider: '',
    domainInstructions: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  // Generate clean URL from company name
  const generateCleanUrl = (companyName: string) => {
    return companyName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  };

  // Auto-generate subdomain when company name changes
  const handleCompanyNameChange = (name: string) => {
    const cleanSubdomain = generateCleanUrl(name);
    setCreateForm({
      ...createForm,
      name,
      subdomain: cleanSubdomain,
      customUrl: createForm.useCustomDomain ? createForm.customUrl : `https://agent-follow-up-crm.web.app?company=${cleanSubdomain}`
    });
  };

  // Open Firebase Console for project creation
  const openFirebaseConsole = (projectId?: string) => {
    if (projectId) {
      // Open specific project
      window.open(`https://console.firebase.google.com/project/${projectId}`, '_blank');
    } else {
      // Open Firebase Console for new project
      window.open('https://console.firebase.google.com/', '_blank');
    }
  };

  const addFirebaseProject = async (projectId: string) => {
    if (!projectId) return;
    try {
      const { data: existing } = await apiClient.get('/firebase-projects');
      const rows = Array.isArray(existing) ? existing : [];
      if (rows.some((r: any) => (r.project_id ?? r.projectId) === projectId)) {
        alert(`Project ID "${projectId}" already exists!`);
        return;
      }
      const projectName = projectId.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      await apiClient.post('/firebase-projects', { projectId, projectName, status: 'available' });
      alert('Project added successfully!');
      loadData();
    } catch (error) {
      console.error('Error adding project:', error);
      alert('Error adding project');
    }
  };

  const deleteFirebaseProject = async (projectId: string) => {
    try {
      const { data: list } = await apiClient.get('/firebase-projects');
      const rows = Array.isArray(list) ? list : [];
      const found = rows.find((r: any) => (r.project_id ?? r.projectId) === projectId);
      if (found?.id) {
        await apiClient.delete('/firebase-projects/' + found.id);
      }
      alert('Project deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Error deleting project');
    }
  };

  const refreshFirebaseProjects = async () => {
    try {
      setRefreshingProjects(true);
      const { data } = await apiClient.get('/firebase-projects');
      const projectsData = (Array.isArray(data) ? data : []).map((row: any) => ({
        id: row.id,
        name: row.project_name ?? row.projectName ?? '',
        projectId: row.project_id ?? row.projectId ?? '',
        status: row.status ?? 'available',
        description: row.description ?? '',
        config: row.payload ?? row.config ?? {}
      })) as FirebaseProject[];
      setFirebaseProjects(projectsData);
    } catch (error) {
      console.error('Error refreshing projects:', error);
    } finally {
      setRefreshingProjects(false);
    }
  };

  const syncFromFirebaseConsole = async () => {
    try {
      setRefreshingProjects(true);
      const commonProjects = [
        { name: "iApply B2B CRM", projectId: "iapplyb2bcrm" },
        { name: "Agent Follow-up CRM", projectId: "agent-follow-up-crm" },
        { name: "AI Gym Trainer", projectId: "ai-gym-trainer" },
        { name: "Canam CRM", projectId: "canam-crm" },
        { name: "Test Project", projectId: "test-project-crm" }
      ];
      const { data: existing } = await apiClient.get('/firebase-projects');
      const rows = Array.isArray(existing) ? existing : [];
      let addedCount = 0;
      for (const project of commonProjects) {
        if (!rows.some((r: any) => (r.project_id ?? r.projectId) === project.projectId)) {
          await apiClient.post('/firebase-projects', { ...project, status: 'available' });
          addedCount++;
        }
      }
      await refreshFirebaseProjects();
      
      if (addedCount > 0) {
        alert(`✅ Synced ${addedCount} projects from Firebase Console!`);
      } else {
        alert('ℹ️ All projects are already synced.');
      }
      
    } catch (error) {
      console.error('Error syncing from Firebase Console:', error);
      alert('Error syncing from Firebase Console');
    } finally {
      setRefreshingProjects(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: companiesRows } = await apiClient.get('/companies');
      const companiesData = (Array.isArray(companiesRows) ? companiesRows : []).map((row: any) => ({
        id: row.id ?? row.firebase_id ?? '',
        ...row
      })) as Company[];
      const canamCRM: Company = {
        id: 'canam-crm-main',
        name: 'Canam CRM (Main)',
        subdomain: 'agent-follow-up-crm',
        contactEmail: 'canamrakesh@gmail.com',
        adminName: 'Rakesh Canam',
        adminEmail: 'canamrakesh@gmail.com',
        adminPassword: 'main-admin',
        firebaseProjectId: 'agent-follow-up-crm',
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        customUrl: 'https://agent-follow-up-crm.web.app',
        branding: { primaryColor: '#3B82F6', secondaryColor: '#1E40AF' },
        totalUsers: 0,
        activeUsers: 0
      };
      const companiesWithUserCounts = await Promise.all(
        [canamCRM, ...companiesData].map(async (company) => {
          try {
            if (company.id === 'canam-crm-main') {
              const { data: usersRows } = await apiClient.get('/users');
              const users = Array.isArray(usersRows) ? usersRows : [];
              const activeUsers = users.filter((u: any) => (u.status ?? u.Status) === 'Active').length;
              return { ...company, totalUsers: users.length, activeUsers };
            }
            const { data: companyUsers } = await apiClient.get('/companies/' + company.id + '/users').catch(() => ({ data: [] }));
            const users = Array.isArray(companyUsers) ? companyUsers : [];
            const activeUsers = users.filter((u: any) => (u.status ?? u.Status) === 'active').length;
            return { ...company, totalUsers: users.length, activeUsers };
          } catch (error) {
            return { ...company, totalUsers: 0, activeUsers: 0 };
          }
        })
      );
      setCompanies(companiesWithUserCounts);
      const { data: projectsRows } = await apiClient.get('/firebase-projects');
      const projectsData = (Array.isArray(projectsRows) ? projectsRows : []).map((row: any) => ({
        id: row.id ?? '',
        name: row.project_name ?? row.projectName ?? '',
        projectId: row.project_id ?? row.projectId ?? '',
        status: row.status ?? 'available',
        description: row.description ?? '',
        config: row.payload ?? row.config ?? {}
      })) as FirebaseProject[];
      setFirebaseProjects(projectsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const selectedProject = firebaseProjects.find(p => p.id === createForm.firebaseProjectId);
      if (!selectedProject) {
        alert('Please select a Firebase project');
        return;
      }

      const companyData = {
        name: createForm.name,
        subdomain: createForm.subdomain,
        contactEmail: createForm.contactEmail,
        adminName: createForm.adminName,
        adminEmail: createForm.adminEmail,
        adminPassword: createForm.adminPassword,
        firebaseProjectId: createForm.firebaseProjectId,
        customUrl: createForm.customUrl || `${createForm.subdomain}.canamcrm.com`,
        status: 'active' as const,
        branding: {
          primaryColor: createForm.primaryColor,
          secondaryColor: createForm.secondaryColor
        },
        createdAt: new Date().toISOString(),
        createdBy: 'superadmin'
      };

      const companyRes = await apiClient.post('/companies', {
        name: companyData.name,
        subdomain: companyData.subdomain,
        contact_email: companyData.contactEmail,
        admin_name: companyData.adminName,
        admin_email: companyData.adminEmail,
        admin_password: companyData.adminPassword,
        firebase_project_id: companyData.firebaseProjectId,
        custom_url: companyData.customUrl,
        status: companyData.status,
        branding: companyData.branding,
      });
      const companyId = (companyRes.data as any)?.id;
      if (companyId && createForm.firebaseProjectId) {
        const { data: projList } = await apiClient.get('/firebase-projects');
        const proj = (Array.isArray(projList) ? projList : []).find((p: any) => (p.project_id ?? p.projectId) === createForm.firebaseProjectId);
        if (proj?.id) await apiClient.put('/firebase-projects/' + proj.id, { status: 'in-use', assignedTo: companyId });
      }
      if (companyId) {
        await apiClient.post('/companies/' + companyId + '/users', {
          companyId,
          name: createForm.adminName,
          email: createForm.adminEmail,
          password: createForm.adminPassword,
          role: 'CompanyAdmin',
          status: 'active',
        });
      }

      alert('Company created successfully!');
      setIsCreateModalOpen(false);
      setCreateForm({
        name: '',
        subdomain: '',
        contactEmail: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        firebaseProjectId: '',
        customUrl: '',
        primaryColor: '#3B82F6',
        secondaryColor: '#1E40AF',
        useCustomDomain: false,
        customDomain: '',
        domainProvider: '',
        domainInstructions: ''
      });
      loadData();

    } catch (error) {
      console.error('Error creating company:', error);
      alert('Error creating company');
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    try {
      await apiClient.put('/companies/' + selectedCompany.id, {
        name: createForm.name,
        subdomain: createForm.subdomain,
        contact_email: createForm.contactEmail,
        custom_url: createForm.customUrl,
        branding: { primaryColor: createForm.primaryColor, secondaryColor: createForm.secondaryColor },
      });
      alert('Company updated successfully!');
      setIsEditModalOpen(false);
      setSelectedCompany(null);
      loadData();
    } catch (error) {
      console.error('Error updating company:', error);
      alert('Error updating company');
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    if (!confirm(`Are you sure you want to delete ${company.name}? This action cannot be undone.`)) return;
    try {
      await apiClient.delete('/companies/' + company.id);
      const { data: projList } = await apiClient.get('/firebase-projects');
      const proj = (Array.isArray(projList) ? projList : []).find((p: any) => (p.project_id ?? p.projectId) === company.firebaseProjectId);
      if (proj?.id) await apiClient.put('/firebase-projects/' + proj.id, { status: 'available', assignedTo: null });
      alert('Company deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Error deleting company');
    }
  };

  const handleToggleStatus = async (company: Company) => {
    const newStatus = company.status === 'active' ? 'inactive' : 'active';
    try {
      await apiClient.put('/companies/' + company.id, { status: newStatus });
      alert(`Company ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`);
      loadData();
    } catch (error) {
      console.error('Error updating company status:', error);
      alert('Error updating company status');
    }
  };

  const openEditModal = (company: Company) => {
    setSelectedCompany(company);
    setCreateForm({
      name: company.name,
      subdomain: company.subdomain,
      contactEmail: company.contactEmail,
      adminName: company.adminName,
      adminEmail: company.adminEmail,
      adminPassword: company.adminPassword,
      firebaseProjectId: company.firebaseProjectId,
      customUrl: company.customUrl || '',
      primaryColor: company.branding?.primaryColor || '#3B82F6',
      secondaryColor: company.branding?.secondaryColor || '#1E40AF',
      useCustomDomain: false, // Default values for reset
      customDomain: '',
      domainProvider: '',
      domainInstructions: ''
    });
    setIsEditModalOpen(true);
  };

  const openCompanyCRM = (company: Company) => {
    const url = company.customUrl || `https://${company.subdomain}.canamcrm.com`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Super Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
              <p className="text-gray-600">Manage multi-tenant CRM companies</p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create New Company
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Companies</p>
                <p className="text-2xl font-semibold text-gray-900">{companies.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Companies</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {companies.filter(c => c.status === 'active').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Available Firebase Projects</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {firebaseProjects.filter(p => p.status === 'available').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {companies.reduce((sum, company) => sum + (company.totalUsers || 0), 0)}
                </p>
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Users</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active Users</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <p className="text-lg font-medium text-gray-900 mb-2">No companies yet</p>
                        <p className="text-sm text-gray-500 mb-4">Create your first company to get started</p>
                        <button
                          onClick={() => setIsCreateModalOpen(true)}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                        >
                          Create New Company
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  companies.map((company) => (
                    <tr key={company.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div 
                              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: company.branding?.primaryColor || '#3B82F6' }}
                            >
                              {company.name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{company.name}</div>
                            <div className="text-sm text-gray-500">{company.contactEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <a 
                            href={company.customUrl || `https://${company.subdomain}.canamcrm.com`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            {company.customUrl || `${company.subdomain}.canamcrm.com`}
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{company.adminName}</div>
                        <div className="text-sm text-gray-500">{company.adminEmail}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{company.totalUsers || 0}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">{company.activeUsers || 0}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          company.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : company.status === 'inactive'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {company.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(company.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openCompanyCRM(company)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Open Company CRM"
                          >
                            🔗
                          </button>
                          <button
                            onClick={() => openEditModal(company)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit Company"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleToggleStatus(company)}
                            className={`${company.status === 'active' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                            title={company.status === 'active' ? 'Deactivate' : 'Activate'}
                          >
                            {company.status === 'active' ? '⏸️' : '▶️'}
                          </button>
                          <button
                            onClick={() => handleDeleteCompany(company)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Company"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Company Modal */}
      {isCreateModalOpen && (
        <Modal title="Create New Company" onClose={() => setIsCreateModalOpen(false)}>
          <form onSubmit={handleCreateCompany} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="ABC Immigration Services"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">URL will auto-generate: agent-follow-up-crm.web.app?company={createForm.subdomain}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subdomain</label>
                <input
                  type="text"
                  value={createForm.subdomain}
                  onChange={(e) => setCreateForm({...createForm, subdomain: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="abc-immigration"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Clean, URL-friendly version of company name</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={createForm.contactEmail}
                onChange={(e) => setCreateForm({...createForm, contactEmail: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name</label>
                <input
                  type="text"
                  value={createForm.adminName}
                  onChange={(e) => setCreateForm({...createForm, adminName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                <input
                  type="email"
                  value={createForm.adminEmail}
                  onChange={(e) => setCreateForm({...createForm, adminEmail: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
                <input
                  type="password"
                  value={createForm.adminPassword}
                  onChange={(e) => setCreateForm({...createForm, adminPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Firebase Project</label>
                <div className="flex gap-2">
                  <select
                    value={createForm.firebaseProjectId}
                    onChange={(e) => setCreateForm({...createForm, firebaseProjectId: e.target.value})}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select Firebase Project</option>
                    {firebaseProjects.filter(p => p.status === 'available').map(project => (
                      <option key={project.id} value={project.id}>{project.name} ({project.projectId})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => refreshFirebaseProjects()}
                    disabled={refreshingProjects}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh Firebase Projects List"
                  >
                    {refreshingProjects ? '⏳ Refreshing...' : '🔄 Refresh'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openFirebaseConsole()}
                    className="px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                    title="Open Firebase Console to create new project"
                  >
                    🔥 Firebase Console
                  </button>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500">Click Firebase Console to create a new project</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">
                      {firebaseProjects.filter(p => p.status === 'available').length} projects available
                    </p>
                    <button
                      type="button"
                      onClick={() => syncFromFirebaseConsole()}
                      disabled={refreshingProjects}
                      className="text-xs text-purple-600 hover:text-purple-800 underline disabled:opacity-50"
                    >
                      {refreshingProjects ? '⏳ Syncing...' : '🔄 Sync from Console'}
                    </button>
                    {firebaseProjects.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const projectId = prompt("Enter sample project ID (e.g. sample-project-123):");
                          if (projectId) addFirebaseProject(projectId);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Add Sample Project
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* URL Configuration */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-blue-900 mb-4">🌐 URL Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Generated URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={createForm.customUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(createForm.customUrl)}
                      className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                      title="Copy URL"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Auto-generated clean URL for the company</p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="useCustomDomain"
                    checked={createForm.useCustomDomain}
                    onChange={(e) => setCreateForm({...createForm, useCustomDomain: e.target.checked})}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="useCustomDomain" className="ml-2 block text-sm text-gray-700">
                    Use custom domain (company has their own domain)
                  </label>
                </div>

                {createForm.useCustomDomain && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Custom Domain</label>
                      <input
                        type="text"
                        value={createForm.customDomain}
                        onChange={(e) => setCreateForm({...createForm, customDomain: e.target.value, customUrl: `https://${e.target.value}`})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="company.com"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Domain Provider</label>
                      <select
                        value={createForm.domainProvider}
                        onChange={(e) => setCreateForm({...createForm, domainProvider: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select Domain Provider</option>
                        <option value="godaddy">GoDaddy</option>
                        <option value="namecheap">Namecheap</option>
                        <option value="cloudflare">Cloudflare</option>
                        <option value="google-domains">Google Domains</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Domain Setup Instructions</label>
                      <textarea
                        value={createForm.domainInstructions}
                        onChange={(e) => setCreateForm({...createForm, domainInstructions: e.target.value})}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Instructions for the company to set up their domain..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                <input
                  type="color"
                  value={createForm.primaryColor}
                  onChange={(e) => setCreateForm({...createForm, primaryColor: e.target.value})}
                  className="w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                <input
                  type="color"
                  value={createForm.secondaryColor}
                  onChange={(e) => setCreateForm({...createForm, secondaryColor: e.target.value})}
                  className="w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Firebase Setup Helper */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-orange-900 mb-2">🔥 Firebase Setup Helper</h3>
              <div className="space-y-2">
                <p className="text-sm text-orange-800">
                  <strong>Step 1:</strong> Click "Firebase Console" button above to open Firebase Console
                </p>
                <p className="text-sm text-orange-800">
                  <strong>Step 2:</strong> Create a new project with ID: <code className="bg-orange-100 px-1 rounded">{createForm.subdomain || 'company-name'}-crm</code>
                </p>
                <p className="text-sm text-orange-800">
                  <strong>Step 3:</strong> Enable Firestore Database, Authentication, and Storage
                </p>
                <p className="text-sm text-orange-800">
                  <strong>Step 4:</strong> Copy the project ID and add it to the Firebase Projects list
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
              >
                Create Company
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Company Modal */}
      {isEditModalOpen && selectedCompany && (
        <Modal title="Edit Company" onClose={() => setIsEditModalOpen(false)}>
          <form onSubmit={handleUpdateCompany} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subdomain</label>
                <input
                  type="text"
                  value={createForm.subdomain}
                  onChange={(e) => setCreateForm({...createForm, subdomain: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={createForm.contactEmail}
                onChange={(e) => setCreateForm({...createForm, contactEmail: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom URL</label>
              <input
                type="url"
                value={createForm.customUrl}
                onChange={(e) => setCreateForm({...createForm, customUrl: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://company.example.com"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                <input
                  type="color"
                  value={createForm.primaryColor}
                  onChange={(e) => setCreateForm({...createForm, primaryColor: e.target.value})}
                  className="w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                <input
                  type="color"
                  value={createForm.secondaryColor}
                  onChange={(e) => setCreateForm({...createForm, secondaryColor: e.target.value})}
                  className="w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
              >
                Update Company
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Firebase Projects Management */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Firebase Projects Management</h3>
            <div className="flex gap-2">
              <button
                onClick={() => openFirebaseConsole()}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors flex items-center gap-2"
              >
                🔥 Open Firebase Console
              </button>
              <button
                onClick={() => syncFromFirebaseConsole()}
                disabled={refreshingProjects}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Sync common Firebase projects"
              >
                {refreshingProjects ? '⏳ Syncing...' : '🔄 Sync from Console'}
              </button>
              <button
                onClick={() => {
                  const projectId = prompt('Enter new Firebase project ID:');
                  if (projectId) {
                    addFirebaseProject(projectId);
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                ➕ Add Project
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {firebaseProjects.map((project) => (
                  <tr key={project.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{project.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{project.projectId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        project.status === 'available' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => openFirebaseConsole(project.projectId)}
                        className="text-orange-600 hover:text-orange-900 mr-3"
                      >
                        🔥 Console
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this project?')) {
                            deleteFirebaseProject(project.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;