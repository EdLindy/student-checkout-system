import { useState, useEffect, type FormEvent } from 'react';
import {
  getActiveCheckouts,
  returnStudent,
  processAutoReturns,
  getAutoReturnMinutes,
  updateAutoReturnMinutes,
  type CheckoutLog
} from '../lib/checkout-service';
import { Clock, User, MapPin, CheckCircle, Timer } from 'lucide-react';

function formatAutoReturnLabel(autoReturnAt?: string | null): string {
  if (!autoReturnAt) {
    return 'Auto return disabled';
  }

  const target = new Date(autoReturnAt);
  if (Number.isNaN(target.getTime())) {
    return 'Auto return pending';
  }

  const diffMs = target.getTime() - Date.now();
  const timeLabel = target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffMs <= 0) {
    return `Auto return pending (${timeLabel})`;
  }

  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  const secStr = secs.toString().padStart(2, '0');

  if (mins > 0) {
    return `Auto return in ${mins}m ${secStr}s (${timeLabel})`;
  }

  return `Auto return in ${secStr}s (${timeLabel})`;
}

export default function TeacherDashboard() {
  const [activeCheckouts, setActiveCheckouts] = useState<CheckoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoReturnMinutes, setAutoReturnMinutes] = useState(10);
  const [autoReturnLoading, setAutoReturnLoading] = useState(true);
  const [savingAutoReturn, setSavingAutoReturn] = useState(false);
  const [autoReturnStatus, setAutoReturnStatus] = useState<string | null>(null);

  useEffect(() => {
    loadActiveCheckouts();
    loadAutoReturnSetting();
    const interval = setInterval(loadActiveCheckouts, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadActiveCheckouts() {
    try {
      await processAutoReturns();
      const data = await getActiveCheckouts();
      setActiveCheckouts(data);
    } catch (error) {
      console.error('Error loading active checkouts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAutoReturnSetting() {
    try {
      const minutes = await getAutoReturnMinutes();
      setAutoReturnMinutes(minutes);
    } catch (error) {
      console.error('Error loading automatic return setting:', error);
    } finally {
      setAutoReturnLoading(false);
    }
  }

  async function handleReturn(checkoutId: string) {
    try {
      await returnStudent(checkoutId);
      loadActiveCheckouts();
    } catch (error) {
      console.error('Error returning student:', error);
      alert('Failed to return student');
    }
  }

  async function handleAutoReturnSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (autoReturnMinutes < 5 || autoReturnMinutes > 15) {
      alert('Automatic return must be between 5 and 15 minutes.');
      return;
    }

    setSavingAutoReturn(true);
    setAutoReturnStatus(null);
    try {
      await updateAutoReturnMinutes(autoReturnMinutes);
      setAutoReturnStatus('Saved');
      window.setTimeout(() => setAutoReturnStatus(null), 4000);
    } catch (error) {
      console.error('Error saving automatic return setting:', error);
      alert('Failed to save automatic return setting.');
    } finally {
      setSavingAutoReturn(false);
    }
  }

  function formatDuration(checkoutTime: string) {
    const start = new Date(checkoutTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-800">Automatic Return</h3>
            <p className="text-sm text-slate-500">
              Students are checked back in automatically if they stay out longer than the selected number of minutes.
            </p>
          </div>
          <form onSubmit={handleAutoReturnSave} className="flex items-center gap-3">
            <label htmlFor="autoReturnMinutes" className="text-sm font-medium text-slate-600">
              Minutes
            </label>
            <input
              id="autoReturnMinutes"
              type="number"
              min={5}
              max={15}
              value={autoReturnMinutes}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (Number.isNaN(parsed)) {
                  setAutoReturnMinutes(5);
                  return;
                }
                const clamped = Math.min(15, Math.max(5, parsed));
                setAutoReturnMinutes(Math.round(clamped));
              }}
              disabled={autoReturnLoading || savingAutoReturn}
              className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={autoReturnLoading || savingAutoReturn}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {savingAutoReturn ? 'Saving...' : 'Save'}
            </button>
          </form>
        </div>
        <p className="text-xs text-slate-500 mt-3">Range: 5-15 minutes. Automatic returns run continuously while this dashboard is open.</p>
        {autoReturnStatus && (
          <p className="text-xs text-green-600 mt-2">Automatic return updated.</p>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Active Checkouts</h2>
        <p className="text-slate-600">
          {activeCheckouts.length} {activeCheckouts.length === 1 ? 'student' : 'students'} currently checked out
        </p>
      </div>

      {activeCheckouts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-700 mb-2">All Clear!</h3>
          <p className="text-slate-500">No students are currently checked out.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeCheckouts.map((checkout) => {
            const studentName = checkout.students?.name ?? checkout.student_name ?? 'Student';
            const classLabel = checkout.students?.class_name ?? checkout.class_name ?? null;
            const destinationLabel =
              typeof checkout.destination === 'string'
                ? checkout.destination
                : checkout.destination?.name ?? checkout.destination_name ?? '';

            return (
              <div
                key={checkout.id}
                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="bg-blue-100 rounded-full p-2 mr-3">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{studentName}</h3>
                      <p className="text-sm text-slate-500">
                        {classLabel ? `Class ${classLabel}` : 'Class unavailable'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-slate-600">
                    <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                    <span>{destinationLabel}</span>
                  </div>
                <div className="flex items-center text-sm text-slate-600">
                  <Clock className="w-4 h-4 mr-2 text-slate-400" />
                  <span>{formatDuration(checkout.checkout_time ?? '')}</span>
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <Timer className="w-4 h-4 mr-2 text-slate-400" />
                  <span>{formatAutoReturnLabel(checkout.auto_return_at)}</span>
                </div>
              </div>

              {checkout.notes && (
                <div className="bg-slate-50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-slate-600">{checkout.notes}</p>
                </div>
              )}

              <button
                onClick={() => handleReturn(checkout.id)}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Returned
              </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
