import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Truck, AlertTriangle, ClipboardList, BarChart3, Box, X, Layers, Users, Globe, RotateCcw } from 'lucide-react';

const Sidebar = ({ mobileMenuOpen, setMobileMenuOpen }) => {
  const links = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'SKU Master', path: '/products', icon: <Layers size={20} /> },
    { name: 'Staff Management', path: '/staff', icon: <Users size={20} /> },
    { name: 'Channel Management', path: '/channels', icon: <Globe size={20} /> },
    { name: 'Courier Management', path: '/couriers', icon: <Truck size={20} /> },
    { name: 'B2B Shipments', path: '/b2b', icon: <Package size={20} /> },
    { name: 'B2C Shipments', path: '/b2c', icon: <Truck size={20} /> },
    { name: 'Returns Management', path: '/returns', icon: <RotateCcw size={20} /> },
    { name: 'Damage Tracking', path: '/damage', icon: <AlertTriangle size={20} /> },
    { name: 'Monthly Stock Check', path: '/stock', icon: <ClipboardList size={20} /> },
    { name: 'Reports', path: '/reports', icon: <BarChart3 size={20} /> },
  ];

  const sidebarClasses = `w-64 bg-slate-900 text-slate-300 flex flex-col h-screen fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
    mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
  }`;

  return (
    <aside className={sidebarClasses}>
      <div className="h-14 flex items-center justify-between px-6 bg-slate-950/50 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/20 p-2 rounded-xl text-indigo-400">
            <Box size={20} />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg tracking-wide">Thengacoco</h1>
          </div>
        </div>
        <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
          <X size={20} />
        </button>
      </div>
      
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-hidden">
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-1.5 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm group ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="transition-transform duration-200 group-hover:scale-110 child-icon">{React.cloneElement(link.icon, { size: 18 })}</span>
            {link.name}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-3 bg-slate-950/30 border-t border-slate-800 hidden md:block">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="text-sm">
            <p className="font-medium text-white">Stock System v2.0</p>
            <p className="text-xs text-indigo-400 mt-0.5 flex items-center gap-1">
               <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
               Connected
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
