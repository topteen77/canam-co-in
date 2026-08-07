import React, { useState, useMemo } from 'react';
import type { Lead, AgentCategory, LeadStatus, LeadSource } from '../types';
import { AGENT_CATEGORIES, LEAD_STATUSES, LEAD_SOURCES } from '../types';
import { MultiSelect } from './MultiSelect';
import { getUserDisplayName } from '../utils/dataCleaning';

interface AgentDashboardProps {
  leads: Lead[];
  availableUsers?: Array<{id: string, name: string, email: string, role: string}>;
  onViewChange?: (view: string, filters?: any) => void;
  showAccountManagerFilter?: boolean;
}

interface DashboardFilters {
  dateCreatedStart?: string;
  dateCreatedEnd?: string;
  accountManagers: string[];
  leadSources: LeadSource[];
  categories: AgentCategory[];
  statuses: LeadStatus[];
  cities: string[];
  countryInterest: string[]; // Country interest filter
}

type SortField = 'name' | 'date' | 'count' | 'city' | 'active' | 'inactive' | 'total';
type SortDirection = 'asc' | 'desc';

interface SortState {
  field: SortField;
  direction: SortDirection;
}

const AgentDashboard: React.FC<AgentDashboardProps> = ({
  leads,
  availableUsers = [],
  onViewChange,
  showAccountManagerFilter = true
}) => {
  // Filter states
  const [filters, setFilters] = useState<DashboardFilters>({
    dateCreatedStart: '',
    dateCreatedEnd: '',
    accountManagers: [],
    leadSources: [],
    categories: [],
    statuses: [],
    cities: [],
    countryInterest: []
  });

  // Sort states for different sections
  const [sortActiveAgents, setSortActiveAgents] = useState<SortState>({ field: 'date', direction: 'asc' });
  const [sortInactiveAgents, setSortInactiveAgents] = useState<SortState>({ field: 'date', direction: 'desc' });
  const [sortFollowUps, setSortFollowUps] = useState<SortState>({ field: 'count', direction: 'desc' });
  const [sortCityWise, setSortCityWise] = useState<SortState>({ field: 'city', direction: 'asc' });

  // Apply filters to leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // 🟢 SAFE FIX: Pre-calculate safe arrays
      const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
      
      // Date created filter
      if (filters.dateCreatedStart) {
        const leadDate = new Date(lead.createdAt);
        const filterStart = new Date(filters.dateCreatedStart);
        if (leadDate < filterStart) return false;
      }
      if (filters.dateCreatedEnd) {
        const leadDate = new Date(lead.createdAt);
        const filterEnd = new Date(filters.dateCreatedEnd);
        filterEnd.setHours(23, 59, 59, 999); // End of day
        if (leadDate > filterEnd) return false;
      }

      // Account Manager filter
      if (filters.accountManagers.length > 0) {
        if (!lead.accountManager || !filters.accountManagers.includes(lead.accountManager)) {
          return false;
        }
      }

      // Lead Source filter
      if (filters.leadSources.length > 0) {
        if (!lead.leadSource || !filters.leadSources.includes(lead.leadSource)) {
          return false;
        }
      }

      // Category filter
      if (filters.categories.length > 0) {
        if (!lead.agentCategory || !filters.categories.includes(lead.agentCategory)) {
          return false;
        }
      }

      // Status filter
      if (filters.statuses.length > 0) {
        if (!lead.status || !filters.statuses.includes(lead.status)) {
          return false;
        }
      }

      // City filter
      if (filters.cities.length > 0) {
        const leadCity = safeContacts[0]?.city || '';
        if (!leadCity || !filters.cities.includes(leadCity)) {
          return false;
        }
      }

      // Country interest filter
      if (filters.countryInterest.length > 0) {
        // 🟢 SAFE FIX: Handle countryInterest safely
        const leadCountries = Array.isArray(lead.countryInterest) ? lead.countryInterest : ['Canada'];
        const hasMatchingCountry = filters.countryInterest.some(filterCountry => 
          leadCountries.some(leadCountry => leadCountry === filterCountry)
        );
        if (!hasMatchingCountry) return false;
      }

      return true;
    });
  }, [leads, filters]);

  // Get unique values for filters
  const uniqueAccountManagers = useMemo(() => {
    const managers = new Set<string>();
    leads.forEach(lead => {
      if (lead.accountManager) managers.add(lead.accountManager);
    });
    return Array.from(managers).sort();
  }, [leads]);

  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    leads.forEach(lead => {
      // 🟢 SAFE FIX: Safe contact access
      const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
      const city = safeContacts[0]?.city;
      if (city) cities.add(city);
    });
    return Array.from(cities).sort();
  }, [leads]);

  const uniqueCountryInterests = useMemo(() => {
    const countries = new Set<string>();
    leads.forEach(lead => {
      // 🟢 SAFE FIX: Safe countryInterest access
      const countryInterest = Array.isArray(lead.countryInterest) ? lead.countryInterest : ['Canada'];
      countryInterest.forEach(country => countries.add(country));
    });
    return Array.from(countries).sort();
  }, [leads]);

  // Navigate to view with filters
  const navigateToView = (view: string, additionalFilters: any = {}) => {
    const filterState = {
      ...filters,
      ...additionalFilters
    };
    
    // Store in localStorage for the target view to read
    localStorage.setItem('dashboardNavFilters', JSON.stringify(filterState));
    localStorage.setItem('dashboardNavView', view);
    localStorage.setItem('dashboardNavTimestamp', Date.now().toString());
    
    if (onViewChange) {
      onViewChange(view, filterState);
    } else {
      // Fallback: trigger event that App.tsx can listen to
      window.dispatchEvent(new CustomEvent('dashboard-navigate', { 
        detail: { view, filters: filterState } 
      }));
    }
  };

  // 1. Count of Active agents (descending oldest to newest) with category bifurcation
  const activeAgentsByCategory = useMemo(() => {
    const activeLeads = filteredLeads.filter(lead => 
      lead.status !== 'Lost' && lead.status !== 'Portal Deactivated'
    );

    // Group by category
    const byCategory: Record<AgentCategory, { leads: Lead[], count: number }> = {
      'Platinum': { leads: [], count: 0 },
      'Diamond': { leads: [], count: 0 },
      'Gold': { leads: [], count: 0 },
      'Silver': { leads: [], count: 0 },
      'Bronze': { leads: [], count: 0 },
      'Beginner': { leads: [], count: 0 }
    };

    activeLeads.forEach(lead => {
      const category = lead.agentCategory || 'Beginner';
      if (byCategory[category]) {
          byCategory[category].leads.push(lead);
          byCategory[category].count++;
      }
    });

    // Sort each category based on sort state
    Object.keys(byCategory).forEach(category => {
      const categoryLeads = byCategory[category as AgentCategory].leads;
      categoryLeads.sort((a, b) => {
        let compareValue = 0;
        if (sortActiveAgents.field === 'date') {
          compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        } else if (sortActiveAgents.field === 'name') {
          compareValue = (a.agencyName || '').localeCompare(b.agencyName || '');
        }
        return sortActiveAgents.direction === 'asc' ? compareValue : -compareValue;
      });
    });

    return byCategory;
  }, [filteredLeads, sortActiveAgents]);

  // 2. Count of Inactive agents with category bifurcation
  const inactiveAgentsByCategory = useMemo(() => {
    const inactiveLeads = filteredLeads.filter(lead => 
      lead.status === 'Lost' || lead.status === 'Portal Deactivated'
    );

    const byCategory: Record<AgentCategory, { leads: Lead[], count: number }> = {
      'Platinum': { leads: [], count: 0 },
      'Diamond': { leads: [], count: 0 },
      'Gold': { leads: [], count: 0 },
      'Silver': { leads: [], count: 0 },
      'Bronze': { leads: [], count: 0 },
      'Beginner': { leads: [], count: 0 }
    };

    inactiveLeads.forEach(lead => {
      const category = lead.agentCategory || 'Beginner';
      if(byCategory[category]) {
          byCategory[category].leads.push(lead);
          byCategory[category].count++;
      }
    });

    // Sort each category based on sort state
    Object.keys(byCategory).forEach(category => {
      const categoryLeads = byCategory[category as AgentCategory].leads;
      categoryLeads.sort((a, b) => {
        let compareValue = 0;
        if (sortInactiveAgents.field === 'date') {
          compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        } else if (sortInactiveAgents.field === 'name') {
          compareValue = (a.agencyName || '').localeCompare(b.agencyName || '');
        }
        return sortInactiveAgents.direction === 'asc' ? compareValue : -compareValue;
      });
    });

    return byCategory;
  }, [filteredLeads, sortInactiveAgents]);

  // 3. Count of agents with at least 1 follow up (descending max to min)
  const agentsWithFollowUps = useMemo(() => {
    // 🟢 SAFE FIX: Filter with array check
    let agents = filteredLeads
      .filter(lead => Array.isArray(lead.followUps) && lead.followUps.length > 0)
      .map(lead => ({
        lead,
        followUpCount: lead.followUps?.length || 0
      }));

    // Apply sorting
    agents.sort((a, b) => {
      let compareValue = 0;
      if (sortFollowUps.field === 'count') {
        compareValue = a.followUpCount - b.followUpCount;
      } else if (sortFollowUps.field === 'name') {
        compareValue = (a.lead.agencyName || '').localeCompare(b.lead.agencyName || '');
      }
      return sortFollowUps.direction === 'asc' ? compareValue : -compareValue;
    });

    return agents;
  }, [filteredLeads, sortFollowUps]);

  // 4. Count of agents with meeting planned & meeting done
  const meetingStats = useMemo(() => {
    const meetingPlanned = filteredLeads.filter(lead => {
      // 🟢 SAFE FIX: Safe followUps check
      const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];
      return safeFollowUps.some(followUp => 
        followUp.type === 'Meeting' && followUp.status === 'Planned'
      );
    });

    const meetingDone = filteredLeads.filter(lead => {
      // 🟢 SAFE FIX: Safe followUps check
      const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];
      return safeFollowUps.some(followUp => 
        followUp.type === 'Meeting' && followUp.status === 'Done'
      );
    });

    return {
      planned: meetingPlanned.length,
      done: meetingDone.length,
      plannedLeads: meetingPlanned,
      doneLeads: meetingDone
    };
  }, [filteredLeads]);

  // 5. Count of agents city-wise active vs inactive
  const cityWiseStats = useMemo(() => {
    const cityMap: Record<string, { active: number, inactive: number, leads: { active: Lead[], inactive: Lead[] } }> = {};

    filteredLeads.forEach(lead => {
      // 🟢 SAFE FIX: Safe contacts access
      const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
      const city = safeContacts[0]?.city || 'Unknown';
      
      if (!cityMap[city]) {
        cityMap[city] = { active: 0, inactive: 0, leads: { active: [], inactive: [] } };
      }

      const isActive = lead.status !== 'Lost' && lead.status !== 'Portal Deactivated';
      
      if (isActive) {
        cityMap[city].active++;
        cityMap[city].leads.active.push(lead);
      } else {
        cityMap[city].inactive++;
        cityMap[city].leads.inactive.push(lead);
      }
    });

    // Convert to array and sort
    let stats = Object.entries(cityMap)
      .map(([city, stats]) => ({ city, ...stats }));
    
    stats.sort((a, b) => {
      let compareValue = 0;
      if (sortCityWise.field === 'city') {
        compareValue = a.city.localeCompare(b.city);
      } else if (sortCityWise.field === 'active') {
        compareValue = a.active - b.active;
      } else if (sortCityWise.field === 'inactive') {
        compareValue = a.inactive - b.inactive;
      } else if (sortCityWise.field === 'total') {
        compareValue = (a.active + a.inactive) - (b.active + b.inactive);
      }
      return sortCityWise.direction === 'asc' ? compareValue : -compareValue;
    });

    return stats;
  }, [filteredLeads, sortCityWise]);

  const clearFilters = () => {
    setFilters({
      dateCreatedStart: '',
      dateCreatedEnd: '',
      accountManagers: [],
      leadSources: [],
      categories: [],
      statuses: [],
      cities: [],
      countryInterest: []
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-800">📊 Filters</h3>
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Clear All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Date Created Range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date Created From</label>
            <input
              type="date"
              value={filters.dateCreatedStart || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, dateCreatedStart: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date Created To</label>
            <input
              type="date"
              value={filters.dateCreatedEnd || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, dateCreatedEnd: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Account Manager */}
          {showAccountManagerFilter && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Account Manager</label>
              <MultiSelect
                options={uniqueAccountManagers.map(manager => ({
                  value: manager,
                  label: getUserDisplayName(manager, availableUsers)
                }))}
                selectedValues={filters.accountManagers}
                onChange={(values) => setFilters(prev => ({ ...prev, accountManagers: values }))}
                placeholder="All Account Managers"
              />
            </div>
          )}

          {/* Lead Source */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lead Source</label>
            <MultiSelect
              options={LEAD_SOURCES.map(source => ({ value: source, label: source }))}
              selectedValues={filters.leadSources}
              onChange={(values) => setFilters(prev => ({ ...prev, leadSources: values as LeadSource[] }))}
              placeholder="All Lead Sources"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Agent Category</label>
            <MultiSelect
              options={AGENT_CATEGORIES.map(cat => ({ value: cat, label: cat }))}
              selectedValues={filters.categories}
              onChange={(values) => setFilters(prev => ({ ...prev, categories: values as AgentCategory[] }))}
              placeholder="All Categories"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <MultiSelect
              options={LEAD_STATUSES.map(status => ({ value: status, label: status }))}
              selectedValues={filters.statuses}
              onChange={(values) => setFilters(prev => ({ ...prev, statuses: values as LeadStatus[] }))}
              placeholder="All Statuses"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <MultiSelect
              options={uniqueCities.map(city => ({ value: city, label: city }))}
              selectedValues={filters.cities}
              onChange={(values) => setFilters(prev => ({ ...prev, cities: values }))}
              placeholder="All Cities"
            />
          </div>

          {/* Country Interest */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">🌍 Country Interested In</label>
            <MultiSelect
              options={uniqueCountryInterests.map(country => {
                const flagMap: Record<string, string> = {
                  'Canada': '🇨🇦',
                  'UK': '🇬🇧',
                  'USA': '🇺🇸'
                };
                return { 
                  value: country, 
                  label: flagMap[country] || country 
                };
              })}
              selectedValues={filters.countryInterest}
              onChange={(values) => setFilters(prev => ({ ...prev, countryInterest: values }))}
              placeholder="All Countries"
            />
          </div>
        </div>

        <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
          <p className="text-sm text-indigo-800 font-semibold">
            📊 Showing results for {filteredLeads.length} lead(s) out of {leads.length} total
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Active Agents by Category */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              ✅ Active Agents by Category (Total: 
              <button
                onClick={() => navigateToView('leads', { statuses: filteredLeads.filter(l => l.status !== 'Lost' && l.status !== 'Portal Deactivated').map(l => l.status).filter((v, i, a) => a.indexOf(v) === i) })}
                className="ml-1 text-indigo-600 hover:text-indigo-800 underline font-bold"
                title="Click to view these leads"
              >
                {filteredLeads.filter(lead => lead.status !== 'Lost' && lead.status !== 'Portal Deactivated').length}
              </button>
              )
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Sort:</span>
              <select
                value={`${sortActiveAgents.field}-${sortActiveAgents.direction}`}
                onChange={(e) => {
                  const [field, direction] = e.target.value.split('-') as [SortField, SortDirection];
                  setSortActiveAgents({ field, direction });
                }}
                className="text-xs px-2 py-1 border border-slate-300 rounded"
              >
                <option value="date-asc">Date (Oldest)</option>
                <option value="date-desc">Date (Newest)</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
            </div>
          </div>
          <div className="space-y-4">
            {AGENT_CATEGORIES.map(category => {
              const categoryData = activeAgentsByCategory[category];
              if (categoryData.count === 0) return null;
              
              return (
                <div key={category} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-700">{category}</h4>
                    <button
                      onClick={() => navigateToView('leads', { 
                        categories: [category],
                        statuses: filteredLeads.filter(l => l.status !== 'Lost' && l.status !== 'Portal Deactivated' && l.agentCategory === category).map(l => l.status).filter((v, i, a) => a.indexOf(v) === i)
                      })}
                      className="text-2xl font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                      title={`Click to view ${category} active agents`}
                    >
                      {categoryData.count}
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 max-h-32 overflow-y-auto">
                    <p className="font-medium mb-1">Agents (Oldest to Newest):</p>
                    <ul className="space-y-1">
                      {categoryData.leads.map(lead => (
                        <li key={lead.id} className="flex items-center justify-between">
                          <span>{lead.agencyName}</span>
                          <span className="text-slate-400">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Inactive Agents by Category */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              ❌ Inactive Agents by Category (Total: 
              <button
                onClick={() => navigateToView('leads', { statuses: ['Lost', 'Portal Deactivated'] })}
                className="ml-1 text-red-600 hover:text-red-800 underline font-bold"
                title="Click to view these leads"
              >
                {filteredLeads.filter(lead => lead.status === 'Lost' || lead.status === 'Portal Deactivated').length}
              </button>
              )
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Sort:</span>
              <select
                value={`${sortInactiveAgents.field}-${sortInactiveAgents.direction}`}
                onChange={(e) => {
                  const [field, direction] = e.target.value.split('-') as [SortField, SortDirection];
                  setSortInactiveAgents({ field, direction });
                }}
                className="text-xs px-2 py-1 border border-slate-300 rounded"
              >
                <option value="date-desc">Date (Newest)</option>
                <option value="date-asc">Date (Oldest)</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
            </div>
          </div>
          <div className="space-y-4">
            {AGENT_CATEGORIES.map(category => {
              const categoryData = inactiveAgentsByCategory[category];
              if (categoryData.count === 0) return null;
              
              return (
                <div key={category} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-700">{category}</h4>
                    <button
                      onClick={() => navigateToView('leads', { 
                        categories: [category],
                        statuses: ['Lost', 'Portal Deactivated']
                      })}
                      className="text-2xl font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                      title={`Click to view ${category} inactive agents`}
                    >
                      {categoryData.count}
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 max-h-32 overflow-y-auto">
                    <ul className="space-y-1">
                      {categoryData.leads.map(lead => (
                        <li key={lead.id} className="flex items-center justify-between">
                          <span>{lead.agencyName}</span>
                          <span className="text-red-400">{lead.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Agents with Follow-ups */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              📞 Agents with Follow-ups (Max to Min) - Total: 
              <button
                onClick={() => navigateToView('followups')}
                className="ml-1 text-indigo-600 hover:text-indigo-800 underline font-bold"
                title="Click to view all follow-ups"
              >
                {agentsWithFollowUps.length}
              </button>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Sort:</span>
              <select
                value={`${sortFollowUps.field}-${sortFollowUps.direction}`}
                onChange={(e) => {
                  const [field, direction] = e.target.value.split('-') as [SortField, SortDirection];
                  setSortFollowUps({ field, direction });
                }}
                className="text-xs px-2 py-1 border border-slate-300 rounded"
              >
                <option value="count-desc">Count (Max)</option>
                <option value="count-asc">Count (Min)</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {agentsWithFollowUps.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No agents with follow-ups</p>
            ) : (
              agentsWithFollowUps.map(({ lead, followUpCount }) => (
                <div key={lead.id} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{lead.agencyName}</p>
                    <p className="text-xs text-slate-500">{lead.agentCategory} • {lead.status}</p>
                  </div>
                  <button
                    onClick={() => navigateToView('followups', { leadIds: [lead.id] })}
                    className="text-xl font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    title={`Click to view ${followUpCount} follow-ups for ${lead.agencyName}`}
                  >
                    {followUpCount}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 4. Meeting Stats */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-4">🤝 Meeting Statistics</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => navigateToView('meetings', { meetingStatus: 'Planned', leadIds: meetingStats.plannedLeads.map(l => l.id) })}
              className="bg-blue-50 rounded-lg p-4 text-center hover:bg-blue-100 transition-colors cursor-pointer"
              title="Click to view planned meetings"
            >
              <p className="text-3xl font-bold text-blue-600 hover:underline">{meetingStats.planned}</p>
              <p className="text-sm text-blue-800 font-medium">Meetings Planned</p>
            </button>
            <button
              onClick={() => navigateToView('meetings', { meetingStatus: 'Done', leadIds: meetingStats.doneLeads.map(l => l.id) })}
              className="bg-green-50 rounded-lg p-4 text-center hover:bg-green-100 transition-colors cursor-pointer"
              title="Click to view done meetings"
            >
              <p className="text-3xl font-bold text-green-600 hover:underline">{meetingStats.done}</p>
              <p className="text-sm text-green-800 font-medium">Meetings Done</p>
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-slate-700">Planned (
                  <button
                    onClick={() => navigateToView('meetings', { meetingStatus: 'Planned', leadIds: meetingStats.plannedLeads.map(l => l.id) })}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {meetingStats.planned}
                  </button>
                )</p>
              </div>
              <div className="max-h-32 overflow-y-auto text-xs text-slate-600 space-y-1">
                {meetingStats.plannedLeads.map(lead => {
                  // 🟢 SAFE FIX: Array check for followUps
                  const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];
                  const plannedCount = safeFollowUps.filter(f => f.type === 'Meeting' && f.status === 'Planned').length || 0;
                  return (
                    <div key={lead.id} className="flex items-center justify-between hover:bg-slate-50 p-1 rounded">
                      <span>{lead.agencyName}</span>
                      <button
                        onClick={() => navigateToView('followups', { leadIds: [lead.id], followUpType: 'Meeting', followUpStatus: 'Planned' })}
                        className="text-blue-500 hover:text-blue-700 hover:underline"
                        title={`Click to view ${plannedCount} planned meeting(s)`}
                      >
                        {plannedCount} planned
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-slate-700">Done (
                  <button
                    onClick={() => navigateToView('meetings', { meetingStatus: 'Done', leadIds: meetingStats.doneLeads.map(l => l.id) })}
                    className="text-green-600 hover:text-green-800 underline"
                  >
                    {meetingStats.done}
                  </button>
                )</p>
              </div>
              <div className="max-h-32 overflow-y-auto text-xs text-slate-600 space-y-1">
                {meetingStats.doneLeads.map(lead => {
                   // 🟢 SAFE FIX: Array check for followUps
                   const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];
                   const doneCount = safeFollowUps.filter(f => f.type === 'Meeting' && f.status === 'Done').length || 0;
                  return (
                    <div key={lead.id} className="flex items-center justify-between hover:bg-slate-50 p-1 rounded">
                      <span>{lead.agencyName}</span>
                      <button
                        onClick={() => navigateToView('followups', { leadIds: [lead.id], followUpType: 'Meeting', followUpStatus: 'Done' })}
                        className="text-green-500 hover:text-green-700 hover:underline"
                        title={`Click to view ${doneCount} done meeting(s)`}
                      >
                        {doneCount} done
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 5. City-wise Active vs Inactive */}
        <div className="bg-white rounded-xl shadow-lg p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">🏙️ City-wise Active vs Inactive Agents</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Sort:</span>
              <select
                value={`${sortCityWise.field}-${sortCityWise.direction}`}
                onChange={(e) => {
                  const [field, direction] = e.target.value.split('-') as [SortField, SortDirection];
                  setSortCityWise({ field, direction });
                }}
                className="text-xs px-2 py-1 border border-slate-300 rounded"
              >
                <option value="city-asc">City (A-Z)</option>
                <option value="city-desc">City (Z-A)</option>
                <option value="active-desc">Active (High)</option>
                <option value="active-asc">Active (Low)</option>
                <option value="inactive-desc">Inactive (High)</option>
                <option value="inactive-asc">Inactive (Low)</option>
                <option value="total-desc">Total (High)</option>
                <option value="total-asc">Total (Low)</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">City</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Active</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Inactive</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Total</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Active %</th>
                </tr>
              </thead>
              <tbody>
                {cityWiseStats.map(({ city, active, inactive }) => {
                  const total = active + inactive;
                  const activePercent = total > 0 ? ((active / total) * 100).toFixed(1) : '0';
                  
                  return (
                    <tr key={city} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-800">{city}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            // 🟢 SAFE FIX: Crash-proof inline filtering
                            const matchingStatuses = filteredLeads
                              .filter(l => {
                                const safeContacts = Array.isArray(l.contacts) ? l.contacts : [];
                                return l.status !== 'Lost' && l.status !== 'Portal Deactivated' && safeContacts[0]?.city === city;
                              })
                              .map(l => l.status)
                              .filter((v, i, a) => a.indexOf(v) === i);
                            
                            navigateToView('leads', { cities: [city], statuses: matchingStatuses });
                          }}
                          className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full font-semibold hover:bg-green-200 hover:underline cursor-pointer"
                          title={`Click to view ${active} active agents in ${city}`}
                        >
                          {active}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => navigateToView('leads', { cities: [city], statuses: ['Lost', 'Portal Deactivated'] })}
                          className="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full font-semibold hover:bg-red-200 hover:underline cursor-pointer"
                          title={`Click to view ${inactive} inactive agents in ${city}`}
                        >
                          {inactive}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => navigateToView('leads', { cities: [city] })}
                          className="font-semibold text-slate-700 hover:text-indigo-600 hover:underline"
                          title={`Click to view ${total} total agents in ${city}`}
                        >
                          {total}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2 max-w-32">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ width: `${activePercent}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-slate-600">{activePercent}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;