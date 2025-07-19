const SUPABASE_URL = 'https://jadljxucecpvpkfcgxyl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZGxqeHVjZWNwdnBrZmNneHlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzYwMDgsImV4cCI6MjA2ODMxMjAwOH0.TBlI1rbu9gW7mEBJiru47hBYBsJJDc-OVRSd26OUNWU';

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);