
import { createClient } from '@supabase/supabase-js';

// Check for environment variables with fallback support for both Vite and Node.js
const getEnvVar = (name: string) => {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
        return import.meta.env[name];
    }
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
        return process.env[name];
    }
    return null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || 'https://vefjtqnoowqfdtivtnym.supabase.co';
const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZmp0cW5vb3dxZmR0aXZ0bnltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNTI1NDgsImV4cCI6MjA5MzcyODU0OH0.o4zcX5L4Hv9RvJlR4UYZ9kn3lp3v_z2SGZsy3fs7x2k';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});

// Test connection silently in background
supabase.from('documents').select('count', { count: 'exact', head: true }).then(({ error }) => {
    if (error) {
        console.warn('Supabase Connection Check: Failed.', error.message);
    } else {
        console.log('Supabase Connection Check: Success');
    }
});
