import type { Session } from '@supabase/supabase-js';
import React, { createContext, PropsWithChildren, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase, supabaseKey, supabaseUrl } from '@/lib/supabase';

type AuthResult = {
  message: string;
  success: boolean;
};

type AuthContextValue = {
  isLinked: boolean;
  isLoading: boolean;
  session: Session | null;
  pairDevice: (deviceCode: string, pairingCode: string) => Promise<AuthResult>;
  refreshLinkStatus: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLinked, setIsLinked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      await checkLink(data.session);
      setIsLoading(false);
    }

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(true);

      // Se ejecuta fuera del callback para no bloquear la actualizacion interna de Auth.
      setTimeout(() => {
        void checkLink(nextSession).finally(() => setIsLoading(false));
      }, 0);
    });

    const appStateListener =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (state) => {
            if (state === 'active') {
              supabase.auth.startAutoRefresh();
            } else {
              supabase.auth.stopAutoRefresh();
            }
          });

    return () => {
      authListener.subscription.unsubscribe();
      appStateListener?.remove();
    };
  }, []);

  async function checkLink(currentSession: Session | null) {
    if (!currentSession) {
      setIsLinked(false);
      return;
    }

    const { data, error } = await supabase.from('users').select('id').limit(1).maybeSingle();

    if (error) {
      setIsLinked(false);
      return;
    }

    setIsLinked(Boolean(data));
  }

  async function refreshLinkStatus() {
    await checkLink(session);
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    return error
      ? { success: false, message: error.message }
      : { success: true, message: 'Sesion iniciada.' };
  }

  async function signUp(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return data.session
      ? { success: true, message: 'Cuenta creada y sesion iniciada.' }
      : {
          success: true,
          message: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesion.',
        };
  }

  async function pairDevice(deviceCode: string, pairingCode: string): Promise<AuthResult> {
    if (!session) {
      return { success: false, message: 'Debes iniciar sesion nuevamente.' };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/pair-vitalwatch-device`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceCode, pairingCode }),
    }).catch(() => null);

    if (!response) {
      return { success: false, message: 'No se pudo conectar con Supabase.' };
    }

    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      return { success: false, message: result.error ?? `Error HTTP ${response.status}.` };
    }

    await refreshLinkStatus();
    return { success: true, message: 'Pulsera vinculada correctamente.' };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        isLinked,
        isLoading,
        session,
        pairDevice,
        refreshLinkStatus,
        signIn,
        signOut,
        signUp,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.use(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
}
