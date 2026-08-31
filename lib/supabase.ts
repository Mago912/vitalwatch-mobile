import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const configuredSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const configuredSupabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!configuredSupabaseUrl || !configuredSupabaseKey) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_KEY en .env.local'
  );
}

export const supabaseUrl = configuredSupabaseUrl;
export const supabaseKey = configuredSupabaseKey;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
  },
});
