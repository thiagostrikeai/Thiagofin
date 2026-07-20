import { Bill } from '../types';
import { getUserPrefs, markReminderShown } from '../lib/localStore';

export interface DueReminder {
  bill: Bill;
  daysUntilDue: number;
  isOverdue: boolean;
  dueDate: Date;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function dueDateThisMonth(dueDay: number, ref = new Date()): Date {
  const dim = daysInMonth(ref.getFullYear(), ref.getMonth());
  const day = Math.min(dueDay, dim);
  return new Date(ref.getFullYear(), ref.getMonth(), day, 23, 59, 59);
}

function isPaidThisMonth(bill: Bill, ref = new Date()): boolean {
  if (!bill.history?.length) return false;
  return bill.history.some((p) => {
    const d = new Date(p.datePaid);
    return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
  });
}

/**
 * Bills that should warn the user now (within warningDays of due date, unpaid).
 */
export function getActiveReminders(bills: Bill[], ref = new Date()): DueReminder[] {
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const result: DueReminder[] = [];

  for (const bill of bills) {
    if (isPaidThisMonth(bill, ref)) continue;

    const created = bill.createdAt ? new Date(bill.createdAt) : new Date(0);
    // not started yet
    if (
      ref.getFullYear() < created.getFullYear() ||
      (ref.getFullYear() === created.getFullYear() && ref.getMonth() < created.getMonth())
    ) {
      continue;
    }

    const due = dueDateThisMonth(bill.dueDay, ref);
    const dueDayOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntilDue = Math.round((dueDayOnly.getTime() - today.getTime()) / msPerDay);
    const isOverdue = daysUntilDue < 0;

    if (isOverdue || daysUntilDue <= (bill.warningDays ?? 0)) {
      result.push({ bill, daysUntilDue, isOverdue, dueDate: due });
    }
  }

  return result.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export function todayKey(ref = new Date()) {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`;
}

/** Browser notification permission + show */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export function showBrowserNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'fintrack-reminder' });
  } catch {
    // ignore
  }
}

/**
 * Fire in-app + browser notifications for due bills (once per bill per day).
 * Returns list of newly notified bills for optional email draft.
 */
export function processDailyReminders(
  userId: string,
  bills: Bill[],
  opts?: { sendBrowser?: boolean }
): DueReminder[] {
  const active = getActiveReminders(bills);
  const prefs = getUserPrefs(userId);
  const key = todayKey();
  const fresh: DueReminder[] = [];

  for (const item of active) {
    if (prefs.lastReminderShown[item.bill.id] === key) continue;
    fresh.push(item);
    markReminderShown(userId, item.bill.id, key);

    if (opts?.sendBrowser !== false) {
      const msg = item.isOverdue
        ? `${item.bill.name} está atrasada (venceu dia ${item.bill.dueDay}).`
        : item.daysUntilDue === 0
          ? `${item.bill.name} vence hoje!`
          : `${item.bill.name} vence em ${item.daysUntilDue} dia(s) (dia ${item.bill.dueDay}).`;
      showBrowserNotification('FinTrack — Lembrete de conta', msg);
    }
  }

  return fresh;
}
