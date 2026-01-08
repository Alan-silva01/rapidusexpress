import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('SUPABASE KEYS MISSING! Using fallback values for development.');
    const fallbackUrl = 'https://example.supabase.co';
    const fallbackKey = 'public-anon-key';
    supabaseUrl = fallbackUrl;
    supabaseAnonKey = fallbackKey;
}


export const supabase = createClient(supabaseUrl, supabaseAnonKey);
