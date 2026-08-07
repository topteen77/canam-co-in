// components/FirebaseProjectManager.tsx – uses API (MySQL firebase_projects table)
import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

interface FirebaseProject {
  id: string;
  companyId: string;
  projectName: string;
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: any;
  updatedAt: any;
}

interface FirebaseProjectManagerProps {
  onProjectAdded: (project: FirebaseProject) => void;
  onProjectUpdated: (project: FirebaseProject) => void;
  onProjectDeleted: (projectId: string) => void;
}

const FirebaseProjectManager: React.FC<FirebaseProjectManagerProps> = ({
  onProjectAdded,
  onProjectUpdated,
  onProjectDeleted
}) => {
  const [projects, setProjects] = useState<FirebaseProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProject, setEditingProject] = useState<FirebaseProject | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    companyId: '',
    projectName: '',
    projectId: '',
    apiKey: '',
    authDomain: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '',
    status: 'active' as const
  });

  // Load projects
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data } = await apiClient.get('/firebase-projects');
      const projectsData = (Array.isArray(data) ? data : []).map((row: any) => ({
        id: row.id,
        companyId: row.assigned_to ?? row.assignedTo ?? '',
        projectName: row.project_name ?? row.projectName ?? '',
        projectId: row.project_id ?? row.projectId ?? '',
        ...(typeof row.payload === 'object' ? row.payload : {}),
        status: row.status ?? 'active',
        createdAt: row.created_at ?? row.createdAt,
        updatedAt: row.updated_at ?? row.updatedAt,
      })) as FirebaseProject[];
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        projectId: formData.projectId,
        projectName: formData.projectName,
        status: formData.status,
        assignedTo: formData.companyId || null,
        payload: {
          companyId: formData.companyId,
          apiKey: formData.apiKey,
          authDomain: formData.authDomain,
          storageBucket: formData.storageBucket,
          messagingSenderId: formData.messagingSenderId,
          appId: formData.appId,
          measurementId: formData.measurementId,
        },
      };
      const { data } = await apiClient.post('/firebase-projects', payload);
      const newId = data?.id ?? `fp_${Date.now()}`;
      const newProject: FirebaseProject = {
        id: newId,
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProjects(prev => [...prev, newProject]);
      onProjectAdded(newProject);
      setFormData({
        companyId: '',
        projectName: '',
        projectId: '',
        apiKey: '',
        authDomain: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: '',
        status: 'active'
      });
      setShowAddForm(false);
      alert('✅ Project added successfully!');
    } catch (error) {
      console.error('Error adding project:', error);
      alert('❌ Error adding project. Please try again.');
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    try {
      await apiClient.put(`/firebase-projects/${editingProject.id}`, {
        status: formData.status,
        assignedTo: formData.companyId || null,
        payload: {
          companyId: formData.companyId,
          projectName: formData.projectName,
          projectId: formData.projectId,
          apiKey: formData.apiKey,
          authDomain: formData.authDomain,
          storageBucket: formData.storageBucket,
          messagingSenderId: formData.messagingSenderId,
          appId: formData.appId,
          measurementId: formData.measurementId,
        },
      });
      const updatedProject: FirebaseProject = {
        ...editingProject,
        ...formData,
        updatedAt: new Date().toISOString(),
      };
      setProjects(prev => prev.map(p => p.id === editingProject.id ? updatedProject : p));
      onProjectUpdated(updatedProject);
      setEditingProject(null);
      setShowAddForm(false);
      alert('✅ Project updated successfully!');
    } catch (error) {
      console.error('Error updating project:', error);
      alert('❌ Error updating project. Please try again.');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!projectId) return;
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
    try {
      await apiClient.delete(`/firebase-projects/${projectId}`);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      onProjectDeleted(projectId);
      alert('✅ Project deleted successfully!');
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('❌ Error deleting project. Please try again.');
    }
  };

  const openEditForm = (project: FirebaseProject) => {
    setEditingProject(project);
    // 🟢 SAFE FIX: Ensure no undefined values reach the form
    setFormData({
      companyId: project.companyId || '',
      projectName: project.projectName || '',
      projectId: project.projectId || '',
      apiKey: project.apiKey || '',
      authDomain: project.authDomain || '',
      storageBucket: project.storageBucket || '',
      messagingSenderId: project.messagingSenderId || '',
      appId: project.appId || '',
      measurementId: project.measurementId || '',
      status: project.status || 'active'
    });
    setShowAddForm(true);
  };

  const openAddForm = () => {
    setEditingProject(null);
    setFormData({
      companyId: '',
      projectName: '',
      projectId: '',
      apiKey: '',
      authDomain: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
      measurementId: '',
      status: 'active'
    });
    setShowAddForm(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-slate-600">Loading Firebase projects...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Firebase Projects</h3>
          <p className="text-sm text-gray-600">Manage separate Firebase projects for each company</p>
        </div>
        <button
          onClick={openAddForm}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          + Add Firebase Project
        </button>
      </div>

      {/* Projects Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {projects.map((project) => (
              <tr key={project.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {project.companyId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {project.projectName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {project.projectId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    project.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : project.status === 'inactive'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {project.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => openEditForm(project)}
                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteProject(project.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingProject ? 'Edit Firebase Project' : 'Add Firebase Project'}
              </h3>
              
              <form onSubmit={editingProject ? handleUpdateProject : handleAddProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company ID</label>
                  <input
                    type="text"
                    value={formData.companyId}
                    onChange={(e) => setFormData({...formData, companyId: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Project Name</label>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={(e) => setFormData({...formData, projectName: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Project ID</label>
                  <input
                    type="text"
                    value={formData.projectId}
                    onChange={(e) => setFormData({...formData, projectId: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">API Key</label>
                  <input
                    type="text"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Auth Domain</label>
                  <input
                    type="text"
                    value={formData.authDomain}
                    onChange={(e) => setFormData({...formData, authDomain: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Storage Bucket</label>
                  <input
                    type="text"
                    value={formData.storageBucket}
                    onChange={(e) => setFormData({...formData, storageBucket: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Messaging Sender ID</label>
                  <input
                    type="text"
                    value={formData.messagingSenderId}
                    onChange={(e) => setFormData({...formData, messagingSenderId: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">App ID</label>
                  <input
                    type="text"
                    value={formData.appId}
                    onChange={(e) => setFormData({...formData, appId: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Measurement ID (Optional)</label>
                  <input
                    type="text"
                    value={formData.measurementId}
                    onChange={(e) => setFormData({...formData, measurementId: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                  >
                    {editingProject ? 'Update' : 'Add'} Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FirebaseProjectManager;