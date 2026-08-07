import * as leadsService from '../services/leadsService.js';

// Helper to safely parse JSON strings from DB
const parseJSON = (data) => {
    if (!data) return [];
    if (typeof data === 'object') return data;
    try { return JSON.parse(data); } catch (e) { return []; }
};

export const getAllLeads = async (req, res) => {
  try {
    const leads = await leadsService.getAllLeads();
    
    // --- KEY FIX: Map EITHER Snake_Case OR CamelCase to Frontend ---
    const formattedLeads = leads.map(lead => ({
      ...lead,
      id: lead.id,
      firebase_id: lead.firebase_id,
      
      // Check BOTH formats to be safe
      agencyName: lead.agencyName || lead.agency_name || '',
      agentCategory: lead.agentCategory || lead.agent_category || 'Beginner',
      
      // THIS FIXES "ACCESSIBLE LEADS: 0"
      accountManager: lead.accountManager || lead.account_manager || '', 
      salesPerson: lead.salesPerson || lead.sales_person || '',
      
      leadSource: lead.leadSource || lead.lead_source || '',
      icpScore: lead.icpScore || lead.icp_score || 0,
      createdBy: lead.createdBy || lead.created_by || '',
      
      createdAt: lead.createdAt || lead.created_at,
      updatedAt: lead.updatedAt || lead.updated_at,
      onboardingDate: lead.onboardingDate || lead.onboarding_date,
      
      // Parse JSON columns (handle potential naming differences)
      contacts: parseJSON(lead.contacts),
      tags: parseJSON(lead.tags),
      followUps: parseJSON(lead.followUps || lead.follow_ups),
      countryInterest: parseJSON(lead.countryInterest || lead.country_interest),
      agencyDocuments: parseJSON(lead.agencyDocuments || lead.agency_documents),
      
      remarks: lead.remarks || '',
      websiteLink: lead.websiteLink || lead.website_link || ''
    }));

    console.log(`✅ Controller: Sending ${formattedLeads.length} leads to frontend.`);
    res.json(formattedLeads);
    
  } catch (error) {
    console.error("❌ Controller Error:", error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

export const addLead = async (req, res) => {
  try {
    const result = await leadsService.addLead(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateLead = async (req, res) => {
  try {
    await leadsService.updateLead(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ updateLead error:', error.message);
    if (error.code) console.error('   DB code:', error.code);
    // Include DB error in response so user can see it (e.g. in Network tab)
    const message = error.message || 'Failed to update lead';
    res.status(500).json({ error: message, dbCode: error.code, dbSqlMessage: error.sqlMessage });
  }
};

export const deleteLead = async (req, res) => {
  try {
    await leadsService.deleteLead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ deleteLead error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to delete lead' });
  }
};

export const appendFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { followUp } = req.body;
    if (!id || !followUp) {
      return res.status(400).json({ error: 'Lead id and follow-up data are required' });
    }
    const result = await leadsService.appendFollowUp(id, followUp);
    res.json(result);
  } catch (error) {
    console.error('❌ appendFollowUp error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to add follow-up' });
  }
};