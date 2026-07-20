import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import {
  verifyInvitationAndCreateGuestAccess,
  getGuestAccess,
  GuestAccess,
  mapInviteError,
} from '../lib/db';
import type { AppUser } from '../types/auth';

const LOCAL_AUTH_KEY = 'fintrack_local_auth';
const LOCAL_USER_UID = 'local-dev-user';

function createLocalUser(): AppUser {
  return {
    uid: LOCAL_USER_UID,
    email: 'local@fintrack.dev',
    displayName: 'Usuário Local',
    photoURL: null,
  };
}

function mapSupabaseUser(u: SupabaseUser): AppUser {
  const meta = u.user_metadata || {};
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName:
      (meta.full_name as string) ||
      (meta.name as string) ||
      (meta.display_name as string) ||
      (u.email ? u.email.split('@')[0] : null),
    photoURL: (meta.avatar_url as string) || (meta.picture as string) || null,
  };
}

function isLocalAuthActive(): boolean {
  return localStorage.getItem(LOCAL_AUTH_KEY) === '1';
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isLocalMode: boolean;
  isGuest: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  /** Entra como convidado só com o código (Anonymous) */
  signInAsGuest: (code: string) => Promise<void>;
  /** Usuário já logado (e-mail) resgata convite e passa a ver a conta do dono */
  acceptInviteCode: (code: string) => Promise<void>;
  signInLocal: () => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  targetUserId: string | null;
  permission: 'view' | 'edit';
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestAccess, setGuestAccess] = useState<GuestAccess | null>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);

  /** Avoid race: onAuthStateChange overwriting guestAccess during redeem */
  const inviteFlowRef = useRef(false);
  const guestAccessRef = useRef<GuestAccess | null>(null);

  useEffect(() => {
    guestAccessRef.current = guestAccess;
  }, [guestAccess]);

  useEffect(() => {
    if (isLocalAuthActive()) {
      setUser(createLocalUser());
      setIsLocalMode(true);
      setGuestAccess(null);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setAuthError(
        'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY, ou use Modo Local.'
      );
      setLoading(false);
      return;
    }

    let mounted = true;

    const applySessionUser = async (su: SupabaseUser | null) => {
      if (!mounted) return;

      if (isLocalAuthActive()) {
        setUser(createLocalUser());
        setIsLocalMode(true);
        setGuestAccess(null);
        setLoading(false);
        return;
      }

      // During invite redeem, only update user identity; keep/refresh guest after redeem
      if (inviteFlowRef.current) {
        if (su) setUser(mapSupabaseUser(su));
        setIsLocalMode(false);
        return;
      }

      setIsLocalMode(false);
      if (!su) {
        setUser(null);
        setGuestAccess(null);
        setLoading(false);
        return;
      }

      const appUser = mapSupabaseUser(su);
      setUser(appUser);
      try {
        const access = await getGuestAccess(appUser.uid);
        if (mounted && !inviteFlowRef.current) {
          setGuestAccess(access);
        }
      } catch (e) {
        console.error('Failed to load guest access', e);
      }
      if (mounted) setLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => {
      void applySessionUser(data.session?.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySessionUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    requireSupabase();
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
  };

  const signInWithApple = async () => {
    requireSupabase();
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string, pass: string) => {
    requireSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    requireSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw error;
    if (!data.session) {
      setAuthError(
        'Conta criada! Verifique seu e-mail para confirmar o cadastro (se a confirmação estiver ativa no Supabase).'
      );
    }
  };

  const redeemForCurrentUser = async (code: string) => {
    const inv = await verifyInvitationAndCreateGuestAccess(code);
    const access: GuestAccess = {
      code: inv.code,
      ownerId: inv.ownerId,
      permission: inv.permission,
    };
    setGuestAccess(access);
    guestAccessRef.current = access;
    return access;
  };

  /**
   * Guest-only: creates Anonymous session (or reuses if already anonymous),
   * then redeems invite. Multiple guests can use the same code.
   */
  const signInAsGuest = async (code: string) => {
    requireSupabase();
    inviteFlowRef.current = true;
    setAuthError(null);

    try {
      // Leave any previous session so we don't redeem on the owner's account
      await supabase.auth.signOut();
      setUser(null);
      setGuestAccess(null);

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error('Anonymous sign-in error', error);
        throw new Error(mapInviteError(error));
      }
      const uid = data.user?.id;
      if (!uid) throw new Error('Falha ao criar sessão de convidado.');

      setUser(mapSupabaseUser(data.user));
      await redeemForCurrentUser(code);
      setLoading(false);
    } catch (e) {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      setUser(null);
      setGuestAccess(null);
      throw e instanceof Error ? e : new Error(mapInviteError(e));
    } finally {
      inviteFlowRef.current = false;
    }
  };

  /**
   * Logged-in user (email) attaches to someone else's account via invite code.
   */
  const acceptInviteCode = async (code: string) => {
    requireSupabase();
    inviteFlowRef.current = true;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Faça login com e-mail antes de usar o código, ou use “Continuar com o código”.');
      }
      await redeemForCurrentUser(code);
    } finally {
      inviteFlowRef.current = false;
    }
  };

  const signInLocal = async () => {
    localStorage.setItem(LOCAL_AUTH_KEY, '1');
    setIsLocalMode(true);
    setGuestAccess(null);
    setUser(createLocalUser());
  };

  const logout = async () => {
    localStorage.removeItem(LOCAL_AUTH_KEY);
    setIsLocalMode(false);
    setGuestAccess(null);
    setUser(null);
    try {
      if (isSupabaseConfigured) await supabase.auth.signOut();
    } catch {
      // ignore
    }
  };

  const isGuest = Boolean(guestAccess && user && guestAccess.ownerId !== user.uid);
  const targetUserId = guestAccess ? guestAccess.ownerId : user ? user.uid : null;
  const permission = guestAccess ? guestAccess.permission : 'edit';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLocalMode,
        isGuest,
        signInWithGoogle,
        signInWithApple,
        signInWithEmail,
        signUpWithEmail,
        signInAsGuest,
        acceptInviteCode,
        signInLocal,
        logout,
        authError,
        targetUserId,
        permission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
