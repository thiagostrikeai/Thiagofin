import { useAuth } from '../contexts/AuthContext';
import { LogIn, Key, Monitor, Mail, ArrowRight, Wallet, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState } from 'react';

function mapAuthError(err: { code?: string; message?: string; status?: number }, fallback: string): string {
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('supabase não configurado') || msg.includes('not configur')) {
    return 'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env / Netlify.';
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'Usuário/e-mail ou senha incorretos.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'Este e-mail/usuário já está em uso. Tente fazer login.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Confirme o e-mail antes de entrar, ou desative “Confirm email” no Supabase (Providers → Email).';
  }
  if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
    return 'Este provedor não está ativo no Supabase (Authentication → Providers).';
  }
  if (msg.includes('anonymous')) {
    return 'Use o cadastro de convidado com nome e senha.';
  }
  return fallback + (err.message ? ` (${err.message})` : '');
}

export default function Login() {
  const {
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    signUpAsGuest,
    signInAsGuestAccount,
    acceptInviteCode,
    signInLocal,
    authError,
    user,
  } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);
  /** false = cadastro convidado | true = login convidado já existente */
  const [guestHasAccount, setGuestHasAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ownerDisplayName, setOwnerDisplayName] = useState('');
  const [guestCode, setGuestCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestUsername, setGuestUsername] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestLoginHint, setGuestLoginHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDev = import.meta.env.DEV;

  React.useEffect(() => {
    // Use "invite" (not "code") — "code" is reserved for Supabase OAuth PKCE
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite') || params.get('guest');
    if (invite && invite.length === 6) {
      setShowForm(true);
      setIsGuestMode(true);
      setGuestCode(invite);
      setGuestHasAccount(false);
    }
  }, []);

  React.useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(mapAuthError(err, 'Erro ao entrar com Google.'));
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
      setError(mapAuthError(err, 'Erro ao entrar com Apple.'));
      setLoading(false);
    }
  };

  const handleLocalSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await signInLocal();
    } catch (err: any) {
      console.error(err);
      setError('Não foi possível entrar no modo local.');
      setLoading(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setGuestLoginHint('');
    setLoading(true);

    try {
      if (guestHasAccount) {
        // Login de convidado já cadastrado
        if (!guestUsername.trim() || !guestPassword) {
          setError('Informe usuário e senha.');
          return;
        }
        await signInAsGuestAccount(guestUsername, guestPassword);
        return;
      }

      // Cadastro de convidado
      const clean = guestCode.replace(/\D/g, '');
      if (clean.length !== 6) {
        setError('Informe o código de convite com 6 dígitos.');
        return;
      }
      if (!guestName.trim()) {
        setError('Informe seu nome.');
        return;
      }
      if (!guestUsername.trim()) {
        setError('Informe um usuário (ou e-mail) para login.');
        return;
      }
      if (guestPassword.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
      }

      // Se já está logado como dono e só quer vincular — raramente usado aqui
      if (user && user.email && !user.email.includes('local@') && !user.email.includes('guest.mycontas')) {
        await acceptInviteCode(clean);
        return;
      }

      const { loginEmail } = await signUpAsGuest({
        name: guestName,
        usernameOrEmail: guestUsername,
        password: guestPassword,
        inviteCode: clean,
      });
      setGuestLoginHint(
        `Cadastro ok! Seu login é: ${loginEmail}. Guarde usuário e senha para entrar de novo.`
      );
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível entrar como convidado.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) await signInWithEmail(email, password);
      else await signUpWithEmail(email, password, ownerDisplayName.trim() || undefined);
    } catch (err: any) {
      console.error(err);
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('password') && msg.includes('6')) {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (msg.includes('already registered')) {
        setError('Este e-mail já está em uso.');
        setIsLogin(true);
      } else {
        setError(mapAuthError(err, 'Ocorreu um erro. Verifique o Supabase ou use Modo Local.'));
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Welcome / splash (phone 1 in the reference) ── */
  if (!showForm) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#f3f0ff]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] shadow-2xl shadow-indigo-500/30"
          style={{
            background: 'linear-gradient(165deg, #5b4cdb 0%, #4338ca 45%, #312e81 100%)',
            minHeight: 560,
          }}
        >
          {/* Decorative geometric shapes */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-10 left-8 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[20px] border-b-orange-400 rotate-12 opacity-90" />
            <div className="absolute top-16 right-12 w-3 h-3 rounded-full bg-orange-400" />
            <div className="absolute top-28 left-1/3 w-2.5 h-2.5 rotate-45 bg-sky-300" />
            <div className="absolute top-24 right-1/4 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-violet-300 -rotate-45" />
            <div className="absolute bottom-48 left-6 w-8 h-8 rounded-full border-2 border-white/20" />
            <div className="absolute bottom-56 right-10 w-4 h-4 rounded-full bg-cyan-300/40" />
            {/* Leaf / plant silhouettes */}
            <svg
              className="absolute bottom-0 left-0 w-full h-72 opacity-40"
              viewBox="0 0 400 300"
              fill="none"
            >
              <ellipse cx="80" cy="260" rx="50" ry="90" fill="#60a5fa" transform="rotate(-25 80 260)" />
              <ellipse cx="140" cy="240" rx="55" ry="100" fill="#3b82f6" transform="rotate(10 140 240)" />
              <ellipse cx="200" cy="250" rx="48" ry="95" fill="#60a5fa" transform="rotate(-15 200 250)" />
              <ellipse cx="260" cy="235" rx="52" ry="105" fill="#2563eb" transform="rotate(20 260 235)" />
              <ellipse cx="320" cy="255" rx="45" ry="88" fill="#3b82f6" transform="rotate(-5 320 255)" />
            </svg>
            {/* Coin icons */}
            {[
              { x: '12%', y: '58%' },
              { x: '28%', y: '72%' },
              { x: '55%', y: '62%' },
              { x: '72%', y: '70%' },
            ].map((pos, i) => (
              <div
                key={i}
                className="absolute w-10 h-10 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white/80 text-sm font-bold backdrop-blur-sm"
                style={{ left: pos.x, top: pos.y }}
              >
                $
              </div>
            ))}
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center text-center px-10 pt-24 pb-10 min-h-[560px]">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-6 w-16 h-16 rounded-3xl bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur-md"
            >
              <Wallet size={32} className="text-white" />
            </motion.div>
            <h1 className="text-4xl font-bold text-white tracking-tight mb-3">Finance App</h1>
            <p className="text-white/70 text-sm leading-relaxed max-w-[240px] mb-10">
              Gerencie gastos, contas e metas com segurança e clareza.
            </p>

            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="absolute bottom-0 right-0 w-36 h-20 rounded-tl-[2.5rem] bg-[#ff6b35] text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-orange-500 transition-colors shadow-lg shadow-orange-500/30"
            >
              Start
              <ArrowRight size={20} />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── Auth form card ── */
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f3f0ff]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md finance-card p-8"
      >
        <div className="flex justify-center mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30"
            style={{ background: 'linear-gradient(135deg, #5b4cdb, #4338ca)' }}
          >
            <Wallet size={28} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-[#1e1b4b] mb-1">FinTrack</h1>
        <p className="text-center text-slate-400 text-sm mb-6">
          {isGuestMode
            ? guestHasAccount
              ? 'Entre com seu usuário de convidado'
              : 'Cadastre-se como convidado'
            : isLogin
              ? 'Faça login para continuar'
              : 'Crie sua conta para começar'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">
            {error}
          </div>
        )}
        {guestLoginHint && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-2xl text-sm border border-emerald-100">
            {guestLoginHint}
          </div>
        )}

        <AnimatePresence mode="wait">
          {isGuestMode ? (
            <motion.form
              key="guest"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              onSubmit={handleGuestSubmit}
              className="space-y-4"
            >
              <div className="flex p-1 rounded-full bg-slate-100 mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setGuestHasAccount(false);
                    setError('');
                  }}
                  className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
                    !guestHasAccount ? 'bg-white shadow text-[#5b4cdb]' : 'text-slate-500'
                  }`}
                >
                  Criar conta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGuestHasAccount(true);
                    setError('');
                  }}
                  className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
                    guestHasAccount ? 'bg-white shadow text-[#5b4cdb]' : 'text-slate-500'
                  }`}
                >
                  Já tenho conta
                </button>
              </div>

              <p className="text-sm text-slate-500 text-left">
                {guestHasAccount
                  ? 'Use o usuário e a senha que você cadastrou como convidado.'
                  : 'Informe o código do convite, seu nome e crie um usuário e senha. Seu nome aparece no app quando estiver logado.'}
              </p>

              {!guestHasAccount && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Código do convite
                  </label>
                  <div className="relative">
                    <Key size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      value={guestCode}
                      onChange={(e) => setGuestCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="finance-input w-full pl-11 text-center text-2xl tracking-[0.35em] font-mono"
                      placeholder="123456"
                      autoComplete="one-time-code"
                    />
                  </div>
                </div>
              )}

              {!guestHasAccount && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Seu nome (como aparece no app)
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="finance-input w-full pl-11"
                      placeholder="Ex: Maria Silva"
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  {guestHasAccount ? 'Usuário ou e-mail' : 'Usuário (login)'}
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={guestUsername}
                    onChange={(e) => setGuestUsername(e.target.value)}
                    className="finance-input w-full pl-11"
                    placeholder={guestHasAccount ? 'maria ou maria@email.com' : 'ex: maria.silva'}
                    autoComplete="username"
                  />
                </div>
                {!guestHasAccount && (
                  <p className="text-[11px] text-slate-400 mt-1 text-left">
                    Pode ser um apelido (vira login automático) ou um e-mail real.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Senha</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={guestPassword}
                  onChange={(e) => setGuestPassword(e.target.value)}
                  className="finance-input w-full"
                  placeholder="mínimo 6 caracteres"
                  autoComplete={guestHasAccount ? 'current-password' : 'new-password'}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="finance-btn-primary w-full py-3.5 disabled:opacity-50"
              >
                {loading
                  ? 'Aguarde...'
                  : guestHasAccount
                    ? 'Entrar como convidado'
                    : 'Cadastrar e entrar'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsGuestMode(false);
                  setError('');
                  setGuestLoginHint('');
                }}
                className="w-full py-2 text-sm text-slate-400 hover:text-[#5b4cdb]"
              >
                Voltar para login do dono
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="auth"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
            >
              <form onSubmit={handleSubmit} className="space-y-4 mb-5">
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                      Seu nome
                    </label>
                    <div className="relative">
                      <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={ownerDisplayName}
                        onChange={(e) => setOwnerDisplayName(e.target.value)}
                        className="finance-input w-full pl-11"
                        placeholder="Como quer ser chamado"
                        autoComplete="name"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">E-mail</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="finance-input w-full pl-11"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Senha</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="finance-input w-full"
                    placeholder="••••••"
                  />
                </div>
                <button type="submit" disabled={loading} className="finance-btn-primary w-full py-3.5 disabled:opacity-50">
                  {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
                </button>
              </form>

              <div className="flex items-center gap-3 mb-5">
                <hr className="flex-1 border-slate-200" />
                <span className="text-xs text-slate-400">ou continuar com</span>
                <hr className="flex-1 border-slate-200" />
              </div>

              <div className="space-y-3 mb-4">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  type="button"
                  className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 font-medium py-3 px-4 rounded-2xl transition-colors disabled:opacity-50"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                  Entrar com Google
                </button>
                <button
                  onClick={handleAppleSignIn}
                  disabled={loading}
                  type="button"
                  className="w-full flex items-center justify-center gap-3 bg-[#1e1b4b] text-white hover:bg-[#2e2a5a] font-medium py-3 px-4 rounded-2xl transition-colors disabled:opacity-50"
                >
                  <LogIn size={18} />
                  Entrar com Apple
                </button>
              </div>

              {isDev && (
                <button
                  onClick={handleLocalSignIn}
                  disabled={loading}
                  type="button"
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium py-3 px-4 rounded-2xl mb-4 disabled:opacity-50"
                >
                  <Monitor size={18} />
                  Continuar em Modo Local
                </button>
              )}

              <button
                onClick={() => {
                  setIsGuestMode(true);
                  setError('');
                }}
                type="button"
                className="w-full flex items-center justify-center gap-2 text-sm font-medium p-3 rounded-2xl bg-[#ece9ff] text-[#5b4cdb]"
              >
                <Key size={16} />
                Convidado? Acesse aqui
              </button>

              <p className="mt-5 text-center text-sm text-slate-400">
                {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                  className="font-semibold text-[#5b4cdb] hover:underline"
                  type="button"
                >
                  {isLogin ? 'Cadastrar' : 'Entrar'}
                </button>
              </p>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="mt-3 w-full text-xs text-slate-400 hover:text-[#5b4cdb]"
              >
                ← Voltar à tela inicial
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
