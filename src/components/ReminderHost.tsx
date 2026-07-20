import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Mail, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBillsData } from '../hooks/useBillsData';
import {
  getActiveReminders,
  processDailyReminders,
  requestNotificationPermission,
  DueReminder,
} from '../utils/reminders';
import { openEmailReminderDraft } from '../utils/calendar';
import { getUserPrefs } from '../lib/localStore';
import { formatCurrency } from '../utils/currency';
import { useAppStore } from '../store/useAppStore';

/**
 * Runs daily reminder checks when the user is logged in.
 * Shows in-app banner + browser notifications; optional email draft.
 */
export default function ReminderHost() {
  const { targetUserId, user, isLocalMode } = useAuth();
  const { bills } = useBillsData();
  const currency = useAppStore((s) => s.currency);
  const [banner, setBanner] = useState<DueReminder[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!targetUserId || bills.length === 0) return;

    const active = getActiveReminders(bills);
    setBanner(active);
    setDismissed(false);

    const prefs = getUserPrefs(targetUserId);
    const fresh = processDailyReminders(targetUserId, bills, { sendBrowser: true });

    // If email reminders on and we have fresh items, prepare optional mailto for first one
    if (prefs.emailRemindersEnabled && fresh.length > 0) {
      const email = prefs.reminderEmail || user?.email;
      // Do not auto-open mailto (annoying). User can click "Enviar e-mail" on banner.
      void email;
    }
  }, [targetUserId, bills, user?.email, isLocalMode]);

  if (dismissed || banner.length === 0) return null;

  const prefs = targetUserId ? getUserPrefs(targetUserId) : null;
  const email = prefs?.reminderEmail || user?.email || '';

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-[60] max-w-md">
      <div className="finance-card-dark p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Bell size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Lembretes de contas</p>
            <ul className="mt-2 space-y-1.5 text-sm text-white/85">
              {banner.slice(0, 4).map((r) => (
                <li key={r.bill.id}>
                  <span className="font-semibold">{r.bill.name}</span>
                  {r.isOverdue
                    ? ' — atrasada'
                    : r.daysUntilDue === 0
                      ? ' — vence hoje'
                      : ` — em ${r.daysUntilDue} dia(s)`}
                  {r.bill.amountEstimate
                    ? ` (${formatCurrency(r.bill.amountEstimate, currency)})`
                    : ''}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 mt-3">
              <Link
                to="/bills"
                className="px-3 py-1.5 rounded-full bg-white text-[#5b4cdb] text-xs font-bold"
              >
                Ver contas
              </Link>
              {email && (
                <button
                  type="button"
                  onClick={() => {
                    const first = banner[0];
                    openEmailReminderDraft(
                      {
                        name: first.bill.name,
                        dueDay: first.bill.dueDay,
                        warningDays: first.bill.warningDays,
                        email,
                      },
                      email
                    );
                  }}
                  className="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold flex items-center gap-1"
                >
                  <Mail size={14} />
                  Enviar e-mail
                </button>
              )}
              <button
                type="button"
                onClick={() => requestNotificationPermission()}
                className="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold"
              >
                Ativar notificações
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg hover:bg-white/10"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
