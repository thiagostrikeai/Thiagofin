import { useAppStore } from '../store/useAppStore';
import { useAuth } from '../contexts/AuthContext';
import { Settings as SettingsIcon, Palette, Layout, Building2, Bell, Globe, Users, Trash2, Key } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { createInvitation, getInvitations, deleteInvitation, Invitation } from '../lib/db';
import { format } from 'date-fns';

export default function Settings() {
  const { theme, dashboardConfig, currency, setTheme, setDashboardConfig, setCurrency } = useAppStore();
  const { user, targetUserId } = useAuth();
  const [bankConnected, setBankConnected] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [invitePermission, setInvitePermission] = useState<'view' | 'edit'>('view');

  const isOwner = user && targetUserId && user.uid === targetUserId;

  const colors = [
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Sky', value: '#0ea5e9' },
  ];

  useEffect(() => {
    if (isOwner) {
      loadInvitations();
    }
  }, [isOwner]);

  const loadInvitations = async () => {
    if (!user) return;
    try {
      const invs = await getInvitations(user.uid);
      setInvitations(invs);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateInvite = async () => {
    if (!user) return;
    setIsCreatingInvite(true);
    try {
      await createInvitation(user.uid, invitePermission);
      await loadInvitations();
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleDeleteInvite = async (code: string) => {
    try {
      await deleteInvitation(code);
      await loadInvitations();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBankConnect = () => {
    // In a real app, this would trigger Plaid Link or similar
    alert('Na versão real, isso abriria a interface de conexão bancária (ex: Plaid).');
    setBankConnected(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon size={32} style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Ajustes</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Theme Settings */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-2xl ${theme.isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
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
          className={`p-6 rounded-2xl ${theme.isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
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

        {/* Invitations / Shared Access */}
        {isOwner && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className={`p-6 rounded-2xl md:col-span-2 ${theme.isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-6">
              <Users size={20} style={{ color: theme.primaryColor }} />
              <h2 className="text-xl font-semibold">Acesso Compartilhado (Convidados)</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 border-r border-gray-200 dark:border-gray-700 pr-0 md:pr-6">
                <p className={`text-sm mb-4 ${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Crie convites para compartilhar seu aplicativo. O convidado usará o código de 6 dígitos para acessar sua conta com as permissões que você definir.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Permissão</label>
                    <select
                      value={invitePermission}
                      onChange={(e) => setInvitePermission(e.target.value as 'view' | 'edit')}
                      className={`w-full p-2 rounded-lg border outline-none font-medium ${theme.isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                    >
                      <option value="view">Somente Visualização</option>
                      <option value="edit">Visualizar e Editar</option>
                    </select>
                  </div>
                  <button
                    onClick={handleCreateInvite}
                    disabled={isCreatingInvite}
                    className="w-full py-2 px-4 rounded-lg font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                    {isCreatingInvite ? 'Criando...' : 'Gerar Código de Convite'}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <h3 className="text-sm font-medium mb-3 uppercase tracking-wider text-gray-500">Convites Ativos</h3>
                {invitations.length === 0 ? (
                  <div className={`p-4 rounded-lg text-center ${theme.isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                    Nenhum convite criado ainda.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invitations.map(inv => (
                      <div key={inv.code} className={`flex items-center justify-between p-4 rounded-xl border ${theme.isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg font-mono text-2xl tracking-widest font-bold ${theme.isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            {inv.code}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {inv.permission === 'edit' ? 'Visualizar e Editar' : 'Somente Visualização'}
                            </div>
                            <div className={`text-xs mb-1 ${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              Criado em {format(inv.createdAt, 'dd/MM/yyyy')}
                            </div>
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/login?code=${inv.code}`;
                                navigator.clipboard.writeText(`Acesse meu aplicativo no FinTrack!\n\nLink: ${url}\nCódigo de acesso: ${inv.code}`);
                                alert('Link e código copiados para a área de transferência!');
                              }}
                              className={`text-xs font-medium hover:underline flex items-center gap-1`}
                              style={{ color: theme.primaryColor }}
                            >
                              Copiar link de convite
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteInvite(inv.code)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Remover convite"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Dashboard Customization */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`p-6 rounded-2xl ${theme.isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
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
          className={`p-6 rounded-2xl ${theme.isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
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
              className="w-full py-2 px-4 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: theme.primaryColor }}
            >
              Conectar Nova Conta
            </button>
          )}
        </motion.div>

        {/* Notifications Settings */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`p-6 rounded-2xl ${theme.isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Bell size={20} style={{ color: theme.primaryColor }} />
            <h2 className="text-xl font-semibold">Notificações</h2>
          </div>
          
          <p className={`text-sm mb-4 ${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Os avisos serão enviados para {user?.email}. Certifique-se de permitir notificações push no seu navegador.
          </p>
          <button
            onClick={() => alert('Configurações de push seriam ativadas aqui.')}
            className="w-full py-2 px-4 rounded-lg font-medium border-2 transition-colors"
            style={{ borderColor: theme.primaryColor, color: theme.primaryColor }}
          >
            Ativar Push Notifications
          </button>
        </motion.div>
      </div>
    </div>
  );
}
