import apiClient from './apiClient';
import type { Lead, FollowUp } from '../types';

// --- SUBSCRIBE (No Polling) ---
export function subscribeLeads(onChange: (leads: Lead[]) => void) {
  apiClient.get('/leads/all').then(res => onChange(res.data));
  return () => {};
}

// --- ADD LEAD ---
export async function addLeadFs(lead: Omit<Lead, 'id' | 'createdAt' | 'followUps'>) {
  try {
    const leadData = {
      ...lead,
      createdAt: new Date().toISOString(),
      followUps: []
    };
    
    // The backend will generate the ID and handle timestamp
    const response = await apiClient.post('/leads/add', leadData);
    return response.data.id;
  } catch (error) {
    console.error('Error adding lead:', error);
    throw error;
  }
}

// --- UPDATE LEAD ---
export async function updateLeadFs(lead: Lead) {
  try {
    await apiClient.put(`/leads/update/${lead.id}`, lead);
  } catch (error) {
    console.error('Error updating lead:', error);
    throw error;
  }
}

// --- ADD FOLLOW-UP ---
export async function addFollowUpFs(lead: Lead, followUp: Omit<FollowUp, 'id'>) {
  try {
    const newFollowUp: FollowUp = {
      id: Date.now().toString(), // Generate temporary ID or let backend handle it
      ...followUp
    };
    
    // We update the whole lead object with the new follow-up
    // Note: In a pure SQL app, you might have a dedicated /api/followups endpoint
    // But for compatibility with your existing frontend structure, we update the lead.
    const updatedLead: Lead = {
      ...lead,
      followUps: [...(lead.followUps || []), newFollowUp]
    };
    
    await updateLeadFs(updatedLead);
    return updatedLead;
  } catch (error) {
    console.error('Error adding follow-up:', error);
    throw error;
  }
}

// --- SEED LEADS ---
export async function seedLeadsIfEmpty(seed: Lead[]) {
  try {
    // Check if leads exist
    const response = await apiClient.get('/leads/all');
    if (response.data && response.data.length > 0) return false;

    // Use a Promise.all to add them in parallel if empty
    // Note: A bulk insert endpoint would be better for performance in production
    const tasks = seed.map(lead => addLeadFs(lead));
    await Promise.all(tasks);
    
    return true;
  } catch (error) {
    console.error('Error seeding leads:', error);
    return false;
  }
}