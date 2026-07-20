import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Target,
  Settings,
  LogOut,
  Menu,
  X,
  Wallet,
  PieChart,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'motion/react';
import ReminderHost from './ReminderHost';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Início', end: true },
  { to: '/bills', icon: Receipt, label: 'Contas' },
  { to: '/expenses', icon: PieChart, label: 'Gastos' },
  { to: '/goals', icon: Target, label: 'Metas' },
  { to: '/settings', icon: Settings, label: 'Ajustes' },
];

export default function Layout() {
  const { user, logout, isLocalMode, isGuest, permission } = useAuth();
  const { theme, setTheme } = useAppStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const pageTitle =
    navItems.find((n) =>
      n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
    )?.label ?? 'FinTrack';

  const shellBg = theme.isDarkMode ? 'bg-[#0f0e1a] text-slate-100' : 'bg-[#f3f0ff] text-[#1e1b4b]';
  const sidebarBg = theme.isDarkMode
    ? 'bg-[#16142a]/95 border-white/5'
    : 'bg-white/80 border-indigo-100/60 backdrop-blur-xl';

  return (
    <div className={`min-h-screen flex ${shellBg} transition-colors duration-300`}>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col w-[280px] border-r sticky top-0 h-screen ${sidebarBg}`}
      >
        <div className="p-7 pb-4 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30"
            style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, #4338ca)` }}
          >
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">FinTrack</p>
            <p className={`text-xs ${theme.isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
              Finance App
            </p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
                  isActive
                    ? 'text-white shadow-lg shadow-indigo-500/25'
                    : theme.isDarkMode
                      ? 'text-slate-400 hover:bg-white/5 hover:text-white'
                      : 'text-slate-500 hover:bg-[#ece9ff] hover:text-[#5b4cdb]'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? { background: `linear-gradient(135deg, ${theme.primaryColor}, #4338ca)` }
                  : undefined
              }
            >
              <item.icon size={20} />
              <span className="text-[15px] font-medium">{item.label}</span>
            </NavLink>
          ))}

          <button
            onClick={() => setTheme({ isDarkMode: !theme.isDarkMode })}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${
              theme.isDarkMode
                ? 'text-slate-400 hover:bg-white/5'
                : 'text-slate-500 hover:bg-[#ece9ff]'
            }`}
          >
            {theme.isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span className="text-[15px] font-medium">
              Modo {theme.isDarkMode ? 'Claro' : 'Escuro'}
            </span>
          </button>
        </nav>

        <div className="p-4 m-4 rounded-3xl finance-card-dark">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={
                user?.photoURL ||
                'https://ui-avatars.com/api/?name=' +
                  encodeURIComponent(user?.displayName || 'U') +
                  '&background=ffffff&color=5b4cdb'
              }
              alt="User"
              className="w-10 h-10 rounded-full ring-2 ring-white/30"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {user?.displayName || user?.email?.split('@')[0] || 'Usuário'}
              </p>
              {isLocalMode && <p className="text-[11px] text-orange-300 font-medium">Modo local</p>}
              {isGuest && (
                <p className="text-[11px] text-orange-300 font-medium leading-snug">
                  Convidado · {permission === 'edit' ? 'pode editar' : 'só visualização'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        className={`md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-16 ${
          theme.isDarkMode ? 'bg-[#16142a]/90 border-b border-white/5' : 'bg-white/80 border-b border-indigo-100/50'
        } backdrop-blur-xl`}
      >
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className={`p-2 rounded-xl ${theme.isDarkMode ? 'hover:bg-white/5' : 'hover:bg-[#ece9ff]'}`}
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: theme.primaryColor }}
          >
            <Wallet size={16} />
          </div>
          <div className="min-w-0">
            <span className="font-bold block truncate">{pageTitle}</span>
            {isGuest && user?.displayName && (
              <span className="text-[10px] text-orange-500 font-medium truncate block">
                {user.displayName}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setTheme({ isDarkMode: !theme.isDarkMode })}
          className={`p-2 rounded-xl ${theme.isDarkMode ? 'hover:bg-white/5' : 'hover:bg-[#ece9ff]'}`}
        >
          {theme.isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className={`md:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px] flex flex-col ${
                theme.isDarkMode ? 'bg-[#16142a]' : 'bg-white'
              } shadow-2xl`}
            >
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white"
                    style={{ background: theme.primaryColor }}
                  >
                    <Wallet size={20} />
                  </div>
                  <span className="text-lg font-bold">FinTrack</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-xl">
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 px-3 space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${
                        isActive
                          ? 'text-white'
                          : theme.isDarkMode
                            ? 'text-slate-400'
                            : 'text-slate-600'
                      }`
                    }
                    style={({ isActive }) =>
                      isActive ? { background: theme.primaryColor } : undefined
                    }
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                ))}
              </nav>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="m-4 flex items-center gap-2 px-4 py-3 rounded-2xl text-red-500 bg-red-500/10 font-medium"
              >
                <LogOut size={18} />
                Sair
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen max-h-screen overflow-y-auto">
        <div className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 pt-20 md:pt-8 pb-24 md:pb-10">
          <Outlet />
        </div>
      </main>

      <ReminderHost />

      {/* Mobile bottom nav — like finance app chips */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-safe ${
          theme.isDarkMode ? 'bg-[#16142a]/95 border-t border-white/5' : 'bg-white/90 border-t border-indigo-100/60'
        } backdrop-blur-xl`}
      >
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl min-w-[56px] transition-all ${
                  isActive ? 'text-white' : theme.isDarkMode ? 'text-slate-500' : 'text-slate-400'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      background: `linear-gradient(135deg, ${theme.primaryColor}, #4338ca)`,
                      boxShadow: '0 8px 16px -6px rgba(91,76,219,0.45)',
                    }
                  : undefined
              }
            >
              <item.icon size={18} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
