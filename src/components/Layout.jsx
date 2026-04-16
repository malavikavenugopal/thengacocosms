import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, Search, User } from 'lucide-react';

const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    switch(location.pathname) {
      case '/': return 'Dashboard Overview';
      case '/products': return 'SKU Master';
      case '/staff': return 'Staff Management';
      case '/channels': return 'Channel Management';
      case '/couriers': return 'Courier Management';
      case '/returns': return 'Returns Management';
      case '/b2b': return 'B2B Shipments';
      case '/b2c': return 'B2C Shipments';
      case '/damage': return 'Damage Tracking';
      case '/stock': return 'Monthly Stock Check';
      case '/reports': return 'Analytics & Reports';
      default: return 'Overview';
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans">
      <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all duration-200">
        {/* Top Navbar */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-500 hover:text-slate-900 transition-colors p-1" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">
              {getPageTitle()}
            </h1>
          </div>
          
          <div className="flex items-center gap-5">
            <div className="relative hidden md:block w-64 lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search resources..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:border-indigo-500 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all text-slate-700"
              />
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md cursor-pointer border-2 border-white ring-2 ring-slate-100">
              M
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 flex-1 overflow-x-hidden">
          <div className="max-w-7xl mx-auto animate-in fade-in duration-300 slide-in-from-bottom-4">
             <Outlet />
          </div>
        </div>
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)}></div>
      )}
    </div>
  );
};

export default Layout;
