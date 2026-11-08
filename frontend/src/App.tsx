import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router';

import { currentUser, errorMessage, type User } from './lib/auth';
import { LocaleProvider, useLocale } from './lib/i18n';
import Account from './pages/Account';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';

function AppShell() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const requestVersion = useRef(0);
  const location = useLocation();
  const { locale, setLocale } = useLocale();
  const isTr = locale === 'tr';

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
    const title = location.pathname === '/signup'
      ? (isTr ? 'Hesap Oluştur' : 'Create account')
      : location.pathname === '/account'
        ? (isTr ? 'Yönetim Paneli' : 'Your account')
        : (isTr ? 'Oturum Aç' : 'Sign in');
    document.title = `${title} · Inventory Manager`;
    document.documentElement.lang = locale;
  }, [location.pathname, locale, isTr]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-left">
          <Link className="brand" to={user ? '/account' : '/signin'} aria-label="Inventory Manager home">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <div className="brand-text">
              <span className="brand-title">
                inventory-manager<span className="brand-dot">.</span>
              </span>
              <span className="brand-subtitle">
                {isTr
                  ? 'Talebe Uyarlanabilir Envanter ve Anlık Sipariş Karşılama Sistemi'
                  : 'Demand-Adaptive Inventory & Instant Order Fulfillment System'}
              </span>
            </div>
          </Link>
        </div>

        <div className="header-right">
          <div className="system-pill" title={isTr ? 'WebAuthn & PostgreSQL İşlem Koruması Aktif' : 'WebAuthn & PostgreSQL Transactional Protection Active'}>
            <span className="pulse-dot" aria-hidden="true" />
            <span>{isTr ? 'Sistem Çevrimiçi · FIDO2 / WebAuthn' : 'System Online · FIDO2 / WebAuthn'}</span>
          </div>

          {user && (
            <div className="header-user-pill" aria-label={isTr ? 'Aktif kullanıcı' : 'Active user'}>
              <span className="header-user-avatar" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span>
              <span className="header-user-name">{user.username}</span>
            </div>
          )}

          <div className="lang-switch" role="group" aria-label={isTr ? 'Dil seçimi' : 'Language selector'}>
            <button
              type="button"
              className={`lang-btn ${locale === 'tr' ? 'active' : ''}`}
              onClick={() => setLocale('tr')}
              aria-pressed={locale === 'tr'}
            >
              TR
            </button>
            <button
              type="button"
              className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
              onClick={() => setLocale('en')}
              aria-pressed={locale === 'en'}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <main id="main" className={user ? 'main-dashboard' : 'main-auth'}>
        {loading ? (
          <section className="panel centered" role="status">
            <span className="spinner" aria-hidden="true" />
            <span>
              {isTr
                ? 'Oturum ve güvenlik durumu doğrulanıyor…'
                : 'Loading your account and verifying session security…'}
            </span>
          </section>
        ) : loadError ? (
          <section className="panel">
            <p className="eyebrow">
              <span className="small-dot" />
              {isTr ? 'BAĞLANTI HATASI · LET’S RECONNECT' : 'CONNECTION ERROR · LET’S RECONNECT'}
            </p>
            <h1>
              {isTr ? 'Sunucu ile bağlantı kurulamadı.' : 'We couldn’t reach your account.'}
            </h1>
            <p className="intro">
              {isTr
                ? 'Arka uç API servisine şu anda ulaşılamıyor. Lütfen yerel servislerin çalıştığından emin olun ve tekrar deneyin.'
                : 'The backend API service is currently unreachable. Please verify local services are running and try again.'}
            </p>
            <p className="error" role="alert">{loadError}</p>
            <button className="button primary" onClick={() => { setLoading(true); void refresh(); }}>
              {isTr ? 'Yeniden Bağlan (Try again)' : 'Try again'}
            </button>
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

      <footer className="site-footer">
        <div className="footer-left">
          <strong>Inventory Manager</strong>
          <span className="footer-divider">·</span>
          <span>
            {isTr
              ? 'BİL 482 Grup 1 — Dijital Envanter Tahsis ve Otomatik Tedarik Prototipi'
              : 'BIL 482 Group 1 — Digital Inventory Allocation & Automated Replenishment Prototype'}
          </span>
        </div>
        <div className="footer-right">
          <span className="footer-tag">WebAuthn Passkey</span>
          <span className="footer-tag">FIFO Allocation</span>
          <span className="footer-tag">PostgreSQL ACID</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LocaleProvider>
      <AppShell />
    </LocaleProvider>
  );
}
