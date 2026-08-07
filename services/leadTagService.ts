import apiClient from './apiClient';

// --- HELPERS ---
const normalizeTagName = (name: string): string => name.trim();

// --- API CALLS ---

// 1. Get All Tags
export const getLeadTags = async (): Promise<string[]> => {
  try {
    const response = await apiClient.get('/tags');
    // Ensure we return an array of strings
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Error fetching lead tags:', error);
    return [];
  }
};

// 2. Add New Tag
export const addLeadTag = async (name: string): Promise<void> => {
  const trimmedName = normalizeTagName(name);
  if (!trimmedName) {
    throw new Error('Tag name cannot be empty');
  }

  try {
    await apiClient.post('/tags', { name: trimmedName });
  } catch (error) {
    console.error('Error adding lead tag:', error);
    throw error;
  }
};

// 3. Subscribe to Tags (Polling)
// Replaces onSnapshot with interval fetching
export const subscribeToLeadTags = (
  callback: (tags: string[]) => void
) => {
  let isActive = true;

  const fetchTags = async () => {
    try {
      const tags = await getLeadTags();
      if (isActive) {
        callback(tags);
      }
    } catch (error) {
      console.error('Error in tag subscription:', error);
    }
  };

  // Initial fetch
  fetchTags();

  // Poll every 60 seconds (Tags don't change often)
  const intervalId = setInterval(fetchTags, 60000);

  // Return unsubscribe function
  return () => {
    isActive = false;
    clearInterval(intervalId);
  };
};