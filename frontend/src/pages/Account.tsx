import { useState } from 'react';

import { ApiError } from '../lib/api';
import { errorMessage, signout, type User } from '../lib/auth';
import Inventory from '../components/Inventory';

export default function Account({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    <section className="panel" aria-labelledby="account-title">
      <p className="eyebrow"><span className="small-dot" /> YOU’RE SIGNED IN</p>
      <h1 id="account-title">Hello, {user.username}<span className="muted-heading">.</span></h1>
      <p className="intro">This is your space. You’re signed in and ready to go.</p>
      <div className="account-details">
        <div className="avatar" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</div>
        <div><span className="detail-label">YOUR USERNAME</span><strong>{user.username}</strong></div>
        <span className="account-badge">Passkey</span>
      </div>
      <p className="account-note">You can refresh or come back later. When your session ends, use your passkey to sign in again.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button secondary" onClick={() => { void leave(); }} disabled={busy}>
        {busy ? 'Signing out…' : 'Sign out'}<span aria-hidden="true">↗</span>
      </button>
      <Inventory key={user.id} userId={user.id} />
    </section>
  );
}
