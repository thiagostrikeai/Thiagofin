export interface Bill {
  id: string;
  name: string;
  dueDay: number; // 1-31
  warningDays: number;
  history: PaymentHistory[];
  createdAt: number;
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
