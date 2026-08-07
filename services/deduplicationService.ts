import apiClient from './apiClient';
import type { Lead } from '../types';

interface DuplicateInfo {
  originalLead: Lead;
  duplicateLeads: Lead[];
  duplicateIds: string[];
}

export class DeduplicationService {
  /**
   * Find duplicate leads based on mobile number (Optimized for SQL Data)
   */
  static async findDuplicates(): Promise<DuplicateInfo[]> {
    console.log('🔍 Starting mobile-based duplicate detection...');
    
    try {
      // 1. Fetch all leads
      const response = await apiClient.get('/leads/all');
      const leads: Lead[] = response.data || [];
      
      console.log(`📊 Total leads found: ${leads.length}`);
      
      const leadGroups = new Map<string, Lead[]>();
      
      // 2. Group leads by mobile number
      leads.forEach(lead => {
        // Safety check: SQL data might have null contacts
        const contacts = Array.isArray(lead.contacts) ? lead.contacts : [];
        if (contacts.length === 0) return;

        // Get primary mobile & normalize it (remove spaces, dashes)
        const rawMobile = contacts[0]?.phone;
        const primaryMobile = rawMobile ? rawMobile.replace(/\D/g, '') : '';
        
        // Strict check: Only consider valid mobile numbers (10+ digits)
        if (!primaryMobile || primaryMobile.length < 10) return;
        
        const key = primaryMobile;
        
        if (!leadGroups.has(key)) {
          leadGroups.set(key, []);
        }
        leadGroups.get(key)!.push(lead);
      });
      
      // 3. Identify Duplicates
      const duplicates: DuplicateInfo[] = [];
      
      leadGroups.forEach((group, mobileNumber) => {
        if (group.length > 1) {
          // Sort by creation date: Oldest is "Original", others are "Duplicates"
          group.sort((a, b) => {
             const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
             const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
             return dateA - dateB;
          });
          
          const originalLead = group[0];
          const duplicateLeads = group.slice(1);
          const duplicateIds = duplicateLeads.map(lead => lead.id);
          
          duplicates.push({
            originalLead,
            duplicateLeads,
            duplicateIds
          });
        }
      });
      
      console.log(`📋 Found ${duplicates.length} duplicate groups by mobile.`);
      return duplicates;

    } catch (error) {
      console.error('❌ Error finding duplicates:', error);
      return [];
    }
  }
  
  /**
   * Remove duplicate leads using optimized parallel requests
   */
  static async removeDuplicates(
    duplicates: DuplicateInfo[], 
    onProgress?: (progress: { processed: number; total: number; current: string }) => void
  ): Promise<{ removed: number; errors: string[] }> {
    console.log('🗑️ Starting bulk duplicate removal...');
    
    let removedCount = 0;
    const errors: string[] = [];
    
    // Flatten list of all IDs to delete
    const allDuplicateIds: string[] = [];
    duplicates.forEach(group => {
      allDuplicateIds.push(...group.duplicateIds);
    });
    
    console.log(`📊 Total duplicates to remove: ${allDuplicateIds.length}`);
    
    // Process in small batches (Chunk Size 5) to prevent server overload
    const CHUNK_SIZE = 5; 
    
    for (let i = 0; i < allDuplicateIds.length; i += CHUNK_SIZE) {
      const chunkIds = allDuplicateIds.slice(i, i + CHUNK_SIZE);
      
      console.log(`🔄 Processing batch ${Math.floor(i / CHUNK_SIZE) + 1}`);
      
      // Create batch of delete requests
      const deletePromises = chunkIds.map(async (id) => {
        try {
          // Use the SQL delete endpoint we fixed earlier
          await apiClient.delete(`/leads/delete/${id}`);
          return { success: true, id };
        } catch (error: any) {
          return { success: false, id, error: error.message };
        }
      });

      // Wait for this batch to finish
      const results = await Promise.all(deletePromises);

      // Tally results
      results.forEach(result => {
        if (result.success) {
          removedCount++;
        } else {
          errors.push(`Failed to remove ID ${result.id}: ${result.error}`);
        }
      });

      // Update progress bar UI
      if (onProgress) {
        onProgress({
          processed: Math.min(i + CHUNK_SIZE, allDuplicateIds.length),
          total: allDuplicateIds.length,
          current: `Processed ${removedCount} / ${allDuplicateIds.length}`
        });
      }
    }
    
    console.log(`✅ Removal Complete. Removed: ${removedCount}, Errors: ${errors.length}`);
    return { removed: removedCount, errors };
  }
  
  /**
   * Find duplicates by Agency Name (Normalized)
   */
  static async findDuplicatesByAgencyName(): Promise<DuplicateInfo[]> {
    console.log('🔍 Starting agency name duplicate detection...');
    
    try {
      const response = await apiClient.get('/leads/all');
      const leads: Lead[] = response.data || [];
      
      const leadGroups = new Map<string, Lead[]>();
      
      leads.forEach(lead => {
        // Normalize name: lowercase + trim whitespace
        const agencyName = lead.agencyName?.toLowerCase().trim();
        
        if (!agencyName) return;
        
        if (!leadGroups.has(agencyName)) {
          leadGroups.set(agencyName, []);
        }
        leadGroups.get(agencyName)!.push(lead);
      });
      
      const duplicates: DuplicateInfo[] = [];
      
      leadGroups.forEach((group, agencyName) => {
        if (group.length > 1) {
          // Sort by creation date
          group.sort((a, b) => {
             const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
             const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
             return dateA - dateB;
          });
          
          const originalLead = group[0];
          const duplicateLeads = group.slice(1);
          const duplicateIds = duplicateLeads.map(lead => lead.id);
          
          duplicates.push({
            originalLead,
            duplicateLeads,
            duplicateIds
          });
        }
      });
      
      console.log(`📋 Found ${duplicates.length} duplicate groups by name.`);
      return duplicates;

    } catch (error) {
      console.error('❌ Error finding duplicates by name:', error);
      return [];
    }
  }
}