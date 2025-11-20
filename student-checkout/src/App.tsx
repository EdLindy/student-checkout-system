import { Link, Routes, Route } from 'react-router-dom';
import StudentCheckout from './components/StudentCheckout';
import TeacherDashboard from './components/TeacherDashboard';
import AdminPanel from './components/AdminPanel';
import AuthGuard from './components/AuthGuard';
import { Users, LayoutDashboard, Settings } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-slate-800">Classroom Checkout</h1>
            </div>
            <div className="flex space-x-2">
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <Users className="w-5 h-5 mr-2" />
                Checkout
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <LayoutDashboard className="w-5 h-5 mr-2" />
                Dashboard
              </Link>
              <Link
                to="/admin"
                className="inline-flex items-center px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <Settings className="w-5 h-5 mr-2" />
                Admin
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route index element={<StudentCheckout />} />
          <Route path="dashboard" element={<AuthGuard requiredRole={undefined}><TeacherDashboard /></AuthGuard>} />
          <Route path="admin" element={<AuthGuard requiredRole={'admin'}><AdminPanel /></AuthGuard>} />
        </Routes>
      </main>
    </div>
  );
}
