import { useState, useEffect, useMemo, useCallback, useRef, type ChangeEvent } from 'react';
import {
  getCheckoutHistory,
  getFullCheckoutHistory,
  deleteCheckoutRecord,
  deleteCheckoutRecords,
  clearCheckoutHistory,
  type CheckoutLog
} from '../lib/checkout-service';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { History, Trash2 } from 'lucide-react';

export default function ActivityLog() {
  const [history, setHistory] = useState<CheckoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const classPickerRef = useRef<HTMLDivElement | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const data = await getCheckoutHistory();
      setHistory(data);
      setSelectedRecordIds([]);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClasses = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('students').select('class_name').order('class_name');
      if (error) throw error;

      const unique = Array.from(
        new Set(
          (data || [])
            .map((row) => (row.class_name ? String(row.class_name).trim() : ''))
            .filter((val) => val.length > 0)
        )
      );

      setClasses(unique);
      setSelectedClasses((previous) => previous.filter((cls) => unique.includes(cls)));
    } catch (error) {
      console.error('Failed to load classes for filter', error);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadClasses();
  }, [loadHistory, loadClasses]);

  useEffect(() => {
    if (!showClassPicker) return;
    function handleClick(event: MouseEvent) {
      if (!classPickerRef.current) return;
      if (!classPickerRef.current.contains(event.target as Node)) {
        setShowClassPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showClassPicker]);

  useEffect(() => {
    const channel = supabase
      .channel('activity-log-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkout_log' }, () => {
        loadHistory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadHistory]);

  const filteredHistory = useMemo(() => {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    const classSet =
      selectedClasses.length > 0
        ? new Set(selectedClasses.map((cls) => cls.trim().toLowerCase()))
        : null;

    return history.filter((rec) => {
      const t = rec.checkout_time ? new Date(rec.checkout_time) : null;
      if (!t) return false;
      if (start && t < start) return false;
      if (end) {
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        if (t > endOfDay) return false;
      }

      if (classSet) {
        const recClass = (rec.class_name ?? rec.students?.class_name ?? '').trim().toLowerCase();
        if (!classSet.has(recClass)) return false;
      }

      return true;
    });
  }, [history, startDate, endDate, selectedClasses]);

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      await deleteCheckoutRecord(id);
      setSelectedRecordIds((prev) => prev.filter((selectedId) => selectedId !== id));
      loadHistory();
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Failed to delete record');
    }
  }

  function toggleRecordSelection(id: string, checked: boolean) {
    setSelectedRecordIds((previous) => {
      if (checked) {
        if (previous.includes(id)) return previous;
        return [...previous, id];
      }
      return previous.filter((recordId) => recordId !== id);
    });
  }

  const visibleRecordIds = useMemo(() => filteredHistory.map((record) => record.id), [filteredHistory]);
  const allVisibleSelected =
    visibleRecordIds.length > 0 && visibleRecordIds.every((id) => selectedRecordIds.includes(id));

  function toggleSelectVisible() {
    if (allVisibleSelected) {
      setSelectedRecordIds((previous) => previous.filter((id) => !visibleRecordIds.includes(id)));
      return;
    }
    setSelectedRecordIds((previous) => {
      const merged = new Set(previous);
      visibleRecordIds.forEach((id) => merged.add(id));
      return Array.from(merged);
    });
  }

  async function handleDeleteSelected() {
    if (selectedRecordIds.length === 0) return;
    if (!confirm(`Delete ${selectedRecordIds.length} selected record${selectedRecordIds.length > 1 ? 's' : ''}?`)) {
      return;
    }
    setBulkDeleting(true);
    try {
      await deleteCheckoutRecords(selectedRecordIds);
      setSelectedRecordIds([]);
      await loadHistory();
    } catch (error) {
      console.error('Failed to delete selected records:', error);
      alert('Failed to delete selected records.');
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleDeleteAll() {
    if (!history.length) return;
    if (
      !confirm(
        'This will permanently delete every activity log record. Are you sure you want to continue?'
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    try {
      await clearCheckoutHistory();
      setSelectedRecordIds([]);
      await loadHistory();
    } catch (error) {
      console.error('Failed to delete all records:', error);
      alert('Failed to delete all records.');
    } finally {
      setBulkDeleting(false);
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

  function sortByClassOrder(values: string[]) {
    const orderMap = new Map(classes.map((cls, index) => [cls, index]));
    return [...values].sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0));
  }

  function handleToggleClass(event: ChangeEvent<HTMLInputElement>) {
    const { value, checked } = event.target;
    setSelectedClasses((previous) => {
      if (checked) {
        if (previous.includes(value)) return previous;
        return sortByClassOrder([...previous, value]);
      }
      return previous.filter((cls) => cls !== value);
    });
  }

  function handleSelectAllClasses() {
    setSelectedClasses(sortByClassOrder(classes));
  }

  function handleClearClasses() {
    setSelectedClasses([]);
  }

  function handleRemoveClass(className: string) {
    setSelectedClasses((previous) => previous.filter((cls) => cls !== className));
  }

  async function exportXlsx() {
    setExporting(true);

    try {
      const hasFilters = Boolean(startDate || endDate || selectedClasses.length > 0);
      const rows: CheckoutLog[] = hasFilters ? filteredHistory : await getFullCheckoutHistory();

      if (rows.length === 0) {
        alert('No records match the selected filters.');
        return;
      }

      const exportRows = rows.map((record) => ({
        Student: record.student_name || record.students?.name || '',
        Class: record.class_name || record.students?.class_name || '',
        Destination:
          record.destination_name ||
          (typeof record.destination === 'string'
            ? record.destination
            : record.destination?.name || ''),
        Checkout: record.checkout_time ? formatDateTime(record.checkout_time) : '',
        Return: record.checkin_time ? formatDateTime(record.checkin_time) : '',
        Duration: formatDuration(record.checkout_time ?? '', record.checkin_time ?? null)
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity Log');
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'activity-log.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('XLSX export failed:', err);
      alert('Failed to generate XLSX. See console for details.');
    } finally {
      setExporting(false);
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

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-sm text-slate-600 mr-2">Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="text-sm text-slate-600 mr-2">End date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border px-2 py-1 rounded" />
        </div>
        <div className="flex flex-col min-w-[200px] relative" ref={classPickerRef}>
          <span className="text-sm text-slate-600 mb-1">Room 305</span>
          <button
            type="button"
            onClick={() => setShowClassPicker((prev) => !prev)}
            className="border border-slate-300 px-4 py-2 rounded-lg bg-white text-sm text-slate-700 hover:border-blue-400 transition"
          >
            Room 305
            <span className="ml-2 text-xs text-slate-500">
              {selectedClasses.length === 0 ? 'All classes' : `${selectedClasses.length} selected`}
            </span>
          </button>
          {showClassPicker && (
            <div className="absolute mt-2 z-20 bg-white border border-slate-200 rounded-xl shadow-lg w-64 max-h-64 overflow-hidden">
              <div className="max-h-44 overflow-y-auto px-3 py-2">
                {classes.length === 0 && <div className="text-sm text-slate-500">Loading classes…</div>}
                {classes.map((className) => (
                  <label key={className} className="flex items-center gap-2 text-sm text-slate-700 py-1">
                    <input
                      type="checkbox"
                      value={className}
                      checked={selectedClasses.includes(className)}
                      onChange={handleToggleClass}
                      className="accent-blue-600"
                    />
                    <span>{className}</span>
                  </label>
                ))}
              </div>
              <div className="border-t border-slate-100 flex items-center justify-between px-3 py-2 text-xs text-slate-600">
                <button
                  type="button"
                  onClick={handleSelectAllClasses}
                  className="text-blue-600 font-semibold disabled:opacity-50"
                  disabled={classes.length === 0}
                >
                  Select All
                </button>
                <button type="button" onClick={handleClearClasses} className="text-slate-500">
                  Clear
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-2">
            {selectedClasses.length === 0
              ? 'Room 305 is showing all classes.'
              : `${selectedClasses.length} class${selectedClasses.length > 1 ? 'es' : ''} filtered.`}
          </p>
          {selectedClasses.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedClasses.map((className) => (
                <span key={className} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
                  {className}
                  <button
                    type="button"
                    onClick={() => handleRemoveClass(className)}
                    className="text-blue-600 hover:text-blue-800"
                    aria-label={`Remove ${className}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="ml-auto">
          <button
            onClick={exportXlsx}
            disabled={exporting}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {exporting ? 'Preparing…' : 'Download .xlsx'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-slate-600">
        <div>
          {selectedRecordIds.length > 0
            ? `${selectedRecordIds.length} record${selectedRecordIds.length > 1 ? 's' : ''} selected.`
            : 'No records selected.'}
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={toggleSelectVisible}
            className="px-3 py-1.5 border border-slate-300 rounded text-xs uppercase tracking-wide"
            disabled={visibleRecordIds.length === 0}
          >
            {allVisibleSelected ? 'Clear Visible' : 'Select Visible'}
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedRecordIds.length === 0 || bulkDeleting}
            className="px-3 py-1.5 border border-red-300 text-red-600 rounded text-xs uppercase tracking-wide disabled:opacity-50"
          >
            Delete Selected
          </button>
          <button
            type="button"
            onClick={handleDeleteAll}
            disabled={history.length === 0 || bulkDeleting}
            className="px-3 py-1.5 border border-red-400 bg-red-50 text-red-700 rounded text-xs uppercase tracking-wide disabled:opacity-50"
          >
            Delete All
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  className="accent-blue-600"
                  checked={allVisibleSelected}
                  onChange={toggleSelectVisible}
                  disabled={visibleRecordIds.length === 0}
                  aria-label="Select visible records"
                />
              </th>
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
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={selectedRecordIds.includes(record.id)}
                    onChange={(e) => toggleRecordSelection(record.id, e.target.checked)}
                    aria-label={`Select ${record.student_name ?? record.students?.name ?? 'record'}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{record.student_name ?? record.students?.name}</div>
                  <div className="text-sm text-slate-500">Class {record.class_name ?? record.students?.class_name}</div>
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
                <td className="px-4 py-3 flex gap-2">
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
