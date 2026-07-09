import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, Target, Settings, LogOut, Menu, X, Landmark, PieChart, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useAppStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/bills', icon: Receipt, label: 'Contas' },
    { to: '/expenses', icon: PieChart, label: 'Gastos' },
    { to: '/goals', icon: Target, label: 'Metas' },
    { to: '/settings', icon: Settings, label: 'Ajustes' },
  ];

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${theme.isDarkMode ? 'bg-[#0a0a0f] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col w-72 border-r transition-all duration-300 ${theme.isDarkMode ? 'bg-[#13131f]/80 backdrop-blur-xl border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="p-8 pb-6 flex items-center gap-4">
          <div className="p-2.5 rounded-2xl shadow-sm" style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}>
            <Landmark size={28} />
          </div>
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-current to-current tracking-tight" style={{ backgroundImage: `linear-gradient(to right, ${theme.primaryColor}, ${theme.isDarkMode ? '#a78bfa' : '#4f46e5'})` }}>FinTrack</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-5 py-3.5 rounded-2xl transition-all duration-300 group ${
                  isActive
                    ? 'font-medium shadow-sm'
                    : `opacity-70 hover:opacity-100 hover:translate-x-1 ${theme.isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`
                }`
              }
              style={({ isActive }) => isActive ? { backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor } : {}}
            >
              <item.icon size={22} className="transition-transform group-hover:scale-110" />
              <span className="text-[15px]">{item.label}</span>
            </NavLink>
          ))}
          
          <button
            onClick={() => setTheme({ ...theme, isDarkMode: !theme.isDarkMode })}
            className={`w-full flex items-center gap-3.5 px-5 py-3.5 rounded-2xl transition-all duration-300 opacity-70 hover:opacity-100 hover:translate-x-1 group ${theme.isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
          >
            {theme.isDarkMode ? <Sun size={22} className="transition-transform group-hover:rotate-90" /> : <Moon size={22} className="transition-transform group-hover:-rotate-12" />}
            <span className="text-[15px]">Modo {theme.isDarkMode ? 'Claro' : 'Escuro'}</span>
          </button>
        </nav>

        <div className="p-5 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-2xl bg-black/5 dark:bg-white/5">
            <img src={user?.photoURL || 'https://ui-avatars.com/api/?name=' + (user?.displayName || 'U')} alt="User" className="w-10 h-10 rounded-full ring-2 ring-white/10 shadow-sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.displayName || 'Usuário'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-5 py-3 text-sm text-red-500 hover:bg-red-500/10 rounded-2xl transition-all duration-300 hover:translate-x-1 font-medium"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 border-b shadow-sm backdrop-blur-xl transition-colors duration-300" style={{ backgroundColor: theme.isDarkMode ? 'rgba(19, 19, 31, 0.8)' : 'rgba(255, 255, 255, 0.9)', borderColor: theme.isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 -ml-2 transition-transform active:scale-95">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center gap-2">
             <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}>
               <Landmark size={20} />
             </div>
             <span className="text-lg font-bold">FinTrack</span>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-40 pt-20 pb-4 px-4 flex flex-col backdrop-blur-2xl"
            style={{ backgroundColor: theme.isDarkMode ? 'rgba(10, 10, 15, 0.95)' : 'rgba(255, 255, 255, 0.95)' }}
          >
            <nav className="flex-1 space-y-2 mt-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-4 rounded-xl transition-all duration-300 ${
                      isActive
                        ? 'font-medium shadow-sm'
                        : `opacity-70 active:scale-95`
                    }`
                  }
                  style={({ isActive }) => isActive ? { backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor } : {}}
                >
                  <item.icon size={24} />
                  <span className="text-lg">{item.label}</span>
                </NavLink>
              ))}
              
              <button
                onClick={() => setTheme({ ...theme, isDarkMode: !theme.isDarkMode })}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all duration-300 opacity-70 active:scale-95"
              >
                {theme.isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
                <span className="text-lg">Modo {theme.isDarkMode ? 'Claro' : 'Escuro'}</span>
              </button>
            </nav>
            <button
              onClick={() => { setIsMobileMenuOpen(false); logout(); }}
              className="w-full flex items-center gap-3 px-4 py-4 text-red-500 rounded-xl transition-colors mt-auto hover:bg-red-500/10 active:scale-95"
            >
              <LogOut size={24} />
              <span className="text-lg">Sair</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col pt-16 md:pt-0 max-h-screen overflow-y-auto">
        <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
