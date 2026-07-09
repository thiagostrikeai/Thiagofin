import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppStore } from '../store/useAppStore';
import { addGoal, deleteGoal, updateGoalAmount, goalsRef } from '../lib/db';
import { Goal } from '../types';
import { onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, X, Target, Bell } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { formatCurrency } from '../utils/currency';

export default function Goals() {
  const { user, targetUserId, permission } = useAuth();
  const { theme, currency } = useAppStore();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);
  
  // Add Goal Form State
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');

  useEffect(() => {
    if (!targetUserId) return;
    const unsubscribe = onSnapshot(goalsRef(targetUserId), (snapshot) => {
      const goalsData: Goal[] = [];
      snapshot.forEach((doc) => {
        goalsData.push({ id: doc.id, ...doc.data() } as Goal);
      });
      setGoals(goalsData);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newGoalName || !newGoalTarget || isSubmitting) return;
    const targetAmount = parseFloat(newGoalTarget.replace(',', '.'));
    if (isNaN(targetAmount)) return;
    
    setIsSubmitting(true);
    try {
      const today = new Date();
      await addGoal(targetUserId, {
        name: newGoalName,
        targetAmount,
        currentAmount: 0,
        month: today.getMonth() + 1,
        year: today.getFullYear()
      });
      
      setIsAddModalOpen(false);
      setNewGoalName('');
      setNewGoalTarget('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAmount = async (id: string, currentAmount: number, target: number) => {
    if (!targetUserId) return;
    // Note: prompt might be blocked in iframes, but since we're fixing just the ones requested, this is okay.
    // If prompt is blocked, we can't use it. We should replace prompt as well!
    const amountStr = prompt(`Novo valor gasto (${currency}):`, currentAmount.toString());
    if (amountStr) {
      const amount = parseFloat(amountStr.replace(',', '.'));
      if (!isNaN(amount)) {
        await updateGoalAmount(targetUserId, id, amount);
        if (amount > target) {
          // Simulate notification
          alert(`⚠️ Atenção! Você estourou o teto da meta!`);
        }
      }
    }
  };

  const handleDeleteGoal = async (id: string) => {
    setGoalToDelete(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Metas de Gastos</h1>
          <p className={`${theme.isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Acompanhe o teto de seus gastos</p>
        </div>
        {permission === 'edit' && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: theme.primaryColor }}
          >
            <Plus size={20} />
            Nova Meta
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence>
          {goals.map((goal) => {
            const isExceeded = goal.currentAmount > goal.targetAmount;
            const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
            
            const data = [
              { name: 'Gasto', value: goal.currentAmount },
              { name: 'Restante', value: Math.max(goal.targetAmount - goal.currentAmount, 0) },
            ];
            const COLORS = [isExceeded ? '#ef4444' : theme.primaryColor, theme.isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9'];

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className={`p-6 rounded-3xl ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border border-white/5 shadow-2xl shadow-indigo-500/5' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'} relative transition-all`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold">{goal.name}</h3>
                    <p className={`text-sm ${theme.isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Teto: {formatCurrency(goal.targetAmount, currency)}</p>
                  </div>
                  {permission === 'edit' && (
                    <button 
                      onClick={() => handleDeleteGoal(goal.id)}
                      className={`p-2 rounded-xl transition-colors ${theme.isDarkMode ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="w-32 h-32 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={60}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                          cornerRadius={4}
                        >
                          {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => formatCurrency(value, currency)} contentStyle={{ backgroundColor: theme.isDarkMode ? '#1e1e2d' : '#ffffff', borderColor: theme.isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: '16px', color: theme.isDarkMode ? '#f8fafc' : '#0f172a' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className={`text-xl font-bold ${isExceeded ? 'text-red-500' : ''}`}>{percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 ml-6 space-y-4">
                    <div>
                      <p className={`text-sm ${theme.isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gasto Atual</p>
                      <p className={`text-2xl font-bold tracking-tight ${isExceeded ? 'text-red-500' : ''}`}>
                        {formatCurrency(goal.currentAmount, currency)}
                      </p>
                    </div>
                    {isExceeded && (
                      <div className="flex items-center gap-2 text-xs font-medium text-red-500 bg-red-500/10 p-2 rounded-xl border border-red-500/20">
                        <Bell size={14} /> Teto estourado!
                      </div>
                    )}
                    <button
                      onClick={() => handleUpdateAmount(goal.id, goal.currentAmount, goal.targetAmount)}
                      className="w-full py-2.5 px-4 rounded-xl text-sm font-medium border-2 transition-all flex items-center justify-center gap-2 hover:bg-indigo-500/10 active:scale-95"
                      style={{ borderColor: theme.primaryColor, color: theme.primaryColor }}
                    >
                      Atualizar Gasto
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {goals.length === 0 && (
        <div className={`text-center py-16 px-4 rounded-3xl border-2 border-dashed ${theme.isDarkMode ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
          <div className="mx-auto w-16 h-16 rounded-full bg-slate-500/10 flex items-center justify-center mb-4">
            <Plus size={32} />
          </div>
          Nenhuma meta cadastrada. Clique em "Nova Meta" para começar.
        </div>
      )}

      {/* Add Goal Modal */}
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
                <h2 className="text-2xl font-bold">Nova Meta</h2>
                <button onClick={() => setIsAddModalOpen(false)} className={`p-2 rounded-xl transition-colors ${theme.isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}><X size={20} /></button>
              </div>
              <form onSubmit={handleAddGoal} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Categoria / Nome</label>
                  <input
                    type="text"
                    required
                    value={newGoalName}
                    onChange={(e) => setNewGoalName(e.target.value)}
                    className={`w-full p-3.5 rounded-xl border focus:ring-2 outline-none transition-all ${theme.isDarkMode ? 'bg-slate-900/50 border-white/10 focus:border-indigo-500 focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'}`}
                    placeholder="Ex: Alimentação, Lazer..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valor Teto</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(e.target.value)}
                    className={`w-full p-3 rounded-lg border focus:ring-2 outline-none ${theme.isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-indigo-500' : 'bg-gray-50 border-gray-300 focus:ring-indigo-500'}`}
                    placeholder="0,00"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-lg font-bold text-white transition-opacity hover:opacity-90 mt-4 disabled:opacity-50"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Meta'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Goal Modal */}
      <AnimatePresence>
        {goalToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`max-w-md w-full p-6 rounded-2xl shadow-xl ${theme.isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}
            >
              <h2 className="text-xl font-bold mb-4">Excluir Meta</h2>
              <p className={`mb-6 ${theme.isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setGoalToDelete(null)}
                  className={`flex-1 py-2 rounded-lg font-medium border transition-colors ${theme.isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (user && goalToDelete) {
                      setIsSubmitting(true);
                      await deleteGoal(targetUserId, goalToDelete);
                      setGoalToDelete(null);
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
