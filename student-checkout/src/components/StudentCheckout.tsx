import { useState, useEffect, useRef } from 'react';
import { CheckoutService, normalizeGender, type NormalizedGender } from '../lib/checkout-service';
import { supabase, type Destination, type GenderAvailability } from '../lib/supabase';
import { RefreshCw } from 'lucide-react';

export function StudentCheckout() {
  const [email, setEmail] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [availability, setAvailability] = useState<GenderAvailability>({ male: true, female: true });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isSuccess: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isCheckedOut, setIsCheckedOut] = useState(false);
  const [rosterGender, setRosterGender] = useState<NormalizedGender | ''>('');
  const [rosterGenderLoading, setRosterGenderLoading] = useState(false);
  const emailRef = useRef('');
  const lastWarningRef = useRef(0);

  useEffect(() => {
    loadInitialData();
    checkIfStudentCheckedOut();

    const channel = supabase
      .channel('checkout-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'current_checkouts' }, () => {
        loadAvailability(emailRef.current);
        checkIfStudentCheckedOut();
      })
      .subscribe();

    const interval = setInterval(() => {
      loadAvailability(emailRef.current);
      checkIfStudentCheckedOut();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    emailRef.current = email;
    loadAvailability(email);
    loadRosterGender(email);
  }, [email]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isCheckedOut) {
        e.preventDefault();
        e.returnValue = 'You are still checked out! Please check in before leaving.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isCheckedOut]);

  useEffect(() => {
    if (!isCheckedOut) return;

    const warnAndFocus = () => {
      if (!isCheckedOut) return;
      const now = Date.now();
      if (now - lastWarningRef.current < 2000) return;
      lastWarningRef.current = now;
      alert('You are still checked out. Please return to the Student Checkout System and check back in.');
      window.focus();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        warnAndFocus();
      }
    };

    const handleBlur = () => {
      warnAndFocus();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isCheckedOut]);

  useEffect(() => {
    if (email) {
      checkIfStudentCheckedOut();
    }
  }, [email]);

  const loadInitialData = async () => {
    await Promise.all([
      loadDestinations(),
      loadAvailability(emailRef.current),
      loadRosterGender(emailRef.current)
    ]);
  };

  const loadRosterGender = async (targetEmail?: string) => {
    const normalized = targetEmail?.trim().toLowerCase();
    if (!normalized) {
      setRosterGender('');
      return;
    }

    setRosterGenderLoading(true);
    try {
      const { data: student } = await supabase
        .from('students')
        .select('gender')
        .eq('email', normalized)
        .maybeSingle();
      const normalizedGender = normalizeGender(student?.gender) ?? '';
      setRosterGender(normalizedGender);
    } finally {
      setRosterGenderLoading(false);
    }
  };


  const loadDestinations = async () => {
    const { data } = await supabase
      .from('destinations')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (data) setDestinations(data);
  };

  const loadAvailability = async (targetEmail?: string) => {
    const normalized = targetEmail?.trim();
    if (!normalized) {
      setAvailability({ male: true, female: true });
      return;
    }

    const avail = await CheckoutService.getGenderAvailability(normalized);
    setAvailability(avail);
  };

  const checkIfStudentCheckedOut = async () => {
    const storedEmail = localStorage.getItem('checkedOutEmail');

    if (storedEmail) {
      const normalizedStoredEmail = storedEmail.toLowerCase().trim();
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('email', normalizedStoredEmail)
        .maybeSingle();

      if (student) {
        const { data: checkout } = await supabase
          .from('current_checkouts')
          .select('id')
          .eq('student_id', student.id)
          .maybeSingle();

        if (checkout) {
          setEmail(storedEmail);
          setIsCheckedOut(true);
          return;
        } else {
          localStorage.removeItem('checkedOutEmail');
          setIsCheckedOut(false);
        }
      }
    }

    if (!email.trim()) {
      setIsCheckedOut(false);
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!student) {
      setIsCheckedOut(false);
      return;
    }

    const { data: checkout } = await supabase
      .from('current_checkouts')
      .select('id')
      .eq('student_id', student.id)
      .maybeSingle();

    setIsCheckedOut(!!checkout);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAvailability(email);
    setRefreshing(false);
  };

  const handleCheckOut = async () => {
    if (!email.trim() || !destinationId) {
      setMessage({ text: 'Email and destination are required.', isSuccess: false });
      return;
    }

    if (!rosterGender) {
      setMessage({ text: 'No roster gender found for this email. Please contact your teacher.', isSuccess: false });
      return;
    }

    setLoading(true);
    setMessage(null);

    const result = await CheckoutService.checkOut(email, destinationId, rosterGender);
    setMessage({ text: result.message, isSuccess: result.success });

    if (result.success) {
      setDestinationId('');
      localStorage.setItem('checkedOutEmail', email);
      await loadAvailability(email);
      await loadRosterGender(email);
      await checkIfStudentCheckedOut();
    }

    setLoading(false);
  };

  const handleCheckIn = async () => {
    if (!email.trim()) {
      setMessage({ text: 'Email is required to check in.', isSuccess: false });
      return;
    }

    setLoading(true);
    setMessage(null);

    const result = await CheckoutService.checkIn(email);
    setMessage({ text: result.message, isSuccess: result.success });

    if (result.success) {
      localStorage.removeItem('checkedOutEmail');
      setEmail('');
      setIsCheckedOut(false);
      await loadAvailability(email);
      await loadRosterGender(email);
    }

    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <h2 className="text-3xl font-bold text-center text-blue-600 mb-8">
        Student Checkout System
      </h2>

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Availability Status</h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="flex gap-4 justify-center">
          <div className={`px-6 py-3 rounded-full font-semibold text-sm border-2 ${
            availability.male
              ? 'bg-green-50 text-green-700 border-green-300'
              : 'bg-red-50 text-red-700 border-red-300'
          } ${availability.male ? '' : 'blink-red'}`}>
            Boys: {availability.male ? 'Available' : 'Unavailable'}
          </div>
          <div className={`px-6 py-3 rounded-full font-semibold text-sm border-2 ${
            availability.female
              ? 'bg-green-50 text-green-700 border-green-300'
              : 'bg-red-50 text-red-700 border-red-300'
          } ${availability.female ? '' : 'blink-red'}`}>
            Girls: {availability.female ? 'Available' : 'Unavailable'}
          </div>
        </div>
        <p className="text-xs text-slate-500 text-center mt-3">
          Availability updates after you enter your email and is limited to your class.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Student Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@school.org"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-2">
            Destination
          </label>
          <select
            id="destination"
            value={destinationId}
            onChange={(e) => setDestinationId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          >
            <option value="">— Select a Destination —</option>
            {destinations.map(dest => (
              <option key={dest.id} value={dest.id}>{dest.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={handleCheckOut}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Check Out'}
          </button>
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className={`px-6 py-3 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isCheckedOut
                ? 'bg-red-600 hover:bg-red-700 blink-red'
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            Check In
          </button>
        </div>

        {message && (
          <div className={`px-6 py-3 rounded-lg font-medium text-center border-2 ${
            message.isSuccess
              ? 'bg-green-50 text-green-700 border-green-300'
              : 'bg-red-50 text-red-700 border-red-300'
          }`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentCheckout;
