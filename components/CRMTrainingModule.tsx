import React, { useState } from 'react';
import { Lead, User } from '../types';

interface CRMTrainingModuleProps {
  userRole: string;
  currentUser: string;
  leads: Lead[];
  availableUsers: User[];
}

export const CRMTrainingModule: React.FC<CRMTrainingModuleProps> = ({
  userRole,
  currentUser,
  leads,
  availableUsers
}) => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set(['overview']));

  // 🟢 SAFE FIX: Robust data sampling
  const safeLeads = Array.isArray(leads) ? leads : [];
  const sampleLeads = safeLeads.slice(0, 3);
  
  const sampleFollowUps = safeLeads
    .flatMap(lead => (Array.isArray(lead.followUps) ? lead.followUps : []))
    .slice(0, 5);

  const toggleTopic = (topic: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topic)) {
      newExpanded.delete(topic);
    } else {
      newExpanded.add(topic);
    }
    setExpandedTopics(newExpanded);
  };

  const trainingSections = {
    overview: {
      title: "🎯 CRM Overview & Navigation",
      content: (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Welcome to Canam Marketing CRM</h3>
            <p className="text-blue-700">
              This comprehensive training guide will help you master all aspects of our CRM system. 
              Each section includes real examples from your current data to provide practical learning.
            </p>
          </div>

          

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white p-4 border rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">🏗️ System Architecture</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Cloud-based Firebase backend</li>
                <li>• Real-time data synchronization</li>
                <li>• Mobile-responsive design</li>
                <li>• GPS tracking integration</li>
                <li>• Role-based access control</li>
              </ul>
            </div>
            <div className="bg-white p-4 border rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">🎭 Your Role: {userRole}</h4>
              <p className="text-sm text-gray-600">
                Based on your role, you have access to specific features and permissions. 
                This training is customized for your access level.
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-2">📊 Current System Stats</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-yellow-700">{safeLeads.length}</div>
                <div className="text-sm text-yellow-600">Total Leads</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-700">{(Array.isArray(availableUsers) ? availableUsers : []).length}</div>
                <div className="text-sm text-yellow-600">Team Members</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-700">{sampleFollowUps.length}</div>
                <div className="text-sm text-yellow-600">Active Follow-ups</div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    leads: {
      title: "🌐 Leads Management",
      content: (
        <div className="space-y-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 mb-2">Leads Management Overview</h3>
            <p className="text-green-700">
              Leads are your primary business prospects. Each lead represents an agency or partner 
              you're working with to generate student applications.
            </p>
          </div>

          

[Image of Lead management process flow]


          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">📋 Lead Status Types</h4>
              <div className="space-y-2">
                {['New', 'In Pipeline', 'ICP Qualified', 'Portal Deactivated', 'Onboarded', 'Lost', 'MOU Signature Pending', 'Agent Portal Created', 'Agent Portal Reactivated'].map(status => (
                  <div key={status} className="flex items-center p-2 bg-gray-50 rounded">
                    <span className="w-3 h-3 bg-blue-500 rounded-full mr-3"></span>
                    <span className="text-sm">{status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">🏆 Agent Categories</h4>
              <div className="space-y-2">
                {['Platinum', 'Diamond', 'Gold', 'Silver', 'Bronze', 'Beginner'].map(category => (
                  <div key={category} className="flex items-center p-2 bg-gray-50 rounded">
                    <span className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></span>
                    <span className="text-sm">{category}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {sampleLeads.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3">📊 Live Lead Examples</h4>
              <div className="space-y-3">
                {sampleLeads.map(lead => {
                  const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
                  return (
                    <div key={lead.id} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-medium text-gray-800">{lead.agencyName}</h5>
                          <p className="text-sm text-gray-600">Status: <span className="font-medium">{lead.status}</span> | Category: <span className="font-medium">{lead.agentCategory}</span></p>
                          {lead.accountManager && (
                            <p className="text-sm text-gray-500">Account Manager: {lead.accountManager}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Created: {new Date(lead.createdAt).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-500">Contacts: {safeContacts.length}</p>
                        </div>
                      </div>
                      {safeContacts.length > 0 && safeContacts[0] && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">
                            Primary Contact: {safeContacts[0].name} ({safeContacts[0].role}) - {safeContacts[0].phone}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">✅ Lead Management Best Practices</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Always add complete contact information</li>
              <li>• Update status regularly to reflect current relationship</li>
              <li>• Assign appropriate agent category based on performance</li>
              <li>• Use tags to categorize leads (e.g., "High Potential", "UK Specialist")</li>
              <li>• Keep contact details updated and verified</li>
            </ul>
          </div>
        </div>
      )
    },

    contacts: {
      title: "👥 Contact Management",
      content: (
        <div className="space-y-6">
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-800 mb-2">Contact Management System</h3>
            <p className="text-purple-700">
              Each lead can have multiple contacts. The primary contact is the main point of communication, 
              while additional contacts can be added for different departments or roles.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">📞 Contact Information Fields</h4>
              <div className="space-y-2">
                {[
                  { field: 'Name', required: true, description: 'Full name of the contact person' },
                  { field: 'Role', required: false, description: 'Position/designation (e.g., Director, Counselor)' },
                  { field: 'Phone', required: true, description: 'Primary mobile number (10 digits)' },
                  { field: 'Email', required: false, description: 'Email address for communication' },
                  { field: 'Address', required: false, description: 'Physical address of the agency' },
                  { field: 'City/State/Country', required: false, description: 'Geographic location details' },
                  { field: 'Alternate Mobile', required: false, description: 'Secondary contact number' },
                  { field: 'POC Details', required: false, description: 'Point of Contact name and designation' }
                ].map(field => (
                  <div key={field.field} className="p-2 bg-gray-50 rounded">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{field.field}</span>
                      {field.required && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Required</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">📋 Contact Roles & Responsibilities</h4>
              <div className="space-y-2">
                {[
                  { role: 'Director', description: 'Overall agency management and decision making' },
                  { role: 'Counselor', description: 'Student guidance and application support' },
                  { role: 'POC', description: 'Primary point of contact for day-to-day operations' },
                  { role: 'Manager', description: 'Team management and coordination' },
                  { role: 'Coordinator', description: 'Process coordination and follow-ups' }
                ].map(role => (
                  <div key={role.role} className="p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{role.role}</span>
                    <p className="text-xs text-gray-500">{role.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {sampleLeads.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3">👥 Live Contact Examples</h4>
              <div className="space-y-3">
                {sampleLeads.map(lead => {
                  const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
                  return safeContacts.length > 0 && (
                    <div key={lead.id} className="border-l-4 border-purple-500 pl-4 py-2">
                      <h5 className="font-medium text-gray-800">{lead.agencyName}</h5>
                      <div className="space-y-2 mt-2">
                        {safeContacts.map((contact, idx) => (
                          <div key={contact.id || idx} className="bg-gray-50 p-3 rounded">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">{contact.name}</p>
                                <p className="text-xs text-gray-600">{contact.role}</p>
                                <p className="text-xs text-gray-500">{contact.phone}</p>
                                {contact.email && <p className="text-xs text-gray-500">{contact.email}</p>}
                              </div>
                              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                                {idx === 0 ? 'Primary' : 'Secondary'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )
    },

    followups: {
      title: "📞 Follow-ups & Meetings",
      content: (
        <div className="space-y-6">
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-orange-800 mb-2">Follow-ups & Meeting Management</h3>
            <p className="text-orange-700">
              Follow-ups are crucial for maintaining relationships with your leads. Track calls, meetings, 
              and emails to ensure consistent communication and progress tracking.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white p-4 border rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">📞 Follow-up Types</h4>
              <div className="space-y-2">
                {['Call', 'Meeting', 'Email'].map(type => (
                  <div key={type} className="flex items-center p-2 bg-gray-50 rounded">
                    <span className="w-3 h-3 bg-blue-500 rounded-full mr-3"></span>
                    <span className="text-sm">{type}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 border rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">📊 Follow-up Status</h4>
              <div className="space-y-2">
                {['Planned', 'Done'].map(status => (
                  <div key={status} className="flex items-center p-2 bg-gray-50 rounded">
                    <span className={`w-3 h-3 rounded-full mr-3 ${status === 'Planned' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                    <span className="text-sm">{status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 border rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">📅 Meeting Features</h4>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">• Meeting check-in/out</div>
                <div className="text-sm text-gray-600">• Photo uploads</div>
                <div className="text-sm text-gray-600">• GPS location tracking</div>
                <div className="text-sm text-gray-600">• Duration tracking</div>
                <div className="text-sm text-gray-600">• Meeting outcomes</div>
              </div>
            </div>
          </div>

          {sampleFollowUps.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3">📞 Live Follow-up Examples</h4>
              <div className="space-y-3">
                {sampleFollowUps.map((followUp, idx) => (
                  <div key={followUp.id || idx} className="border-l-4 border-orange-500 pl-4 py-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{followUp.type}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            followUp.status === 'Planned' 
                              ? 'bg-yellow-100 text-yellow-600' 
                              : 'bg-green-100 text-green-600'
                          }`}>
                            {followUp.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{followUp.notes}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Scheduled: {new Date(followUp.date).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">✅ Follow-up Best Practices</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Schedule follow-ups immediately after initial contact</li>
              <li>• Use different types (Call/Meeting/Email) based on context</li>
              <li>• Always add detailed notes about the conversation</li>
              <li>• Mark follow-ups as 'Done' when completed</li>
              <li>• Use meeting check-in for in-person meetings</li>
              <li>• Take photos during meetings for documentation</li>
            </ul>
          </div>
        </div>
      )
    },

    pipeline: {
      title: "📊 Pipeline Management",
      content: (
        <div className="space-y-6">
          <div className="bg-indigo-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-indigo-800 mb-2">Pipeline Management System</h3>
            <p className="text-indigo-700">
              The pipeline view shows leads that are actively being worked on. This helps you focus 
              on leads that need attention and track progress through your sales process.
            </p>
          </div>

          

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">🎯 Pipeline Lead Statuses</h4>
              <div className="space-y-2">
                {['New', 'In Pipeline', 'ICP Qualified', 'MOU Signature Pending', 'Agent Portal Created'].map(status => (
                  <div key={status} className="flex items-center p-2 bg-gray-50 rounded">
                    <span className="w-3 h-3 bg-indigo-500 rounded-full mr-3"></span>
                    <span className="text-sm">{status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">📈 Pipeline Metrics</h4>
              <div className="space-y-2">
                <div className="p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">Conversion Rate</span>
                  <p className="text-xs text-gray-500">Track leads moving through stages</p>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">Time in Pipeline</span>
                  <p className="text-xs text-gray-500">Average time from New to Onboarded</p>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">Activity Level</span>
                  <p className="text-xs text-gray-500">Recent follow-ups and interactions</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-3">📊 Pipeline Workflow</h4>
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg">
              {['New', 'In Pipeline', 'ICP Qualified', 'MOU Pending', 'Onboarded'].map((stage, index) => (
                <div key={stage} className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="text-xs mt-2 text-center">{stage}</span>
                  {index < 4 && <div className="absolute w-full h-0.5 bg-gray-300 top-4 left-1/2 transform translate-x-4 -z-10"></div>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">🎯 Pipeline Management Tips</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Review pipeline weekly to identify stuck leads</li>
              <li>• Focus on high-potential leads first</li>
              <li>• Update status promptly when leads progress</li>
              <li>• Use follow-ups to move leads through pipeline</li>
              <li>• Monitor conversion rates by agent category</li>
            </ul>
          </div>
        </div>
      )
    },

    reports: {
      title: "📈 Reports & Analytics",
      content: (
        <div className="space-y-6">
          <div className="bg-teal-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-teal-800 mb-2">Reports & Analytics Dashboard</h3>
            <p className="text-teal-700">
              Generate comprehensive reports to track performance, analyze trends, and make data-driven decisions. 
              Access varies by user role.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">📊 Available Reports</h4>
              <div className="space-y-2">
                {[
                  { report: 'Lead Performance', description: 'Conversion rates and lead quality metrics' },
                  { report: 'Follow-up Analytics', description: 'Activity levels and response rates' },
                  { report: 'Agent Category Analysis', description: 'Performance by agent tier' },
                  { report: 'Geographic Reports', description: 'Location-based performance data' },
                  { report: 'Time-based Trends', description: 'Monthly/quarterly performance trends' },
                  { report: 'User Activity', description: 'Team member productivity metrics' }
                ].map(report => (
                  <div key={report.report} className="p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{report.report}</span>
                    <p className="text-xs text-gray-500">{report.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">🎭 Role-based Access</h4>
              <div className="space-y-2">
                {[
                  { role: 'Admin/SuperAdmin', access: 'Full access to all reports and analytics' },
                  { role: 'Account Manager', access: 'Access to assigned leads and team reports' },
                  { role: 'Sales', access: 'Personal performance and lead reports' },
                  { role: 'Operations', access: 'Operational metrics and process reports' }
                ].map(role => (
                  <div key={role.role} className="p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{role.role}</span>
                    <p className="text-xs text-gray-500">{role.access}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-3">📈 Key Performance Indicators</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { metric: 'Total Leads', value: safeLeads.length, color: 'blue' },
                { metric: 'Active Follow-ups', value: sampleFollowUps.length, color: 'green' },
                { metric: 'Pipeline Leads', value: safeLeads.filter(l => l.status === 'In Pipeline').length, color: 'yellow' },
                { metric: 'Onboarded Leads', value: safeLeads.filter(l => l.status === 'Onboarded').length, color: 'purple' }
              ].map(metric => (
                <div key={metric.metric} className="text-center p-3 bg-gray-50 rounded">
                  <div className={`text-2xl font-bold text-${metric.color}-600`}>{metric.value}</div>
                  <div className="text-xs text-gray-600">{metric.metric}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">📊 Report Best Practices</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Review reports weekly for performance insights</li>
              <li>• Export data for external analysis when needed</li>
              <li>• Focus on trends rather than individual data points</li>
              <li>• Use reports to identify training opportunities</li>
              <li>• Share relevant reports with team members</li>
            </ul>
          </div>
        </div>
      )
    },

    gps: {
      title: "🗺️ GPS Tracking & Maps",
      content: (
        <div className="space-y-6">
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-red-800 mb-2">GPS Tracking & Location Services</h3>
            <p className="text-red-700">
              Advanced GPS tracking system for real-time location monitoring, meeting check-ins, 
              and travel analytics. Access levels vary by user role.
            </p>
          </div>

          

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">📍 GPS Features</h4>
              <div className="space-y-2">
                {[
                  { feature: 'Real-time Tracking', description: 'Live location updates every 5-30 seconds' },
                  { feature: 'Meeting Check-in', description: 'GPS-verified meeting attendance' },
                  { feature: 'Travel Analytics', description: 'Distance and time tracking' },
                  { feature: 'Route Optimization', description: 'Efficient travel planning' },
                  { feature: 'Geofencing', description: 'Virtual boundary notifications' },
                  { feature: 'Offline Support', description: 'Queue updates when offline' }
                ].map(feature => (
                  <div key={feature.feature} className="p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{feature.feature}</span>
                    <p className="text-xs text-gray-500">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">👥 Role-based Access</h4>
              <div className="space-y-2">
                {[
                  { role: 'Admin/SuperAdmin', access: 'Full GPS tracking and team monitoring' },
                  { role: 'Account Manager', access: 'Team location tracking and meeting verification' },
                  { role: 'Sales/Operations', access: 'Personal location and meeting check-ins' }
                ].map(role => (
                  <div key={role.role} className="p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{role.role}</span>
                    <p className="text-xs text-gray-500">{role.access}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-3">📱 Mobile GPS Setup</h4>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded">
                <h5 className="font-medium text-blue-800">Step 1: Enable Location Services</h5>
                <p className="text-sm text-blue-700">Allow location access when prompted by your browser</p>
              </div>
              <div className="p-3 bg-green-50 rounded">
                <h5 className="font-medium text-green-800">Step 2: Start Tracking</h5>
                <p className="text-sm text-green-700">Navigate to "My Location" or "Live GPS Tracking" section</p>
              </div>
              <div className="p-3 bg-purple-50 rounded">
                <h5 className="font-medium text-purple-800">Step 3: Meeting Check-in</h5>
                <p className="text-sm text-purple-700">Use GPS-verified check-in for meetings</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-2">⚠️ GPS Privacy & Best Practices</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• GPS tracking is only active during work hours</li>
              <li>• Location data is encrypted and secure</li>
              <li>• Only authorized personnel can view location data</li>
              <li>• Meeting check-ins are optional but recommended</li>
              <li>• Contact admin if you have privacy concerns</li>
            </ul>
          </div>
        </div>
      )
    },

    admin: {
      title: "👥 User & System Administration",
      content: (
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Administrative Functions</h3>
            <p className="text-gray-700">
              {userRole === 'Admin' || userRole === 'SuperAdmin' 
                ? "You have administrative access. This section covers user management, system settings, and data administration."
                : "Administrative functions are restricted to Admin and SuperAdmin roles only."
              }
            </p>
          </div>

          

          {(userRole === 'Admin' || userRole === 'SuperAdmin') ? (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">👥 User Management</h4>
                  <div className="space-y-2">
                    {[
                      { function: 'Add New Users', description: 'Create accounts for new team members' },
                      { function: 'User Approval', description: 'Approve pending user registrations' },
                      { function: 'Role Assignment', description: 'Assign roles and permissions' },
                      { function: 'Password Management', description: 'Reset and manage user passwords' },
                      { function: 'User Status', description: 'Activate/deactivate user accounts' }
                    ].map(func => (
                      <div key={func.function} className="p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{func.function}</span>
                        <p className="text-xs text-gray-500">{func.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">🗄️ Data Administration</h4>
                  <div className="space-y-2">
                    {[
                      { function: 'Database Management', description: 'View and manage database records' },
                      { function: 'Data Export', description: 'Export leads and reports to Excel/CSV' },
                      { function: 'Usage Reports', description: 'Monitor system usage and activity' },
                      { function: 'Meeting Photos', description: 'Manage uploaded meeting photos' },
                      { function: 'System Settings', description: 'Configure system-wide settings' }
                    ].map(func => (
                      <div key={func.function} className="p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{func.function}</span>
                        <p className="text-xs text-gray-500">{func.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">👥 Current Team Overview</h4>
                <div className="space-y-2">
                  {(Array.isArray(availableUsers) ? availableUsers : []).map(user => (
                    <div key={user.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <span className="text-sm font-medium">{user.name || user.email}</span>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded ${
                          user.role === 'Admin' || user.role === 'SuperAdmin' 
                            ? 'bg-red-100 text-red-600' 
                            : user.role === 'Account Manager'
                            ? 'bg-blue-100 text-blue-600'
                            : user.role === 'Sales'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.role}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{user.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-800 mb-2">🔒 Access Restricted</h4>
              <p className="text-yellow-700 text-sm">
                Administrative functions are only available to Admin and SuperAdmin users. 
                Contact your administrator if you need access to specific administrative features.
              </p>
            </div>
          )}
        </div>
      )
    },

    sop: {
      title: "📋 Standard Operating Procedures",
      content: (
        <div className="space-y-6">
          <div className="bg-emerald-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-emerald-800 mb-2">Standard Operating Procedures (SOPs)</h3>
            <p className="text-emerald-700">
              Comprehensive procedures for common CRM tasks. Follow these SOPs to ensure consistency 
              and best practices across the organization.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                title: "📝 Adding a New Lead",
                steps: [
                  "Click 'Add Lead' button from the leads dashboard",
                  "Fill in agency name (required)",
                  "Add primary contact information (name, phone, email required)",
                  "Select appropriate agent category (Platinum, Diamond, Gold, Silver, Bronze, Beginner)",
                  "Choose lead status (default: New)",
                  "Add any relevant tags",
                  "Assign account manager and sales person if applicable",
                  "Save the lead"
                ]
              },
              {
                title: "📞 Scheduling a Follow-up",
                steps: [
                  "Open the lead details from the leads list",
                  "Navigate to the Follow-ups tab",
                  "Click 'Add Follow-up' button",
                  "Select follow-up type (Call, Meeting, Email)",
                  "Set date and time",
                  "Add detailed notes about the planned interaction",
                  "Assign to appropriate team member",
                  "Save the follow-up"
                ]
              },
              {
                title: "📅 Meeting Check-in Process",
                steps: [
                  "Navigate to the meeting location",
                  "Go to 'Meetings' section in the CRM",
                  "Find the scheduled meeting",
                  "Click 'Check-in' button",
                  "Allow GPS location access when prompted",
                  "Take meeting photos if required",
                  "Add meeting notes and outcomes",
                  "Check-out when meeting is complete"
                ]
              },
              {
                title: "🔄 Updating Lead Status",
                steps: [
                  "Open the lead details",
                  "Click 'Edit' button",
                  "Update the status field to reflect current progress",
                  "Add any additional information (onboarding date, applicants, etc.)",
                  "Update remarks if necessary",
                  "Save changes"
                ]
              },
              {
                title: "📊 Generating Reports",
                steps: [
                  "Navigate to 'Reports' section",
                  "Select report type based on your needs",
                  "Choose date range and filters",
                  "Review the generated report",
                  "Export to Excel/CSV if needed",
                  "Share with relevant team members"
                ]
              },
              {
                title: "👥 User Management (Admin Only)",
                steps: [
                  "Go to 'Users' section",
                  "Click 'Add User' for new team members",
                  "Fill in user details and assign role",
                  "Set password or enable Google sign-in",
                  "Approve the user account",
                  "Assign leads and permissions as needed"
                ]
              }
            ].map((sop, index) => (
              <div key={index} className="bg-white border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">{sop.title}</h4>
                <ol className="space-y-2">
                  {sop.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                        {stepIndex + 1}
                      </span>
                      <span className="text-sm text-gray-700">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">📋 SOP Compliance Guidelines</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Always follow SOPs for consistent data quality</li>
              <li>• Update SOPs when processes change</li>
              <li>• Train new team members on relevant SOPs</li>
              <li>• Document any deviations with reasons</li>
              <li>• Review SOPs quarterly for improvements</li>
            </ul>
          </div>
        </div>
      )
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">CRM Training & User Manual</h1>
        <p className="text-gray-600">
          Comprehensive training guide for {userRole} role • Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold text-gray-800 mb-4">Training Sections</h3>
            <nav className="space-y-1">
              {Object.entries(trainingSections).map(([key, section]) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveSection(key);
                    toggleTopic(key);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeSection === key
                      ? 'bg-blue-100 text-blue-800 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6">
              {trainingSections[activeSection as keyof typeof trainingSections]?.content}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 bg-white rounded-lg shadow-sm border p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSection('overview')}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200"
          >
            Back to Overview
          </button>
          <button
            onClick={() => setActiveSection('sop')}
            className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm hover:bg-green-200"
          >
            View SOPs
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
          >
            Print Guide
          </button>
        </div>
      </div>
    </div>
  );
};