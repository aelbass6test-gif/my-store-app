import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://keqmlcqymkohxzcouxfi.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlcW1sY3F5bWtvaHh6Y291eGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODU0NzAsImV4cCI6MjA4NjE2MTQ3MH0.OfxqWM9CFCcLj62u5KLWZyiiBhUH-miUu882Cqlwf4I';

export const supabase = createClient(supabaseUrl, supabaseKey);
