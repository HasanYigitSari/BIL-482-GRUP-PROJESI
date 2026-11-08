import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../lib/api';
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
  const [pending, setPending] = useState<Submission | null>(() => storedSubmission(storageKey));
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const refresh = useRef<() => void>(() => {});

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
      setNotice(order.status === 'fulfilled' ? `Order #${order.id} is ready. Your demo link is below.` : `Order #${order.id} is waiting for stock. It will be delivered automatically.`);
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

  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setNotice('Demo link copied.'); }
    catch { setActionError('Could not copy automatically. Select the link text and copy it.'); }
  }

  const product = products[0];
  return (
    <section className="inventory" aria-labelledby="inventory-title">
      <div className="inventory-heading">
        <p className="eyebrow">A LITTLE SOMETHING FOR YOU</p>
        <h2 id="inventory-title">Your digital shelf.</h2>
        <p className="inventory-hint">Order a demo link. Ready stock arrives instantly; otherwise, we’ll save your place.</p>
      </div>
      {pollError && <div className="error" role="alert">{pollError} <button className="text-button" onClick={() => refresh.current()}>Refresh</button></div>}
      {loading && !product && <p role="status" className="inventory-hint">Loading inventory…</p>}
      {product && <div className="inventory-product">
        <div className="inventory-product-title"><h3>{product.name}</h3><span className="account-badge">{product.available_count} available</span></div>
        <p className="inventory-hint">A unique demonstration URL. No payment, real product, or activation.</p>
        {pending && <p className="inventory-hint" role="status">Your previous submission needs confirmation. Retrying retrieves the same order.</p>}
        <button className="button primary" disabled={busy} onClick={() => { void submit(product.id); }}>
          {busy ? 'Confirming your order…' : pending ? 'Retry last order' : 'Order demo link'}<span aria-hidden="true">↗</span>
        </button>
      </div>}
      {actionError && <p className="error" role="alert">{actionError}</p>}
      <p className="inventory-notice" role="status">{notice}</p>
      <div className="inventory-heading"><h3>My orders</h3><p className="inventory-hint">Your links stay here after refresh or signing in again.</p></div>
      {orders && orders.results.length === 0 && <p className="inventory-empty">Your first demo link is waiting to happen.</p>}
      <ul className="inventory-orders" aria-label="Your orders" aria-busy={loading}>
        {orders?.results.map((order) => <li key={order.id}>
          <div className="inventory-order-title"><strong>Order #{order.id}</strong><span className={`order-status ${order.status}`}>{order.status === 'fulfilled' ? 'Ready' : 'Waiting for stock'}</span></div>
          <p className="inventory-hint"><time dateTime={order.created_at}>{new Date(order.created_at).toLocaleString()}</time></p>
          {order.url ? <>
            <code className="inventory-link">{order.url}</code>
            <div className="inventory-copy"><span>Demo link · not functional</span><button className="text-button" onClick={() => { void copy(order.url!); }}>Copy link</button></div>
          </> : <p className="inventory-hint">We’ll deliver your link here automatically when it arrives.</p>}
        </li>)}
      </ul>
      {orders && (orders.previous || orders.next) && <nav className="inventory-pagination" aria-label="Order history pages">
        <button className="text-button" disabled={!orders.previous || loading} onClick={() => setPage((current) => current - 1)}>Previous</button>
        <span>Page {page} · {orders.count} orders</span>
        <button className="text-button" disabled={!orders.next || loading} onClick={() => setPage((current) => current + 1)}>Next</button>
      </nav>}
      {demo && <InventoryDemo state={demo} onUpdated={() => refresh.current()} />}
    </section>
  );
}
