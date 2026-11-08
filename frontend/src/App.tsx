import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router';

import { currentUser, errorMessage, type User } from './lib/auth';
import Account from './pages/Account';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const requestVersion = useRef(0);
  const location = useLocation();

  const acceptUser = useCallback((nextUser: User | null) => {
    requestVersion.current += 1;
    setUser(nextUser);
    setLoadError('');
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const nextUser = await currentUser();
      if (version === requestVersion.current) {
        setUser(nextUser);
        setLoadError('');
      }
    } catch (error) {
      if (version === requestVersion.current) setLoadError(errorMessage(error));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const focus = () => { void refresh(); };
    const expired = () => acceptUser(null);
    window.addEventListener('focus', focus);
    window.addEventListener('session-expired', expired);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener('focus', focus);
      window.removeEventListener('session-expired', expired);
    };
  }, [refresh, acceptUser]);

  useEffect(() => {
    const title = location.pathname === '/signup' ? 'Create account' : location.pathname === '/account' ? 'Your account' : 'Sign in';
    document.title = `${title} · Inventory Manager`;
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to={user ? '/account' : '/signin'} aria-label="Inventory Manager home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          inventory-manager<span className="brand-dot">.</span>
        </Link>
        <span className="header-caption">A place of your own.</span>
      </header>

      <main id="main">
        {loading ? (
          <section className="panel centered" role="status"><span className="spinner" aria-hidden="true" /> Loading your account…</section>
        ) : loadError ? (
          <section className="panel">
            <p className="eyebrow">LET’S RECONNECT</p>
            <h1>We couldn’t reach your account.</h1>
            <p className="error" role="alert">{loadError}</p>
            <button className="button primary" onClick={() => { setLoading(true); void refresh(); }}>Try again</button>
          </section>
        ) : (
          <Routes>
            <Route path="/signup" element={user ? <Navigate to="/account" replace /> : <SignUp onAuthenticated={acceptUser} />} />
            <Route path="/signin" element={user ? <Navigate to="/account" replace /> : <SignIn onAuthenticated={acceptUser} />} />
            <Route path="/account" element={user ? <Account user={user} onSignedOut={() => acceptUser(null)} /> : <Navigate to="/signin" replace />} />
            <Route path="*" element={<Navigate to={user ? '/account' : '/signin'} replace />} />
          </Routes>
        )}
      </main>

      <footer className="site-footer"><span>Inventory Manager</span><span>Your key. Your account.</span></footer>
    </div>
  );
}
