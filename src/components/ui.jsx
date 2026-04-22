import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

export const Card = ({ children, className = '', noPadding = false }) => (
  <div className={`bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 ${noPadding ? '' : 'p-6'} transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] ${className}`}>
    {children}
  </div>
);

export const Input = ({ label, className = '', ...props }) => (
  <div className={`flex flex-col gap-1.5 w-full ${className}`}>
    {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
    <input
      className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white transition-all text-sm w-full placeholder-slate-400 text-slate-800"
      {...props}
    />
  </div>
);

export const Select = ({ label, options, className = '', ...props }) => (
  <div className={`flex flex-col gap-1.5 w-full ${className}`}>
    {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
    <div className="relative">
      <select
        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white transition-all text-sm appearance-none cursor-pointer text-slate-800 pr-10"
        {...props}
      >
        <option value="" className="text-slate-400">Select an option</option>
        {(options || []).map((opt, i) => (
          <option key={i} value={opt}>{opt}</option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
    </div>
  </div>
);

export const SearchableSelect = ({ label, options, value, onChange, placeholder = "Select...", className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  const filteredOptions = (options || []).filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`} ref={wrapperRef}>
      {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
      <div className="relative">
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer flex justify-between items-center hover:border-indigo-300 transition-all text-sm ${isOpen ? 'ring-2 ring-indigo-500/30 border-indigo-500 bg-white' : ''}`}
        >
          <span className={value ? "text-slate-900 font-medium" : "text-slate-400"}>
            {value || placeholder}
          </span>
          <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            <Plus size={16} className="rotate-45 text-slate-400" />
          </div>
        </div>

        {isOpen && (
          <div className="absolute z-[100] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-100 max-h-72 overflow-hidden flex flex-col">
            <input 
              autoFocus
              type="text"
              className="w-full p-2.5 mb-2 text-sm border-b border-slate-100 outline-none placeholder:text-slate-300 font-medium"
              placeholder="Type to search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="overflow-y-auto custom-scrollbar flex-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, i) => (
                  <div 
                    key={i}
                    className={`p-2.5 text-sm rounded-lg cursor-pointer transition-colors mb-1 last:mb-0 ${
                      value === opt 
                        ? 'bg-indigo-50 text-indigo-700 font-bold' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                  >
                    {opt}
                  </div>
                ))
              ) : (
                <div className="p-4 text-xs text-slate-400 italic text-center">No results found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const Table = ({ headers, children }) => (
  <div className="w-full overflow-x-auto rounded-xl border border-slate-200 relative shadow-sm">
    <table className="w-full text-left border-collapse">
      <thead className="bg-slate-50 border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <tr>
          {(headers || []).map((header, i) => (
            <th key={i} className="py-4 px-6 font-semibold text-xs text-slate-500 uppercase tracking-wider backdrop-blur-sm">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white shadow-inner">
        {children}
      </tbody>
    </table>
  </div>
);

export const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 active:bg-indigo-800 border-transparent',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm active:bg-slate-100',
    danger: 'bg-red-500 text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/30 active:bg-red-700 border-transparent',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/30 active:bg-emerald-800 border-transparent',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-transparent'
  };

  return (
    <button
      className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 text-sm flex items-center justify-center gap-2 border ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
