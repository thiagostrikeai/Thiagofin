import { useAppStore } from '../store/useAppStore';
import { useAuth } from '../contexts/AuthContext';
import { Settings as SettingsIcon, Palette, Layout, Building2, Bell, Globe, Users, Trash2, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import {
  createInvitation,
  getInvitations,
  deleteInvitation,
  Invitation,
  listMyGuests,
  revokeGuest,
  GuestMember,
  setInvitationActive,
} from '../lib/db';
import { format } from 'date-fns';
import { getUserPrefs, setUserPrefs } from '../lib/localStore';
import { requestNotificationPermission } from '../utils/reminders';

export default function Settings() {
  const { theme, dashboardConfig, currency, setTheme, setDashboardConfig, setCurrency } = useAppStore();
  const { user, targetUserId, isLocalMode, isGuest, permission } = useAuth();
  const [bankConnected, setBankConnected] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [guests, setGuests] = useState<GuestMember[]>([]);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [invitePermission, setInvitePermission] = useState<'view' | 'edit'>('view');
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(true);
  const [reminderEmail, setReminderEmail] = useState('');
  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const isOwner = Boolean(user && targetUserId && user.uid === targetUserId && !isGuest);

  useEffect(() => {
    if (!targetUserId) return;
    const prefs = getUserPrefs(targetUserId);
    setEmailRemindersEnabled(prefs.emailRemindersEnabled);
    setReminderEmail(prefs.reminderEmail || user?.email || '');
  }, [targetUserId, user?.email]);

  const colors = [
    { name: 'Roxo Finance', value: '#5b4cdb' },
    { name: 'Laranja', value: '#ff6b35' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Sky', value: '#0ea5e9' },
  ];

  useEffect(() => {
    if (isOwner && !isLocalMode) {
      void loadInvitations();
      void loadGuests();
    }
  }, [isOwner, isLocalMode]);

  const loadInvitations = async () => {
    if (!user || isLocalMode) return;
    try {
      const invs = await getInvitations(user.uid);
      setInvitations(invs);
    } catch (e) {
      console.error(e);
      setInviteError('Não foi possível carregar convites. Confira se o schema SQL foi aplicado.');
    }
  };

  const loadGuests = async () => {
    if (!user || isLocalMode) return;
    try {
      const list = await listMyGuests();
      setGuests(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateInvite = async () => {
    if (!user) return;
    if (isLocalMode) {
      alert('Convites exigem login com Supabase (não funcionam no Modo Local).');
      return;
    }
    setIsCreatingInvite(true);
    setInviteError('');
    setLastCreatedCode(null);
    try {
      const code = await createInvitation(
        user.uid,
        invitePermission,
        invitePermission === 'edit' ? 'Edição' : 'Visualização'
      );
      setLastCreatedCode(code);
      await loadInvitations();
    } catch (e) {
      console.error(e);
      setInviteError(
        e instanceof Error
          ? e.message
          : 'Erro ao criar convite. Verifique Auth e RLS no Supabase.'
      );
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleDeleteInvite = async (code: string) => {
    try {
      await deleteInvitation(code);
      if (lastCreatedCode === code) setLastCreatedCode(null);
      await loadInvitations();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleInvite = async (code: string, active: boolean) => {
    try {
      await setInvitationActive(code, active);
      await loadInvitations();
    } catch (e) {
      console.error(e);
      alert('Não foi possível alterar o convite. Rode fix-invites.sql se a coluna active não existir.');
    }
  };

  const handleRevokeGuest = async (guestUid: string) => {
    if (!confirm('Remover o acesso deste convidado?')) return;
    try {
      await revokeGuest(guestUid);
      await loadGuests();
    } catch (e) {
      console.error(e);
      alert('Erro ao remover convidado.');
    }
  };

  const siteOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://mycontas.netlify.app';

  const handleBankConnect = () => {
    // In a real app, this would trigger Plaid Link or similar
    alert('Na versão real, isso abriria a interface de conexão bancária (ex: Plaid).');
    setBankConnected(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/25"
          style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, #4338ca)` }}
        >
          <SettingsIcon size={24} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Theme Settings */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 ${theme.isDarkMode ? 'bg-[#1a1830]/90 border border-white/5 rounded-3xl' : 'finance-card'}`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Palette size={20} style={{ color: theme.primaryColor }} />
            <h2 className="text-xl font-semibold">Aparência</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Cor Principal</p>
              <div className="flex gap-2">
                {colors.map(color => (
                  <button
                    key={color.name}
                    onClick={() => setTheme({ primaryColor: color.value })}
                    className={`w-8 h-8 rounded-full transition-transform ${theme.primaryColor === color.value ? 'scale-125 ring-2 ring-offset-2' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color.value, ringColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium">Modo Escuro</span>
              <button
                onClick={() => setTheme({ isDarkMode: !theme.isDarkMode })}
                className={`w-12 h-6 rounded-full transition-colors relative ${theme.isDarkMode ? 'bg-indigo-500' : 'bg-gray-300'}`}
                style={{ backgroundColor: theme.isDarkMode ? theme.primaryColor : undefined }}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${theme.isDarkMode ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Regional Preferences */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`p-6 ${theme.isDarkMode ? 'bg-[#1a1830]/90 border border-white/5 rounded-3xl' : 'finance-card'}`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Globe size={20} style={{ color: theme.primaryColor }} />
            <h2 className="text-xl font-semibold">Preferências Regionais</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Moeda Principal</span>
              <select 
                value={currency} 
                onChange={(e) => setCurrency(e.target.value)}
                className={`p-2 rounded-lg border outline-none font-medium ${theme.isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
              >
                <option value="BRL">Real (BRL - R$)</option>
                <option value="USD">Dólar (USD - $)</option>
                <option value="EUR">Euro (EUR - €)</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Guest banner */}
        {isGuest && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:col-span-2 p-4 rounded-2xl bg-orange-50 border border-orange-100 text-orange-800 text-sm"
          >
            Você está como <strong>convidado</strong> (
            {permission === 'edit' ? 'pode visualizar e editar' : 'somente visualização'}).
            Convites e ajustes da conta principal só o dono gerencia.
          </motion.div>
        )}

        {/* Invitations / Shared Access */}
        {isOwner && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className={`p-6 md:col-span-2 ${theme.isDarkMode ? 'bg-[#1a1830]/90 border border-white/5 rounded-3xl' : 'finance-card'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} style={{ color: theme.primaryColor }} />
              <h2 className="text-xl font-semibold">Acesso Compartilhado (Convidados)</h2>
            </div>
            <p className={`text-sm mb-6 ${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Gere um código de 6 dígitos. Várias pessoas podem usar o mesmo código. Escolha se cada
              convite permite só ver ou também editar. Códigos não expiram até você apagar ou desativar.
            </p>

            {inviteError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{inviteError}</div>
            )}

            {lastCreatedCode && (
              <div className="mb-6 p-4 rounded-2xl bg-[#ece9ff] border border-indigo-100">
                <p className="text-sm font-medium text-[#5b4cdb] mb-1">Código gerado</p>
                <p className="text-3xl font-mono font-bold tracking-[0.3em] text-[#1e1b4b]">
                  {lastCreatedCode}
                </p>
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold text-[#5b4cdb] hover:underline"
                  onClick={() => {
                    const url = `${siteOrigin}/login?invite=${lastCreatedCode}`;
                    void navigator.clipboard.writeText(
                      `Acesse o MyContas!\n\nLink: ${url}\nCódigo: ${lastCreatedCode}`
                    );
                    alert('Link e código copiados!');
                  }}
                >
                  Copiar link + código
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 border-r border-gray-200 dark:border-gray-700 pr-0 md:pr-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Permissão do convite</label>
                    <select
                      value={invitePermission}
                      onChange={(e) => setInvitePermission(e.target.value as 'view' | 'edit')}
                      className={`w-full p-2.5 rounded-xl border outline-none font-medium ${theme.isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                    >
                      <option value="view">Somente visualização</option>
                      <option value="edit">Visualizar e editar</option>
                    </select>
                  </div>
                  <button
                    onClick={() => void handleCreateInvite()}
                    disabled={isCreatingInvite}
                    className="finance-btn-primary w-full py-3 disabled:opacity-50"
                  >
                    {isCreatingInvite ? 'Gerando...' : 'Gerar código de convite'}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2 space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-3 uppercase tracking-wider text-gray-500">
                    Códigos de convite
                  </h3>
                  {invitations.length === 0 ? (
                    <div className={`p-4 rounded-xl text-center ${theme.isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                      Nenhum convite criado ainda.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {invitations.map((inv) => (
                        <div
                          key={inv.code}
                          className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border ${
                            theme.isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                          } ${inv.active === false ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`p-3 rounded-lg font-mono text-2xl tracking-widest font-bold ${
                                theme.isDarkMode ? 'bg-gray-800' : 'bg-white'
                              }`}
                            >
                              {inv.code}
                            </div>
                            <div>
                              <div className="font-medium">
                                {inv.permission === 'edit'
                                  ? 'Visualizar e editar'
                                  : 'Somente visualização'}
                                {inv.active === false && (
                                  <span className="ml-2 text-xs text-red-500">desativado</span>
                                )}
                              </div>
                              <div
                                className={`text-xs mb-1 ${
                                  theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                }`}
                              >
                                Criado em {format(inv.createdAt, 'dd/MM/yyyy')}
                                {typeof inv.useCount === 'number' ? ` · ${inv.useCount} uso(s)` : ''}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const url = `${siteOrigin}/login?invite=${inv.code}`;
                                  void navigator.clipboard.writeText(
                                    `Acesse o MyContas!\n\nLink: ${url}\nCódigo: ${inv.code}`
                                  );
                                  alert('Link e código copiados!');
                                }}
                                className="text-xs font-medium hover:underline"
                                style={{ color: theme.primaryColor }}
                              >
                                Copiar link de convite
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleToggleInvite(inv.code, inv.active === false)
                              }
                              className="text-xs px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-100"
                            >
                              {inv.active === false ? 'Reativar' : 'Desativar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteInvite(inv.code)}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Apagar convite"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-3 uppercase tracking-wider text-gray-500">
                    Pessoas com acesso
                  </h3>
                  {guests.length === 0 ? (
                    <div
                      className={`p-4 rounded-xl text-center text-sm ${
                        theme.isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      Ninguém entrou com convite ainda.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {guests.map((g) => (
                        <div
                          key={g.guestUid}
                          className={`flex items-center justify-between p-3 rounded-xl border ${
                            theme.isDarkMode
                              ? 'bg-gray-700/80 border-gray-600'
                              : 'bg-white border-gray-100'
                          }`}
                        >
                          <div>
                            <p className="font-medium text-sm">
                              {g.guestName || g.guestEmail || 'Convidado anônimo'}
                            </p>
                            <p className="text-xs text-slate-400">
                              {g.permission === 'edit' ? 'Pode editar' : 'Só visualização'}
                              {g.code ? ` · código ${g.code}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRevokeGuest(g.guestUid)}
                            className="text-xs font-semibold text-red-500 hover:underline"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Dashboard Customization */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`p-6 ${theme.isDarkMode ? 'bg-[#1a1830]/90 border border-white/5 rounded-3xl' : 'finance-card'}`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Layout size={20} style={{ color: theme.primaryColor }} />
            <h2 className="text-xl font-semibold">Dashboard</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Mostrar Gráficos</span>
              <button
                onClick={() => setDashboardConfig({ showChart: !dashboardConfig.showChart })}
                className={`w-12 h-6 rounded-full transition-colors relative ${dashboardConfig.showChart ? 'bg-indigo-500' : 'bg-gray-300'}`}
                style={{ backgroundColor: dashboardConfig.showChart ? theme.primaryColor : undefined }}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${dashboardConfig.showChart ? 'translate-x-6' : ''}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Mostrar Contas Próximas</span>
              <button
                onClick={() => setDashboardConfig({ showUpcomingBills: !dashboardConfig.showUpcomingBills })}
                className={`w-12 h-6 rounded-full transition-colors relative ${dashboardConfig.showUpcomingBills ? 'bg-indigo-500' : 'bg-gray-300'}`}
                style={{ backgroundColor: dashboardConfig.showUpcomingBills ? theme.primaryColor : undefined }}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${dashboardConfig.showUpcomingBills ? 'translate-x-6' : ''}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Mostrar Metas</span>
              <button
                onClick={() => setDashboardConfig({ showGoals: !dashboardConfig.showGoals })}
                className={`w-12 h-6 rounded-full transition-colors relative ${dashboardConfig.showGoals ? 'bg-indigo-500' : 'bg-gray-300'}`}
                style={{ backgroundColor: dashboardConfig.showGoals ? theme.primaryColor : undefined }}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${dashboardConfig.showGoals ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Bank Connection */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`p-6 ${theme.isDarkMode ? 'bg-[#1a1830]/90 border border-white/5 rounded-3xl' : 'finance-card'}`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={20} style={{ color: theme.primaryColor }} />
            <h2 className="text-xl font-semibold">Conexão Bancária</h2>
          </div>
          
          <p className={`text-sm mb-4 ${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Conecte suas contas bancárias e cartões de crédito para sincronização automática.
          </p>

          {bankConnected ? (
            <div className="flex items-center gap-2 text-green-500 font-medium bg-green-50 bg-opacity-10 p-3 rounded-lg">
              <Building2 size={20} />
              Banco Conectado com Sucesso
            </div>
          ) : (
            <button
              onClick={handleBankConnect}
              className="finance-btn-primary w-full py-3"
            >
              Conectar Nova Conta
            </button>
          )}
        </motion.div>

        {/* Notifications / Email reminders */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`p-6 ${theme.isDarkMode ? 'bg-[#1a1830]/90 border border-white/5 rounded-3xl' : 'finance-card'}`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Bell size={20} style={{ color: theme.primaryColor }} />
            <h2 className="text-xl font-semibold">Lembretes</h2>
          </div>
          
          <p className={`text-sm mb-4 ${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Contas próximas do vencimento geram alerta no app. Use o calendário Google/Apple para
            avisos automáticos mensais (e e-mail do Google Calendar, se ativado na sua conta Google).
          </p>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Lembretes por e-mail no app</span>
              <button
                type="button"
                onClick={() => {
                  if (!targetUserId) return;
                  const next = !emailRemindersEnabled;
                  setEmailRemindersEnabled(next);
                  setUserPrefs(targetUserId, { emailRemindersEnabled: next });
                }}
                className={`w-12 h-6 rounded-full transition-colors relative ${emailRemindersEnabled ? '' : 'bg-gray-300'}`}
                style={{ backgroundColor: emailRemindersEnabled ? theme.primaryColor : undefined }}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${emailRemindersEnabled ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-1.5">
                <Mail size={16} style={{ color: theme.primaryColor }} />
                E-mail para lembretes
              </label>
              <input
                type="email"
                value={reminderEmail}
                onChange={(e) => setReminderEmail(e.target.value)}
                onBlur={() => {
                  if (targetUserId) {
                    setUserPrefs(targetUserId, { reminderEmail: reminderEmail.trim() });
                  }
                }}
                placeholder={user?.email || 'seu@email.com'}
                className={`w-full p-3 rounded-xl border outline-none ${theme.isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
              />
              <p className="text-xs text-slate-400 mt-1">
                Usado no botão &quot;Abrir e-mail de lembrete&quot; e no arquivo Apple Calendar.
                {isLocalMode ? ' (modo local)' : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                const p = await requestNotificationPermission();
                setNotifStatus(p);
              }}
              className="w-full py-2.5 px-4 rounded-full font-medium border-2 transition-colors"
              style={{ borderColor: theme.primaryColor, color: theme.primaryColor }}
            >
              {notifStatus === 'granted'
                ? '✓ Notificações do navegador ativas'
                : 'Ativar notificações do navegador'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
