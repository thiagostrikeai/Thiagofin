import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppStore } from '../store/useAppStore';
import { billsRef, updatePayment, deletePayment } from '../lib/db';
import { Bill, PaymentHistory } from '../types';
import { onSnapshot, query } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Calendar as CalendarIcon, Edit2, Trash2, X, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../utils/currency';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function Expenses() {
  const { user, targetUserId, permission } = useAuth();
  const { theme, currency } = useAppStore();
  const [bills, setBills] = useState<Bill[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  // Edit Payment State
  const [editingPayment, setEditingPayment] = useState<{billId: string, payment: PaymentHistory, bill: Bill} | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!targetUserId) return;
    const q = query(billsRef(targetUserId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBills(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill)));
    });
    return () => unsubscribe();
  }, [user]);

  // Data processing
  const getPaymentsForMonth = (m: number, y: number) => {
    let allPayments: { bill: Bill, payment: PaymentHistory }[] = [];
    bills.forEach(bill => {
      if (bill.history) {
        bill.history.forEach(p => {
          const d = new Date(p.datePaid);
          if (d.getMonth() === m && d.getFullYear() === y) {
            allPayments.push({ bill, payment: p });
          }
        });
      }
    });
    return allPayments.sort((a, b) => b.payment.datePaid - a.payment.datePaid);
  };

  const monthlyPayments = getPaymentsForMonth(selectedMonth, selectedYear);

  const pieData = bills.map(b => {
    const total = b.history?.filter(p => {
      const d = new Date(p.datePaid);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    }).reduce((sum, p) => sum + p.amount, 0) || 0;
    return { name: b.name, value: total };
  }).filter(d => d.value > 0);

  const barData = months.map((mName, mIdx) => {
    let data: any = { name: mName.substring(0, 3) };
    bills.forEach(b => {
      data[b.name] = b.history?.filter(p => {
        const d = new Date(p.datePaid);
        return d.getMonth() === mIdx && d.getFullYear() === selectedYear;
      }).reduce((sum, p) => sum + p.amount, 0) || 0;
    });
    return data;
  });

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingPayment || isSubmitting) return;
    const amount = parseFloat(editAmount.replace(',', '.'));
    if (isNaN(amount)) return;
    
    setIsSubmitting(true);
    try {
      await updatePayment(
        targetUserId, 
        editingPayment.billId, 
        editingPayment.payment.id, 
        amount, 
        new Date(editDate).getTime(),
        editingPayment.bill.history
      );
      setEditingPayment(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async (billId: string, paymentId: string, history: PaymentHistory[]) => {
    if (!user || !confirm('Deseja excluir este lançamento?')) return;
    await deletePayment(targetUserId, billId, paymentId, history);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gastos e Lançamentos</h1>
          <p className={`${theme.isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Visualize e gerencie seus gastos detalhados
          </p>
        </div>
        
        <div className={`p-4 rounded-2xl flex items-center gap-4 ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5 shadow-lg shadow-indigo-500/5' : 'bg-white shadow-sm border border-slate-100'} transition-all`}>
          <div className="flex items-center gap-2 font-medium">
            <div className="p-2 rounded-xl" style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}>
              <CalendarIcon size={20} />
            </div>
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className={`p-2.5 rounded-xl border outline-none transition-colors ${theme.isDarkMode ? 'bg-slate-800/50 border-white/10 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
            >
              {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={`p-2.5 rounded-xl border outline-none transition-colors ${theme.isDarkMode ? 'bg-slate-800/50 border-white/10 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-3xl ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5 shadow-2xl shadow-indigo-500/5' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'} transition-all`}
        >
          <h2 className="text-xl font-bold mb-6">Gastos por Conta ({months[selectedMonth]})</h2>
          <div className="h-64">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={4}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: theme.isDarkMode ? '#1e1e2d' : '#ffffff', borderColor: theme.isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: '16px', color: theme.isDarkMode ? '#f8fafc' : '#0f172a', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: number) => [formatCurrency(value, currency), 'Total']}
                  />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">Nenhum gasto neste mês.</div>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`p-6 rounded-3xl ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5 shadow-2xl shadow-purple-500/5' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'} transition-all`}
        >
          <h2 className="text-xl font-bold mb-6">Evolução Mensal ({selectedYear})</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9'} />
                <XAxis dataKey="name" tick={{ fill: theme.isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: theme.isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: theme.isDarkMode ? '#1e1e2d' : '#ffffff', borderColor: theme.isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: '16px', color: theme.isDarkMode ? '#f8fafc' : '#0f172a', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  cursor={{ fill: theme.isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}
                  formatter={(value: number) => [formatCurrency(value, currency), 'Gasto']}
                />
                <Legend iconType="circle" />
                {bills.map((b, i) => (
                  <Bar key={b.id} dataKey={b.name} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === bills.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`p-6 rounded-3xl ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5 shadow-2xl shadow-indigo-500/5' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'} overflow-hidden transition-all`}
      >
        <h2 className="text-xl font-bold mb-6">Lançamentos ({months[selectedMonth]} {selectedYear})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`border-b ${theme.isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <th className="py-4 px-4 font-medium">Data</th>
                <th className="py-4 px-4 font-medium">Conta</th>
                <th className="py-4 px-4 font-medium text-right">Valor</th>
                <th className="py-4 px-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {monthlyPayments.length > 0 ? (
                monthlyPayments.map(({ bill, payment }) => (
                  <motion.tr 
                    whileHover={{ scale: 1.01, backgroundColor: theme.isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}
                    key={payment.id} 
                    className={`border-b ${theme.isDarkMode ? 'border-white/5' : 'border-slate-100'} transition-all cursor-default`}
                  >
                    <td className="py-4 px-4 whitespace-nowrap">{format(new Date(payment.datePaid), 'dd/MM/yyyy')}</td>
                    <td className="py-4 px-4 font-medium whitespace-nowrap">{bill.name}</td>
                    <td className="py-4 px-4 text-right whitespace-nowrap font-medium text-indigo-500 dark:text-indigo-400">{formatCurrency(payment.amount, currency)}</td>
                    <td className="py-4 px-4 text-center flex justify-center gap-2">
                      {permission === 'edit' && (
                        <>
                          <button 
                            onClick={() => {
                              setEditingPayment({ billId: bill.id, payment, bill });
                              setEditAmount(payment.amount.toString());
                              setEditDate(format(new Date(payment.datePaid), 'yyyy-MM-dd'));
                            }}
                            className={`p-2 rounded-xl transition-colors ${theme.isDarkMode ? 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeletePayment(bill.id, payment.id, bill.history)}
                            className={`p-2 rounded-xl transition-colors ${theme.isDarkMode ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500">
                    Nenhum lançamento encontrado para este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <AnimatePresence>
        {editingPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`max-w-md w-full p-6 rounded-3xl shadow-2xl border ${theme.isDarkMode ? 'bg-[#13131f] text-white border-white/10' : 'bg-white text-slate-900 border-slate-100'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Editar Lançamento</h2>
                <button
                  onClick={() => setEditingPayment(null)}
                  className={`p-2 rounded-xl transition-colors ${theme.isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdatePayment} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Conta</label>
                  <input
                    type="text"
                    disabled
                    value={editingPayment.bill.name}
                    className={`w-full p-3.5 rounded-xl border outline-none opacity-60 ${theme.isDarkMode ? 'bg-slate-900/50 border-white/10' : 'bg-slate-50 border-slate-200'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className={`w-full p-3.5 rounded-xl border focus:ring-2 outline-none transition-all ${theme.isDarkMode ? 'bg-slate-900/50 border-white/10 focus:border-indigo-500 focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Data do Pagamento</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className={`w-full p-3.5 rounded-xl border focus:ring-2 outline-none transition-all ${theme.isDarkMode ? 'bg-slate-900/50 border-white/10 focus:border-indigo-500 focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'}`}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl font-bold text-white transition-opacity hover:opacity-90 mt-4 flex justify-center items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  <CheckCircle2 size={20} />
                  {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
