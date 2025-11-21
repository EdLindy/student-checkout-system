import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

const App = lazy(() => import('./App'));
const StudentCheckout = lazy(() => import('./components/StudentCheckout'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen text-slate-500">
            Loading application…
          </div>
        }
      >
        <Routes>
          <Route path="/student" element={<StudentCheckout />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>
);
