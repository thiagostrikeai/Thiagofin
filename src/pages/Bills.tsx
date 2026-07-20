import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Bill } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar as CalendarIcon,
  Download,
  Upload,
  RefreshCw,
  Mail,
  Apple,
} from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { formatCurrency } from '../utils/currency';
import Papa from 'papaparse';
import { useRef } from 'react';
import { useBillsData } from '../hooks/useBillsData';
import {
  openGoogleCalendarRecurring,
  downloadAppleCalendarIcs,
  openEmailReminderDraft,
  getNextDueDate,
  getReminderDate,
} from '../utils/calendar';
import { getUserPrefs } from '../lib/localStore';

type CalendarOffer = {
  bill: Bill;
};

export default function Bills() {
  const { theme, currency } = useAppStore();
  const {
    bills,
    loading,
    error: dataError,
    permission,
    isLocalMode,
    targetUserId,
    user,
    addBill,
    payBill,
    deleteBill,
  } = useBillsData();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [calendarOffer, setCalendarOffer] = useState<CalendarOffer | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const [newBillName, setNewBillName] = useState('');
  const [newBillDueDay, setNewBillDueDay] = useState(10);
  const [newBillWarningDays, setNewBillWarningDays] = useState(3);
  const [newBillStartDate, setNewBillStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newBillAmount, setNewBillAmount] = useState('');
  const [emailReminder, setEmailReminder] = useState(true);
  const [isRecurring, setIsRecurring] = useState(true);

  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reminderEmail =
    (targetUserId && getUserPrefs(targetUserId).reminderEmail) || user?.email || '';

  const handleDownloadTemplate = () => {
    const csvContent =
      'Nome da Conta,Dia de Vencimento,Dias de Aviso\nAluguel,5,3\nInternet,10,3\nLuz,15,5';
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
        const data = results.data as Record<string, string>[];
        let count = 0;
        try {
          for (const row of data) {
            const name = row['Nome da Conta'];
            const dueDay = parseInt(row['Dia de Vencimento'], 10);
            const warningDays = parseInt(row['Dias de Aviso'], 10) || 3;
            if (name && !isNaN(dueDay)) {
              await addBill({
                name,
                dueDay,
                warningDays,
                createdAt: Date.now(),
                isRecurring: true,
                emailReminderEnabled: true,
              });
              count++;
            }
          }
          alert(`${count} contas importadas com sucesso!`);
        } catch (e: unknown) {
          console.error(e);
          alert('Erro ao importar: ' + (e instanceof Error ? e.message : 'falha desconhecida'));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  };

  const resetForm = () => {
    setNewBillName('');
    setNewBillDueDay(10);
    setNewBillWarningDays(3);
    setNewBillStartDate(format(new Date(), 'yyyy-MM-dd'));
    setNewBillAmount('');
    setEmailReminder(true);
    setIsRecurring(true);
    setFormError('');
  };

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newBillName || isSubmitting) return;

    if (newBillDueDay < 1 || newBillDueDay > 31) {
      setFormError('Dia de vencimento deve ser entre 1 e 31.');
      return;
    }
    if (newBillWarningDays < 0 || newBillWarningDays > 30) {
      setFormError('Dias de aviso deve ser entre 0 e 30.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      const estimate = newBillAmount ? parseFloat(newBillAmount.replace(',', '.')) : undefined;
      const created = await addBill({
        name: newBillName.trim(),
        dueDay: newBillDueDay,
        warningDays: newBillWarningDays,
        createdAt: new Date(newBillStartDate + 'T12:00:00').getTime(),
        isRecurring,
        emailReminderEnabled: emailReminder,
        amountEstimate: estimate && !isNaN(estimate) ? estimate : undefined,
      });

      setIsAddModalOpen(false);
      resetForm();

      // Offer calendar recurring reminder
      setCalendarOffer({ bill: created });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Erro ao salvar conta.';
      if (String(msg).includes('permission') || String(msg).includes('Missing or insufficient')) {
        setFormError(
          'Sem permissão no Supabase. Use Modo Local ou confira o login e as políticas RLS.'
        );
      } else {
        setFormError(msg);
      }
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
      await payBill(
        selectedBill.id,
        amount,
        new Date(payDate + 'T12:00:00').getTime(),
        selectedBill.history || []
      );
      setIsPayModalOpen(false);
      setSelectedBill(null);
      setPayAmount('');
    } catch (err) {
      console.error(err);
      alert('Erro ao confirmar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPaidInSelectedMonth = (bill: Bill) => {
    if (!bill.history?.length) return false;
    return bill.history.some((p) => {
      const d = new Date(p.datePaid);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  };

  const getPaidAmountInSelectedMonth = (bill: Bill) => {
    if (!bill.history?.length) return 0;
    return bill.history
      .filter((p) => {
        const d = new Date(p.datePaid);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      })
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const isNearDueDate = (bill: Bill) => {
    if (isPaidInSelectedMonth(bill)) return false;
    const today = new Date();
    const createdDate = bill.createdAt ? new Date(bill.createdAt) : new Date(0);

    if (
      selectedYear < createdDate.getFullYear() ||
      (selectedYear === createdDate.getFullYear() && selectedMonth < createdDate.getMonth())
    ) {
      return false;
    }
    if (
      selectedYear < today.getFullYear() ||
      (selectedYear === today.getFullYear() && selectedMonth < today.getMonth())
    ) {
      return true;
    }
    if (
      selectedYear > today.getFullYear() ||
      (selectedYear === today.getFullYear() && selectedMonth > today.getMonth())
    ) {
      return false;
    }
    const daysUntilDue = bill.dueDay - today.getDate();
    if (daysUntilDue < 0) return true;
    return daysUntilDue <= bill.warningDays;
  };

  const chartData = bills
    .map((b) => ({ name: b.name, Gasto: getPaidAmountInSelectedMonth(b) }))
    .filter((d) => d.Gasto > 0);

  const cardClass = theme.isDarkMode
    ? 'bg-[#1a1830]/90 border border-white/5 rounded-3xl'
    : 'finance-card';

  const offerBill = calendarOffer?.bill;
  const offerDue = offerBill ? getNextDueDate(offerBill.dueDay) : null;
  const offerRem = offerBill ? getReminderDate(offerBill.dueDay, offerBill.warningDays) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contas a Pagar</h1>
          <p className="text-slate-400">
            Contas recorrentes, vencimentos e lembretes
            {isLocalMode ? ' · dados salvos localmente' : ''}
          </p>
        </div>
        {permission === 'edit' && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadTemplate}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium transition-colors ${
                theme.isDarkMode
                  ? 'bg-white/10 text-white hover:bg-white/15'
                  : 'bg-white text-slate-700 shadow-sm border border-indigo-50 hover:bg-[#ece9ff]'
              }`}
            >
              <Download size={18} />
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium transition-colors ${
                theme.isDarkMode
                  ? 'bg-white/10 text-white hover:bg-white/15'
                  : 'bg-white text-slate-700 shadow-sm border border-indigo-50 hover:bg-[#ece9ff]'
              }`}
            >
              <Upload size={18} />
              <span className="hidden sm:inline">Importar</span>
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsAddModalOpen(true);
              }}
              className="finance-btn-primary flex items-center gap-2 px-5 py-2.5"
            >
              <Plus size={18} />
              Nova Conta
            </button>
          </div>
        )}
      </div>

      {dataError && (
        <div className="p-4 rounded-2xl bg-red-50 text-red-600 border border-red-100 text-sm">
          {dataError}
        </div>
      )}

      <div className={`p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-4 ${cardClass}`}>
        <div className="flex items-center gap-2 font-medium">
          <div
            className="p-2 rounded-xl"
            style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}
          >
            <CalendarIcon size={20} />
          </div>
          <span>Filtrar por período:</span>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="finance-input flex-1 sm:flex-none"
          >
            {months.map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="finance-input flex-1 sm:flex-none"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`p-6 ${cardClass}`}>
          <h2 className="text-xl font-bold mb-6">
            Gastos Pagos ({months[selectedMonth]} {selectedYear})
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={theme.isDarkMode ? 'rgba(255,255,255,0.05)' : '#ede9fe'}
                />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: theme.isDarkMode ? '#1e1e2d' : '#ffffff',
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value: number) => [formatCurrency(value, currency), 'Gasto']}
                />
                <Bar dataKey="Gasto" fill={theme.primaryColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {loading && <p className="text-center text-slate-400 py-8">Carregando contas...</p>}

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
                whileHover={{ y: -4 }}
                className={`p-6 ${cardClass} border-l-4 relative overflow-hidden`}
                style={{
                  borderLeftColor: paid ? '#10b981' : nearDue ? '#ff6b35' : theme.primaryColor,
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="pr-8">
                    <h3 className="text-xl font-bold truncate">{bill.name}</h3>
                    {(bill.isRecurring !== false) && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-[#5b4cdb] bg-[#ece9ff] px-2 py-0.5 rounded-full">
                        <RefreshCw size={11} /> Recorrente mensal
                      </span>
                    )}
                  </div>
                  {permission === 'edit' && (
                    <button
                      onClick={() => setBillToDelete(bill.id)}
                      className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div className="space-y-2.5 mb-5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Vencimento:</span>
                    <span className="font-medium bg-slate-500/10 px-2.5 py-1 rounded-lg">
                      Dia {bill.dueDay}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Avisar:</span>
                    <span className="font-medium">{bill.warningDays} dia(s) antes</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Status:</span>
                    <span
                      className={`font-medium flex items-center gap-1.5 ${
                        paid ? 'text-emerald-500' : nearDue ? 'text-orange-500' : ''
                      }`}
                    >
                      {paid ? <CheckCircle2 size={16} /> : nearDue ? <AlertCircle size={16} /> : null}
                      {paid ? 'Pago' : nearDue ? 'Alerta / Atrasado' : 'Aberto'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {!paid && permission === 'edit' && (
                    <button
                      onClick={() => {
                        setSelectedBill(bill);
                        setIsPayModalOpen(true);
                      }}
                      className="w-full py-3 px-4 rounded-xl font-medium border-2 transition-all flex items-center justify-center gap-2 hover:bg-indigo-500/10"
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
                  <button
                    type="button"
                    onClick={() => setCalendarOffer({ bill })}
                    className="w-full py-2.5 text-xs font-semibold rounded-xl bg-[#ece9ff] text-[#5b4cdb] hover:bg-[#e0dcff] flex items-center justify-center gap-1.5"
                  >
                    <CalendarIcon size={14} />
                    Lembrete no calendário
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {!loading && bills.length === 0 && (
        <div className="text-center py-16 px-4 rounded-3xl border-2 border-dashed border-indigo-100 text-slate-400">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#ece9ff] text-[#5b4cdb] flex items-center justify-center mb-4">
            <Plus size={32} />
          </div>
          Nenhuma conta cadastrada. Clique em &quot;Nova Conta&quot; para começar.
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
              className="max-w-md w-full p-6 rounded-3xl shadow-2xl bg-white text-slate-900 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-2xl font-bold">Nova Conta Recorrente</h2>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-2xl text-sm">{formError}</div>
              )}

              <form onSubmit={handleAddBill} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Nome da conta / dívida</label>
                  <input
                    type="text"
                    required
                    value={newBillName}
                    onChange={(e) => setNewBillName(e.target.value)}
                    className="finance-input w-full"
                    placeholder="Ex: Aluguel, Internet, Cartão..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Início (mês/ano da 1ª cobrança)</label>
                  <input
                    type="date"
                    required
                    value={newBillStartDate}
                    onChange={(e) => setNewBillStartDate(e.target.value)}
                    className="finance-input w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Dia do vencimento</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={31}
                      value={newBillDueDay}
                      onChange={(e) => setNewBillDueDay(Number(e.target.value))}
                      className="finance-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Avisar com (dias)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={30}
                      value={newBillWarningDays}
                      onChange={(e) => setNewBillWarningDays(Number(e.target.value))}
                      className="finance-input w-full"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Ex.: 3 = alerta 3 dias antes do dia {newBillDueDay}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Valor estimado (opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBillAmount}
                    onChange={(e) => setNewBillAmount(e.target.value)}
                    className="finance-input w-full"
                    placeholder="0,00"
                  />
                </div>

                <label className="flex items-center gap-3 p-3 rounded-2xl bg-[#ece9ff]/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 accent-[#5b4cdb]"
                  />
                  <span className="text-sm font-medium">
                    Conta recorrente (todo mês no dia {newBillDueDay})
                  </span>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl bg-orange-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailReminder}
                    onChange={(e) => setEmailReminder(e.target.checked)}
                    className="w-4 h-4 accent-[#ff6b35]"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Quero lembrete por e-mail / calendário
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="finance-btn-primary w-full py-3.5 mt-2 disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar conta'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Calendar offer modal — Google / Apple / Email */}
      <AnimatePresence>
        {calendarOffer && offerBill && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full p-6 rounded-3xl shadow-2xl bg-white"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="text-xl font-bold text-[#1e1b4b]">Adicionar lembrete recorrente</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Conta <strong className="text-slate-700">{offerBill.name}</strong> salva com
                    sucesso.
                  </p>
                </div>
                <button
                  onClick={() => setCalendarOffer(null)}
                  className="p-2 rounded-xl hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="my-4 p-4 rounded-2xl bg-[#f3f0ff] text-sm space-y-1">
                <p>
                  <span className="text-slate-500">Vencimento:</span>{' '}
                  <strong>todo dia {offerBill.dueDay}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Próximo vencimento:</span>{' '}
                  <strong>{offerDue?.toLocaleDateString('pt-BR')}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Lembrete:</span>{' '}
                  <strong>
                    {offerBill.warningDays} dia(s) antes ({offerRem?.toLocaleDateString('pt-BR')})
                  </strong>
                </p>
              </div>

              <p className="text-sm text-slate-500 mb-4">
                Cadastre no calendário para receber avisos automáticos todos os meses (Google pode
                enviar por e-mail se a notificação de e-mail estiver ativa na conta).
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    openGoogleCalendarRecurring({
                      name: offerBill.name,
                      dueDay: offerBill.dueDay,
                      warningDays: offerBill.warningDays,
                      email: reminderEmail,
                      notes: offerBill.amountEstimate
                        ? `Valor estimado: ${formatCurrency(offerBill.amountEstimate, currency)}`
                        : undefined,
                    })
                  }
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #4285F4, #34A853)' }}
                >
                  <CalendarIcon size={20} />
                  Google Calendar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    downloadAppleCalendarIcs({
                      name: offerBill.name,
                      dueDay: offerBill.dueDay,
                      warningDays: offerBill.warningDays,
                      email: reminderEmail,
                      notes: offerBill.amountEstimate
                        ? `Valor estimado: ${formatCurrency(offerBill.amountEstimate, currency)}`
                        : undefined,
                    })
                  }
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-semibold bg-black text-white hover:bg-slate-800"
                >
                  <Apple size={20} />
                  Apple Calendar (.ics)
                </button>

                {reminderEmail && (
                  <button
                    type="button"
                    onClick={() =>
                      openEmailReminderDraft(
                        {
                          name: offerBill.name,
                          dueDay: offerBill.dueDay,
                          warningDays: offerBill.warningDays,
                          email: reminderEmail,
                        },
                        reminderEmail
                      )
                    }
                    className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-semibold border-2 border-[#5b4cdb] text-[#5b4cdb] hover:bg-[#ece9ff]"
                  >
                    <Mail size={20} />
                    Abrir e-mail de lembrete
                  </button>
                )}

                {!reminderEmail && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
                    Sem e-mail na conta. Em Ajustes, defina o e-mail de lembretes — ou use o
                    calendário (recomendado para avisos automáticos).
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setCalendarOffer(null)}
                  className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-600"
                >
                  Agora não
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pay Modal */}
      <AnimatePresence>
        {isPayModalOpen && selectedBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full p-6 rounded-3xl shadow-xl bg-white"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Confirmar Pagamento</h2>
                <button onClick={() => setIsPayModalOpen(false)}>
                  <X size={24} />
                </button>
              </div>
              <p className="mb-4">
                Conta: <strong>{selectedBill.name}</strong>
              </p>
              <form onSubmit={handlePayBill} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Valor exato pago</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="finance-input w-full"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Data do pagamento</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="finance-input w-full"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="finance-btn-primary w-full py-3 flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 size={20} />
                  {isSubmitting ? 'Confirmando...' : 'Confirmar'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {billToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full p-6 rounded-3xl shadow-xl bg-white"
            >
              <h2 className="text-xl font-bold mb-4">Excluir Conta</h2>
              <p className="mb-6 text-slate-600">
                Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setBillToDelete(null)}
                  className="flex-1 py-2.5 rounded-full font-medium border border-slate-200 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (billToDelete) {
                      setIsSubmitting(true);
                      try {
                        await deleteBill(billToDelete);
                        setBillToDelete(null);
                      } catch (e) {
                        console.error(e);
                        alert('Erro ao excluir.');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }
                  }}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-full font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
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
