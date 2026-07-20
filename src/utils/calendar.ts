/**
 * Google Calendar + Apple Calendar (.ics) helpers for recurring bill reminders.
 */

export interface BillCalendarInput {
  name: string;
  dueDay: number; // 1-31
  warningDays: number;
  startDate?: Date;
  email?: string | null;
  notes?: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Next occurrence of dueDay (clamped for short months) */
export function getNextDueDate(dueDay: number, from = new Date()): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const day = Math.min(dueDay, daysInMonth);
  let candidate = new Date(y, m, day, 9, 0, 0, 0);
  // if due day already passed this month, use next month
  const todayStart = new Date(y, m, from.getDate());
  if (candidate < todayStart) {
    const nm = m + 1;
    const ny = nm > 11 ? y + 1 : y;
    const realM = nm % 12;
    const dim = new Date(ny, realM + 1, 0).getDate();
    candidate = new Date(ny, realM, Math.min(dueDay, dim), 9, 0, 0, 0);
  }
  return candidate;
}

/** Reminder date = due date minus warningDays */
export function getReminderDate(dueDay: number, warningDays: number, from = new Date()): Date {
  const due = getNextDueDate(dueDay, from);
  const rem = new Date(due);
  rem.setDate(rem.getDate() - Math.max(0, warningDays));
  rem.setHours(9, 0, 0, 0);
  return rem;
}

function toGoogleDate(d: Date): string {
  // All-day style YYYYMMDD
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function toIcsDate(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function toIcsUtcStamp(d = new Date()): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Opens Google Calendar with a monthly recurring event on dueDay.
 * User can enable "e-mail" reminders in the Google UI; description includes FinTrack context.
 */
export function openGoogleCalendarRecurring(bill: BillCalendarInput): void {
  const due = getNextDueDate(bill.dueDay, bill.startDate);
  const nextDay = new Date(due);
  nextDay.setDate(nextDay.getDate() + 1);

  const title = `Pagar: ${bill.name}`;
  const details = [
    `Lembrete FinTrack — conta recorrente.`,
    `Vencimento todo dia ${bill.dueDay}.`,
    `Aviso sugerido: ${bill.warningDays} dia(s) antes.`,
    bill.notes || '',
    '',
    'Dica: em "Adicionar notificação" escolha E-mail e defina os dias de antecedência.',
  ]
    .filter(Boolean)
    .join('\n');

  // Monthly on BYMONTHDAY
  const rrule = `RRULE:FREQ=MONTHLY;BYMONTHDAY=${Math.min(Math.max(bill.dueDay, 1), 28)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toGoogleDate(due)}/${toGoogleDate(nextDay)}`,
    details,
    recur: rrule,
  });

  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener,noreferrer');
}

/**
 * Builds and downloads an .ics file for Apple Calendar / Outlook / etc.
 * Includes monthly recurrence + VALARM before due date.
 */
export function downloadAppleCalendarIcs(bill: BillCalendarInput, filename?: string): void {
  const due = getNextDueDate(bill.dueDay, bill.startDate);
  const uid = `fintrack-${bill.dueDay}-${bill.name.replace(/\s+/g, '-').slice(0, 40)}-${Date.now()}@fintrack.app`;
  const summary = escapeIcs(`Pagar: ${bill.name}`);
  const description = escapeIcs(
    `Lembrete FinTrack. Conta recorrente — vence todo dia ${bill.dueDay}. Aviso ${bill.warningDays} dia(s) antes.`
  );

  // Use BYMONTHDAY up to 28 to avoid invalid dates in short months
  const byDay = Math.min(Math.max(bill.dueDay, 1), 28);
  const triggerDays = Math.max(bill.warningDays, 0);

  const emailAlarm =
    bill.email
      ? `
BEGIN:VALARM
ACTION:EMAIL
TRIGGER:-P${triggerDays}D
DESCRIPTION:${escapeIcs(`Lembrete: ${bill.name} vence em ${triggerDays} dia(s)`)}
SUMMARY:${summary}
ATTENDEE:MAILTO:${bill.email}
END:VALARM`
      : '';

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//FinTrack//Finance App//PT
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${toIcsUtcStamp()}
DTSTART:${toIcsDate(due)}
DTEND:${toIcsDate(new Date(due.getTime() + 60 * 60 * 1000))}
RRULE:FREQ=MONTHLY;BYMONTHDAY=${byDay}
SUMMARY:${summary}
DESCRIPTION:${description}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-P${triggerDays}D
DESCRIPTION:${escapeIcs(`FinTrack: ${bill.name} vence em ${triggerDays} dia(s)`)}
END:VALARM${emailAlarm}
END:VEVENT
END:VCALENDAR`.replace(/\n/g, '\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `lembrete-${bill.name.replace(/\s+/g, '-').toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Opens a pre-filled email draft as a one-shot / self-reminder setup */
export function openEmailReminderDraft(bill: BillCalendarInput, toEmail: string): void {
  const due = getNextDueDate(bill.dueDay);
  const rem = getReminderDate(bill.dueDay, bill.warningDays);
  const subject = encodeURIComponent(`[FinTrack] Lembrete: ${bill.name}`);
  const body = encodeURIComponent(
    [
      `Olá!`,
      ``,
      `Você cadastrou a conta recorrente "${bill.name}" no FinTrack.`,
      ``,
      `• Vencimento: todo dia ${bill.dueDay}`,
      `• Próximo vencimento: ${due.toLocaleDateString('pt-BR')}`,
      `• Aviso: ${bill.warningDays} dia(s) antes (${rem.toLocaleDateString('pt-BR')})`,
      ``,
      `Dica: adicione este evento no Google ou Apple Calendar (no app FinTrack) para receber lembretes automáticos por e-mail ou notificação do calendário todos os meses.`,
      ``,
      `— FinTrack`,
    ].join('\n')
  );
  window.location.href = `mailto:${encodeURIComponent(toEmail)}?subject=${subject}&body=${body}`;
}
