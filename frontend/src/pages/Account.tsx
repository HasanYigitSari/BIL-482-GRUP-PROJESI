import { useState } from 'react';

import { ApiError } from '../lib/api';
import { errorMessage, signout, type User } from '../lib/auth';
import { useLocale } from '../lib/i18n';
import Inventory from '../components/Inventory';

export default function Account({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { locale } = useLocale();
  const isTr = locale === 'tr';

  async function leave() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await signout();
      onSignedOut();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSignedOut();
      else setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dashboard-container" aria-labelledby="account-title">
      <section className="panel account-header-panel">
        <div className="account-header-top">
          <div className="account-welcome">
            <p className="eyebrow">
              <span className="small-dot" />
              {isTr ? 'OTURUM AKTİF · YOU’RE SIGNED IN' : 'ACTIVE SESSION · YOU’RE SIGNED IN'}
            </p>
            <h1 id="account-title">
              {isTr ? `Merhaba, ${user.username}` : `Hello, ${user.username}`}
              <span className="muted-heading">.</span>
            </h1>
            <p className="intro account-intro">
              {isTr
                ? 'Kurumsal Dijital Envanter ve Sipariş Karşılama Paneline hoş geldiniz. Bu ekrandan anlık dijital ürün siparişi verebilir, FIFO kuyruk durumunu izleyebilir ve otonom tedarik simülasyonunu yönetebilirsiniz.'
                : 'Welcome to the Digital Inventory & Order Fulfillment Console. Place instant digital product orders, monitor real-time FIFO allocation, and control autonomous supply replenishment.'}
            </p>
          </div>

          <div className="account-session-card">
            <div className="account-details">
              <div className="avatar" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</div>
              <div className="account-meta">
                <span className="detail-label">{isTr ? 'KULLANICI ADI · YOUR USERNAME' : 'YOUR USERNAME'}</span>
                <strong>{user.username}</strong>
                <span className="account-submeta">
                  {isTr ? `Hesap ID #${user.id} · 24 Saatlik Korumalı Oturum` : `Account ID #${user.id} · 24h Protected Session`}
                </span>
              </div>
              <span className="account-badge">Passkey</span>
            </div>

            <div className="account-session-footer">
              <p className="account-note">
                {isTr
                  ? 'Sayfayı yenileyebilir veya daha sonra geri dönebilirsiniz. Oturumunuz sona erdiğinde Passkey ile tekrar giriş yapabilirsiniz.'
                  : 'You can refresh or come back later. When your session ends, use your passkey to sign in again.'}
              </p>
              <button className="button secondary signout-btn" onClick={() => { void leave(); }} disabled={busy}>
                {busy
                  ? (isTr ? 'Çıkış yapılıyor… (Signing out…)' : 'Signing out…')
                  : (isTr ? 'Oturumu Kapat (Sign out)' : 'Sign out')}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      <Inventory key={user.id} userId={user.id} />
    </div>
  );
}
