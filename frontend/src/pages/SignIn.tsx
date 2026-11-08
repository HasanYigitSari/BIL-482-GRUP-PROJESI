import { useState } from 'react';
import { Link } from 'react-router';

import { errorMessage, passkeysAvailable, signin, type User } from '../lib/auth';
import { useLocale } from '../lib/i18n';

export default function SignIn({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const supported = passkeysAvailable();
  const { locale } = useLocale();
  const isTr = locale === 'tr';

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onAuthenticated(await signin());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <aside className="auth-showcase" aria-label={isTr ? 'Sistem Mimarisi ve Özellikler' : 'System Architecture & Features'}>
        <div className="showcase-badge">
          <span className="pulse-dot" aria-hidden="true" />
          <span>{isTr ? 'KURUMSAL DİJİTAL ENVANTER PLATFORMU' : 'ENTERPRISE DIGITAL INVENTORY PLATFORM'}</span>
        </div>
        <h2 className="showcase-title">
          {isTr
            ? 'Talebe Uyarlanabilir Envanter ve Anlık Sipariş Karşılama'
            : 'Demand-Adaptive Inventory & Instant Order Fulfillment'}
        </h2>
        <p className="showcase-desc">
          {isTr
            ? 'Benzersiz dijital ürünleri güvenli bir şekilde depolayan, müşterilere tekil olarak tahsis eden ve ortak envanteri talebe göre otonom olarak yenileyen yeni nesil yönetim sistemi.'
            : 'A next-generation management system that securely stores unique digital products, assigns them exclusively to customers, and autonomously replenishes shared stock based on demand.'}
        </p>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h3>{isTr ? 'Şifresiz WebAuthn / Passkey Güvenliği' : 'Passwordless WebAuthn / Passkey Security'}</h3>
              <p>
                {isTr
                  ? 'Açık anahtarlı kriptografi ile kimlik avına dayanıklı oturum açma. Özel anahtarlar cihazınızdan asla çıkmaz.'
                  : 'Phishing-resistant authentication powered by public-key cryptography. Private keys never leave your device.'}
              </p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <h3>{isTr ? 'Anlık Tahsis ve FIFO Sipariş Kuyruğu' : 'Instant Allocation & FIFO Order Queue'}</h3>
              <p>
                {isTr
                  ? 'Stokta bulunan dijital ürünler milisaniyeler içinde teslim edilir; stok tükendiğinde siparişler ilk giren ilk çıkar (FIFO) sırasıyla karşılanır.'
                  : 'Available digital assets are delivered immediately; when stock is depleted, pending orders are fulfilled strictly oldest-first (FIFO).'}
              </p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </div>
            <div>
              <h3>{isTr ? 'Otonom Tedarik ve Hata Kurtarma' : 'Autonomous Replenishment & Recovery'}</h3>
              <p>
                {isTr
                  ? 'Arka plan tedarik işçisi (worker), hedef stok seviyesini korumak için üstel geri çekilme (exponential backoff) ve idempotent isteklerle çalışır.'
                  : 'A background replenishment worker maintains target stock levels using durable jobs, idempotent provider requests, and exponential backoff.'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <section className="panel auth-panel" aria-labelledby="signin-title">
        <p className="eyebrow">
          <span className="small-dot" />
          {isTr ? 'KİMLİK DOĞRULAMA · GOOD TO SEE YOU' : 'AUTHENTICATION PORTAL · GOOD TO SEE YOU'}
        </p>
        <h1 id="signin-title">
          {isTr ? (
            <>Tekrar hoş geldiniz.<br /><span className="muted-heading">Güvenli oturumunuzu başlatın.</span></>
          ) : (
            <>Welcome back.<br /><span className="muted-heading">Sign in to your workspace.</span></>
          )}
        </h1>
        <p className="intro">
          {isTr
            ? 'Kullanıcı adı veya parola girmenize gerek yoktur. Kayıtlı geçiş anahtarınızı (Passkey) seçerek hesabınıza doğrudan erişebilirsiniz.'
            : 'Use your saved passkey to open your account. No username or password entry is required—your device handles cryptographic verification.'}
        </p>

        <div className="passkey-note">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="8" cy="9" r="4" /><path d="m11 12 8 8m-3-3 2-2m-5-1 2-2" />
          </svg>
          <div>
            <strong>{isTr ? 'Biyometrik veya Donanım Anahtarı ile Doğrulama' : 'Cryptographic Passkey Verification'}</strong>
            <p>
              {isTr
                ? 'Parmak izi (Touch ID), yüz tanıma (Face ID), cihaz PIN kodu veya güvenlik anahtarınızla onay verin.'
                : 'Confirm with your fingerprint, face recognition, device PIN, or hardware security key.'}
            </p>
          </div>
        </div>

        <div className="auth-steps" aria-label={isTr ? 'Giriş adımları' : 'Sign-in steps'}>
          <div className="auth-step">
            <span className="step-num">1</span>
            <span>{isTr ? 'Aşağıdaki Passkey ile Giriş Yap butonuna tıklayın' : 'Click Sign in with a passkey below'}</span>
          </div>
          <div className="auth-step">
            <span className="step-num">2</span>
            <span>{isTr ? 'Tarayıcı isteminden kayıtlı hesabınızı seçip onaylayın' : 'Select your saved credential in the browser prompt'}</span>
          </div>
        </div>

        {!supported && (
          <p className="error" role="alert">
            {isTr
              ? 'Bu ortamda Passkey desteği kullanılamıyor. Lütfen güncel bir tarayıcıda http://localhost:5173 adresini açın.'
              : 'Passkeys aren’t available here. Open localhost in an up-to-date browser with a passkey provider or security key.'}
          </p>
        )}
        {error && <p className="error" role="alert">{error}</p>}

        <button className="button primary" onClick={() => { void submit(); }} disabled={busy || !supported}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              {isTr ? 'Cihazınızdaki istemi onaylayın…' : 'Follow your device’s prompt…'}
            </>
          ) : (
            <>
              {isTr ? 'Passkey ile Oturum Aç (Sign in with a passkey)' : 'Sign in with a passkey'}
              <span aria-hidden="true">↗</span>
            </>
          )}
        </button>

        <p className="status-text" role="status">
          {busy
            ? (isTr ? 'Devam etmek için Inventory Manager geçiş anahtarınızı seçin.' : 'Choose your Inventory Manager passkey to continue.')
            : (isTr ? 'Kullanıcı adı veya şifre gerekmez · FIDO2 WebAuthn Standardı' : 'No username or password needed · FIDO2 WebAuthn Standard')}
        </p>

        <div className="panel-bottom">
          {isTr ? 'Henüz bir hesabınız yok mu?' : 'New here?'}{' '}
          <Link to="/signup">{isTr ? 'Yeni Hesap Oluştur (Create an account)' : 'Create an account'}</Link>
        </div>
      </section>
    </div>
  );
}
