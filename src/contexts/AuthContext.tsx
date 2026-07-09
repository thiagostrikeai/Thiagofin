import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { auth, googleProvider, appleProvider } from '../lib/firebase';
import { verifyInvitationAndCreateGuestAccess, getGuestAccess, GuestAccess } from '../lib/db';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signInAsGuest: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  targetUserId: string | null;
  permission: 'view' | 'edit';
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestAccess, setGuestAccess] = useState<GuestAccess | null>(null);

  useEffect(() => {
    getRedirectResult(auth).then((result) => {
    }).catch((error) => {
      console.error("Error with redirect sign in", error);
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError('O provedor de login selecionado não está ativado no Firebase Console.');
      } else {
        setAuthError('Erro ao processar login.');
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const access = await getGuestAccess(user.uid);
          setGuestAccess(access);
        } catch (e) {
          console.error("Failed to load guest access", e);
        }
      } else {
        setGuestAccess(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      const isIframe = window.self !== window.top;
      if (isIframe) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error) {
      console.error("Error signing in with Google", error);
      throw error;
    }
  };

  const signInWithApple = async () => {
    try {
      const isIframe = window.self !== window.top;
      if (isIframe) {
        await signInWithRedirect(auth, appleProvider);
      } else {
        await signInWithPopup(auth, appleProvider);
      }
    } catch (error) {
      console.error("Error signing in with Apple", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Error signing in with email", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Error signing up with email", error);
      throw error;
    }
  };

  const signInAsGuest = async (code: string) => {
    try {
      const userCredential = await signInAnonymously(auth);
      await verifyInvitationAndCreateGuestAccess(code, userCredential.user.uid);
      const access = await getGuestAccess(userCredential.user.uid);
      setGuestAccess(access);
    } catch (error) {
      console.error("Error signing in as guest", error);
      if (auth.currentUser) {
        await auth.signOut(); // cleanup if failed
      }
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const targetUserId = guestAccess ? guestAccess.ownerId : (user ? user.uid : null);
  const permission = guestAccess ? guestAccess.permission : 'edit';

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, signInAsGuest, logout, authError, targetUserId, permission }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
