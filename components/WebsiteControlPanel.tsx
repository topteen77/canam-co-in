import React, { useState, useEffect } from 'react';

interface WebsiteContent {
  id: string;
  section: string;
  title: string;
  content: string;
  imageUrl?: string;
  order: number;
  published: boolean;
  lastUpdated: string;
}

interface WebsiteControlPanelProps {
  isAdmin: boolean;
}

const WebsiteControlPanel: React.FC<WebsiteControlPanelProps> = ({ isAdmin }) => {
  const [activeTab, setActiveTab] = useState<string>('home'); // Default to 'home' to avoid empty initial state
  const [sections, setSections] = useState<WebsiteContent[]>([]);
  const [editingSection, setEditingSection] = useState<WebsiteContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [websiteUrl] = useState('https://iapply-3.web.app');

  // Website sections configuration
  const websiteSections = [
    { id: 'home', label: 'Homepage', icon: '🏠', description: 'Manage hero section, features, and main content' },
    { id: 'about', label: 'About Us', icon: '👥', description: 'Edit company information and mission' },
    { id: 'programs', label: 'Programs', icon: '📚', description: 'Manage study programs and courses' },
    { id: 'testimonials', label: 'Testimonials', icon: '💬', description: 'Add/edit partner testimonials' },
    { id: 'destinations', label: 'Destinations', icon: '📍', description: 'Manage destination countries/universities' },
    { id: 'rewards', label: 'Rewards', icon: '🎁', description: 'Edit rewards and offers section' },
    { id: 'vas', label: 'Value Added Services', icon: '⚙️', description: 'Manage VAS offerings' },
  ];

  // Mock data - replace with actual API calls
  useEffect(() => {
    // Simulate loading website content
    setIsLoading(true);
    const timer = setTimeout(() => {
      setSections([
        { id: '1', section: 'home', title: 'Hero Section', content: 'Welcome to iApply by Canam', order: 1, published: true, lastUpdated: new Date().toISOString() },
        { id: '2', section: 'about', title: 'About Us', content: 'Empowering study abroad agents worldwide', order: 1, published: true, lastUpdated: new Date().toISOString() },
      ]);
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleEdit = (section: WebsiteContent) => {
    setEditingSection({ ...section });
  };

  const handleSave = async () => {
    if (!editingSection) return;
    
    setIsLoading(true);
    // TODO: Call API to save changes
    try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate async
        setSections(prevSections => prevSections.map(s => s.id === editingSection.id ? editingSection : s));
        setEditingSection(null);
        alert('Changes saved successfully!');
    } catch (e) {
        console.error("Save failed", e);
        alert("Failed to save changes.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleOpenWebsite = () => {
    window.open(websiteUrl, '_blank');
  };

  const handlePublish = async (sectionId: string) => {
    setIsLoading(true);
    // TODO: Call API to publish/unpublish
    try {
        await new Promise(resolve => setTimeout(resolve, 500));
        setSections(prevSections => prevSections.map(s => s.id === sectionId ? { ...s, published: !s.published } : s));
    } catch (e) {
        console.error("Publish failed", e);
    } finally {
        setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="text-center py-8">
          <span className="text-6xl block mb-4">🌐</span>
          <h2 className="text-xl font-bold text-gray-700 mb-2">Access Denied</h2>
          <p className="text-gray-500">You need administrator privileges to access the Website Control Panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🌐</span>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Website Control Panel</h1>
              <p className="text-sm text-slate-500">Manage iApply by Canam website content and sections</p>
            </div>
          </div>
          <button
            onClick={handleOpenWebsite}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <span>🌐</span>
            View Live Website
          </button>
        </div>

        <div className="border-t pt-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-indigo-600">{sections.length}</div>
              <div className="text-sm text-slate-500">Total Sections</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{sections.filter(s => s.published).length}</div>
              <div className="text-sm text-slate-500">Published</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 truncate px-2">{websiteUrl}</div>
              <div className="text-sm text-slate-500">Live URL</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
        <div className="bg-white rounded-xl shadow">
        <div className="border-b border-slate-200">
          <nav className="flex overflow-x-auto no-scrollbar">
            {websiteSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === section.id
                    ? 'border-indigo-600 text-indigo-600 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-indigo-600'
                }`}
              >
                <span className="text-lg">{section.icon}</span>
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-3 text-slate-600">Loading...</span>
            </div>
          ) : editingSection ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Editing: {editingSection.title}</h3>
                  <button
                    onClick={() => setEditingSection(null)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-xl"
                    aria-label="Close editor"
                  >
                    ✕
                  </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
                <input
                  type="text"
                  value={editingSection.title}
                  onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Content</label>
                <textarea
                  value={editingSection.content}
                  onChange={(e) => setEditingSection({ ...editingSection, content: e.target.value })}
                  rows={10}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Image URL</label>
                <input
                  type="url"
                  value={editingSection.imageUrl || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, imageUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <span>💾</span>
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingSection(null)}
                  className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  {websiteSections.find(s => s.id === activeTab)?.label}
                </h3>
                <p className="text-sm text-slate-500">
                  {websiteSections.find(s => s.id === activeTab)?.description}
                </p>
              </div>

              <div className="space-y-4">
                {sections.filter(s => s.section === activeTab).length > 0 ? (
                  sections
                    .filter(s => s.section === activeTab)
                    .map((section) => (
                      <div
                        key={section.id}
                        className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-slate-50/50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-slate-800">{section.title}</h4>
                              {section.published ? (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                  Published
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                                  Draft
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mb-2 line-clamp-2">{section.content}</p>
                            <p className="text-xs text-slate-400">
                              Last updated: {new Date(section.lastUpdated).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleEdit(section)}
                              className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors text-lg"
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handlePublish(section.id)}
                              className={`p-2 rounded-lg transition-colors text-lg ${
                                section.published
                                  ? 'hover:bg-orange-50 text-orange-600'
                                  : 'hover:bg-green-50 text-green-600'
                              }`}
                              title={section.published ? 'Unpublish' : 'Publish'}
                            >
                              {section.published ? '✕' : '💾'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-lg">
                    <span className="text-5xl mb-3 block opacity-50">📄</span>
                    <p className="text-slate-500 mb-4">No content found for this section</p>
                    <button
                      onClick={() => {
                        const newSection: WebsiteContent = {
                          id: Date.now().toString(),
                          section: activeTab,
                          title: `New ${websiteSections.find(s => s.id === activeTab)?.label} Content`,
                          content: '',
                          order: sections.filter(s => s.section === activeTab).length + 1,
                          published: false,
                          lastUpdated: new Date().toISOString(),
                        };
                        setEditingSection(newSection);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors mx-auto"
                    >
                      <span>➕</span>
                      Add New Content
                    </button>
                  </div>
                )}

                {sections.filter(s => s.section === activeTab).length > 0 && (
                  <button
                    onClick={() => {
                      const newSection: WebsiteContent = {
                        id: Date.now().toString(),
                        section: activeTab,
                        title: `New ${websiteSections.find(s => s.id === activeTab)?.label} Content`,
                        content: '',
                        order: sections.filter(s => s.section === activeTab).length + 1,
                        published: false,
                        lastUpdated: new Date().toISOString(),
                      };
                      setEditingSection(newSection);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <span>➕</span>
                    Add New Content
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebsiteControlPanel;