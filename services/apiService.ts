
import { supabase } from './supabaseClient';

export const SUPABASE_PROJECT_URL = 'https://keqmlcqymkohxzcouxfi.supabase.co';

export const apiCall = async (path: string, options: RequestInit = {}) => {
  // We prioritize the local proxy server (server.ts) for all API calls to avoid CORS issues
  // and ensure consistent behavior between dev and production.
  
  // If path starts with /api, use it as is (relative to origin)
  return await fetch(path, options);
};
