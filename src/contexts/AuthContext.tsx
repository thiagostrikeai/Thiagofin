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
const GUEST_EMAIL_DOMAIN = 'guest.mycontas.app';

function createLocalUser(): AppUser {
  return {
    uid: LOCAL_USER_UID,
    email: 'local@fintrack.dev',
    displayName: 'Usuário Local',
    photoURL: null,
  };
}

export function mapSupabaseUser(u: SupabaseUser): AppUser {
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

/** Turns "Maria" or "maria@email.com" into a valid Supabase login email */
export function toGuestLoginEmail(usernameOrEmail: string): string {
  const t = usernameOrEmail.trim().toLowerCase();
  if (!t) throw new Error('Informe um usuário ou e-mail.');
  if (t.includes('@')) return t;
  const slug = t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 48);
  if (slug.length < 2) throw new Error('Usuário deve ter pelo menos 2 caracteres válidos.');
  return `${slug}@${GUEST_EMAIL_DOMAIN}`;
}

function isLocalAuthActive(): boolean {
  return localStorage.getItem(LOCAL_AUTH_KEY) === '1';
}

export interface GuestRegisterInput {
  /** Nome que aparece na interface */
  name: string;
  /** Usuário (sem @) ou e-mail completo para login futuro */
  usernameOrEmail: string;
  password: string;
  inviteCode: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isLocalMode: boolean;
  isGuest: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName?: string) => Promise<void>;
  /** Cadastro de convidado: nome + usuário/senha + código */
  signUpAsGuest: (input: GuestRegisterInput) => Promise<{ loginEmail: string }>;
  /** Login de convidado já cadastrado (usuário/e-mail + senha) */
  signInAsGuestAccount: (usernameOrEmail: string, password: string) => Promise<void>;
  /** Legacy: só código (anônimo) */
  signInAsGuest: (code: string) => Promise<void>;
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

  const signUpWithEmail = async (email: string, pass: string, displayName?: string) => {
    requireSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: displayName
          ? { full_name: displayName, name: displayName, display_name: displayName }
          : undefined,
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

  const ensureSessionAfterSignUp = async (email: string, password: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return session.user;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        throw new Error(
          'Confirme o e-mail antes de entrar, ou desative "Confirm email" em Supabase → Authentication → Providers → Email (para testes).'
        );
      }
      throw error;
    }
    if (!data.user) throw new Error('Não foi possível iniciar sessão após o cadastro.');
    return data.user;
  };

  /**
   * Cadastro de convidado com nome + usuário/senha + código.
   * Cria conta Auth, grava o nome no perfil e vincula à conta do dono.
   */
  const signUpAsGuest = async (input: GuestRegisterInput): Promise<{ loginEmail: string }> => {
    requireSupabase();
    const name = input.name.trim();
    const password = input.password;
    const inviteCode = input.inviteCode.replace(/\D/g, '');

    if (name.length < 2) throw new Error('Informe seu nome (mínimo 2 caracteres).');
    if (password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
    if (inviteCode.length !== 6) throw new Error('Código de convite deve ter 6 dígitos.');

    const loginEmail = toGuestLoginEmail(input.usernameOrEmail);

    inviteFlowRef.current = true;
    setAuthError(null);

    try {
      await supabase.auth.signOut();
      setUser(null);
      setGuestAccess(null);

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: loginEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: name,
            name,
            display_name: name,
            is_guest: true,
            guest_username: input.usernameOrEmail.trim(),
          },
        },
      });

      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          throw new Error(
            'Este usuário/e-mail já existe. Use “Já tenho conta de convidado” e entre com usuário e senha.'
          );
        }
        throw signUpError;
      }

      let su = signUpData.user;
      if (!signUpData.session) {
        su = await ensureSessionAfterSignUp(loginEmail, password);
      } else {
        su = signUpData.session.user;
      }

      // Garante metadados de nome (caso o signIn não traga)
      if (su) {
        await supabase.auth.updateUser({
          data: {
            full_name: name,
            name,
            display_name: name,
            is_guest: true,
          },
        });
        const { data: refreshed } = await supabase.auth.getUser();
        if (refreshed.user) su = refreshed.user;
      }

      if (!su) throw new Error('Falha ao criar sessão de convidado.');

      setUser(mapSupabaseUser(su));
      await redeemForCurrentUser(inviteCode);
      setLoading(false);

      return { loginEmail };
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

  /** Login de convidado já cadastrado (sem precisar digitar o código de novo) */
  const signInAsGuestAccount = async (usernameOrEmail: string, password: string) => {
    requireSupabase();
    inviteFlowRef.current = true;
    setAuthError(null);
    try {
      const loginEmail = toGuestLoginEmail(usernameOrEmail);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (error) throw error;
      if (!data.user) throw new Error('Falha no login.');

      setUser(mapSupabaseUser(data.user));
      const access = await getGuestAccess(data.user.id);
      if (!access) {
        throw new Error(
          'Conta encontrada, mas sem convite vinculado. Use o cadastro de convidado com o código de 6 dígitos.'
        );
      }
      setGuestAccess(access);
      guestAccessRef.current = access;
      setLoading(false);
    } catch (e) {
      setGuestAccess(null);
      throw e instanceof Error ? e : new Error(mapInviteError(e));
    } finally {
      inviteFlowRef.current = false;
    }
  };

  /** Legacy: só código (Anonymous) — mantido como fallback */
  const signInAsGuest = async (code: string) => {
    requireSupabase();
    inviteFlowRef.current = true;
    setAuthError(null);

    try {
      await supabase.auth.signOut();
      setUser(null);
      setGuestAccess(null);

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error('Anonymous sign-in error', error);
        throw new Error(
          'Login só com código precisa do provedor Anonymous no Supabase. Prefira “Cadastrar como convidado” com nome e senha.'
        );
      }
      if (!data.user) throw new Error('Falha ao criar sessão de convidado.');

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

  const acceptInviteCode = async (code: string) => {
    requireSupabase();
    inviteFlowRef.current = true;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Faça login antes de usar o código, ou cadastre-se como convidado.');
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
        signUpAsGuest,
        signInAsGuestAccount,
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
