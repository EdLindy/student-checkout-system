import { useEffect, useState, PropsWithChildren } from 'react';
import { initIdentity, currentUser, openLogin, onLogin, onLogout } from '../lib/netlify-identity';

type AuthGuardProps = {
  requiredRole?: string; // optional role name to require (e.g., 'admin')
};

export default function AuthGuard({ children, requiredRole }: PropsWithChildren<AuthGuardProps>) {
  const [user, setUser] = useState<any | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    initIdentity();
    const u = currentUser();
    setUser(u);
    setChecking(false);

    const loginHandler = (usr: any) => setUser(usr);
    const logoutHandler = () => setUser(null);
    onLogin(loginHandler);
    onLogout(logoutHandler);
    return () => {
      // no-op: widget cleanup isn't necessary here
    };
  }, []);

  if (checking) return <div className="p-6 text-center">Checking authentication...</div>;

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">You must sign in to access this page.</p>
        <button
          onClick={() => openLogin()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Sign in
        </button>
      </div>
    );
  }

  // if a role is required, check user.app_metadata?.roles array
  if (requiredRole) {
    const roles: string[] = (user?.app_metadata?.roles as string[]) || [];
    if (!roles.includes(requiredRole)) {
      return (
        <div className="p-6 text-center">
          <p className="mb-4">You are signed in but not authorized to view this page.</p>
        </div>
      );
    }
  }

  return <>{children}</>;
}
