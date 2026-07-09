import { create } from 'zustand';

interface ThemeConfig {
  primaryColor: string;
  isDarkMode: boolean;
}

interface DashboardConfig {
  showChart: boolean;
  showUpcomingBills: boolean;
  showGoals: boolean;
}

interface AppState {
  theme: ThemeConfig;
  dashboardConfig: DashboardConfig;
  currency: string;
  setTheme: (theme: Partial<ThemeConfig>) => void;
  setDashboardConfig: (config: Partial<DashboardConfig>) => void;
  setCurrency: (currency: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: {
    primaryColor: '#6366f1', // indigo-500
    isDarkMode: false,
  },
  dashboardConfig: {
    showChart: true,
    showUpcomingBills: true,
    showGoals: true,
  },
  currency: 'BRL',
  setTheme: (theme) => set((state) => ({ theme: { ...state.theme, ...theme } })),
  setDashboardConfig: (config) => set((state) => ({ dashboardConfig: { ...state.dashboardConfig, ...config } })),
  setCurrency: (currency) => set({ currency }),
}));
