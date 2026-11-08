import { useState, type FormEvent } from 'react';

import { useLocale } from '../lib/i18n';
import { changeDemo, inventoryError, type DemoAction, type DemoState } from '../lib/inventory';

export default function InventoryDemo({ state, onUpdated }: { state: DemoState; onUpdated: () => void }) {
  const product = state.products[0];
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { locale } = useLocale();
  const isTr = locale === 'tr';

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
    } catch (cause) {
      setError(inventoryError(cause));
    } finally {
      setBusy(false);
    }
  }

  function updateTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void act('set_target', Number(target ?? product.target_stock));
  }

  const jobStateLabel = job
    ? job.state === 'running'
      ? (isTr ? 'Çalışıyor (running)' : 'running')
      : job.state === 'queued'
        ? (isTr ? 'Sırada (queued)' : 'queued')
        : job.state === 'retry'
          ? (isTr ? 'Yeniden Denenecek (retry)' : 'retry')
          : (isTr ? 'Engellendi (blocked)' : 'blocked')
    : (isTr ? 'Hedef Tamamlandı (idle)' : 'idle');

  return (
    <details className="inventory-demo panel" open>
      <summary>
        <div className="summary-header">
          <div className="summary-title-group">
            <span className="eyebrow summary-eyebrow">
              <span className="small-dot" />
              {isTr ? 'SİMÜLASYON VE TEDARİK KONTROLÜ' : 'SIMULATION & REPLENISHMENT CONTROL'}
            </span>
            <span className="summary-main-title">
              {isTr ? 'Yerel Simülasyon (Local simulation)' : 'Local simulation'}
            </span>
          </div>
          <span className={`supply-status-pill ${state.paused ? 'paused' : 'active'}`}>
            {state.paused
              ? (isTr ? 'Tedarik Duraklatıldı' : 'Supply Paused')
              : (isTr ? 'Tedarik Aktif' : 'Supply Enabled')}
          </span>
        </div>
        <span className="summary-subtitle">
          {isTr
            ? 'Stok ve tedarik kontrolleri (Stock & supply controls) — Tüm yerel hesaplar arasında paylaşılır ve yalnızca sahte tedarikçiyi (mock provider) etkiler.'
            : 'Stock & supply controls — Shared across local accounts. These controls only affect the mock provider.'}
        </span>
      </summary>

      <div className="demo-body">
        <dl className="inventory-counts">
          <div className="count-box">
            <dt>{isTr ? 'Hazır (Available)' : 'Available'}</dt>
            <dd>{product.available_count}</dd>
            <span className="count-sub">{isTr ? `Hedef: ${product.target_stock}` : `Target: ${product.target_stock}`}</span>
          </div>
          <div className="count-box">
            <dt>{isTr ? 'Bekleyen (Waiting)' : 'Waiting'}</dt>
            <dd>{product.pending_count}</dd>
            <span className="count-sub">{isTr ? 'FIFO Kuyruğu' : 'FIFO Queue'}</span>
          </div>
          <div className="count-box">
            <dt>{isTr ? 'Teslim (Delivered)' : 'Delivered'}</dt>
            <dd>{product.fulfilled_count}</dd>
            <span className="count-sub">{isTr ? 'Tamamlanan' : 'Fulfilled'}</span>
          </div>
        </dl>

        <div className="inventory-job" aria-live="polite">
          <div className="job-header">
            <strong>
              {state.paused
                ? (isTr ? 'Tedarik Duraklatıldı (Supply paused)' : 'Supply paused')
                : (isTr ? 'Tedarik Etkin (Supply enabled)' : 'Supply enabled')}
            </strong>
            <span className={`job-badge ${job ? `job-${job.state}` : 'job-idle'}`}>
              {jobStateLabel}
            </span>
          </div>

          <p>
            {job
              ? (isTr
                  ? `Tedarik Görevi (Acquisition): ${job.state} · ${job.attempts} deneme (${job.attempts} attempt${job.attempts === 1 ? '' : 's'})`
                  : `Acquisition: ${job.state} · ${job.attempts} attempt${job.attempts === 1 ? '' : 's'}`)
              : (isTr
                  ? 'Stok hedefi karşılandı. Bekleyen tedarik görevi yok. (Stock target met. No acquisition waiting.)'
                  : 'Stock target met. No acquisition waiting.')}
          </p>
          {job?.message && <p className="job-message">{job.message}</p>}
          {job?.retry_at && (
            <p className="job-retry">
              {isTr ? 'Sonraki deneme zamanı (Next attempt): ' : 'Next attempt: '}
              <strong>{new Date(job.retry_at).toLocaleTimeString()}</strong>
            </p>
          )}
          {state.fail_next && (
            <p className="job-warning">
              {isTr
                ? '⚡ Hata Enjeksiyonu Aktif: Bir sonraki tedarikçi denemesi bilerek bir kez başarısız olacak (The next provider attempt will fail once).'
                : '⚡ Fault Injection Armed: The next provider attempt will fail once.'}
            </p>
          )}
          {state.paused && job?.state === 'running' && (
            <p className="job-note">
              {isTr
                ? 'Şu anda devam etmekte olan tedarik denemesi tamamlanabilir (The attempt already underway can finish).'
                : 'The attempt already underway can finish.'}
            </p>
          )}
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="demo-controls-section">
          <span className="section-mini-label">
            {isTr ? 'TEDARİK İŞÇİSİ SİMÜLASYON AKSİYONLARI' : 'WORKER SIMULATION ACTIONS'}
          </span>
          <div className="inventory-actions">
            <button
              className="button secondary compact"
              disabled={busy}
              onClick={() => { void act(state.paused ? 'resume' : 'pause'); }}
            >
              {state.paused
                ? (isTr ? 'Tedariki Sürdür (Resume supply)' : 'Resume supply')
                : (isTr ? 'Tedariki Duraklat (Pause supply)' : 'Pause supply')}
            </button>
            <button
              className="button secondary compact"
              disabled={busy || state.fail_next}
              onClick={() => { void act('fail_next'); }}
            >
              {isTr ? 'Sonraki Denemeyi Başarısız Kıl (Fail next attempt)' : 'Fail next attempt'}
            </button>
            {job?.state === 'blocked' && (
              <button
                className="button secondary compact"
                disabled={busy}
                onClick={() => { void act('retry'); }}
              >
                {isTr ? 'Tedariki Yeniden Dene (Retry acquisition)' : 'Retry acquisition'}
              </button>
            )}
          </div>
          <p className="inventory-hint demo-action-hint">
            {isTr
              ? 'İpucu: Tedariki duraklatıp stok bitene kadar sipariş vererek bekleyen (FIFO) sipariş kuyruğunu test edebilir veya "Fail next attempt" ile 5 saniyelik otomatik yeniden deneme (exponential backoff) mekanizmasını gözlemleyebilirsiniz.'
              : 'Tip: Pause supply and place orders past available stock to observe FIFO queueing, or arm "Fail next attempt" to test automatic 5-second backoff recovery.'}
          </p>
        </div>

        <form className="inventory-target" onSubmit={updateTarget}>
          <label htmlFor="stock-target">
            {isTr ? 'Hedef Hazır Stok Seviyesi (Available stock target)' : 'Available stock target'}
          </label>
          <div className="target-input-row">
            <input
              id="stock-target"
              type="number"
              min="0"
              max="2147483647"
              step="1"
              required
              value={target ?? product.target_stock}
              onChange={(event) => setTarget(event.target.value)}
              disabled={busy}
            />
            <button className="button secondary compact" disabled={busy} type="submit">
              {isTr ? 'Hedefi Kaydet (Save target)' : 'Save target'}
            </button>
          </div>
          <p className="inventory-hint">
            {isTr
              ? 'Bekleyen müşteri siparişleri her zaman önceliklidir. Hedefi düşürmek mevcut envanterdeki ürünleri silmez; hedef 0 olsa bile bekleyen talep varsa tedarik tetiklenir.'
              : 'Pending orders get priority. Lowering the target keeps items already acquired; even at target 0, pending demand still triggers acquisition.'}
          </p>
        </form>
      </div>
    </details>
  );
}
