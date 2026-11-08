import { useState } from 'react';
import { Link } from 'react-router';

import { errorMessage, passkeysAvailable, signin, type User } from '../lib/auth';

export default function SignIn({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const supported = passkeysAvailable();

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
    <section className="panel" aria-labelledby="signin-title">
      <p className="eyebrow"><span className="small-dot" /> GOOD TO SEE YOU</p>
      <h1 id="signin-title">Welcome back.<br /><span className="muted-heading">Make yourself at home.</span></h1>
      <p className="intro">Use your saved passkey to open your account. Your device will take care of the rest.</p>
      <div className="passkey-note">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="8" cy="9" r="4" /><path d="m11 12 8 8m-3-3 2-2m-5-1 2-2" />
        </svg>
        <div><strong>A familiar way in</strong><p>Confirm with your fingerprint, face, device PIN, or security key.</p></div>
      </div>
      {!supported && <p className="error" role="alert">Passkeys aren’t available here. Open localhost in an up-to-date browser with a passkey provider or security key.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button primary" onClick={() => { void submit(); }} disabled={busy || !supported}>
        {busy ? <><span className="spinner" aria-hidden="true" /> Follow your device’s prompt…</> : <>Sign in with a passkey <span aria-hidden="true">↗</span></>}
      </button>
      <p className="status-text" role="status">{busy ? 'Choose your Inventory Manager passkey to continue.' : 'No username or password needed.'}</p>
      <div className="panel-bottom">New here? <Link to="/signup">Create an account</Link></div>
    </section>
  );
}
