// import { GoogleGenAI } from "@google/genai";
import type { Lead, FollowUpType } from '../types';

// Fallback for build issues with @google/genai
let ai: any = null;

// Initialize AI in a function to avoid top-level await
const initializeAI = async () => {
  if (ai) return ai;
  
  try {
    if (typeof window !== 'undefined' && process.env.API_KEY) {
      const { GoogleGenAI } = await import("@google/genai");
      ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
  } catch (error) {
    console.warn('GoogleGenAI not available:', error);
  }
  
  return ai;
};

export const generateFollowUpSuggestion = async (lead: Lead, followUpType: FollowUpType): Promise<string> => {
  // Initialize AI if not already done
  const aiInstance = await initializeAI();
  
  // Fallback if AI is not available
  if (!aiInstance) {
    return `Follow up with ${lead.agencyName} regarding their ${lead.status.toLowerCase()} status. Check on their progress and next steps.`;
  }

  const history = lead.followUps
    .map(f => `${f.type} on ${new Date(f.date).toLocaleDateString()}: ${f.notes}`)
    .join('\n');

  const prompt = `
    You are an expert assistant for a B2B partnership manager at a student recruitment company. 
    Your goal is to help draft concise, professional, and effective follow-up notes for potential partner agencies.

    Here is the lead's information:
    - Agency Name: ${lead.agencyName}
    - Current Status: ${lead.status}
    - Previous Interactions: ${history || 'None'}

    The manager wants to create a new follow-up of type: "${followUpType}".

    Based on this information, generate a brief, actionable note or objective for this B2B follow-up. 
    - For a 'Call', suggest a talking point or goal (e.g., discuss commission rates, explain our services).
    - For a 'Meeting', suggest an agenda item or objective (e.g., finalize partnership agreement, present marketing materials).
    - For an 'Email', draft a short, polite message body to advance the partnership discussion.

    Keep the suggestion to 1-2 sentences. Do not add any extra text or introductions.
  `;

  try {
    const response = await aiInstance.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.8,
          maxOutputTokens: 100,
        },
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error generating suggestion:", error);
    return `Follow up with ${lead.agencyName} regarding their ${lead.status.toLowerCase()} status. Check on their progress and next steps.`;
  }
};