import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppStore } from '../store/useAppStore';
import { addBill, payBill, deleteBill, billsRef } from '../lib/db';
import { Bill } from '../types';
import { onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, CheckCircle2, AlertCircle, X, Calendar as CalendarIcon, Download, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { formatCurrency } from '../utils/currency';
import Papa from 'papaparse';
import { useRef } from 'react';

export default function Bills() {
  const { user, targetUserId, permission } = useAuth();
  const { theme, currency } = useAppStore();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);
  
  // Period Selector State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  
  // Add Bill Form State
  const [newBillName, setNewBillName] = useState('');
  const [newBillDueDay, setNewBillDueDay] = useState(1);
  const [newBillWarningDays, setNewBillWarningDays] = useState(3);
  const [newBillStartDate, setNewBillStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Pay Bill Form State
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const csvContent = "Nome da Conta,Dia de Vencimento,Dias de Aviso\nAluguel,5,3\nInternet,10,3\nLuz,15,5";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_contas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !targetUserId) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        let count = 0;
        for (const row of data) {
          const name = row['Nome da Conta'];
          const dueDay = parseInt(row['Dia de Vencimento']);
          const warningDays = parseInt(row['Dias de Aviso']) || 3;
          
          if (name && !isNaN(dueDay)) {
            await addBill(targetUserId, {
              name,
              dueDay,
              warningDays,
              createdAt: Date.now()
            });
            count++;
          }
        }
        alert(`${count} contas importadas com sucesso!`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  useEffect(() => {
    if (!targetUserId) return;
    const unsubscribe = onSnapshot(billsRef(targetUserId), (snapshot) => {
      const billsData: Bill[] = [];
      snapshot.forEach((doc) => {
        billsData.push({ id: doc.id, ...doc.data() } as Bill);
      });
      setBills(billsData.sort((a, b) => a.dueDay - b.dueDay));
    });
    return () => unsubscribe();
  }, [user]);

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newBillName || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addBill(targetUserId, {
        name: newBillName,
        dueDay: newBillDueDay,
        warningDays: newBillWarningDays,
        createdAt: new Date(newBillStartDate).getTime()
      });
      setIsAddModalOpen(false);
      setNewBillName('');
      setNewBillDueDay(1);
      setNewBillWarningDays(3);
      setNewBillStartDate(format(new Date(), 'yyyy-MM-dd'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedBill || !payAmount || isSubmitting) return;
    const amount = parseFloat(payAmount.replace(',', '.'));
    if (isNaN(amount)) return;
    
    setIsSubmitting(true);
    try {
      await payBill(targetUserId, selectedBill.id, amount, new Date(payDate).getTime(), selectedBill.history);
      setIsPayModalOpen(false);
      setSelectedBill(null);
      setPayAmount('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBill = async (id: string) => {
    setBillToDelete(id);
  };

  const isPaidInSelectedMonth = (bill: Bill) => {
    if (!bill.history || bill.history.length === 0) return false;
    return bill.history.some(p => {
      const d = new Date(p.datePaid);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  };

  const getPaidAmountInSelectedMonth = (bill: Bill) => {
    if (!bill.history || bill.history.length === 0) return 0;
    const payments = bill.history.filter(p => {
      const d = new Date(p.datePaid);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
    return payments.reduce((sum, p) => sum + p.amount, 0);
  };

  const isNearDueDate = (bill: Bill) => {
    if (isPaidInSelectedMonth(bill)) return false;
    
    const today = new Date();
    const createdDate = bill.createdAt ? new Date(bill.createdAt) : new Date(0);

    if (selectedYear < createdDate.getFullYear() || (selectedYear === createdDate.getFullYear() && selectedMonth < createdDate.getMonth())) {
      return false; // Not started yet in this period
    }
    
    if (selectedYear < today.getFullYear() || (selectedYear === today.getFullYear() && selectedMonth < today.getMonth())) {
      return true; // Overdue in the past
    }
    
    if (selectedYear > today.getFullYear() || (selectedYear === today.getFullYear() && selectedMonth > today.getMonth())) {
      return false; // Not due yet
    }
    
    const currentDay = today.getDate();
    let daysUntilDue = bill.dueDay - currentDay;
    if (daysUntilDue < 0) {
      return true; 
    }
    return daysUntilDue <= bill.warningDays;
  };

  const chartData = bills
    .map(b => ({
      name: b.name,
      Gasto: getPaidAmountInSelectedMonth(b)
    }))
    .filter(d => d.Gasto > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Contas a Pagar</h1>
          <p className={`${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Gerencie seus vencimentos e lembretes</p>
        </div>
        {permission === 'edit' && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadTemplate}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${theme.isDarkMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
            >
              <Download size={20} />
              <span className="hidden sm:inline">Modelo CSV</span>
            </button>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${theme.isDarkMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
            >
              <Upload size={20} />
              <span className="hidden sm:inline">Importar</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: theme.primaryColor }}
            >
              <Plus size={20} />
              Nova Conta
            </button>
          </div>
        )}
      </div>

      {/* Period Selector */}
      <div className={`p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-4 ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5 shadow-lg shadow-indigo-500/5' : 'bg-white shadow-sm border border-slate-100'} transition-all`}>
        <div className="flex items-center gap-2 font-medium">
          <div className="p-2 rounded-xl" style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}>
            <CalendarIcon size={20} />
          </div>
          <span>Filtrar por período:</span>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className={`p-2.5 rounded-xl border outline-none flex-1 sm:flex-none transition-colors ${theme.isDarkMode ? 'bg-slate-800/50 border-white/10 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
          >
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className={`p-2.5 rounded-xl border outline-none flex-1 sm:flex-none transition-colors ${theme.isDarkMode ? 'bg-slate-800/50 border-white/10 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Chart Section */}
      {chartData.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-3xl ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5 shadow-2xl shadow-indigo-500/5' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'} transition-all`}
        >
          <h2 className="text-xl font-bold mb-6">Gastos Pagos ({months[selectedMonth]} {selectedYear})</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9'} />
                <XAxis dataKey="name" tick={{ fill: theme.isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: theme.isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: theme.isDarkMode ? '#1e1e2d' : '#ffffff', borderColor: theme.isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: '16px', color: theme.isDarkMode ? '#f8fafc' : '#0f172a', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  cursor={{ fill: theme.isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}
                  formatter={(value: number) => [formatCurrency(value, currency), 'Gasto']}
                />
                <Bar dataKey="Gasto" fill={theme.primaryColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {bills.map((bill) => {
            const paid = isPaidInSelectedMonth(bill);
            const nearDue = isNearDueDate(bill);
            
            return (
              <motion.div
                key={bill.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className={`p-6 rounded-3xl ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border-y border-r border-white/5 shadow-xl shadow-indigo-500/5' : 'bg-white shadow-xl shadow-slate-200/50 border-y border-r border-slate-100'} border-l-4 relative overflow-hidden transition-all`}
                style={{ borderLeftColor: paid ? '#10b981' : nearDue ? '#f59e0b' : theme.primaryColor }}
              >
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-xl font-bold truncate pr-8">{bill.name}</h3>
                  <button 
                    onClick={() => handleDeleteBill(bill.id)}
                    className={`absolute top-5 right-5 p-2 rounded-xl transition-colors ${theme.isDarkMode ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="space-y-3 mb-6 text-sm">
                  <div className="flex justify-between items-center">
                    <span className={`${theme.isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Vencimento:</span>
                    <span className="font-medium bg-slate-500/10 px-2.5 py-1 rounded-lg">Dia {bill.dueDay}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`${theme.isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Status:</span>
                    <span className={`font-medium flex items-center gap-1.5 ${paid ? 'text-emerald-500' : nearDue ? 'text-amber-500' : ''}`}>
                      {paid ? <CheckCircle2 size={16} /> : nearDue ? <AlertCircle size={16} /> : null}
                      {paid ? 'Pago' : nearDue ? 'Atrasado/Alerta' : 'Aberto'}
                    </span>
                  </div>
                </div>

                {!paid && (
                  <button
                    onClick={() => {
                      setSelectedBill(bill);
                      setIsPayModalOpen(true);
                    }}
                    className="w-full py-3 px-4 rounded-xl font-medium border-2 transition-all flex items-center justify-center gap-2 hover:bg-indigo-500/10 active:scale-95"
                    style={{ borderColor: theme.primaryColor, color: theme.primaryColor }}
                  >
                    Confirmar Pagamento
                  </button>
                )}
                {paid && (
                  <div className="w-full py-3 px-4 rounded-xl font-medium bg-emerald-500/10 text-emerald-500 text-center flex items-center justify-center gap-2 border border-emerald-500/20">
                    <CheckCircle2 size={20} /> Pago
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {bills.length === 0 && (
        <div className={`text-center py-16 px-4 rounded-3xl border-2 border-dashed ${theme.isDarkMode ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
          <div className="mx-auto w-16 h-16 rounded-full bg-slate-500/10 flex items-center justify-center mb-4">
            <Plus size={32} />
          </div>
          Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.
        </div>
      )}

      {/* Add Bill Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`max-w-md w-full p-6 rounded-3xl shadow-2xl border ${theme.isDarkMode ? 'bg-[#13131f] text-white border-white/10' : 'bg-white text-slate-900 border-slate-100'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Nova Conta</h2>
                <button onClick={() => setIsAddModalOpen(false)} className={`p-2 rounded-xl transition-colors ${theme.isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}><X size={20} /></button>
              </div>
              <form onSubmit={handleAddBill} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Nome da Conta</label>
                  <input
                    type="text"
                    required
                    value={newBillName}
                    onChange={(e) => setNewBillName(e.target.value)}
                    className={`w-full p-3.5 rounded-xl border focus:ring-2 outline-none transition-all ${theme.isDarkMode ? 'bg-slate-900/50 border-white/10 focus:border-indigo-500 focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'}`}
                    placeholder="Ex: Aluguel, Internet..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Mês/Ano de Início</label>
                  <input
                    type="date"
                    required
                    value={newBillStartDate}
                    onChange={(e) => setNewBillStartDate(e.target.value)}
                    className={`w-full p-3 rounded-lg border focus:ring-2 outline-none ${theme.isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-indigo-500' : 'bg-gray-50 border-gray-300 focus:ring-indigo-500'}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Dia do Vencimento</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="31"
                      value={newBillDueDay}
                      onChange={(e) => setNewBillDueDay(Number(e.target.value))}
                      className={`w-full p-3 rounded-lg border focus:ring-2 outline-none ${theme.isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-indigo-500' : 'bg-gray-50 border-gray-300 focus:ring-indigo-500'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Avisar com (dias)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="15"
                      value={newBillWarningDays}
                      onChange={(e) => setNewBillWarningDays(Number(e.target.value))}
                      className={`w-full p-3 rounded-lg border focus:ring-2 outline-none ${theme.isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-indigo-500' : 'bg-gray-50 border-gray-300 focus:ring-indigo-500'}`}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-lg font-bold text-white transition-opacity hover:opacity-90 mt-4 disabled:opacity-50"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pay Bill Modal */}
      <AnimatePresence>
        {isPayModalOpen && selectedBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`max-w-md w-full p-6 rounded-2xl shadow-xl ${theme.isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Confirmar Pagamento</h2>
                <button onClick={() => setIsPayModalOpen(false)}><X size={24} /></button>
              </div>
              <p className="mb-4">Conta: <strong>{selectedBill.name}</strong></p>
              <form onSubmit={handlePayBill} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Valor Exato Pago</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className={`w-full p-3 rounded-lg border focus:ring-2 outline-none ${theme.isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-indigo-500' : 'bg-gray-50 border-gray-300 focus:ring-indigo-500'}`}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Data do Pagamento</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className={`w-full p-3 rounded-lg border focus:ring-2 outline-none ${theme.isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-indigo-500' : 'bg-gray-50 border-gray-300 focus:ring-indigo-500'}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-lg font-bold text-white transition-opacity hover:opacity-90 mt-4 flex justify-center items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  <CheckCircle2 size={20} />
                  {isSubmitting ? 'Confirmando...' : 'Confirmar'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Bill Modal */}
      <AnimatePresence>
        {billToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`max-w-md w-full p-6 rounded-2xl shadow-xl ${theme.isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}
            >
              <h2 className="text-xl font-bold mb-4">Excluir Conta</h2>
              <p className={`mb-6 ${theme.isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setBillToDelete(null)}
                  className={`flex-1 py-2 rounded-lg font-medium border transition-colors ${theme.isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (user && billToDelete) {
                      setIsSubmitting(true);
                      await deleteBill(targetUserId, billToDelete);
                      setBillToDelete(null);
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
