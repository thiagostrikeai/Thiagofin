import { useAuth } from '../contexts/AuthContext';
import { Wallet, LogIn, Mail, Key } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import React, { useState } from 'react';

export default function Login() {
  const { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, signInAsGuest, authError } = useAuth();
  const theme = useAppStore(state => state.theme);
  
  const [isLogin, setIsLogin] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [guestCode, setGuestCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam && codeParam.length === 6) {
      setIsGuestMode(true);
      setGuestCode(codeParam);
    }
  }, []);

  // Set local error if authError from context changes
  React.useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('O provedor de login do Google não está ativado no Firebase Console.');
      } else {
        setError('Erro: ' + err.message);
      }
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await signInWithApple();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('O provedor de login da Apple não está ativado no Firebase Console.');
      } else {
        setError('Ocorreu um erro ao fazer login com a Apple.');
      }
      setLoading(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestCode || guestCode.length !== 6) {
      setError('Por favor, insira um código de 6 dígitos válido.');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      await signInAsGuest(guestCode);
    } catch (err: any) {
      console.error(err);
      setError('Código inválido ou expirado. Verifique e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isLogin) {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso. Tente fazer login em vez de cadastrar.');
        setIsLogin(true); // Automatically switch to login mode
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Login por e-mail e senha não está ativado no Firebase Console. Por favor, ative-o nas configurações de Authentication.');
      } else {
        setError('Ocorreu um erro. Verifique se o provedor está ativado no Firebase ou tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${theme.isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`max-w-md w-full rounded-2xl shadow-xl p-8 text-center ${theme.isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}
      >
        <div className="flex justify-center mb-6">
          <div 
            className="p-4 rounded-full" 
            style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}
          >
            <Wallet size={48} />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">FinTrack</h1>
        <p className={`mb-6 ${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {isGuestMode ? 'Acesse o aplicativo compartilhado' : (isLogin ? 'Faça login para continuar' : 'Crie sua conta para começar')}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {isGuestMode ? (
          <form onSubmit={handleGuestSubmit} className="space-y-4 mb-6 text-left">
            <div>
              <label className="block text-sm font-medium mb-1">Código do Convite</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Key size={18} />
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={guestCode}
                  onChange={(e) => setGuestCode(e.target.value.replace(/\D/g, ''))}
                  className={`w-full pl-10 p-3 rounded-lg border text-center text-2xl tracking-widest font-mono focus:ring-2 outline-none ${theme.isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-indigo-500' : 'bg-gray-50 border-gray-300 focus:ring-indigo-500'}`}
                  placeholder="123456"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {loading ? 'Acessando...' : 'Acessar'}
            </button>
            <button
              type="button"
              onClick={() => { setIsGuestMode(false); setError(''); }}
              className={`w-full py-2 text-sm font-medium hover:underline ${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            >
              Voltar para Login normal
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4 mb-6 text-left">
              <div>
                <label className="block text-sm font-medium mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full p-3 rounded-lg border focus:ring-2 outline-none ${theme.isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-indigo-500' : 'bg-gray-50 border-gray-300 focus:ring-indigo-500'}`}
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full p-3 rounded-lg border focus:ring-2 outline-none ${theme.isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-indigo-500' : 'bg-gray-50 border-gray-300 focus:ring-indigo-500'}`}
                  placeholder="••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: theme.primaryColor }}
              >
                {loading ? 'Aguarde...' : (isLogin ? 'Entrar' : 'Cadastrar')}
              </button>
            </form>

            <div className="flex items-center justify-between mb-6">
              <hr className={`flex-1 ${theme.isDarkMode ? 'border-gray-700' : 'border-gray-300'}`} />
              <span className={`px-3 text-sm ${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>ou continuar com</span>
              <hr className={`flex-1 ${theme.isDarkMode ? 'border-gray-700' : 'border-gray-300'}`} />
            </div>

            <div className="space-y-4 mb-6">
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                type="button"
                className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                Entrar com Google
              </button>
              <button
                onClick={handleAppleSignIn}
                disabled={loading}
                type="button"
                className="w-full flex items-center justify-center gap-3 bg-black text-white hover:bg-gray-800 font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
              >
                <LogIn size={20} />
                Entrar com Apple
              </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => { setIsGuestMode(true); setError(''); }}
                type="button"
                className="w-full flex items-center justify-center gap-2 text-sm font-medium p-3 rounded-xl transition-colors"
                style={{ color: theme.primaryColor, backgroundColor: `${theme.primaryColor}10` }}
              >
                <Key size={18} />
                Convidado? Acesse aqui
              </button>
            </div>

            <p className={`mt-6 text-sm ${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className="font-medium hover:underline"
                style={{ color: theme.primaryColor }}
                type="button"
              >
                {isLogin ? 'Cadastrar' : 'Entrar'}
              </button>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
