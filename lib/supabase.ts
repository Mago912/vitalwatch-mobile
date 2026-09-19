import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const configuredSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const configuredSupabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!configuredSupabaseUrl || !configuredSupabaseKey) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_KEY en .env.local'
  );
}

export const supabaseUrl = configuredSupabaseUrl;
export const supabaseKey = configuredSupabaseKey;

// Expo genera las paginas web en Node, donde no existe el almacenamiento del navegador.
const isStaticWebRender = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: isStaticWebRender ? undefined : AsyncStorage,
    autoRefreshToken: !isStaticWebRender,
    detectSessionInUrl: false,
    persistSession: !isStaticWebRender,
  },
});
