import React, { useState } from 'react';
import { Card, Input, Button, Table } from '../components/ui';
import { Plus, Trash2, Globe, Edit2, Check, X } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';

const Channels = () => {
  const { channels, addChannel, updateChannel, deleteChannel } = useGlobalState();
  const [newChannelName, setNewChannelName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleAddChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    
    if (channels.some(c => c.name.toLowerCase() === newChannelName.trim().toLowerCase())) {
      toast.error('This channel already exists.');
      return;
    }

    try {
      await addChannel(newChannelName.trim());
      setNewChannelName('');
      toast.success('Channel added!');
    } catch (err) {
      toast.error('Error adding channel');
    }
  };

  const startEdit = (channel) => {
    setEditingId(channel.id);
    setEditValue(channel.name);
  };

  const saveEdit = async (id) => {
    if (!editValue.trim()) return;
    
    if (channels.some(c => c.id !== id && c.name.toLowerCase() === editValue.trim().toLowerCase())) {
      toast.error('Another channel with this name already exists.');
      return;
    }

    try {
      await updateChannel(id, editValue.trim());
      setEditingId(null);
      setEditValue('');
      toast.success('Channel updated!');
    } catch (err) {
      toast.error('Error updating channel');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleDeleteChannel = async (id) => {
    if (window.confirm('Delete this channel?')) {
      try {
        await deleteChannel(id);
        toast.error('Channel removed.');
      } catch (err) {
        toast.error('Error deleting channel');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
          <Globe size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Channel Management</h2>
          <p className="text-sm text-slate-500">Manage sales channels and e-commerce platforms</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <div className="mb-4 flex items-center gap-2 text-indigo-600">
            <Plus size={18} />
            <h3 className="font-semibold">Add New Channel</h3>
          </div>
          <form onSubmit={handleAddChannel} className="space-y-4">
            <Input 
              label="Channel Name" 
              placeholder="e.g. Amazon US" 
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              required
            />
            <Button type="submit" className="w-full mt-2">
              Add Channel
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Active Channels</h3>
            <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
              Total: {channels.length}
            </span>
          </div>
          <Table headers={['ID', 'Name', 'Actions']}>
            {channels.map((item, index) => (
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
                      <button onClick={() => saveEdit(item.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Check size={18} />
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
                      <button onClick={() => handleDeleteChannel(item.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
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

export default Channels;
