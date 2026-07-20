import { Bill, Goal, PaymentHistory } from '../types';
import { requireSupabase, supabase } from './supabase';

export interface Invitation {
  code: string;
  ownerId: string;
  permission: 'view' | 'edit';
  createdAt: number;
  active?: boolean;
  useCount?: number;
  label?: string | null;
}

export interface GuestAccess {
  code: string;
  ownerId: string;
  permission: 'view' | 'edit';
}

export interface GuestMember {
  guestUid: string;
  permission: 'view' | 'edit';
  code: string;
  guestEmail: string | null;
  guestName: string | null;
  joinedAt: string | null;
}

// ── Row mappers ────────────────────────────────────────

type BillRow = {
  id: string;
  user_id: string;
  name: string;
  due_day: number;
  warning_days: number;
  history: PaymentHistory[] | string;
  created_at: number;
  is_recurring: boolean | null;
  email_reminder_enabled: boolean | null;
  amount_estimate: number | string | null;
};

type GoalRow = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number | string;
  current_amount: number | string;
  month: number;
  year: number;
};

function parseHistory(h: PaymentHistory[] | string | null | undefined): PaymentHistory[] {
  if (!h) return [];
  if (typeof h === 'string') {
    try {
      return JSON.parse(h) as PaymentHistory[];
    } catch {
      return [];
    }
  }
  return Array.isArray(h) ? h : [];
}

export function mapBill(row: BillRow): Bill {
  return {
    id: row.id,
    name: row.name,
    dueDay: row.due_day,
    warningDays: row.warning_days,
    history: parseHistory(row.history),
    createdAt: Number(row.created_at),
    isRecurring: row.is_recurring ?? true,
    emailReminderEnabled: row.email_reminder_enabled ?? true,
    amountEstimate:
      row.amount_estimate === null || row.amount_estimate === undefined
        ? undefined
        : Number(row.amount_estimate),
  };
}

export function mapGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    name: row.name,
    targetAmount: Number(row.target_amount),
    currentAmount: Number(row.current_amount),
    month: row.month,
    year: row.year,
  };
}

function normalizeInviteCode(code: string): string {
  return String(code || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

// Codes are digits; keep digits only for 6-digit invites
function normalizeDigitCode(code: string): string {
  return String(code || '').replace(/\D/g, '').slice(0, 6);
}

// ── Invitations / guest ────────────────────────────────

export const createInvitation = async (
  ownerId: string,
  permission: 'view' | 'edit',
  label?: string
): Promise<string> => {
  const db = requireSupabase();
  // Generate unique 6-digit code (retry on rare collision)
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const { error } = await db.from('invitations').insert({
      code,
      owner_id: ownerId,
      permission,
      created_at: Date.now(),
      active: true,
      use_count: 0,
      label: label || null,
    });
    if (!error) return code;
    // unique violation → retry
    if (error.code !== '23505') throw error;
  }
  throw new Error('Não foi possível gerar um código único. Tente de novo.');
};

export const getInvitations = async (ownerId: string): Promise<Invitation[]> => {
  const db = requireSupabase();
  const { data, error } = await db
    .from('invitations')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    code: r.code,
    ownerId: r.owner_id,
    permission: r.permission as 'view' | 'edit',
    createdAt: Number(r.created_at),
    active: r.active !== false,
    useCount: Number(r.use_count || 0),
    label: r.label ?? null,
  }));
};

export const deleteInvitation = async (code: string) => {
  const db = requireSupabase();
  const { error } = await db.from('invitations').delete().eq('code', code);
  if (error) throw error;
};

export const setInvitationActive = async (code: string, active: boolean) => {
  const db = requireSupabase();
  const { error } = await db.from('invitations').update({ active }).eq('code', code);
  if (error) throw error;
};

/** Maps Supabase / Postgres errors to user-friendly Portuguese messages */
export function mapInviteError(err: unknown): string {
  const msg = String((err as { message?: string })?.message || err || '').toLowerCase();
  if (msg.includes('invalid invitation') || msg.includes('invalid invitation code')) {
    return 'Código de convite inválido. Confira os 6 dígitos e tente novamente.';
  }
  if (msg.includes('invitation inactive')) {
    return 'Este convite foi desativado pelo dono da conta.';
  }
  if (msg.includes('max uses')) {
    return 'Este convite atingiu o limite de usos.';
  }
  if (msg.includes('cannot redeem own')) {
    return 'Você não pode usar o próprio convite. Abra o link em outro dispositivo/conta.';
  }
  if (msg.includes('not authenticated') || msg.includes('jwt')) {
    return 'Sessão não autenticada. Tente novamente.';
  }
  if (msg.includes('anonymous') || msg.includes('signups not allowed') || msg.includes('provider')) {
    return 'Login de convidado (Anonymous) não está ativo no Supabase. Ative em Authentication → Providers → Anonymous, ou entre com e-mail e use o código.';
  }
  if (msg.includes('function') && msg.includes('redeem_invitation')) {
    return 'Função de convite não encontrada no banco. Execute o arquivo supabase/fix-invites.sql no SQL Editor.';
  }
  if (msg.includes('permission') || msg.includes('row-level security') || msg.includes('rls')) {
    return 'Sem permissão no banco (RLS). Rode o SQL fix-invites.sql no Supabase.';
  }
  return (err as { message?: string })?.message || 'Não foi possível aceitar o convite.';
}

export const verifyInvitationAndCreateGuestAccess = async (
  code: string,
  _guestUid?: string
): Promise<Invitation> => {
  const db = requireSupabase();
  const clean = normalizeDigitCode(code);
  if (clean.length !== 6) {
    throw new Error('Código de convite inválido. Use os 6 dígitos.');
  }

  const { data, error } = await db.rpc('redeem_invitation', { p_code: clean });
  if (error) {
    console.error('[redeem_invitation]', error);
    throw new Error(mapInviteError(error));
  }
  if (!data) {
    throw new Error('Código de convite inválido.');
  }

  // Supabase may return object or stringified json
  const inv =
    typeof data === 'string'
      ? (JSON.parse(data) as {
          code: string;
          ownerId: string;
          permission: 'view' | 'edit';
          createdAt: number;
        })
      : (data as {
          code: string;
          ownerId: string;
          permission: 'view' | 'edit';
          createdAt: number;
        });

  if (!inv?.ownerId) {
    throw new Error('Resposta inválida do servidor ao resgatar convite.');
  }

  return {
    code: inv.code,
    ownerId: inv.ownerId,
    permission: inv.permission,
    createdAt: Number(inv.createdAt),
  };
};

export const getGuestAccess = async (guestUid: string): Promise<GuestAccess | null> => {
  const db = requireSupabase();
  const { data, error } = await db
    .from('guest_access')
    .select('*')
    .eq('guest_uid', guestUid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    code: data.code,
    ownerId: data.owner_id,
    permission: data.permission as 'view' | 'edit',
  };
};

export const listMyGuests = async (): Promise<GuestMember[]> => {
  const db = requireSupabase();
  const { data, error } = await db.rpc('list_my_guests');
  if (error) {
    // Fallback: direct table select if RPC not installed yet
    const { data: rows, error: e2 } = await db.from('guest_access').select('*');
    if (e2) throw error;
    return (rows || [])
      .filter((r) => true)
      .map((r) => ({
        guestUid: r.guest_uid as string,
        permission: r.permission as 'view' | 'edit',
        code: r.code as string,
        guestEmail: (r.guest_email as string) || null,
        guestName: (r.guest_name as string) || null,
        joinedAt: (r.joined_at as string) || null,
      }));
  }
  return (data || []).map(
    (r: {
      guest_uid: string;
      permission: string;
      code: string;
      guest_email: string | null;
      guest_name: string | null;
      joined_at: string | null;
    }) => ({
      guestUid: r.guest_uid,
      permission: r.permission as 'view' | 'edit',
      code: r.code,
      guestEmail: r.guest_email,
      guestName: r.guest_name,
      joinedAt: r.joined_at,
    })
  );
};

export const revokeGuest = async (guestUid: string) => {
  const db = requireSupabase();
  const { error } = await db.rpc('revoke_guest', { p_guest_uid: guestUid });
  if (error) {
    // fallback delete
    const { error: e2 } = await db.from('guest_access').delete().eq('guest_uid', guestUid);
    if (e2) throw error;
  }
};

// ── Bills ──────────────────────────────────────────────

export const fetchBills = async (userId: string): Promise<Bill[]> => {
  const db = requireSupabase();
  const { data, error } = await db
    .from('bills')
    .select('*')
    .eq('user_id', userId)
    .order('due_day', { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => mapBill(r as BillRow));
};

export const subscribeBills = (
  userId: string,
  onData: (bills: Bill[]) => void,
  onError?: (err: Error) => void
): (() => void) => {
  let cancelled = false;
  const channelName = `bills-${userId}-${crypto.randomUUID()}`;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  const load = async () => {
    try {
      const bills = await fetchBills(userId);
      if (!cancelled) onData(bills);
    } catch (e) {
      if (!cancelled) onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  };

  void load();

  try {
    channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills', filter: `user_id=eq.${userId}` },
        () => {
          void load();
        }
      );
    channel.subscribe();
  } catch (e) {
    console.warn('[FinTrack] Realtime bills indisponível; usando polling.', e);
    channel = null;
  }

  const poll = window.setInterval(() => void load(), 12000);

  return () => {
    cancelled = true;
    window.clearInterval(poll);
    if (channel) {
      void supabase.removeChannel(channel);
    }
  };
};

export const addBill = async (
  userId: string,
  bill: Omit<Bill, 'id' | 'history'>
): Promise<string> => {
  const db = requireSupabase();
  const { data, error } = await db
    .from('bills')
    .insert({
      user_id: userId,
      name: bill.name,
      due_day: bill.dueDay,
      warning_days: bill.warningDays,
      history: [],
      created_at: bill.createdAt,
      is_recurring: bill.isRecurring ?? true,
      email_reminder_enabled: bill.emailReminderEnabled ?? true,
      amount_estimate: bill.amountEstimate ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
};

export const payBill = async (
  userId: string,
  billId: string,
  amount: number,
  datePaid: number,
  currentHistory: PaymentHistory[]
) => {
  const db = requireSupabase();
  const newPayment: PaymentHistory = { id: crypto.randomUUID(), amount, datePaid };
  const { error } = await db
    .from('bills')
    .update({ history: [...currentHistory, newPayment] })
    .eq('id', billId)
    .eq('user_id', userId);
  if (error) throw error;
};

export const updatePayment = async (
  userId: string,
  billId: string,
  paymentId: string,
  amount: number,
  datePaid: number,
  currentHistory: PaymentHistory[]
) => {
  const db = requireSupabase();
  const history = currentHistory.map((p) =>
    p.id === paymentId ? { ...p, amount, datePaid } : p
  );
  const { error } = await db
    .from('bills')
    .update({ history })
    .eq('id', billId)
    .eq('user_id', userId);
  if (error) throw error;
};

export const deletePayment = async (
  userId: string,
  billId: string,
  paymentId: string,
  currentHistory: PaymentHistory[]
) => {
  const db = requireSupabase();
  const history = currentHistory.filter((p) => p.id !== paymentId);
  const { error } = await db
    .from('bills')
    .update({ history })
    .eq('id', billId)
    .eq('user_id', userId);
  if (error) throw error;
};

export const deleteBill = async (userId: string, billId: string) => {
  const db = requireSupabase();
  const { error } = await db.from('bills').delete().eq('id', billId).eq('user_id', userId);
  if (error) throw error;
};

// ── Goals ──────────────────────────────────────────────

export const fetchGoals = async (userId: string): Promise<Goal[]> => {
  const db = requireSupabase();
  const { data, error } = await db.from('goals').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data || []).map((r) => mapGoal(r as GoalRow));
};

export const subscribeGoals = (
  userId: string,
  onData: (goals: Goal[]) => void,
  onError?: (err: Error) => void
): (() => void) => {
  let cancelled = false;
  const channelName = `goals-${userId}-${crypto.randomUUID()}`;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  const load = async () => {
    try {
      const goals = await fetchGoals(userId);
      if (!cancelled) onData(goals);
    } catch (e) {
      if (!cancelled) onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  };

  void load();

  try {
    channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${userId}` },
        () => {
          void load();
        }
      );
    channel.subscribe();
  } catch (e) {
    console.warn('[FinTrack] Realtime goals indisponível; usando polling.', e);
    channel = null;
  }

  const poll = window.setInterval(() => void load(), 12000);

  return () => {
    cancelled = true;
    window.clearInterval(poll);
    if (channel) {
      void supabase.removeChannel(channel);
    }
  };
};

export const addGoal = async (userId: string, goal: Omit<Goal, 'id'>) => {
  const db = requireSupabase();
  const { error } = await db.from('goals').insert({
    user_id: userId,
    name: goal.name,
    target_amount: goal.targetAmount,
    current_amount: goal.currentAmount,
    month: goal.month,
    year: goal.year,
  });
  if (error) throw error;
};

export const updateGoalAmount = async (userId: string, goalId: string, currentAmount: number) => {
  const db = requireSupabase();
  const { error } = await db
    .from('goals')
    .update({ current_amount: currentAmount })
    .eq('id', goalId)
    .eq('user_id', userId);
  if (error) throw error;
};

export const deleteGoal = async (userId: string, goalId: string) => {
  const db = requireSupabase();
  const { error } = await db.from('goals').delete().eq('id', goalId).eq('user_id', userId);
  if (error) throw error;
};

export { normalizeDigitCode, normalizeInviteCode };
