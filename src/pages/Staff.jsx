import React, { useState } from 'react';
import { Card, Input, Button, Table } from '../components/ui';
import { Plus, Trash2, Users, Edit2, Check, X } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

const Staff = () => {
  const { staff, addStaffMember, updateStaffMember, deleteStaffMember } = useGlobalState();
  const [newStaffName, setNewStaffName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    
    if (staff.some(s => s.name.toLowerCase() === newStaffName.trim().toLowerCase())) {
      toast.error('This name already exists.');
      return;
    }

    setIsAdding(true);
    try {
      await addStaffMember(newStaffName.trim());
      setNewStaffName('');
      toast.success('Staff added!');
    } catch (err) {
      toast.error('Error adding staff');
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (person) => {
    setEditingId(person.id);
    setEditValue(person.name);
  };

  const saveEdit = async (id) => {
    if (!editValue.trim()) return;
    
    if (staff.some(s => s.id !== id && s.name.toLowerCase() === editValue.trim().toLowerCase())) {
      toast.error('Another person with this name already exists.');
      return;
    }

    setIsSaving(true);
    try {
      await updateStaffMember(id, editValue.trim());
      setEditingId(null);
      setEditValue('');
      toast.success('Updated successfully!');
    } catch (err) {
      toast.error('Error updating staff');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleDeleteStaff = async (id) => {
    Swal.fire({
      title: 'Remove Staff Member?',
      text: "This person will no longer appear in the 'Parceled By' list.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Yes, delete it'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteStaffMember(id);
          toast.error('Staff removed.');
        } catch (err) {
          toast.error('Error deleting staff');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
          <Users size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Staff Management</h2>
          <p className="text-sm text-slate-500">Manage the list of people responsible for parceling</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <div className="mb-4 flex items-center gap-2 text-indigo-600">
            <Plus size={18} />
            <h3 className="font-semibold">Add New Staff</h3>
          </div>
          <form onSubmit={handleAddStaff} className="space-y-4">
            <Input 
              label="Staff Name" 
              placeholder="e.g. John Doe" 
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              required
            />
            <Button type="submit" className="w-full mt-2" loading={isAdding}>
              Add Staff
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Active Staff</h3>
            <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
              Total: {staff.length}
            </span>
          </div>
          <Table headers={['ID', 'Name', 'Actions']}>
            {staff.map((item, index) => (
              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-500 whitespace-nowrap w-16">#{index + 1}</td>
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
                        {isSaving ? <span className="animate-spin text-xs">...</span> : <Check size={18} />}
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
                      <button onClick={() => handleDeleteStaff(item.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
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

export default Staff;
