import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { errorMessage, passkeysAvailable, signup, type User } from '../lib/auth';

export default function SignUp({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const supported = passkeysAvailable();

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
    <section className="panel" aria-labelledby="signup-title">
      <p className="eyebrow"><span className="small-dot" /> MAKE YOURSELF AT HOME</p>
      <h1 id="signup-title">Your account.<br /><span className="muted-heading">Just a passkey away.</span></h1>
      <p className="intro">Choose a username, then save a passkey with your device or security key. No password to remember.</p>
      <form onSubmit={submit} aria-busy={busy}>
        <label htmlFor="username">Username</label>
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
          placeholder="your_name"
          aria-describedby="username-hint"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={busy}
          required
        />
        <p id="username-hint" className="field-hint">3–30 letters, numbers, or underscores. Stored in lowercase.</p>
        {!supported && <p className="error" role="alert">Passkeys aren’t available here. Open localhost in an up-to-date browser with a passkey provider or security key.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button primary" type="submit" disabled={busy || !supported}>
          {busy ? <><span className="spinner" aria-hidden="true" /> Follow your device’s prompt…</> : <>Create account <span aria-hidden="true">↗</span></>}
        </button>
        <p className="status-text" role="status">{busy ? 'Keep this page open while you create your passkey.' : 'Your device will guide you through the next step.'}</p>
      </form>
      <div className="panel-bottom">Already have an account? <Link to="/signin">Sign in</Link></div>
    </section>
  );
}
