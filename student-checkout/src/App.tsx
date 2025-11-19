import { useState } from 'react';
import StudentCheckout from './components/StudentCheckout';
import TeacherDashboard from './components/TeacherDashboard';
import AdminPanel from './components/AdminPanel';
import { Users, LayoutDashboard, Settings } from 'lucide-react';

type View = 'checkout' | 'dashboard' | 'admin';

function App() {
  const [currentView, setCurrentView] = useState<View>('checkout');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-slate-800">Classroom Checkout</h1>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentView('checkout')}
                className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'checkout'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Users className="w-5 h-5 mr-2" />
                Checkout
              </button>
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'dashboard'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mr-2" />
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('admin')}
                className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'admin'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-5 h-5 mr-2" />
                Admin
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'checkout' && <StudentCheckout />}
        {currentView === 'dashboard' && <TeacherDashboard />}
        {currentView === 'admin' && <AdminPanel />}
      </main>
    </div>
  );
}

export default App;
