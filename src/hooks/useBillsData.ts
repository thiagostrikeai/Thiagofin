import { useEffect, useState } from 'react';
import { Bill, PaymentHistory } from '../types';
import {
  subscribeBills,
  addBill as remoteAddBill,
  payBill as remotePayBill,
  deleteBill as remoteDeleteBill,
  updatePayment as remoteUpdatePayment,
  deletePayment as remoteDeletePayment,
} from '../lib/db';
import {
  subscribeLocalBills,
  localAddBill,
  localPayBill,
  localDeleteBill,
  localUpdatePayment,
  localDeletePayment,
} from '../lib/localStore';
import { useAuth } from '../contexts/AuthContext';

export function useBillsData() {
  const { user, targetUserId, permission, isLocalMode } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUserId) {
      setBills([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (isLocalMode) {
      return subscribeLocalBills(targetUserId, (data) => {
        setBills(data);
        setLoading(false);
      });
    }

    return subscribeBills(
      targetUserId,
      (data) => {
        setBills(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(
          err.message.includes('Supabase não configurado')
            ? err.message
            : 'Não foi possível carregar as contas no Supabase. Verifique login, schema SQL e RLS.'
        );
        setLoading(false);
      }
    );
  }, [targetUserId, isLocalMode, user?.uid]);

  const addBill = async (bill: Omit<Bill, 'id' | 'history'>): Promise<Bill> => {
    if (!targetUserId) throw new Error('Usuário não identificado.');
    if (permission === 'view') throw new Error('Você tem permissão somente de visualização.');

    if (isLocalMode) {
      return localAddBill(targetUserId, {
        isRecurring: true,
        emailReminderEnabled: true,
        ...bill,
      });
    }

    const id = await remoteAddBill(targetUserId, {
      isRecurring: true,
      emailReminderEnabled: true,
      ...bill,
    });
    return { id, history: [], isRecurring: true, emailReminderEnabled: true, ...bill };
  };

  const payBill = async (
    billId: string,
    amount: number,
    datePaid: number,
    currentHistory: PaymentHistory[]
  ) => {
    if (!targetUserId) throw new Error('Usuário não identificado.');
    if (isLocalMode) {
      localPayBill(targetUserId, billId, amount, datePaid, currentHistory);
      return;
    }
    await remotePayBill(targetUserId, billId, amount, datePaid, currentHistory);
  };

  const deleteBill = async (billId: string) => {
    if (!targetUserId) throw new Error('Usuário não identificado.');
    if (isLocalMode) {
      localDeleteBill(targetUserId, billId);
      return;
    }
    await remoteDeleteBill(targetUserId, billId);
  };

  const updatePayment = async (
    billId: string,
    paymentId: string,
    amount: number,
    datePaid: number,
    currentHistory: PaymentHistory[]
  ) => {
    if (!targetUserId) throw new Error('Usuário não identificado.');
    if (isLocalMode) {
      localUpdatePayment(targetUserId, billId, paymentId, amount, datePaid, currentHistory);
      return;
    }
    await remoteUpdatePayment(targetUserId, billId, paymentId, amount, datePaid, currentHistory);
  };

  const deletePayment = async (
    billId: string,
    paymentId: string,
    currentHistory: PaymentHistory[]
  ) => {
    if (!targetUserId) throw new Error('Usuário não identificado.');
    if (isLocalMode) {
      localDeletePayment(targetUserId, billId, paymentId, currentHistory);
      return;
    }
    await remoteDeletePayment(targetUserId, billId, paymentId, currentHistory);
  };

  return {
    bills,
    loading,
    error,
    permission,
    isLocalMode,
    targetUserId,
    user,
    addBill,
    payBill,
    deleteBill,
    updatePayment,
    deletePayment,
  };
}
