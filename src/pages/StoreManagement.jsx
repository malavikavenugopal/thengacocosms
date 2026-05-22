import React, { useState, useMemo } from 'react';
import { Card, Input, Button, Table, SearchableSelect } from '../components/ui';
import { Store, Plus, Trash2, Save, Mail, Search, Eye, Edit2, X, ClipboardList, BarChart2 } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import emailjs from 'emailjs-com';

const StoreManagement = () => {
  const { stores, storeSales, b2bShipments, addStoreSale, updateStoreSale, deleteStoreSale, stock, storeReminders, addStoreReminder, addStore, updateStore, deleteStore } = useGlobalState();

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [salesData, setSalesData] = useState([{ id: Date.now(), productName: '', quantity: '', amount: '' }]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [summarySearch, setSummarySearch] = useState('');
  const [summaryMonth, setSummaryMonth] = useState('');
  const [editingSale, setEditingSale] = useState(null);
  const [manualStatuses, setManualStatuses] = useState({});
  const [newStoreName, setNewStoreName] = useState('');
  const [editingStoreId, setEditingStoreId] = useState(null);

  const toggleReportStatus = (storeName) => {
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonthStr = prevDate.toISOString().slice(0, 7);
    const key = `${storeName}_${prevMonthStr}`;
    
    const currentStatus = manualStatuses[key] || localStorage.getItem(`sales_report_${key}`) || 'auto';
    let newStatus = 'received';
    
    if (currentStatus === 'received') {
      newStatus = 'pending';
    } else if (currentStatus === 'pending') {
      newStatus = 'auto';
    }
    
    setManualStatuses({ ...manualStatuses, [key]: newStatus });
    localStorage.setItem(`sales_report_${key}`, newStatus);
    toast.success(`Status updated to ${newStatus === 'auto' ? 'Automatic' : newStatus}`);
  };

  const handleEditSale = (sale) => {
    setEditingSale(sale);
    setSelectedStore(sale.storeName);
    setSelectedMonth(sale.month);
    setSalesData(sale.products.map(p => ({ ...p, id: Math.random() }))); // Assign random IDs
    setActiveTab('enter-sales');
  };

  const handleDeleteSale = (sale) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteStoreSale(sale.id);
          toast.success('Sales record deleted');
        } catch (error) {
          toast.error('Failed to delete');
        }
      }
    });
  };

  const getLastReminderDate = (storeName) => {
    if (!storeReminders) return 'Never';
    const reminder = storeReminders.find(r => r.storeName === storeName);
    if (!reminder) return 'Never';
    return new Date(reminder.date).toLocaleDateString();
  };

  const getProductBalance = (storeName, productName) => {
    const storeData = storeStockData[storeName];
    if (!storeData) return 0;
    const prodData = storeData.products[productName];
    if (!prodData) return 0;
    return prodData.balance;
  };

  // Calculate stock sent to each store
  const storeStockData = useMemo(() => {
    const data = {};

    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonthStr = prevDate.toISOString().slice(0, 7);

    // Initialize stores
    stores.forEach(store => {
      data[store.name] = {
        name: store.name,
        products: {},
        totalSent: 0,
        totalSold: 0,
        balance: 0,
        hasSalesForPrevMonth: false
      };
    });

    // Process B2B Shipments (Stock Sent)
    b2bShipments.forEach(shipment => {
      if (shipment.isStore && shipment.clientName && data[shipment.clientName]) {
        shipment.products.forEach(p => {
          if (!data[shipment.clientName].products[p.name]) {
            data[shipment.clientName].products[p.name] = { sent: 0, sold: 0, balance: 0 };
          }
          const qty = Number(p.quantity) || 0;
          data[shipment.clientName].products[p.name].sent += qty;
          data[shipment.clientName].totalSent += qty;
        });
      }
    });

    // Process Store Sales (Stock Sold)
    const salesExistMap = {};
    storeSales.forEach(sale => {
      if (sale.month === prevMonthStr) {
        salesExistMap[sale.storeName] = true;
      }
      if (filterMonth && sale.month !== filterMonth) return;
      if (data[sale.storeName]) {
        sale.products.forEach(p => {
          const prodName = p.productName || p.name;
          if (!data[sale.storeName].products[prodName]) {
            data[sale.storeName].products[prodName] = { sent: 0, sold: 0, balance: 0, amount: 0 };
          }
          const qty = Number(p.quantity) || 0;
          const amt = Number(p.amount) || 0;
          data[sale.storeName].products[prodName].sold += qty;
          data[sale.storeName].products[prodName].amount += amt;
          data[sale.storeName].totalSold += qty;
        });
      }
    });

    // Calculate Balance
    Object.values(data).forEach(store => {
      Object.values(store.products).forEach(p => {
        p.balance = p.sent - p.sold;
      });
      store.balance = store.totalSent - store.totalSold;
      
      const key = `${store.name}_${prevMonthStr}`;
      const status = manualStatuses[key] || localStorage.getItem(`sales_report_${key}`) || 'auto';
      
      if (status === 'received') {
        store.hasSalesForPrevMonth = true;
      } else if (status === 'pending') {
        store.hasSalesForPrevMonth = false;
      } else {
        store.hasSalesForPrevMonth = salesExistMap[store.name] || false;
      }
    });

    return data;
  }, [stores, b2bShipments, storeSales, filterMonth, manualStatuses]);

  const filteredSales = useMemo(() => {
    return storeSales.filter(sale => {
      const matchesSearch = sale.storeName.toLowerCase().includes(summarySearch.toLowerCase()) ||
        sale.products.some(p => (p.productName || p.name).toLowerCase().includes(summarySearch.toLowerCase()));
      const matchesMonth = !summaryMonth || sale.month === summaryMonth;
      return matchesSearch && matchesMonth;
    });
  }, [storeSales, summarySearch, summaryMonth]);

  const handleAddProductRow = () => {
    setSalesData([...salesData, { id: Date.now(), productName: '', quantity: '', amount: '' }]);
  };

  const handleRemoveProductRow = (id) => {
    if (salesData.length > 1) {
      setSalesData(salesData.filter(row => row.id !== id));
    }
  };

  const handleUpdateProductRow = (id, field, value) => {
    setSalesData(salesData.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const handleSalesSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStore) {
      toast.error('Please select a store');
      return;
    }

    const invalid = salesData.find(p => !p.productName || !p.quantity);
    if (invalid) {
      toast.error('Please fill all product details');
      return;
    }

    try {
      const record = {
        storeName: selectedStore,
        month: selectedMonth,
        products: salesData.map(p => ({ 
          productName: p.productName, 
          quantity: Number(p.quantity),
          amount: Number(p.amount) || 0 
        })),
        date: editingSale ? editingSale.date : new Date().toISOString()
      };

      if (editingSale) {
        await updateStoreSale(editingSale.id, record, false);
        toast.success('Sales record updated.');
        setEditingSale(null);
      } else {
        await addStoreSale(record, false);
        toast.success('Sales record saved.');
      }
      setSalesData([{ id: Date.now(), productName: '', quantity: '', amount: '' }]);
      setSelectedStore('');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save sales record');
    }
  };

  const sendEmailReminder = (storeName) => {


    const SERVICE_ID = "service_y7lj1lk";
    const TEMPLATE_ID = "template_49vk3nm";
    const PUBLIC_KEY = "X5FofaqJcxk9CcT5z";
    const recipients = "orders@thengacoco.com";

    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 1);
    const monthName = prevDate.toLocaleString('default', { month: 'long' });
    const year = prevDate.getFullYear();

    const headerHtml = `
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #4f46e5;">
        <h1 style="color: #4f46e5; font-size: 32px; font-family: 'Georgia', serif; margin: 0; text-transform: uppercase; letter-spacing: 3px;">ThengaCoco</h1>
        <p style="color: #64748b; font-size: 14px; font-weight: bold; margin: 5px 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Monthly Sales Collection Reminder</p>
      </div>
    `;

    const bodyHtml = `
      <div style="font-size: 16px; font-family: sans-serif; line-height: 1.5; color: #334155;">
        <p>Dear Team,</p>
        <p>This is a reminder to collect the sales report for the store: <b>${storeName}</b> for the month of <b>${monthName} ${year}</b>.</p>
        <p>Please follow up with the store manager to collect the sales data and ensure it is entered into the system.</p>
        <br/>
        <p>Best Regards,<br/><b>Thenga Coco</b></p>
      </div>
    `;

    const templateParams = {
      to_email: recipients,
      from_name: "ThengaCoco Stock System",
      subject: `Reminder: Collect Monthly Sales for ${storeName}`,
      vendor_name: "Accounts Team",
      date: new Date().toLocaleDateString(),
      product_details: headerHtml + bodyHtml
    };

    emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
      .then((res) => {
        toast.success("Reminder email sent.");
        localStorage.setItem(`last_reminder_${storeName}`, new Date().toISOString());
        addStoreReminder({ storeName, date: new Date().toISOString(), type: 'EmailJS' });
      })
      .catch((err) => {
        console.error("Email send failure:", err);
        toast.error("Failed to send email. Opening default mail client instead.");
        // Fallback to mailto
        window.location.href = `mailto:${recipients}?subject=Reminder: Collect Monthly Sales for ${storeName}&body=Dear Accounts Team,%0D%0A%0D%0AThis is a reminder to collect the monthly sales report for ${storeName}.%0D%0A%0D%0ABest Regards,%0D%0AStock System`;
        localStorage.setItem(`last_reminder_${storeName}`, new Date().toISOString());
        addStoreReminder({ storeName, date: new Date().toISOString(), type: 'Mailto' });
      });
  };

  const filteredStores = Object.values(storeStockData).filter(store => 
    store.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Store size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Store Management</h2>
            <p className="text-sm text-slate-500">Track stock sent, sold, and balances for stores</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar whitespace-nowrap w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 flex-1 sm:flex-none ${activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Eye size={16} /> Overview
          </button>
          <button
            onClick={() => setActiveTab('enter-sales')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 flex-1 sm:flex-none ${activeTab === 'enter-sales' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <ClipboardList size={16} /> Enter Sales
          </button>
          <button
            onClick={() => setActiveTab('sales-summary')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 flex-1 sm:flex-none ${activeTab === 'sales-summary' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <BarChart2 size={16} /> Sales Summary
          </button>
          <button
            onClick={() => setActiveTab('manage-stores')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 flex-1 sm:flex-none ${activeTab === 'manage-stores' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Store size={16} /> Manage Stores
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search stores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 font-medium">Filter Month:</span>
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="py-2 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
              />
              {filterMonth && (
                <button
                  onClick={() => setFilterMonth('')}
                  className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                  title="Clear filter"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <Card className="overflow-hidden border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-500">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-bold">Store Name</th>
                    <th className="px-6 py-4 font-bold text-center">Total Sent</th>
                    <th className="px-6 py-4 font-bold text-center">Total Sold</th>
                    <th className="px-6 py-4 font-bold text-center">Balance Stock</th>
                    <th className="px-6 py-4 font-bold text-center">Prev Month Sales</th>
                    <th className="px-6 py-4 font-bold text-center">Last Reminder</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStores.map(store => (
                    <tr key={store.name} className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{store.name}</td>
                      <td className="px-6 py-4 text-center text-indigo-600 font-bold">{store.totalSent}</td>
                      <td className="px-6 py-4 text-center text-emerald-600 font-bold">{store.totalSold}</td>
                      <td className="px-6 py-4 text-center font-bold">
                        <span className={`px-2 py-1 rounded-full text-xs ${store.balance > 10 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {store.balance}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleReportStatus(store.name)}
                          className={`px-2 py-0.5 rounded-full text-xs font-bold transition-all ${store.hasSalesForPrevMonth ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                          title="Click to manually toggle status"
                        >
                          {store.hasSalesForPrevMonth ? 'Received' : 'Pending'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500 text-xs">
                        {getLastReminderDate(store.name)}
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-indigo-600 hover:bg-indigo-50"
                          onClick={() => {
                            Swal.fire({
                              title: `Stock Details for ${store.name}`,
                              html: `
                                <div class="text-left max-h-[400px] overflow-y-auto pr-2">
                                  <table class="w-full text-sm">
                                    <thead>
                                      <tr class="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                                        <th class="py-3 text-left font-bold">Product</th>
                                        <th class="py-3 text-center font-bold">Sent</th>
                                        <th class="py-3 text-center font-bold">Sold</th>
                                        <th class="py-3 text-center font-bold">Amount</th>
                                        <th class="py-3 text-center font-bold">Balance</th>
                                      </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-50">
                                      ${Object.entries(store.products).map(([name, p]) => `
                                        <tr class="hover:bg-slate-50/50 transition-colors">
                                          <td class="py-3 text-slate-800 font-medium">${name}</td>
                                          <td class="py-3 text-center text-indigo-600 font-bold">${p.sent}</td>
                                          <td class="py-3 text-center text-emerald-600 font-bold">${p.sold}</td>
                                          <td class="py-3 text-center text-slate-600 font-bold">₹${p.amount || 0}</td>
                                          <td class="py-3 text-center">
                                            <span class="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold ${p.balance > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}">
                                              ${p.balance}
                                            </span>
                                          </td>
                                        </tr>
                                      `).join('')}
                                    </tbody>
                                  </table>
                                </div>
                              `,
                              width: '650px',
                              customClass: {
                                popup: 'rounded-2xl border border-slate-100 shadow-xl',
                                title: 'text-xl font-bold text-slate-900 pt-6 px-6 text-left',
                                htmlContainer: 'px-6 py-4',
                                confirmButton: 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg transition-all text-sm',
                                actions: 'px-6 pb-6 pt-2 justify-end'
                              },
                              buttonsStyling: false,
                              confirmButtonText: 'Close'
                            });
                          }}
                        >
                          <Eye size={16} />
                        </Button>
                        {!store.hasSalesForPrevMonth && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-emerald-600 hover:bg-emerald-50"
                            onClick={() => sendEmailReminder(store.name)}
                            title="Send Email Reminder"
                          >
                            <Mail size={16} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredStores.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                        No stores found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : activeTab === 'enter-sales' ? (
        <Card className="border-indigo-100 bg-indigo-50/30">
          <div className="mb-4 flex items-center gap-2 text-indigo-600 font-bold">
            <ClipboardList size={18} />
            Enter Monthly Sales
          </div>
          <form onSubmit={handleSalesSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SearchableSelect
                label="Select Store"
                placeholder="Choose a store"
                options={stores.map(s => s.name)}
                value={selectedStore}
                onChange={setSelectedStore}
                required
              />
              <Input
                label="Month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                required
              />
            </div>

            <div className="border-t border-indigo-100 pt-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Product Sales</h4>
                <Button type="button" variant="ghost" onClick={handleAddProductRow} className="text-indigo-600 hover:bg-indigo-100/50">
                  <Plus size={16} className="mr-1" /> Add Product
                </Button>
              </div>

              <div className="space-y-3">
                {salesData.map((row) => (
                  <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white/40 p-3 rounded-lg border border-indigo-50 relative group">
                    <div className="md:col-span-5">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Product</label>
                        {selectedStore && row.productName && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getProductBalance(selectedStore, row.productName) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            Bal: {getProductBalance(selectedStore, row.productName)}
                          </span>
                        )}
                      </div>
                      <SearchableSelect
                        options={stock.map(s => s.name)}
                        value={row.productName}
                        onChange={(val) => handleUpdateProductRow(row.id, 'productName', val)}
                        required
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Input
                        label="Quantity Sold"
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => handleUpdateProductRow(row.id, 'quantity', e.target.value)}
                        required
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Input
                        label="Sales Amount"
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={row.amount}
                        onChange={(e) => handleUpdateProductRow(row.id, 'amount', e.target.value)}
                        required
                      />
                    </div>
                    <div className="md:col-span-1 flex justify-end pb-2">
                      {salesData.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveProductRow(row.id)}
                          className="p-2 text-rose-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-indigo-100">
              <div className="text-sm font-bold text-slate-700">
                Total Amount: <span className="text-indigo-600 text-lg">₹{salesData.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)}</span>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-lg transition-all flex items-center gap-2">
                  <Save size={18} /> Save Sales Data
                </Button>
              </div>
            </div>
          </form>
        </Card>
      ) : activeTab === 'sales-summary' ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by store or product..."
                value={summarySearch}
                onChange={(e) => setSummarySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 font-medium">Filter Month:</span>
              <input
                type="month"
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(e.target.value)}
                className="py-2 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
              />
              {summaryMonth && (
                <button
                  onClick={() => setSummaryMonth('')}
                  className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                  title="Clear filter"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase">Total Sales Amount</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">
                ₹{filteredSales.reduce((sum, sale) => sum + sale.products.reduce((s, p) => s + (Number(p.amount) || 0), 0), 0)}
              </div>
            </Card>
            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase">Total Products Sold</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {filteredSales.reduce((sum, sale) => sum + sale.products.reduce((s, p) => s + (Number(p.quantity) || 0), 0), 0)}
              </div>
            </Card>
            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase">Total Sales Records</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {filteredSales.length}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-500">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-bold">Month</th>
                    <th className="px-6 py-4 font-bold">Store</th>
                    <th className="px-6 py-4 font-bold">Products</th>
                    <th className="px-6 py-4 font-bold text-right">Total Amount</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(sale => (
                    <tr key={sale.id} className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{sale.month}</td>
                      <td className="px-6 py-4 font-medium text-slate-700">{sale.storeName}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {sale.products.map(p => `${p.productName || p.name} (${p.quantity})`).join(', ')}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">
                        ₹{sale.products.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)}
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button
                          onClick={() => handleEditSale(sale)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteSale(sale)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                        No sales records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="p-4 bg-white border-slate-200">
            <div className="flex gap-3">
              <Input
                placeholder="Enter store name..."
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={async () => {
                  if (!newStoreName.trim()) {
                    toast.error('Store name cannot be empty');
                    return;
                  }
                  try {
                    if (editingStoreId) {
                      await updateStore(editingStoreId, newStoreName.trim());
                      toast.success('Store updated');
                      setEditingStoreId(null);
                    } else {
                      await addStore(newStoreName.trim());
                      toast.success('Store added');
                    }
                    setNewStoreName('');
                  } catch (error) {
                    toast.error('Operation failed');
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {editingStoreId ? 'Update Store' : 'Add Store'}
              </Button>
              {editingStoreId && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingStoreId(null);
                    setNewStoreName('');
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-500">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-bold">Store Name</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map(store => (
                    <tr key={store.id} className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{store.name}</td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingStoreId(store.id);
                            setNewStoreName(store.name);
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => {
                            Swal.fire({
                              title: 'Are you sure?',
                              text: "You won't be able to revert this!",
                              icon: 'warning',
                              showCancelButton: true,
                              confirmButtonColor: '#4f46e5',
                              cancelButtonColor: '#ef4444',
                              confirmButtonText: 'Yes, delete it!'
                            }).then(async (result) => {
                              if (result.isConfirmed) {
                                try {
                                  await deleteStore(store.id);
                                  toast.success('Store deleted');
                                } catch (error) {
                                  toast.error('Failed to delete');
                                }
                              }
                            });
                          }}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StoreManagement;
