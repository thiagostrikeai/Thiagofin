export interface Bill {
  id: string;
  name: string;
  dueDay: number; // 1-31
  warningDays: number;
  history: PaymentHistory[];
  createdAt: number;
  /** Conta se repete todo mês no mesmo dia de vencimento */
  isRecurring?: boolean;
  /** Usuário pediu lembrete por e-mail / calendário */
  emailReminderEnabled?: boolean;
  amountEstimate?: number;
}

export interface PaymentHistory {
  id: string;
  amount: number;
  datePaid: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  month: number; // 1-12
  year: number;
}
