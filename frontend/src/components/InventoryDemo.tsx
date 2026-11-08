import { useState, type FormEvent } from 'react';

import { changeDemo, inventoryError, type DemoAction, type DemoState } from '../lib/inventory';

export default function InventoryDemo({ state, onUpdated }: { state: DemoState; onUpdated: () => void }) {
  const product = state.products[0];
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!product) return null;
  const job = product.acquisition;

  async function act(action: DemoAction, value?: number) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await changeDemo(product.id, action, value);
      if (action === 'set_target') setTarget(null);
      onUpdated();
    } catch (cause) { setError(inventoryError(cause)); }
    finally { setBusy(false); }
  }

  function updateTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void act('set_target', Number(target ?? product.target_stock));
  }

  return (
    <details className="inventory-demo">
      <summary>Local simulation <span>Stock &amp; supply controls</span></summary>
      <p className="inventory-hint">Shared across local accounts. These controls only affect the mock provider.</p>
      <dl className="inventory-counts">
        <div><dt>Available</dt><dd>{product.available_count}</dd></div>
        <div><dt>Waiting</dt><dd>{product.pending_count}</dd></div>
        <div><dt>Delivered</dt><dd>{product.fulfilled_count}</dd></div>
      </dl>
      <div className="inventory-job" aria-live="polite">
        <strong>Supply {state.paused ? 'paused' : 'enabled'}</strong>
        <p>{job ? `Acquisition: ${job.state} · ${job.attempts} attempt${job.attempts === 1 ? '' : 's'}` : 'Stock target met. No acquisition waiting.'}</p>
        {job?.message && <p>{job.message}</p>}
        {job?.retry_at && <p>Next attempt: {new Date(job.retry_at).toLocaleTimeString()}</p>}
        {state.fail_next && <p>The next provider attempt will fail once.</p>}
        {state.paused && job?.state === 'running' && <p>The attempt already underway can finish.</p>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="inventory-actions">
        <button className="button secondary compact" disabled={busy} onClick={() => { void act(state.paused ? 'resume' : 'pause'); }}>{state.paused ? 'Resume supply' : 'Pause supply'}</button>
        <button className="button secondary compact" disabled={busy || state.fail_next} onClick={() => { void act('fail_next'); }}>Fail next attempt</button>
        {job?.state === 'blocked' && <button className="button secondary compact" disabled={busy} onClick={() => { void act('retry'); }}>Retry acquisition</button>}
      </div>
      <form className="inventory-target" onSubmit={updateTarget}>
        <label htmlFor="stock-target">Available stock target</label>
        <div>
          <input id="stock-target" type="number" min="0" max="2147483647" step="1" required value={target ?? product.target_stock} onChange={(event) => setTarget(event.target.value)} disabled={busy} />
          <button className="button secondary compact" disabled={busy} type="submit">Save target</button>
        </div>
        <p className="inventory-hint">Pending orders get priority. Lowering the target keeps items already acquired.</p>
      </form>
    </details>
  );
}
