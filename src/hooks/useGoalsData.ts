import { useEffect, useState } from 'react';
import { Goal } from '../types';
import {
  subscribeGoals,
  addGoal as remoteAddGoal,
  updateGoalAmount as remoteUpdateGoalAmount,
  deleteGoal as remoteDeleteGoal,
} from '../lib/db';
import {
  subscribeLocalGoals,
  localAddGoal,
  localUpdateGoalAmount,
  localDeleteGoal,
} from '../lib/localStore';
import { useAuth } from '../contexts/AuthContext';

export function useGoalsData() {
  const { user, targetUserId, permission, isLocalMode } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUserId) {
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    if (isLocalMode) {
      return subscribeLocalGoals(targetUserId, (data) => {
        setGoals(data);
        setLoading(false);
      });
    }

    return subscribeGoals(
      targetUserId,
      (data) => {
        setGoals(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Não foi possível carregar as metas no Supabase.');
        setLoading(false);
      }
    );
  }, [targetUserId, isLocalMode, user?.uid]);

  const addGoal = async (goal: Omit<Goal, 'id'>) => {
    if (!targetUserId) throw new Error('Usuário não identificado.');
    if (isLocalMode) return localAddGoal(targetUserId, goal);
    await remoteAddGoal(targetUserId, goal);
  };

  const updateGoalAmount = async (goalId: string, currentAmount: number) => {
    if (!targetUserId) throw new Error('Usuário não identificado.');
    if (isLocalMode) {
      localUpdateGoalAmount(targetUserId, goalId, currentAmount);
      return;
    }
    await remoteUpdateGoalAmount(targetUserId, goalId, currentAmount);
  };

  const deleteGoal = async (goalId: string) => {
    if (!targetUserId) throw new Error('Usuário não identificado.');
    if (isLocalMode) {
      localDeleteGoal(targetUserId, goalId);
      return;
    }
    await remoteDeleteGoal(targetUserId, goalId);
  };

  return {
    goals,
    loading,
    error,
    permission,
    isLocalMode,
    targetUserId,
    user,
    addGoal,
    updateGoalAmount,
    deleteGoal,
  };
}
