import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppStore } from '../store/useAppStore';
import { motion } from 'motion/react';
import { useBillsData } from '../hooks/useBillsData';
import { useGoalsData } from '../hooks/useGoalsData';
import { Bill } from '../types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { isSameMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, ChevronRight, CreditCard, TrendingUp, ArrowDownRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';

type ChartMode = 'income' | 'expenses';
type Period = 'day' | 'week' | 'month' | 'year';

export default function Dashboard() {
  const { user, isGuest, permission } = useAuth();
  const { theme, dashboardConfig, currency } = useAppStore();
  const { bills } = useBillsData();
  const { goals } = useGoalsData();
  const [chartMode, setChartMode] = useState<ChartMode>('expenses');
  const [period, setPeriod] = useState<Period>('month');
  const firstName =
    user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuário';

  const isPaidThisMonth = (bill: Bill) => {
    if (!bill.history?.length) return false;
    return bill.history.some((p) => isSameMonth(new Date(p.datePaid), new Date()));
  };

  const isNearDueDate = (bill: Bill) => {
    if (isPaidThisMonth(bill)) return false;
    const today = new Date();
    const createdDate = bill.createdAt ? new Date(bill.createdAt) : new Date(0);
    if (
      today.getFullYear() < createdDate.getFullYear() ||
      (today.getFullYear() === createdDate.getFullYear() &&
        today.getMonth() < createdDate.getMonth())
    ) {
      return false;
    }
    const daysUntilDue = bill.dueDay - today.getDate();
    if (daysUntilDue < 0) return true;
    return daysUntilDue <= bill.warningDays;
  };

  const upcomingBills = bills.filter((b) => isNearDueDate(b)).sort((a, b) => a.dueDay - b.dueDay);

  const totalSpent = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const totalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
  const balance = Math.max(totalTarget - totalSpent, 0);
  const budgetPct =
    totalTarget > 0 ? Math.min(Math.round((totalSpent / totalTarget) * 100), 100) : 0;

  const monthPayments = useMemo(() => {
    const now = new Date();
    let total = 0;
    const recent: { name: string; amount: number; date: number }[] = [];
    bills.forEach((bill) => {
      bill.history?.forEach((p) => {
        const d = new Date(p.datePaid);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          total += p.amount;
          recent.push({ name: bill.name, amount: p.amount, date: p.datePaid });
        }
      });
    });
    recent.sort((a, b) => b.date - a.date);
    return { total, recent: recent.slice(0, 5) };
  }, [bills]);

  /** Line chart data from last 6 months of payments vs goals ceiling */
  const chartData = useMemo(() => {
    const now = new Date();
    const months: { name: string; value: number; ceiling: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = format(d, 'MMM', { locale: ptBR });
      let spent = 0;
      bills.forEach((bill) => {
        bill.history?.forEach((p) => {
          const pd = new Date(p.datePaid);
          if (pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear()) {
            spent += p.amount;
          }
        });
      });
      // Ceiling: sum of goal targets (or spent as income-side placeholder)
      const ceiling = totalTarget || spent * 1.2 || 1000;
      months.push({
        name: label.charAt(0).toUpperCase() + label.slice(1),
        value: chartMode === 'expenses' ? spent : Math.max(ceiling - spent, 0),
        ceiling,
      });
    }
    return months;
  }, [bills, totalTarget, chartMode]);

  const peakPoint = chartData.reduce(
    (best, m, idx) => (m.value > best.value ? { ...m, idx } : best),
    { name: '', value: 0, idx: -1 }
  );

  const cardBg = theme.isDarkMode
    ? 'bg-[#1a1830]/90 border border-white/5 shadow-xl shadow-black/20'
    : 'finance-card';
  const muted = theme.isDarkMode ? 'text-slate-400' : 'text-slate-400';
  const ink = theme.isDarkMode ? 'text-white' : 'text-[#1e1b4b]';

  return (
    <div className="space-y-6 max-w-xl mx-auto md:max-w-none">
      {/* Header */}
      <div className="text-center md:text-left md:flex md:items-end md:justify-between">
        <div>
          <p className={`text-sm font-medium ${muted}`}>
            Olá, {firstName}
            {isGuest ? ' 👋' : ''}
          </p>
          {isGuest && (
            <p className={`text-xs mt-0.5 font-medium ${theme.isDarkMode ? 'text-orange-300' : 'text-orange-500'}`}>
              Convidado{user?.displayName ? `: ${user.displayName}` : ''} ·{' '}
              {permission === 'edit' ? 'pode editar' : 'somente visualização'}
            </p>
          )}
          <p className={`text-sm mt-1 ${muted}`}>Saldo total</p>
          <h1 className={`text-4xl md:text-5xl font-bold tracking-tight mt-1 ${ink}`}>
            {formatCurrency(chartMode === 'expenses' ? balance : totalTarget, currency)}
          </h1>
        </div>
        <p className={`hidden md:block text-sm ${muted}`}>
          {format(new Date(), "MMMM yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Income / Expenses toggle */}
      <div className="flex justify-center md:justify-start">
        <div
          className={`inline-flex p-1 rounded-full ${
            theme.isDarkMode ? 'bg-white/5' : 'bg-white shadow-sm border border-indigo-50'
          }`}
        >
          <button
            type="button"
            onClick={() => setChartMode('income')}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
              chartMode === 'income'
                ? 'text-white shadow-md'
                : muted
            }`}
            style={
              chartMode === 'income'
                ? { background: `linear-gradient(135deg, ${theme.primaryColor}, #4338ca)` }
                : undefined
            }
          >
            Teto
          </button>
          <button
            type="button"
            onClick={() => setChartMode('expenses')}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
              chartMode === 'expenses' ? 'text-white shadow-md' : muted
            }`}
            style={
              chartMode === 'expenses'
                ? { background: `linear-gradient(135deg, ${theme.primaryColor}, #4338ca)` }
                : undefined
            }
          >
            Gastos
          </button>
        </div>
      </div>

      {/* Period chips */}
      <div className="flex justify-center md:justify-start gap-5 text-sm font-medium">
        {(
          [
            ['day', 'Dia'],
            ['week', 'Semana'],
            ['month', 'Mês'],
            ['year', 'Ano'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={`pb-1 border-b-2 transition-colors ${
              period === key
                ? 'border-[#ff6b35] text-[#ff6b35]'
                : `border-transparent ${muted} hover:text-[#5b4cdb]`
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Area chart */}
      {dashboardConfig.showChart && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 md:p-6 ${cardBg}`}
        >
          <div className="h-56 md:h-64 relative">
            {peakPoint.value > 0 && (
              <div
                className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg"
                style={{ background: theme.primaryColor }}
              >
                {formatCurrency(peakPoint.value, currency)}
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 28, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5b4cdb" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#5b4cdb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="orangeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6b35" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ff6b35" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 8"
                  vertical={false}
                  stroke={theme.isDarkMode ? 'rgba(255,255,255,0.06)' : '#ede9fe'}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: theme.isDarkMode ? '#94a3b8' : '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <RechartsTooltip
                  contentStyle={{
                    background: theme.isDarkMode ? '#1a1830' : '#fff',
                    border: 'none',
                    borderRadius: 16,
                    boxShadow: '0 10px 30px rgba(91,76,219,0.15)',
                    color: theme.isDarkMode ? '#fff' : '#1e1b4b',
                  }}
                  formatter={(value: number) => [formatCurrency(value, currency), chartMode === 'expenses' ? 'Gasto' : 'Disponível']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={chartMode === 'expenses' ? '#5b4cdb' : '#ff6b35'}
                  strokeWidth={3}
                  fill={chartMode === 'expenses' ? 'url(#purpleFill)' : 'url(#orangeFill)'}
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: theme.primaryColor,
                    stroke: '#fff',
                    strokeWidth: 3,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ceiling"
                  stroke="#ff6b35"
                  strokeWidth={2}
                  strokeOpacity={0.5}
                  fill="url(#orangeFill)"
                  fillOpacity={0.15}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Budget progress (credit limit style) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="finance-card-dark p-5 flex items-center gap-4"
      >
        <div className="relative w-14 h-14 shrink-0">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="#fff"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${(budgetPct / 100) * 150.8} 150.8`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">
            {budgetPct}%
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/70">Seu orçamento mensal</p>
          <p className="text-lg font-bold truncate">
            {formatCurrency(totalSpent, currency)}
            <span className="text-white/50 font-medium text-sm">
              {' '}
              de {formatCurrency(totalTarget || 0, currency)}
            </span>
          </p>
        </div>
        <Link
          to="/goals"
          className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
        >
          <ChevronRight size={20} />
        </Link>
      </motion.div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <div className={`p-4 ${cardBg}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#ece9ff] text-[#5b4cdb] flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
            <span className={`text-xs font-medium ${muted}`}>Teto</span>
          </div>
          <p className={`text-xl font-bold ${ink}`}>{formatCurrency(totalTarget, currency)}</p>
        </div>
        <div className={`p-4 ${cardBg}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#ff6b35] flex items-center justify-center">
              <ArrowDownRight size={18} />
            </div>
            <span className={`text-xs font-medium ${muted}`}>Gastos</span>
          </div>
          <p className={`text-xl font-bold ${totalSpent > totalTarget && totalTarget > 0 ? 'text-red-500' : ink}`}>
            {formatCurrency(totalSpent || monthPayments.total, currency)}
          </p>
        </div>
        <div className={`p-4 ${cardBg} col-span-2 md:col-span-1`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Bell size={18} />
            </div>
            <span className={`text-xs font-medium ${muted}`}>Alertas</span>
          </div>
          <p className={`text-xl font-bold ${ink}`}>{upcomingBills.length} contas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming bills */}
        {dashboardConfig.showUpcomingBills && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`p-5 ${cardBg}`}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-lg font-bold ${ink}`}>Próximos vencimentos</h2>
              <Link to="/bills" className="text-sm font-semibold text-[#5b4cdb]">
                Ver todas
              </Link>
            </div>
            <div className="space-y-2.5">
              {upcomingBills.length > 0 ? (
                upcomingBills.slice(0, 4).map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-orange-50/80 border border-orange-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 text-[#ff6b35] flex items-center justify-center">
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-[#1e1b4b]">{bill.name}</p>
                        <p className="text-xs text-orange-500 flex items-center gap-1">
                          <Bell size={11} /> Dia {bill.dueDay}
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/bills"
                      className="px-4 py-2 rounded-full bg-[#ff6b35] text-white text-xs font-bold shadow-md shadow-orange-500/25"
                    >
                      Pagar
                    </Link>
                  </div>
                ))
              ) : (
                <p className={`text-sm text-center py-6 ${muted}`}>Nenhuma conta próxima.</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Recent transactions + goals */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="finance-card-dark p-5"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Transações</h2>
              <Link to="/expenses" className="text-sm text-white/70 hover:text-white">
                Todas
              </Link>
            </div>
            <div className="space-y-3">
              {monthPayments.recent.length > 0 ? (
                monthPayments.recent.map((t, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-sm font-bold">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t.name}</p>
                        <p className="text-[11px] text-white/50">
                          {format(new Date(t.date), "d MMM, HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-sm flex items-center gap-0.5">
                      <ArrowDownRight size={14} className="text-orange-300" />
                      {formatCurrency(t.amount, currency)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/50 text-center py-4">
                  Nenhuma transação este mês.
                </p>
              )}
            </div>
          </motion.div>

          {dashboardConfig.showGoals && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={`p-5 ${cardBg}`}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-lg font-bold ${ink}`}>Metas</h2>
                <Link to="/goals" className="text-sm font-semibold text-[#5b4cdb]">
                  Ajustar
                </Link>
              </div>
              <div className="space-y-4">
                {goals.length > 0 ? (
                  goals.slice(0, 3).map((goal) => {
                    const pct = goal.targetAmount
                      ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                      : 0;
                    const over = goal.currentAmount > goal.targetAmount;
                    return (
                      <div key={goal.id}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className={`font-medium ${ink}`}>{goal.name}</span>
                          <span className={over ? 'text-red-500 font-bold' : muted}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div
                          className={`h-2.5 rounded-full overflow-hidden ${
                            theme.isDarkMode ? 'bg-white/10' : 'bg-[#ece9ff]'
                          }`}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: over
                                ? '#ef4444'
                                : `linear-gradient(90deg, ${theme.primaryColor}, #ff6b35)`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className={`text-sm text-center py-4 ${muted}`}>Cadastre metas em Metas.</p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
