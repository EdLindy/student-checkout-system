import { useState, useEffect } from 'react';
import { getCheckoutHistory, deleteCheckoutRecord, CheckoutLog } from '../lib/checkout-service';
import { History, Trash2 } from 'lucide-react';

export default function ActivityLog() {
  const [history, setHistory] = useState<CheckoutLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const data = await getCheckoutHistory();
      setHistory(data);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      await deleteCheckoutRecord(id);
      loadHistory();
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Failed to delete record');
    }
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  function formatDuration(checkout: string, returnTime: string | null) {
    if (!returnTime) return 'In Progress';
    
    const start = new Date(checkout);
    const end = new Date(returnTime);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center text-slate-500">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex items-center mb-6">
        <History className="w-8 h-8 text-blue-600 mr-3" />
        <h2 className="text-2xl font-bold text-slate-800">Activity Log</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Student</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Destination</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Checkout</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Return</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Duration</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {history.map((record) => (
              <tr key={record.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{record.students?.name}</div>
                  <div className="text-sm text-slate-500">Grade {record.students?.grade}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{record.destination}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {formatDateTime(record.checkout_time)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {record.return_time ? formatDateTime(record.return_time) : (
                    <span className="text-orange-600 font-medium">Out</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {formatDuration(record.checkout_time, record.return_time)}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(record.id)}
                    className="text-red-600 hover:text-red-700 transition-colors"
                    title="Delete record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
