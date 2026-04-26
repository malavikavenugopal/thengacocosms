import React, { useState } from 'react';
import { Card, Input, Button, Table } from '../components/ui';
import { Plus, Trash2, Truck, Edit2, Check, X } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

const Couriers = () => {
  const { couriers, addCourier, updateCourier, deleteCourier } = useGlobalState();
  const [newCourierName, setNewCourierName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddCourier = async (e) => {
    e.preventDefault();
    if (!newCourierName.trim()) return;
    
    if (couriers.some(c => c.name.toLowerCase() === newCourierName.trim().toLowerCase())) {
      toast.error('This courier already exists.');
      return;
    }

    setIsAdding(true);
    try {
      await addCourier(newCourierName.trim());
      setNewCourierName('');
      toast.success('Courier added!');
    } catch (err) {
      toast.error('Error adding courier');
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (courier) => {
    setEditingId(courier.id);
    setEditValue(courier.name);
  };

  const saveEdit = async (id) => {
    if (!editValue.trim()) return;
    
    if (couriers.some(c => c.id !== id && c.name.toLowerCase() === editValue.trim().toLowerCase())) {
      toast.error('Another courier with this name already exists.');
      return;
    }

    setIsSaving(true);
    try {
      await updateCourier(id, editValue.trim());
      setEditingId(null);
      setEditValue('');
      toast.success('Courier updated!');
    } catch (err) {
      toast.error('Error updating courier');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleDeleteCourier = async (id) => {
    Swal.fire({
      title: 'Remove Courier Partner?',
      text: "This partner will no longer appear in the shipment options.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Yes, delete it'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteCourier(id);
          toast.error('Courier removed.');
        } catch (err) {
          toast.error('Error deleting courier');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
          <Truck size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Courier Management</h2>
          <p className="text-sm text-slate-500">Manage shipping partners and courier services</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <div className="mb-4 flex items-center gap-2 text-indigo-600">
            <Plus size={18} />
            <h3 className="font-semibold">Add Courier Partner</h3>
          </div>
          <form onSubmit={handleAddCourier} className="space-y-4">
            <Input 
              label="Courier Name" 
              placeholder="e.g. BlueDart Express" 
              value={newCourierName}
              onChange={(e) => setNewCourierName(e.target.value)}
              required
            />
            <Button type="submit" className="w-full mt-2" loading={isAdding}>
              Add Courier
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Active Partners</h3>
            <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
              Total: {couriers.length}
            </span>
          </div>
          <Table headers={['Partner ID', 'Courier Name', 'Actions']}>
            {couriers.map((item, index) => (
              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-500 whitespace-nowrap w-32">
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono">COUR-{index + 101}</span>
                </td>
                <td className="py-4 px-6 text-sm font-semibold text-slate-900 w-full">
                  {editingId === item.id ? (
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(item.id)}
                      autoFocus
                    />
                  ) : (
                    <span>{item.name}</span>
                  )}
                </td>
                <td className="py-4 px-6 text-sm whitespace-nowrap text-right">
                  {editingId === item.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => saveEdit(item.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-50" disabled={isSaving}>
                        {isSaving ? <span className="animate-spin text-sm">...</span> : <Check size={18} />}
                      </button>
                      <button onClick={cancelEdit} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDeleteCourier(item.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default Couriers;
