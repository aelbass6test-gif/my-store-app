
import { createClient } from '@supabase/supabase-js';

// استخدام القيم المباشرة لضمان عدم حدوث أخطاء undefined عند قراءة متغيرات البيئة
const supabaseUrl = 'https://keqmlcqymkohxzcouxfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlcW1sY3F5bWtvaHh6Y291eGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODU0NzAsImV4cCI6MjA4NjE2MTQ3MH0.OfxqWM9CFCcLj62u5KLWZyiiBhUH-miUu882Cqlwf4I';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey);

// Test connection silently in background
supabase.from('documents').select('count', { count: 'exact', head: true }).then(({ error }) => {
    if (error) {
        console.warn('Supabase Connection Check: Failed.', error.message);
    } else {
        console.log('Supabase Connection Check: Success');
    }
});
