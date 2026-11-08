import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../lib/api';
import { useLocale } from '../lib/i18n';
import { getDemo, getOrders, getProducts, inventoryError, placeOrder, type DemoState, type OrderPage, type Product, type Submission } from '../lib/inventory';
import InventoryDemo from './InventoryDemo';

function storedSubmission(key: string): Submission | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Submission | null;
    if (value && Number.isSafeInteger(value.product_id) && value.product_id > 0
      && typeof value.request_id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.request_id)) return value;
  } catch { /* A new submission will require writable storage before sending. */ }
  return null;
}

export default function Inventory({ userId }: { userId: number }) {
  const storageKey = `inventory-manager:order-request:${userId}`;
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderPage | null>(null);
  const [demo, setDemo] = useState<DemoState | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pollError, setPollError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [pending, setPending] = useState<Submission | null>(() => storedSubmission(storageKey));
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const refresh = useRef<() => void>(() => {});
  const { locale } = useLocale();
  const isTr = locale === 'tr';

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let again = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let demoAvailable = true;
    setLoading(true);

    async function update() {
      if (!active || document.hidden) return;
      if (inFlight) { again = true; return; }
      clearTimeout(timer);
      inFlight = true;
      controller = new AbortController();
      const signal = controller.signal;
      try {
        // Settle the whole batch before scheduling another, including on failure.
        const [catalog, history, simulation] = await Promise.allSettled([
          getProducts(signal), getOrders(page, signal), demoAvailable ? getDemo(signal) : Promise.resolve(null),
        ]);
        if (!active || signal.aborted) return;
        if (catalog.status === 'rejected') throw catalog.reason;
        if (history.status === 'rejected') throw history.reason;
        if (simulation.status === 'rejected') throw simulation.reason;
        demoAvailable = simulation.value !== null;
        setProducts(catalog.value.products);
        setOrders(history.value);
        setDemo(simulation.value);
        setPollError('');
      } catch (error) {
        if (active && !signal.aborted) setPollError(inventoryError(error));
      } finally {
        inFlight = false;
        if (active) {
          setLoading(false);
          if (!document.hidden) {
            timer = setTimeout(() => { void update(); }, again ? 0 : 2000);
            again = false;
          }
        }
      }
    }

    function visibility() {
      if (document.hidden) {
        clearTimeout(timer);
        controller?.abort();
      } else { void update(); }
    }
    refresh.current = () => { void update(); };
    document.addEventListener('visibilitychange', visibility);
    void update();
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', visibility);
      refresh.current = () => {};
    };
  }, [page, userId]);

  async function submit(productId: number) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setActionError('');
    setNotice('');
    const submission = pending ?? { product_id: productId, request_id: crypto.randomUUID() };
    try {
      // Persist before sending. A timeout or page reload must retain this identifier.
      try { sessionStorage.setItem(storageKey, JSON.stringify(submission)); }
      catch { throw new ApiError(0, 'storage_unavailable', 'Allow browser session storage before placing an order.'); }
      setPending(submission);
      const { order } = await placeOrder(submission);
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setNotice(
        order.status === 'fulfilled'
          ? (isTr
              ? `Sipariş #${order.id} hazır! Dijital demo bağlantınız aşağıda teslim edildi. (Order #${order.id} is ready.)`
              : `Order #${order.id} is ready. Your demo link is below.`)
          : (isTr
              ? `Sipariş #${order.id} stok kuyruğuna alındı. Ürün tedarik edildiğinde otomatik olarak teslim edilecektir. (Order #${order.id} is waiting for stock.)`
              : `Order #${order.id} is waiting for stock. It will be delivered automatically.`),
      );
      if (page !== 1) setPage(1);
      else refresh.current();
    } catch (error) {
      setActionError(inventoryError(error));
      // Keep ambiguous outcomes and expired-session requests for a safe retry.
      if (error instanceof ApiError && [400, 404, 409].includes(error.status)) {
        try { sessionStorage.removeItem(storageKey); } catch { /* The request remains safe to replay. */ }
        setPending(null);
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function copy(url: string, orderId?: number) {
    try {
      await navigator.clipboard.writeText(url);
      setNotice(isTr ? 'Demo bağlantısı panoya kopyalandı. (Demo link copied.)' : 'Demo link copied.');
      if (orderId !== undefined) {
        setCopiedId(orderId);
        setTimeout(() => setCopiedId((prev) => (prev === orderId ? null : prev)), 2000);
      }
    } catch {
      setActionError(
        isTr
          ? 'Otomatik kopyalanamadı. Lütfen bağlantı metnini seçip manuel olarak kopyalayın.'
          : 'Could not copy automatically. Select the link text and copy it.',
      );
    }
  }

  const product = products[0];
  const demoProduct = demo?.products[0];
  const availableCount = product?.available_count ?? demoProduct?.available_count ?? 0;
  const userPendingOrders = orders?.results.filter((o) => o.status === 'pending').length ?? 0;

  return (
    <section className="inventory" aria-labelledby="inventory-title">
      {/* Live KPI Telemetry Strip */}
      <div className="kpi-grid" aria-label={isTr ? 'Gerçek Zamanlı Envanter Göstergeleri' : 'Real-Time Inventory Telemetry'}>
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">{isTr ? 'HAZIR DİJİTAL STOK' : 'AVAILABLE STOCK'}</span>
            <span className={`kpi-dot ${availableCount > 0 ? 'ok' : 'warn'}`} />
          </div>
          <div className="kpi-value">{product ? product.available_count : '—'}</div>
          <div className="kpi-foot">
            {demoProduct
              ? (isTr ? `Hedef Tampon: ${demoProduct.target_stock} adet` : `Target Buffer: ${demoProduct.target_stock} items`)
              : (isTr ? 'Anlık tahsise hazır' : 'Ready for instant allocation')}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">{isTr ? 'KUYRUKTAKİ SİPARİŞLER' : 'PENDING QUEUE (FIFO)'}</span>
            <span className={`kpi-dot ${(demoProduct?.pending_count ?? userPendingOrders) > 0 ? 'warn' : 'ok'}`} />
          </div>
          <div className="kpi-value">{demoProduct ? demoProduct.pending_count : userPendingOrders}</div>
          <div className="kpi-foot">
            {isTr ? 'İlk giren ilk çıkar (FIFO) önceliği' : 'Oldest-first (FIFO) fulfillment'}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">{isTr ? 'SİPARİŞ GEÇMİŞİM' : 'MY TOTAL ORDERS'}</span>
            <span className="kpi-dot info" />
          </div>
          <div className="kpi-value">{orders ? orders.count : '—'}</div>
          <div className="kpi-foot">
            {demoProduct
              ? (isTr ? `Sistem Geneli Teslim: ${demoProduct.fulfilled_count}` : `System Total Delivered: ${demoProduct.fulfilled_count}`)
              : (isTr ? 'Tekil teslimat garantili' : 'Guaranteed single-assignment')}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">{isTr ? 'TEDARİK İŞÇİSİ (WORKER)' : 'REPLENISHMENT WORKER'}</span>
            <span className={`kpi-dot ${demo?.paused ? 'warn' : 'ok'}`} />
          </div>
          <div className="kpi-value kpi-status-text">
            {demo
              ? demo.paused
                ? (isTr ? 'Duraklatıldı' : 'Paused')
                : demoProduct?.acquisition
                  ? demoProduct.acquisition.state.toUpperCase()
                  : (isTr ? 'Dengede' : 'Target Met')
              : (isTr ? 'Otonom' : 'Active')}
          </div>
          <div className="kpi-foot">
            {isTr ? '2 sn canlı senkronizasyon aktif' : '2s live polling sync active'}
          </div>
        </div>
      </div>

      {/* System Workflow Pipeline Explanation */}
      <div className="workflow-banner panel">
        <div className="workflow-header">
          <span className="eyebrow workflow-eyebrow">
            <span className="small-dot" />
            {isTr ? 'MİMARİ İŞ AKIŞI · SYSTEM PIPELINE' : 'ARCHITECTURAL WORKFLOW · SYSTEM PIPELINE'}
          </span>
          <span className="workflow-live-tag">
            <span className="pulse-dot" aria-hidden="true" />
            {isTr ? 'Canlı Veri Akışı (Her 2 saniyede güncellenir)' : 'Live Telemetry Stream (Refreshes every 2s)'}
          </span>
        </div>
        <div className="workflow-steps">
          <div className="workflow-step">
            <span className="workflow-num">01</span>
            <div>
              <strong>{isTr ? 'İdempotent Sipariş (UUID)' : 'Idempotent Order (UUID)'}</strong>
              <p>{isTr ? 'İstemci benzersiz bir request_id üretir; ağ kopmalarında mükerrer sipariş oluşmaz.' : 'Client generates a unique request_id; network retries never duplicate orders.'}</p>
            </div>
          </div>
          <div className="workflow-step">
            <span className="workflow-num">02</span>
            <div>
              <strong>{isTr ? 'Atomik Stok Tahsisi & FIFO' : 'Atomic Allocation & FIFO'}</strong>
              <p>{isTr ? 'Stok varsa anında teslim edilir; yoksa en eski bekleyen sipariş öncelikli olacak şekilde kuyruğa girer.' : 'Delivers immediately if in stock; otherwise queues oldest-first under PostgreSQL row locks.'}</p>
            </div>
          </div>
          <div className="workflow-step">
            <span className="workflow-num">03</span>
            <div>
              <strong>{isTr ? 'Otonom Tedarik (Worker)' : 'Autonomous Replenishment'}</strong>
              <p>{isTr ? 'Arka plan işçisi eksik stoku ve bekleyen talepleri algılayıp tedarikçiden yeni ürün çeker.' : 'Background worker detects demand or buffer deficit and acquires new digital items.'}</p>
            </div>
          </div>
          <div className="workflow-step">
            <span className="workflow-num">04</span>
            <div>
              <strong>{isTr ? 'Tekil Dijital Teslimat' : 'Unique Digital Delivery'}</strong>
              <p>{isTr ? 'Her dijital bağlantı veritabanı kısıtlamalarıyla yalnızca tek bir siparişe atanır.' : 'Database constraints ensure every inventory item is delivered at most once.'}</p>
            </div>
          </div>
        </div>
      </div>

      {pollError && (
        <div className="error" role="alert">
          <span>{pollError}</span>{' '}
          <button className="text-button" onClick={() => refresh.current()}>
            {isTr ? 'Yenile (Refresh)' : 'Refresh'}
          </button>
        </div>
      )}

      {/* Main 2-Column Dashboard Grid */}
      <div className="dashboard-grid">
        <div className="dashboard-main">
          {/* Digital Product & Ordering Card */}
          <div className="panel inventory-catalog-panel">
            <div className="inventory-heading">
              <p className="eyebrow">
                <span className="small-dot" />
                {isTr ? 'DİJİTAL ÜRÜN KATALOĞU · A LITTLE SOMETHING FOR YOU' : 'DIGITAL PRODUCT CATALOG · A LITTLE SOMETHING FOR YOU'}
              </p>
              <h2 id="inventory-title">
                {isTr ? 'Dijital Ürün Tahsis Konsolu (Your digital shelf)' : 'Your digital shelf.'}
              </h2>
              <p className="inventory-hint">
                {isTr
                  ? 'Demo dijital bağlantı siparişi verin. Hazır stok mevcutsa anında teslim edilir; aksi takdirde sıranız (FIFO) korunur ve tedarik tamamlandığında otomatik olarak atanır.'
                  : 'Order a demo link. Ready stock arrives instantly; otherwise, we’ll save your place in the FIFO queue and deliver automatically.'}
              </p>
            </div>

            {loading && !product && (
              <p role="status" className="inventory-hint loading-inline">
                <span className="spinner" aria-hidden="true" />
                {isTr ? 'Envanter verileri yükleniyor… (Loading inventory…)' : 'Loading inventory…'}
              </p>
            )}

            {product && (
              <div className="inventory-product">
                <div className="inventory-product-title">
                  <div>
                    <span className="product-sku">SKU: {product.code.toUpperCase()}</span>
                    <h3>{product.name}</h3>
                  </div>
                  <span className={`account-badge stock-badge ${product.available_count > 0 ? 'in-stock' : 'out-of-stock'}`}>
                    {isTr
                      ? `${product.available_count} adet hazır (${product.available_count} available)`
                      : `${product.available_count} available`}
                  </span>
                </div>

                <p className="inventory-hint product-description">
                  {isTr
                    ? 'Tek kullanımlık benzersiz gösterim URL’si (example.invalid). Gerçek ödeme veya aktivasyon içermez; uçtan uca stok tahsis ve tedarik mimarisini doğrular.'
                    : 'A unique demonstration URL (example.invalid). No payment, real product, or activation—built to verify end-to-end allocation and replenishment.'}
                </p>

                {pending && (
                  <div className="pending-retry-banner" role="status">
                    <strong>{isTr ? 'İdempotent Yeniden Deneme Hazır:' : 'Idempotent Retry Ready:'}</strong>{' '}
                    <span>
                      {isTr
                        ? `Önceki sipariş isteğiniz (${pending.request_id.slice(0, 8)}…) onay bekliyor. Yeniden denemek mükerrer kayıt oluşturmadan aynı siparişi getirir.`
                        : 'Your previous submission needs confirmation. Retrying retrieves the same order using the original request UUID.'}
                    </span>
                  </div>
                )}

                <button
                  className="button primary order-cta-button"
                  disabled={busy}
                  onClick={() => { void submit(product.id); }}
                >
                  {busy
                    ? (isTr ? 'Siparişiniz onaylanıyor… (Confirming your order…)' : 'Confirming your order…')
                    : pending
                      ? (isTr ? 'Son Siparişi Yeniden Dene (Retry last order)' : 'Retry last order')
                      : (isTr ? 'Demo Bağlantı Siparişi Ver (Order demo link)' : 'Order demo link')}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            )}

            {actionError && <p className="error" role="alert">{actionError}</p>}
            <p className={`inventory-notice ${notice ? 'has-notice' : ''}`} role="status">{notice}</p>
          </div>

          {/* Order History & Delivery Ledger */}
          <div className="panel inventory-orders-panel">
            <div className="orders-panel-header">
              <div className="inventory-heading">
                <p className="eyebrow">
                  <span className="small-dot" />
                  {isTr ? 'TESLİMAT KAYIT DEFTERİ · ORDER LEDGER' : 'DELIVERY LEDGER · ORDER HISTORY'}
                </p>
                <h3>{isTr ? 'Siparişlerim (My orders)' : 'My orders'}</h3>
                <p className="inventory-hint">
                  {isTr
                    ? 'Sayfayı yenilediğinizde veya oturumu kapatıp açtığınızda teslim edilen tüm bağlantılarınız burada güvenle saklanır.'
                    : 'Your links stay here after refresh or signing in again. Orders are sorted newest first.'}
                </p>
              </div>
              {orders && (
                <span className="orders-count-pill">
                  {isTr ? `Toplam ${orders.count} Sipariş` : `${orders.count} Total`}
                </span>
              )}
            </div>

            {orders && orders.results.length === 0 && (
              <div className="inventory-empty">
                <p>
                  {isTr
                    ? 'Henüz bir siparişiniz bulunmuyor. İlk dijital bağlantınızı oluşturmak için yukarıdaki sipariş butonunu kullanın. (Your first demo link is waiting to happen.)'
                    : 'Your first demo link is waiting to happen. Place an order above to receive an instant digital assignment.'}
                </p>
              </div>
            )}

            <ul className="inventory-orders" aria-label="Your orders" aria-busy={loading}>
              {orders?.results.map((order) => (
                <li key={order.id} className={`order-item ${order.status}`}>
                  <div className="inventory-order-title">
                    <div className="order-id-group">
                      <strong>{isTr ? `Sipariş #${order.id} (Order #${order.id})` : `Order #${order.id}`}</strong>
                      <span className="order-product-tag">{order.product_name}</span>
                    </div>
                    <span className={`order-status ${order.status}`}>
                      {order.status === 'fulfilled'
                        ? (isTr ? 'Teslim Edildi (Ready)' : 'Ready')
                        : (isTr ? 'Stok Bekliyor (Waiting for stock)' : 'Waiting for stock')}
                    </span>
                  </div>

                  <div className="order-timestamps">
                    <span>
                      {isTr ? 'Oluşturulma: ' : 'Created: '}
                      <time dateTime={order.created_at}>{new Date(order.created_at).toLocaleString()}</time>
                    </span>
                    {order.fulfilled_at && (
                      <span>
                        {isTr ? ' · Teslim: ' : ' · Fulfilled: '}
                        <time dateTime={order.fulfilled_at}>{new Date(order.fulfilled_at).toLocaleTimeString()}</time>
                      </span>
                    )}
                  </div>

                  {order.url ? (
                    <div className="order-delivery-box">
                      <code className="inventory-link">{order.url}</code>
                      <div className="inventory-copy">
                        <span>
                          {isTr
                            ? 'Gösterim bağlantısı · işlevsel değildir (Demo link · not functional)'
                            : 'Demo link · not functional'}
                        </span>
                        <button
                          className="text-button copy-btn"
                          onClick={() => { void copy(order.url!, order.id); }}
                        >
                          {copiedId === order.id
                            ? (isTr ? '✓ Kopyalandı (Copied)' : '✓ Copied')
                            : (isTr ? 'Bağlantıyı Kopyala (Copy link)' : 'Copy link')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="inventory-hint pending-delivery-note">
                      <span className="spinner" aria-hidden="true" />
                      <span>
                        {isTr
                          ? 'Tedarik işçisi yeni stok sağladığında bağlantınız bu alana otomatik olarak teslim edilecektir. (We’ll deliver your link here automatically when it arrives.)'
                          : 'We’ll deliver your link here automatically when it arrives.'}
                      </span>
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {orders && (orders.previous || orders.next) && (
              <nav className="inventory-pagination" aria-label="Order history pages">
                <button
                  className="button secondary compact"
                  disabled={!orders.previous || loading}
                  onClick={() => setPage((current) => current - 1)}
                >
                  {isTr ? '← Önceki (Previous)' : '← Previous'}
                </button>
                <span>
                  {isTr
                    ? `Sayfa ${page} · Toplam ${orders.count} sipariş (Page ${page} · ${orders.count} orders)`
                    : `Page ${page} · ${orders.count} orders`}
                </span>
                <button
                  className="button secondary compact"
                  disabled={!orders.next || loading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {isTr ? 'Sonraki (Next) →' : 'Next →'}
                </button>
              </nav>
            )}
          </div>
        </div>

        {/* Side Column: Simulation Controls & Architecture Guarantees */}
        <aside className="dashboard-side">
          {demo && <InventoryDemo state={demo} onUpdated={() => refresh.current()} />}

          <div className="panel system-guarantees-panel">
            <p className="eyebrow">
              <span className="small-dot" />
              {isTr ? 'SİSTEM GÜVENCELERİ · ARCHITECTURAL GUARANTEES' : 'ARCHITECTURAL GUARANTEES'}
            </p>
            <h3>{isTr ? 'Tasarım ve Güvenilirlik İlkeleri' : 'Design & Reliability Invariants'}</h3>
            <ul className="guarantees-list">
              <li>
                <strong>{isTr ? 'Bire-Bir Tahsis (Exactly-Once Assignment):' : 'One-to-One Item Ownership:'}</strong>
                <span>
                  {isTr
                    ? 'PostgreSQL kısıtlamaları sayesinde hiçbir dijital ürün birden fazla siparişe veya kullanıcıya atanamaz.'
                    : 'PostgreSQL unique constraints guarantee no inventory item is ever assigned to more than one order.'}
                </span>
              </li>
              <li>
                <strong>{isTr ? 'Kesintiye Dayanıklı Tedarik (Durable Jobs):' : 'Crash-Resilient Acquisition:'}</strong>
                <span>
                  {isTr
                    ? 'Tedarik işçisi yeniden başlatılsa bile yarım kalan görev aynı UUID ile kaldığı yerden devam eder.'
                    : 'Interrupted worker jobs resume with the same deterministic provider UUID across restarts.'}
                </span>
              </li>
              <li>
                <strong>{isTr ? 'Oturum ve CSRF Koruması:' : 'Session & CSRF Protection:'}</strong>
                <span>
                  {isTr
                    ? 'Tüm yazma işlemleri HttpOnly çerezler ve her istekte yenilenen maskeli CSRF belirteçleri ile korunur.'
                    : 'All mutations require HttpOnly session cookies and fresh masked CSRF tokens.'}
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
