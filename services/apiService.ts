
import { supabase } from './supabaseClient';

export const SUPABASE_PROJECT_URL = 'https://keqmlcqymkohxzcouxfi.supabase.co';

export const apiCall = async (path: string, options: RequestInit = {}) => {
  // Check if we are in development environment (AI Studio) or production (Cloudflare)
  const isDev = window.location.hostname.includes('ais-dev') || window.location.hostname.includes('localhost');
  
  // If it's a sync or webhook call and we are in production, redirect to Supabase Edge Functions
  if (!isDev && (path.startsWith('/api/sync') || path.startsWith('/api/webhook'))) {
    const url = new URL(path, window.location.origin);
    const params = new URLSearchParams(url.search);
    
    // Webhook handling
    if (path.startsWith('/api/webhook/wuilt')) {
        const edgeFunctionUrl = `${SUPABASE_PROJECT_URL}/functions/v1/wuilt-webhook?${params.toString()}`;
        return await fetch(edgeFunctionUrl, { ...options, headers: { ...options.headers, 'Content-Type': 'application/json' } });
    }

    // Platform Sync handling (Newer pattern: /api/sync/platform/wuilt/store123?type=orders)
    if (path.includes('/api/sync/platform/')) {
        const parts = url.pathname.split('/');
        // parts: ["", "api", "sync", "platform", "PLATFORM_ID", "STORE_ID", "preview"]
        const platform = parts[4];
        const storeId = parts[5];
        const isPreview = parts[6] === 'preview';
        
        params.append('platform', platform);
        params.append('storeId', storeId);
        if (isPreview) params.append('preview', 'true');
        
        const edgeFunctionUrl = `${SUPABASE_PROJECT_URL}/functions/v1/sync-platform?${params.toString()}`;
        return await fetch(edgeFunctionUrl, { ...options, headers: { ...options.headers, 'Content-Type': 'application/json' } });
    }
  }

  // Fallback to relative path (standard Express server in Dev)
  return await fetch(path, options);
};
