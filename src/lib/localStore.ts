/**
 * LocalStorage-backed data layer for "Modo Local" (no Firebase auth).
 * Mirrors Firestore bill/goal collections under a synthetic user id.
 */
import { Bill, Goal, PaymentHistory } from '../types';

const billsKey = (userId: string) => `fintrack_bills_${userId}`;
const goalsKey = (userId: string) => `fintrack_goals_${userId}`;
const prefsKey = (userId: string) => `fintrack_prefs_${userId}`;

export interface UserPrefs {
  emailRemindersEnabled: boolean;
  reminderEmail: string;
  /** billId -> last ISO date (yyyy-mm-dd) when in-app reminder was shown */
  lastReminderShown: Record<string, string>;
}

const defaultPrefs = (): UserPrefs => ({
  emailRemindersEnabled: true,
  reminderEmail: '',
  lastReminderShown: {},
});

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Bills ──────────────────────────────────────────────

export function localGetBills(userId: string): Bill[] {
  return readJson<Bill[]>(billsKey(userId), []);
}

export function localSetBills(userId: string, bills: Bill[]) {
  writeJson(billsKey(userId), bills);
  window.dispatchEvent(new CustomEvent('fintrack-bills', { detail: { userId } }));
}

export function localAddBill(
  userId: string,
  bill: Omit<Bill, 'id' | 'history'> & { history?: PaymentHistory[] }
): Bill {
  const bills = localGetBills(userId);
  const created: Bill = {
    ...bill,
    id: crypto.randomUUID(),
    history: bill.history ?? [],
  };
  bills.push(created);
  localSetBills(userId, bills);
  return created;
}

export function localUpdateBill(userId: string, billId: string, patch: Partial<Bill>) {
  const bills = localGetBills(userId).map((b) => (b.id === billId ? { ...b, ...patch } : b));
  localSetBills(userId, bills);
}

export function localDeleteBill(userId: string, billId: string) {
  localSetBills(
    userId,
    localGetBills(userId).filter((b) => b.id !== billId)
  );
}

export function localPayBill(
  userId: string,
  billId: string,
  amount: number,
  datePaid: number,
  currentHistory: PaymentHistory[]
) {
  const payment: PaymentHistory = { id: crypto.randomUUID(), amount, datePaid };
  localUpdateBill(userId, billId, { history: [...currentHistory, payment] });
}

export function localUpdatePayment(
  userId: string,
  billId: string,
  paymentId: string,
  amount: number,
  datePaid: number,
  currentHistory: PaymentHistory[]
) {
  const history = currentHistory.map((p) =>
    p.id === paymentId ? { ...p, amount, datePaid } : p
  );
  localUpdateBill(userId, billId, { history });
}

export function localDeletePayment(
  userId: string,
  billId: string,
  paymentId: string,
  currentHistory: PaymentHistory[]
) {
  localUpdateBill(userId, billId, {
    history: currentHistory.filter((p) => p.id !== paymentId),
  });
}

export function subscribeLocalBills(userId: string, cb: (bills: Bill[]) => void): () => void {
  const emit = () => cb(localGetBills(userId).sort((a, b) => a.dueDay - b.dueDay));
  emit();
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (!detail || detail.userId === userId) emit();
  };
  window.addEventListener('fintrack-bills', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('fintrack-bills', handler);
    window.removeEventListener('storage', handler);
  };
}

// ── Goals ──────────────────────────────────────────────

export function localGetGoals(userId: string): Goal[] {
  return readJson<Goal[]>(goalsKey(userId), []);
}

export function localSetGoals(userId: string, goals: Goal[]) {
  writeJson(goalsKey(userId), goals);
  window.dispatchEvent(new CustomEvent('fintrack-goals', { detail: { userId } }));
}

export function localAddGoal(userId: string, goal: Omit<Goal, 'id'>): Goal {
  const goals = localGetGoals(userId);
  const created: Goal = { ...goal, id: crypto.randomUUID() };
  goals.push(created);
  localSetGoals(userId, goals);
  return created;
}

export function localUpdateGoalAmount(userId: string, goalId: string, currentAmount: number) {
  localSetGoals(
    userId,
    localGetGoals(userId).map((g) => (g.id === goalId ? { ...g, currentAmount } : g))
  );
}

export function localDeleteGoal(userId: string, goalId: string) {
  localSetGoals(
    userId,
    localGetGoals(userId).filter((g) => g.id !== goalId)
  );
}

export function subscribeLocalGoals(userId: string, cb: (goals: Goal[]) => void): () => void {
  const emit = () => cb(localGetGoals(userId));
  emit();
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (!detail || detail.userId === userId) emit();
  };
  window.addEventListener('fintrack-goals', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('fintrack-goals', handler);
    window.removeEventListener('storage', handler);
  };
}

// ── Prefs / email reminders ────────────────────────────

export function getUserPrefs(userId: string): UserPrefs {
  return { ...defaultPrefs(), ...readJson<Partial<UserPrefs>>(prefsKey(userId), {}) };
}

export function setUserPrefs(userId: string, patch: Partial<UserPrefs>) {
  const next = { ...getUserPrefs(userId), ...patch };
  writeJson(prefsKey(userId), next);
  window.dispatchEvent(new CustomEvent('fintrack-prefs', { detail: { userId } }));
  return next;
}

export function markReminderShown(userId: string, billId: string, dayKey: string) {
  const prefs = getUserPrefs(userId);
  setUserPrefs(userId, {
    lastReminderShown: { ...prefs.lastReminderShown, [billId]: dayKey },
  });
}
