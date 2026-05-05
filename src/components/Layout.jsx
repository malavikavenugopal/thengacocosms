import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, Search, User, LogOut } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';

const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logout, currentUser } = useGlobalState();
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard Overview';
      case '/products': return 'SKU Master';
      case '/purchases': return 'Purchase Management';
      case '/staff': return 'Staff Management';
      case '/channels': return 'Channel Management';
      case '/couriers': return 'Courier Management';
      case '/returns': return 'Returns Management';
      case '/b2b': return 'B2B Shipments';
      case '/b2c': return 'B2C Shipments';
      case '/damage': return 'Damage Tracking';
      case '/stock': return 'Stock Check';
      case '/manufacturing': return 'Candle Manufacturing';
      case '/rework': return 'Rework Log Entry';
      case '/reports': return 'Analytics & Reports';
      default: return 'Overview';
    }
  };

  const userInitial = currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : 'U';

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans">
      <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />

      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen transition-all duration-200 min-w-0 overflow-x-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-slate-500 hover:text-slate-900 transition-colors p-1" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="relative hidden xl:block w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search resources..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:border-indigo-500 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all text-slate-700"
              />
            </div>

            <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-100">
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-[10px] sm:text-xs font-bold text-slate-900 leading-none">{currentUser?.email?.split('@')[0] || 'User'}</p>
                <p className="text-[8px] sm:text-[10px] font-medium text-slate-500 mt-1">
                  {currentUser?.role === 'admin' ? 'Administrator' : 'Staff Member'}
                </p>
              </div>

              <button
                onClick={logout}
                className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 transition-all duration-200"
                title="Log Out"
              >
                <LogOut size={16} />
                <span className="text-[10px] sm:text-xs font-bold hidden sm:block">Logout</span>
              </button>

              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg shadow-indigo-100 border-2 border-white shrink-0">
                {userInitial}
              </div>
            </div>
          </div>
        </header>

        <div className="p-3 sm:p-4 lg:p-8 flex-1 overflow-x-hidden">
          <div className="max-w-7xl mx-auto animate-in fade-in duration-300 slide-in-from-bottom-4">
            <Outlet key={location.pathname} />
          </div>
        </div>
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)}></div>
      )}
    </div>
  );
};

export default Layout;
