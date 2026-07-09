import { db } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { Bill, Goal, PaymentHistory } from '../types';

export const billsRef = (userId: string) => collection(db, `users/${userId}/bills`);
export const goalsRef = (userId: string) => collection(db, `users/${userId}/goals`);

export interface Invitation {
  code: string;
  ownerId: string;
  permission: 'view' | 'edit';
  createdAt: number;
}

export interface GuestAccess {
  code: string;
  ownerId: string;
  permission: 'view' | 'edit';
}

export const createInvitation = async (ownerId: string, permission: 'view' | 'edit') => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await setDoc(doc(db, `invitations/${code}`), {
    code,
    ownerId,
    permission,
    createdAt: Date.now()
  });
  return code;
};

export const getInvitations = async (ownerId: string) => {
  const q = query(collection(db, 'invitations'), where('ownerId', '==', ownerId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Invitation);
};

export const deleteInvitation = async (code: string) => {
  await deleteDoc(doc(db, `invitations/${code}`));
};

export const verifyInvitationAndCreateGuestAccess = async (code: string, guestUid: string) => {
  const invDoc = await getDoc(doc(db, `invitations/${code}`));
  if (!invDoc.exists()) {
    throw new Error("Código de convite inválido.");
  }
  const data = invDoc.data() as Invitation;
  
  // Create guest access mapping
  await setDoc(doc(db, `guestAccess/${guestUid}`), {
    code: data.code,
    ownerId: data.ownerId,
    permission: data.permission
  });
  return data;
};

export const getGuestAccess = async (guestUid: string) => {
  const docSnap = await getDoc(doc(db, `guestAccess/${guestUid}`));
  if (docSnap.exists()) {
    return docSnap.data() as GuestAccess;
  }
  return null;
};

export const addBill = async (userId: string, bill: Omit<Bill, 'id' | 'history'>) => {
  const newBill = {
    ...bill,
    history: []
  };
  await addDoc(billsRef(userId), newBill);
};

export const payBill = async (userId: string, billId: string, amount: number, datePaid: number, currentHistory: PaymentHistory[]) => {
  const billDoc = doc(db, `users/${userId}/bills/${billId}`);
  const newPayment: PaymentHistory = { id: crypto.randomUUID(), amount, datePaid };
  await updateDoc(billDoc, {
    history: [...currentHistory, newPayment]
  });
};

export const updatePayment = async (userId: string, billId: string, paymentId: string, amount: number, datePaid: number, currentHistory: PaymentHistory[]) => {
  const billDoc = doc(db, `users/${userId}/bills/${billId}`);
  const updatedHistory = currentHistory.map(p => p.id === paymentId ? { ...p, amount, datePaid } : p);
  await updateDoc(billDoc, { history: updatedHistory });
};

export const deletePayment = async (userId: string, billId: string, paymentId: string, currentHistory: PaymentHistory[]) => {
  const billDoc = doc(db, `users/${userId}/bills/${billId}`);
  const updatedHistory = currentHistory.filter(p => p.id !== paymentId);
  await updateDoc(billDoc, { history: updatedHistory });
};

export const deleteBill = async (userId: string, billId: string) => {
  await deleteDoc(doc(db, `users/${userId}/bills/${billId}`));
};

export const addGoal = async (userId: string, goal: Omit<Goal, 'id'>) => {
  await addDoc(goalsRef(userId), goal);
};

export const updateGoalAmount = async (userId: string, goalId: string, currentAmount: number) => {
  await updateDoc(doc(db, `users/${userId}/goals/${goalId}`), {
    currentAmount
  });
};

export const deleteGoal = async (userId: string, goalId: string) => {
  await deleteDoc(doc(db, `users/${userId}/goals/${goalId}`));
};
