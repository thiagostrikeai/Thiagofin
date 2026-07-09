import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppStore } from '../store/useAppStore';
import { billsRef, goalsRef } from '../lib/db';
import { Bill, Goal } from '../types';
import { onSnapshot } from 'firebase/firestore';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { format, isSameMonth } from 'date-fns';
import { AlertCircle, Target, TrendingDown, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';

export default function Dashboard() {
  const { user, targetUserId, permission } = useAuth();
  const { theme, dashboardConfig, currency } = useAppStore();
  const [bills, setBills] = useState<Bill[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    if (!targetUserId) return;
    const unsubBills = onSnapshot(billsRef(targetUserId), (snapshot) => {
      const data: Bill[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Bill));
      setBills(data);
    });
    const unsubGoals = onSnapshot(goalsRef(targetUserId), (snapshot) => {
      const data: Goal[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Goal));
      setGoals(data);
    });
    return () => { unsubBills(); unsubGoals(); };
  }, [user]);

  const isPaidThisMonth = (bill: Bill) => {
    if (!bill.history || bill.history.length === 0) return false;
    const currentMonth = new Date();
    return bill.history.some(p => isSameMonth(new Date(p.datePaid), currentMonth));
  };

  const isNearDueDate = (bill: Bill) => {
    if (isPaidThisMonth(bill)) return false;
    const today = new Date();
    const createdDate = bill.createdAt ? new Date(bill.createdAt) : new Date(0);
    
    if (today.getFullYear() < createdDate.getFullYear() || (today.getFullYear() === createdDate.getFullYear() && today.getMonth() < createdDate.getMonth())) {
      return false; // Not started yet in this period
    }

    const currentDay = today.getDate();
    let daysUntilDue = bill.dueDay - currentDay;
    if (daysUntilDue < 0) return true; 
    return daysUntilDue <= bill.warningDays;
  };

  const upcomingBills = bills.filter(b => isNearDueDate(b)).sort((a, b) => a.dueDay - b.dueDay);
  
  const chartData = goals.map(g => ({
    name: g.name,
    Gasto: g.currentAmount,
    Teto: g.targetAmount
  }));

  const totalSpent = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const totalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Olá, {user?.displayName?.split(' ')[0] || 'Usuário'}</h1>
          <p className={`${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Aqui está o resumo financeiro do mês</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -5, scale: 1.02 }}
          transition={{ duration: 0.3 }}
          className={`p-6 rounded-3xl ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5 shadow-2xl shadow-indigo-500/5' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'} transition-all`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500"><Target size={22} /></div>
            <h3 className={`font-medium ${theme.isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Teto Mensal</h3>
          </div>
          <p className="text-3xl font-bold tracking-tight">{formatCurrency(totalTarget, currency)}</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -5, scale: 1.02 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className={`p-6 rounded-3xl ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5 shadow-2xl shadow-purple-500/5' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'} transition-all`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500"><TrendingDown size={22} /></div>
            <h3 className={`font-medium ${theme.isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gasto Total</h3>
          </div>
          <p className={`text-3xl font-bold tracking-tight ${totalSpent > totalTarget ? 'text-red-500' : ''}`}>
            {formatCurrency(totalSpent, currency)}
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -5, scale: 1.02 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className={`p-6 rounded-3xl ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5 shadow-2xl shadow-amber-500/5' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'} transition-all`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500"><AlertCircle size={22} /></div>
            <h3 className={`font-medium ${theme.isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Contas em Alerta</h3>
          </div>
          <p className="text-3xl font-bold tracking-tight">{upcomingBills.length}</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section */}
        {dashboardConfig.showChart && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className={`lg:col-span-2 p-6 rounded-3xl ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'} transition-all`}
          >
            <h2 className="text-xl font-bold mb-6">Comparativo de Metas</h2>
            {goals.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9'} />
                    <XAxis dataKey="name" tick={{ fill: theme.isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: theme.isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: theme.isDarkMode ? '#1e1e2d' : '#ffffff', borderColor: theme.isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: '16px', color: theme.isDarkMode ? '#f8fafc' : '#0f172a', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                      cursor={{ fill: theme.isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}
                      formatter={(value: number) => [formatCurrency(value, currency), '']}
                    />
                    <Legend iconType="circle" />
                    <Bar dataKey="Gasto" fill={theme.primaryColor} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Teto" fill={theme.isDarkMode ? '#334155' : '#e2e8f0'} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className={`h-72 flex items-center justify-center text-sm ${theme.isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Cadastre metas para visualizar o gráfico.
              </div>
            )}
          </motion.div>
        )}

        {/* Sidebar Sections */}
        <div className="space-y-6 lg:col-span-1">
          {dashboardConfig.showUpcomingBills && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className={`p-6 rounded-3xl ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'} transition-all`}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Próximos Vencimentos</h2>
                <Link to="/bills" className="text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: theme.primaryColor }}>Ver todas</Link>
              </div>
              <div className="space-y-3">
                {upcomingBills.length > 0 ? (
                  upcomingBills.slice(0, 3).map(bill => (
                    <motion.div whileHover={{ scale: 1.02 }} key={bill.id} className="flex justify-between items-center p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 transition-all">
                      <div>
                        <p className="font-bold text-amber-600 dark:text-amber-400">{bill.name}</p>
                        <p className="text-xs text-amber-500 flex items-center gap-1 mt-1"><Bell size={12} /> Dia {bill.dueDay}</p>
                      </div>
                      <Link to="/bills" className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20">
                        Pagar
                      </Link>
                    </motion.div>
                  ))
                ) : (
                  <p className={`text-sm text-center py-6 ${theme.isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma conta próxima.</p>
                )}
              </div>
            </motion.div>
          )}

          {dashboardConfig.showGoals && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className={`p-6 rounded-3xl ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'} transition-all`}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Metas em Risco</h2>
                <Link to="/goals" className="text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: theme.primaryColor }}>Ajustar</Link>
              </div>
              <div className="space-y-5">
                {goals.filter(g => g.currentAmount > g.targetAmount * 0.8).length > 0 ? (
                  goals.filter(g => g.currentAmount > g.targetAmount * 0.8).map(goal => (
                    <div key={goal.id} className="space-y-2 group">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium group-hover:text-indigo-400 transition-colors">{goal.name}</span>
                        <span className={goal.currentAmount > goal.targetAmount ? 'text-red-500 font-bold' : 'font-semibold'}>
                          {(goal.currentAmount / goal.targetAmount * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className={`h-2.5 rounded-full overflow-hidden ${theme.isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <div 
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ 
                            width: `${Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)}%`,
                            backgroundColor: goal.currentAmount > goal.targetAmount ? '#ef4444' : theme.primaryColor
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={`text-sm text-center py-6 ${theme.isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma meta em risco.</p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
