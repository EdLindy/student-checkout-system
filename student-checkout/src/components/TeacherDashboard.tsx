import { useState, useEffect } from 'react';
import { getActiveCheckouts, returnStudent, type CheckoutLog } from '../lib/checkout-service';
import { Clock, User, MapPin, CheckCircle } from 'lucide-react';

export default function TeacherDashboard() {
  const [activeCheckouts, setActiveCheckouts] = useState<CheckoutLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveCheckouts();
    const interval = setInterval(loadActiveCheckouts, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadActiveCheckouts() {
    try {
      const data = await getActiveCheckouts();
      setActiveCheckouts(data);
    } catch (error) {
      console.error('Error loading active checkouts:', error);
    } finally {
      setLoading(false);
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
          {activeCheckouts.map((checkout) => (
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
                    <h3 className="font-bold text-slate-800">{checkout.students?.name}</h3>
                    <p className="text-sm text-slate-500">Grade {checkout.students?.grade}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-slate-600">
                  <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                  <span>{typeof checkout.destination === 'string' ? checkout.destination : checkout.destination?.name ?? ''}</span>
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <Clock className="w-4 h-4 mr-2 text-slate-400" />
                  <span>{formatDuration(checkout.checkout_time ?? '')}</span>
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
          ))}
        </div>
      )}
    </div>
  );
}
