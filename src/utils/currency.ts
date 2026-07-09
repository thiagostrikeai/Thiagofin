export const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};
