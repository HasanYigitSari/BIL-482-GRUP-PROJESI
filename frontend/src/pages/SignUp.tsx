import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { errorMessage, passkeysAvailable, signup, type User } from '../lib/auth';
import { useLocale } from '../lib/i18n';

export default function SignUp({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const supported = passkeysAvailable();
  const { locale } = useLocale();
  const isTr = locale === 'tr';

  const trimmed = username.trim();
  const validLength = trimmed.length >= 3 && trimmed.length <= 30;
  const validChars = /^[a-zA-Z0-9_]+$/.test(trimmed);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onAuthenticated(await signup(username));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <aside className="auth-showcase" aria-label={isTr ? 'Kayıt ve Güvenlik Mimarisi' : 'Registration & Security Architecture'}>
        <div className="showcase-badge">
          <span className="pulse-dot" aria-hidden="true" />
          <span>{isTr ? 'KRİPTOGRAFİK HESAP KAYDI' : 'CRYPTOGRAPHIC ACCOUNT ENROLLMENT'}</span>
        </div>
        <h2 className="showcase-title">
          {isTr
            ? 'Tek Adımda Güvenli Hesap ve Dijital Envanter Erişimi'
            : 'Single-Step Passkey Enrollment & Inventory Access'}
        </h2>
        <p className="showcase-desc">
          {isTr
            ? 'Hesap oluşturma işlemi, WebAuthn kayıt seremonisi tamamlandığında atomik olarak gerçekleşir. İptal edilen istemler yarım kalmış hesap bırakmaz.'
            : 'Account creation commits atomically only after your WebAuthn registration ceremony succeeds. Cancelled prompts never leave partial accounts behind.'}
        </p>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <h3>{isTr ? 'Keşfedilebilir Kimlik Bilgisi (Discoverable Passkey)' : 'Discoverable Resident Credential'}</h3>
              <p>
                {isTr
                  ? 'Oluşturulan anahtar cihazınızda veya parola yöneticinizde saklanır; sonraki girişlerde kullanıcı adı yazmanız gerekmez.'
                  : 'Your credential is stored as a discoverable passkey, allowing username-free sign-in on future visits.'}
              </p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div>
              <h3>{isTr ? 'İzole Sipariş Geçmişi ve Tekil Teslimat' : 'Isolated Order Ledger & Unique Delivery'}</h3>
              <p>
                {isTr
                  ? 'Her kullanıcı yalnızca kendi sipariş geçmişini ve kendisine tahsis edilmiş benzersiz dijital bağlantıları görüntüler.'
                  : 'Every account views strictly its own order history and uniquely assigned digital product links.'}
              </p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l3 3" />
              </svg>
            </div>
            <div>
              <h3>{isTr ? 'Gerçek Zamanlı Simülasyon Kontrolleri' : 'Real-Time Simulation Controls'}</h3>
              <p>
                {isTr
                  ? 'Kayıt olduktan sonra tedarik duraklatma, hata enjeksiyonu ve hedef stok değişimlerini canlı olarak test edebilirsiniz.'
                  : 'Once signed in, test supply pausing, provider failure injection, and dynamic stock target adjustments live.'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <section className="panel auth-panel" aria-labelledby="signup-title">
        <p className="eyebrow">
          <span className="small-dot" />
          {isTr ? 'YENİ HESAP OLUŞTUR · MAKE YOURSELF AT HOME' : 'ACCOUNT REGISTRATION · MAKE YOURSELF AT HOME'}
        </p>
        <h1 id="signup-title">
          {isTr ? (
            <>Hesabınızı oluşturun.<br /><span className="muted-heading">Sadece bir Passkey uzağınızda.</span></>
          ) : (
            <>Your account.<br /><span className="muted-heading">Just a passkey away.</span></>
          )}
        </h1>
        <p className="intro">
          {isTr
            ? 'Benzersiz bir kullanıcı adı belirleyin ve cihazınızla veya güvenlik anahtarınızla bir Passkey kaydedin. Hatırlamanız gereken bir parola yoktur.'
            : 'Choose a username, then save a passkey with your device or security key. No password to remember.'}
        </p>

        <form onSubmit={submit} aria-busy={busy}>
          <label htmlFor="username">
            {isTr ? 'Kullanıcı Adı (Username)' : 'Username'}
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username webauthn"
            autoCapitalize="none"
            spellCheck={false}
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]{3,30}"
            placeholder={isTr ? 'ornek_kullanici' : 'your_name'}
            aria-describedby="username-hint"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={busy}
            required
          />
          <div id="username-hint" className="field-hint">
            <span>
              {isTr
                ? '3–30 karakter: yalnızca ASCII harf, rakam veya alt çizgi (_). Veritabanında küçük harf olarak saklanır.'
                : '3–30 letters, numbers, or underscores. Automatically normalized and stored in lowercase.'}
            </span>
            {trimmed.length > 0 && (
              <div className="validation-chips" aria-hidden="true">
                <span className={`chip ${validLength ? 'chip-ok' : 'chip-warn'}`}>
                  {validLength ? '✓' : '•'} {isTr ? '3–30 karakter' : '3–30 chars'} ({trimmed.length}/30)
                </span>
                <span className={`chip ${validChars ? 'chip-ok' : 'chip-warn'}`}>
                  {validChars ? '✓' : '•'} {isTr ? 'Harf / rakam / _' : 'Alphanumeric / _'}
                </span>
                <span className="chip chip-neutral">
                  → {trimmed.toLowerCase()}
                </span>
              </div>
            )}
          </div>

          {!supported && (
            <p className="error" role="alert">
              {isTr
                ? 'Bu ortamda Passkey desteği kullanılamıyor. Lütfen güncel bir tarayıcıda http://localhost:5173 adresini açın.'
                : 'Passkeys aren’t available here. Open localhost in an up-to-date browser with a passkey provider or security key.'}
            </p>
          )}
          {error && <p className="error" role="alert">{error}</p>}

          <button className="button primary" type="submit" disabled={busy || !supported}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" />
                {isTr ? 'Cihazınızdaki istemi onaylayın…' : 'Follow your device’s prompt…'}
              </>
            ) : (
              <>
                {isTr ? 'Hesap Oluştur ve Passkey Kaydet (Create account)' : 'Create account'}
                <span aria-hidden="true">↗</span>
              </>
            )}
          </button>

          <p className="status-text" role="status">
            {busy
              ? (isTr ? 'Passkey oluşturulurken lütfen bu sayfayı açık tutun.' : 'Keep this page open while you create your passkey.')
              : (isTr ? 'Cihazınız bir sonraki adımda biyometrik veya PIN onayı isteyecektir.' : 'Your device will guide you through the next step.')}
          </p>
        </form>

        <div className="panel-bottom">
          {isTr ? 'Zaten bir hesabınız var mı?' : 'Already have an account?'}{' '}
          <Link to="/signin">{isTr ? 'Oturum Açın (Sign in)' : 'Sign in'}</Link>
        </div>
      </section>
    </div>
  );
}
