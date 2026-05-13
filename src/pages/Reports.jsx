import React, { useState, useMemo } from 'react';
import { Card, Input, Select, Button, Table } from '../components/ui';
import { Download, Filter, FileSpreadsheet, Package, ShoppingCart, AlertCircle, RotateCcw } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import { exportFormattedGeneric } from '../utils/exportUtils';

const Reports = () => {
  const { stock, b2bShipments, b2cShipments, damageRecords, returnRecords, channels } = useGlobalState();
  const [activeTab, setActiveTab] = useState('shipments');
  
  // Filter states
  const [filter, setFilter] = useState({
    startDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().split('T')[0];
    })(),
    endDate: new Date().toISOString().split('T')[0],
    sku: 'All SKUs',
    channel: 'All Channels'
  });
  const [isExporting, setIsExporting] = useState(false);

  const tabs = [
    { id: 'shipments', label: 'Shipment Report' },
    { id: 'b2bPivot', label: 'B2B Sales Summary' },
    { id: 'b2cPivot', label: 'B2C Sales Summary' },
    { id: 'products', label: 'SKU Report' },
    { id: 'returns', label: 'Returns Report' },
    { id: 'damage', label: 'Damage Report' },
  ];

  // B2C Pivot Logic: Group by SKU and Channel
  const { b2cPivotData, activeChannels } = useMemo(() => {
    const activeB2C = b2cShipments.filter(s => {
      const dateMatch = (!filter.startDate || s.date >= filter.startDate) && 
                        (!filter.endDate || s.date <= filter.endDate);
      const isNotSample = s.channel?.toLowerCase() !== 'samples';
      return dateMatch && isNotSample;
    });

    // 1. Get unique channels from active shipments to ensure FBA and others are included
    const foundChannels = Array.from(new Set(activeB2C.map(s => s.channel || 'Unknown')))
      .filter(name => name.toLowerCase() !== 'samples')
      .sort();

    const results = stock.map(p => {
      const channelCounts = {};
      foundChannels.forEach(name => {
        channelCounts[name] = 0;
      });
      
      let rowTotal = 0;
      activeB2C.forEach(s => {
        let qtyForThisProduct = 0;
        (s.products || []).forEach(sp => {
           if (sp.name === p.name) {
             const ps = Number(sp.packSize) || Number(p.packSize) || 1;
             qtyForThisProduct += (Number(sp.quantity) || 0) * ps;
           } else {
             // Check if sp is a bundle containing p
             const bundle = stock.find(item => item.name === sp.name);
             if (bundle?.isComposite && bundle.components) {
               const comp = bundle.components.find(c => c.name === p.name);
               if (comp) {
                 qtyForThisProduct += (Number(sp.quantity) || 0) * (Number(comp.quantity) || 1);
               }
             }
           }
        });

        if (qtyForThisProduct > 0) {
          const channelName = s.channel || 'Unknown';
          channelCounts[channelName] = (channelCounts[channelName] || 0) + qtyForThisProduct;
          rowTotal += qtyForThisProduct;
        }
      });

      return {
        category: p.category || 'Other',
        sku: p.sku || '-',
        name: p.name,
        channels: channelCounts,
        total: rowTotal
      };
    });

    // 2. Identify channels which actually have sales in this filtered set
    const channelsWithSales = foundChannels.filter(name => 
      results.some(row => row.channels[name] > 0)
    );

    // 3. Filter products that have sales in selected period OR if specifically filtered
    const filteredResults = results.filter(row => {
      const hasSales = row.total > 0;
      const skuMatch = filter.sku === 'All SKUs' || row.name === filter.sku;
      return hasSales && skuMatch;
    }).sort((a, b) => b.total - a.total);

    return { b2cPivotData: filteredResults, activeChannels: channelsWithSales };
  }, [stock, b2cShipments, channels, filter.startDate, filter.endDate, filter.sku]);

  // B2B Sales Summary Logic: Group by Product
  const b2bPivotData = useMemo(() => {
    const totals = {};
    
    b2bShipments.forEach(s => {
      const dateMatch = (!filter.startDate || s.date >= filter.startDate) && 
                        (!filter.endDate || s.date <= filter.endDate);
      if (!dateMatch) return;

      (s.products || []).forEach(p => {
        // Direct match
        const masterSKU = stock.find(item => item.name === p.name);
        const ps = Number(p.packSize) || Number(masterSKU?.packSize) || 1;
        const shipmentQty = (Number(p.quantity) || 0) * ps;

        if (masterSKU?.isComposite && masterSKU.components) {
          // If it's a bundle, add to its components instead
          masterSKU.components.forEach(comp => {
            totals[comp.name] = (totals[comp.name] || 0) + (shipmentQty * (Number(comp.quantity) || 1));
          });
        } else {
          // Normal product
          totals[p.name] = (totals[p.name] || 0) + shipmentQty;
        }
      });
    });

    return stock
      .filter(p => !p.isComposite)
      .map(p => ({
        sku: p.sku || '-',
        name: p.name,
        total: totals[p.name] || 0
      }))
      .filter(row => {
        const hasSales = row.total > 0;
        const skuMatch = filter.sku === 'All SKUs' || row.name === filter.sku;
        return hasSales && skuMatch;
      })
      .sort((a, b) => b.total - a.total);
  }, [stock, b2bShipments, filter.startDate, filter.endDate, filter.sku]);

  // Combined shipments for the shipments report
  const allShipments = useMemo(() => {
    const b2b = b2bShipments.map(s => ({ ...s, type: 'B2B', displayChannel: s.courier || 'N/A' }));
    const b2c = b2cShipments.map(s => ({ ...s, type: 'B2C', displayChannel: s.channel || 'N/A' }));
    return [...b2b, ...b2c].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [b2bShipments, b2cShipments]);

  // Apply filters
  const filteredShipments = useMemo(() => {
    return allShipments.filter(s => {
      const dateMatch = (!filter.startDate || s.date >= filter.startDate) && 
                        (!filter.endDate || s.date <= filter.endDate);
      const skuMatch = filter.sku === 'All SKUs' || 
                           (s.products || []).some(p => p.name === filter.sku);
      const channelMatch = filter.channel === 'All Channels' || 
                           (s.type === 'B2B' && filter.channel === 'B2B Shipments') ||
                           (s.type === 'B2C' && filter.channel === 'B2C Shipments') ||
                           (s.type === 'B2C' && s.channel === filter.channel);
      return dateMatch && skuMatch && channelMatch;
    });
  }, [allShipments, filter]);

  const filteredDamages = useMemo(() => {
    return damageRecords.filter(d => {
      const dateMatch = (!filter.startDate || d.date >= filter.startDate) && 
                        (!filter.endDate || d.date <= filter.endDate);
      const skuMatch = filter.sku === 'All SKUs' || d.productName === filter.sku;
      return dateMatch && skuMatch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [damageRecords, filter]);

  const filteredReturns = useMemo(() => {
    return returnRecords.filter(r => {
      const dateMatch = (!filter.startDate || r.date >= filter.startDate) && 
                        (!filter.endDate || r.date <= filter.endDate);
      const skuMatch = filter.sku === 'All SKUs' || r.productName === filter.sku;
      const channelMatch = filter.channel === 'All Channels' || r.channel === filter.channel;
      return dateMatch && skuMatch && channelMatch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [returnRecords, filter]);

  const productStats = useMemo(() => {
    return stock.filter(p => !p.isComposite).map(p => {
      const b2bQty = b2bShipments.reduce((sum, s) => {
        let direct = 0;
        (s.products || []).forEach(sp => {
          if (sp.name === p.name) {
            const ps = Number(sp.packSize) || Number(p.packSize) || 1;
            direct += (Number(sp.quantity) || 0) * ps;
          } else {
            // Check if sp is a bundle containing p
            const bundle = stock.find(item => item.name === sp.name);
            if (bundle?.isComposite && bundle.components) {
              const comp = bundle.components.find(c => c.name === p.name);
              if (comp) {
                // Bundle quantity * component quantity per bundle
                direct += (Number(sp.quantity) || 0) * (Number(comp.quantity) || 1);
              }
            }
          }
        });
        return sum + direct;
      }, 0);
      
      const b2cQty = b2cShipments.reduce((sum, s) => {
        let direct = 0;
        (s.products || []).forEach(sp => {
          if (sp.name === p.name) {
            const ps = Number(sp.packSize) || Number(p.packSize) || 1;
            direct += (Number(sp.quantity) || 0) * ps;
          } else {
            // Check if sp is a bundle containing p
            const bundle = stock.find(item => item.name === sp.name);
            if (bundle?.isComposite && bundle.components) {
              const comp = bundle.components.find(c => c.name === p.name);
              if (comp) {
                direct += (Number(sp.quantity) || 0) * (Number(comp.quantity) || 1);
              }
            }
          }
        });
        return sum + direct;
      }, 0);

      const returnsQty = returnRecords.reduce((sum, r) => {
        return sum + (r.productName === p.name ? Number(r.quantity) : 0);
      }, 0);

      const totalDispatched = b2bQty + b2cQty;
      const currentStock = Number(p.opening) + Number(p.in) - (b2bQty + b2cQty) - Number(p.damage); 
      const status = currentStock < 10 ? 'Low Stock' : 'Healthy';

      return {
        name: p.name,
        sku: p.sku || 'N/A',
        totalDispatched,
        b2bQty,
        b2cQty,
        returnsQty,
        status,
        currentStock
      };
    }).sort((a, b) => b.totalDispatched - a.totalDispatched);
  }, [stock, b2bShipments, b2cShipments, returnRecords]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let dataToExport = [];
      let title = '';
      let fileName = '';

      if (activeTab === 'shipments') {
        dataToExport = filteredShipments.map(s => ({
          Date: s.date,
          Type: s.type,
          Channel: s.type === 'B2B' ? s.whoParceled : s.channel,
          Products: (s.products || []).map(p => `${p.name} (${p.quantity})`).join(', '),
          TotalUnits: s.products.reduce((sum, p) => {
            const master = stock.find(item => item.name === p.name);
            const ps = Number(p.packSize) || Number(master?.packSize) || 1;
            return sum + (Number(p.quantity) * ps);
          }, 0)
        }));
        title = 'DISPATCH LOG — SHIPMENTS';
        fileName = `shipments_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      } else if (activeTab === 'b2cPivot') {
        dataToExport = b2cPivotData.map(row => {
          const rowData = {
            Category: row.category,
            SKU: row.sku,
            Product: row.name
          };
          activeChannels.forEach(c => {
            rowData[c.toUpperCase()] = row.channels[c] || 0;
          });
          rowData.TOTAL = row.total;
          return rowData;
        });
        title = 'B2C SALES SUMMARY — PIVOT';
        fileName = `b2c_sales_summary_${new Date().toISOString().split('T')[0]}.xlsx`;
      } else if (activeTab === 'b2bPivot') {
        dataToExport = b2bPivotData.map(row => ({
          SKU: row.sku,
          Product: row.name,
          TotalUnits: row.total
        }));
        title = 'B2B SALES SUMMARY';
        fileName = `b2b_sales_summary_${new Date().toISOString().split('T')[0]}.xlsx`;
      } else if (activeTab === 'products') {
        dataToExport = productStats.map(p => ({
          SKUName: p.name,
          TotalDispatched: p.totalDispatched,
          B2BUnits: p.b2bQty,
          B2CUnits: p.b2cQty,
          ReturnUnits: p.returnsQty,
          CurrentStock: p.currentStock,
          Status: p.status
        }));
        title = 'SKU MASTER HEALTH REPORT';
        fileName = `sku_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      } else if (activeTab === 'damage') {
        dataToExport = filteredDamages.map(d => ({
          Date: d.date,
          SKU: d.productName,
          Quantity: d.quantity,
          Reason: d.reason || 'N/A'
        }));
        title = 'DAMAGE LOG';
        fileName = `damage_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      } else if (activeTab === 'returns') {
        dataToExport = filteredReturns.map(r => ({
          Date: r.date,
          Channel: r.channel,
          SKU: r.productName,
          Quantity: r.quantity,
          Reason: r.reason || 'N/A'
        }));
        title = 'RETURNS LOG';
        fileName = `returns_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      }

      exportFormattedGeneric(dataToExport, title, fileName);
    } finally {
      setIsExporting(false);
    }
  };

  const skuOptions = ['All SKUs', ...stock.map(p => p.name)];
  const channelOptions = ['All Channels', 'B2B Shipments', 'B2C Shipments', ...channels.map(c => c.name)];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Reports Dashboard</h2>
          <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wider font-medium">Operations Analytics & Data Export</p>
        </div>
        <Button onClick={handleExport} variant="success" className="w-full lg:w-auto shrink-0 flex items-center justify-center gap-2 shadow-lg shadow-emerald-50 h-10 px-6 text-xs font-bold" loading={isExporting}>
          <Download size={16} /> Export {tabs.find(t => t.id === activeTab)?.label}
        </Button>
      </div>

      <Card className="p-4 bg-white border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-indigo-600 font-bold text-xs uppercase tracking-widest">
          <Filter size={16} />
          Report Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input 
            label="Start Date" 
            type="date" 
            value={filter.startDate}
            onChange={(e) => setFilter({...filter, startDate: e.target.value})}
            className="text-xs"
          />
          <Input 
            label="End Date" 
            type="date" 
            value={filter.endDate}
            onChange={(e) => setFilter({...filter, endDate: e.target.value})}
            className="text-xs"
          />
          <Select 
            label="SKU" 
            options={skuOptions} 
            value={filter.sku}
            onChange={(e) => setFilter({...filter, sku: e.target.value})}
            className="text-xs"
          />
          <Select 
            label="Channel" 
            options={channelOptions} 
            value={filter.channel}
            onChange={(e) => setFilter({...filter, channel: e.target.value})}
            className="text-xs"
          />
        </div>
      </Card>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex border-b border-slate-100 bg-slate-50/50 overflow-x-auto scrollbar-hide whitespace-nowrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-sm font-medium transition-colors inline-block ${
                activeTab === tab.id 
                  ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-0">
          {activeTab === 'b2cPivot' && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 sticky left-0 bg-slate-50 z-10">Category</th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 sticky left-[120px] bg-slate-50 z-10">SKU</th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">Product</th>
                    {activeChannels.map(c => (
                      <th key={c} className="py-3 px-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 min-w-[100px]">
                        {c}
                      </th>
                    ))}
                    <th className="py-3 px-4 text-center text-xs font-bold text-slate-900 uppercase tracking-wider bg-indigo-50/50">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b2cPivotData.length === 0 ? (
                    <tr>
                      <td colSpan={activeChannels.length + 4} className="py-12 text-center text-slate-400">No sales records found for this period.</td>
                    </tr>
                  ) : (
                    b2cPivotData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-slate-600 border-r border-slate-100 bg-emerald-50/20 sticky left-0 z-1 min-w-[100px]">{row.category}</td>
                        <td className="py-3 px-4 text-sm font-mono text-indigo-600 border-r border-slate-100 bg-rose-50/20 sticky left-[120px] z-1 min-w-[100px]">{row.sku || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-800 border-r border-slate-100 min-w-[250px] bg-blue-50/10 leading-relaxed">{row.name}</td>
                        {activeChannels.map(c => (
                          <td key={c} className={`py-3 px-4 text-center text-sm border-r border-slate-100 ${row.channels[c] > 0 ? 'font-bold text-slate-900 bg-emerald-50/30' : 'text-slate-300'}`}>
                            {row.channels[c]}
                          </td>
                        ))}
                        <td className="py-3 px-4 text-center text-sm font-bold text-slate-900 bg-indigo-50/30">{row.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'b2bPivot' && (
            <Table headers={['SKU Code', 'Product Name', 'Total Quantity Dispatched']}>
              {b2bPivotData.length === 0 ? (
                <tr>
                  <td colSpan="3" className="py-12 text-center text-slate-400">No B2B sales records found for this period.</td>
                </tr>
              ) : (
                b2bPivotData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 text-sm font-mono font-bold text-indigo-600">{row.sku}</td>
                    <td className="py-4 px-6 text-sm font-semibold text-slate-900 leading-relaxed">{row.name}</td>
                    <td className="py-4 px-6 text-sm font-bold text-slate-900">
                      <span className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full font-bold">
                        {row.total} units
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </Table>
          )}

          {activeTab === 'shipments' && (
            <Table headers={['Date', 'Type', 'Channel / Orders', 'Shipment Details']}>
              {filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-400">No shipments found for the current filters.</td>
                </tr>
              ) : (
                filteredShipments.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 text-sm text-slate-800 whitespace-nowrap">{s.date}</td>
                    <td className="py-4 px-6 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                        s.type === 'B2B' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {s.type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <div className="font-bold text-slate-900 leading-tight">
                        {s.type === 'B2B' ? s.clientName : s.channel}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        Orders: <span className="text-slate-900">{s.orderCount || '1'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <div className="overflow-x-auto max-w-[500px]">
                        <div className="min-w-[450px]">
                        {/* Internal Header */}
                        <div className="grid grid-cols-[1fr,60px,60px,60px] gap-2 mb-2 px-2 py-1 bg-slate-50 rounded text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>Product</span>
                          <span className="text-center">Qty</span>
                          <span className="text-center">Pack</span>
                          <span className="text-center">Total</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {(s.products || []).map((p, idx) => {
                            const masterSKU = stock.find(item => item.name === p.name);
                            const ps = Number(p.packSize) || Number(masterSKU?.packSize) || 1;
                            return (
                              <div key={idx} className="grid grid-cols-[1fr,60px,60px,60px] gap-2 items-center px-2 py-2 border-b border-slate-100 last:border-0 hover:bg-white rounded transition-colors group">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1 rounded shrink-0 border border-emerald-100">{masterSKU?.sku || 'N/A'}</span>
                                  <span className="font-medium text-slate-800 break-words line-clamp-2" title={p.name}>{p.name}</span>
                                </div>
                                <div className="text-center font-bold text-slate-900">{p.quantity}</div>
                                <div className="text-center text-slate-400 font-medium">{ps}</div>
                                <div className="text-center font-bold text-indigo-600 bg-indigo-50/50 py-0.5 rounded">{Number(p.quantity) * ps}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </td>
                  </tr>
                ))
              )}
            </Table>
          )}

          {activeTab === 'products' && (
            <Table headers={['SKU Code', 'Product Name', 'Total Dispatched', 'B2B Qty', 'B2C Qty', 'Returns Qty', 'Stock Status']}>
              {productStats.map(p => (
                <tr key={p.name} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6 text-sm font-mono font-bold text-indigo-600">{p.sku}</td>
                  <td className="py-4 px-6 text-sm font-semibold text-slate-900 leading-relaxed min-w-[200px]">{p.name}</td>
                  <td className="py-4 px-6 text-sm font-bold text-slate-800">{p.totalDispatched}</td>
                  <td className="py-4 px-6 text-sm font-medium text-indigo-600">{p.b2bQty}</td>
                  <td className="py-4 px-6 text-sm font-medium text-emerald-600">{p.b2cQty}</td>
                  <td className="py-4 px-6 text-sm font-medium text-rose-600">{p.returnsQty}</td>
                  <td className="py-4 px-6 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                      p.status === 'Healthy' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </Table>
          )}

          {activeTab === 'returns' && (
            <Table headers={['Date', 'Channel', 'SKU Name', 'Quantity', 'Reason']}>
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400">No return records found for the current filters.</td>
                </tr>
              ) : (
                filteredReturns.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 text-sm text-slate-800">{r.date}</td>
                    <td className="py-4 px-6 text-sm font-semibold text-slate-900">{r.channel}</td>
                    <td className="py-4 px-6 text-sm text-slate-600 leading-relaxed min-w-[200px]">{r.productName}</td>
                    <td className="py-4 px-6 text-sm text-emerald-600 font-bold">+{r.quantity}</td>
                    <td className="py-4 px-6 text-sm text-slate-600">{r.reason || 'N/A'}</td>
                  </tr>
                ))
              )}
            </Table>
          )}

          {activeTab === 'damage' && (
            <Table headers={['Date', 'SKU Name', 'Quantity', 'Reason Category']}>
              {filteredDamages.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-400">No damage records found for the current filters.</td>
                </tr>
              ) : (
                filteredDamages.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 text-sm text-slate-800">{d.date}</td>
                    <td className="py-4 px-6 text-sm font-semibold text-slate-900">{d.productName}</td>
                    <td className="py-4 px-6 text-sm text-rose-600 font-bold">{d.quantity}</td>
                    <td className="py-4 px-6 text-sm text-slate-600">{d.reason || 'N/A'}</td>
                  </tr>
                ))
              )}
            </Table>
          )}
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-full shadow-sm text-indigo-600">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h4 className="font-semibold text-indigo-900">Need advanced analytics?</h4>
            <p className="text-sm text-indigo-700 mt-1">Export raw data to Excel for custom pivot tables and charts.</p>
          </div>
        </div>
        <Button variant="success" className="shrink-0 w-full sm:w-auto shadow-lg shadow-emerald-50" onClick={handleExport} loading={isExporting}>
          Download All Raw Data
        </Button>
      </div>
    </div>
  );
};

export default Reports;
