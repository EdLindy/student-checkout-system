import { useState, useEffect, useMemo } from 'react';
import { getCheckoutHistory, deleteCheckoutRecord, type CheckoutLog } from '../lib/checkout-service';
import { History, Trash2 } from 'lucide-react';

export default function ActivityLog() {
  const [history, setHistory] = useState<CheckoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

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

  function formatDateTime(dateString: string | undefined | null) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
  }

  function formatDuration(checkout: string | undefined | null, returnTime: string | undefined | null) {
    if (!returnTime) return 'In Progress';

    const start = new Date(checkout || '');
    const end = new Date(returnTime);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  }

  const filteredHistory = useMemo(() => {
    if (!startDate && !endDate) return history;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return history.filter((rec) => {
      const t = rec.checkout_time ? new Date(rec.checkout_time) : null;
      if (!t) return false;
      if (start && t < start) return false;
      if (end) {
        // include end day entire day
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        if (t > endOfDay) return false;
      }
      return true;
    });
  }, [history, startDate, endDate]);

  async function exportPdf() {
    const rows = filteredHistory.map((record) => ({
      student: record.student_name || record.students?.name || '',
      destination: record.destination_name || (typeof record.destination === 'string' ? record.destination : record.destination?.name ?? ''),
      checkout: record.checkout_time || '',
      return: record.checkin_time || '',
      duration: formatDuration(record.checkout_time || null, record.checkin_time || null)
    }));

    try {
      const res = await fetch('/.netlify/functions/generate-activity-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to generate PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'activity-log.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF. See console for details.');
    }
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

      <div className="mb-4 flex items-center gap-4">
        <div>
          <label className="text-sm text-slate-600 mr-2">Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="text-sm text-slate-600 mr-2">End date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border px-2 py-1 rounded" />
        </div>
        <div className="ml-auto">
          <button onClick={exportPdf} className="bg-blue-600 text-white px-4 py-2 rounded">Print / Download PDF</button>
        </div>
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
            {filteredHistory.map((record) => (
              <tr key={record.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{record.student_name ?? record.students?.name}</div>
                  <div className="text-sm text-slate-500">Grade {record.class_name ?? record.students?.grade}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {record.destination_name ?? (typeof record.destination === 'string' ? record.destination : record.destination?.name ?? '')}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {formatDateTime(record.checkout_time ?? '')}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {record.checkin_time ? formatDateTime(record.checkin_time) : (
                    <span className="text-orange-600 font-medium">Out</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {formatDuration(record.checkout_time ?? '', record.checkin_time ?? null)}
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
