import { api, ApiError } from './api';

export type Product = { id: number; code: string; name: string; available_count: number };
export type Order = {
  id: number; product_id: number; product_name: string; status: 'pending' | 'fulfilled';
  url: string | null; created_at: string; fulfilled_at: string | null;
};
export type OrderPage = { count: number; next: string | null; previous: string | null; results: Order[] };
export type Acquisition = {
  state: 'queued' | 'running' | 'retry' | 'blocked'; attempts: number;
  retry_at: string | null; error_code: string; message: string; updated_at: string;
};
export type DemoProduct = {
  id: number; name: string; target_stock: number; available_count: number;
  pending_count: number; fulfilled_count: number; acquisition: Acquisition | null;
};
export type DemoState = { paused: boolean; fail_next: boolean; products: DemoProduct[] };
export type DemoAction = 'pause' | 'resume' | 'fail_next' | 'set_target' | 'retry';
export type Submission = { product_id: number; request_id: string };

export const getProducts = (signal?: AbortSignal) => api<{ products: Product[] }>('products/', undefined, signal);
export const getOrders = (page: number, signal?: AbortSignal) => api<OrderPage>(`orders/?page=${page}`, undefined, signal);
export const placeOrder = (submission: Submission) => api<{ order: Order }>('orders/', submission);

export async function getDemo(signal?: AbortSignal): Promise<DemoState | null> {
  try { return await api<DemoState>('demo/inventory/', undefined, signal); }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export const changeDemo = (product_id: number, action: DemoAction, target_stock?: number) =>
  api<DemoState>('demo/inventory/', { product_id, action, ...(target_stock === undefined ? {} : { target_stock }) });

export function inventoryError(error: unknown): string {
  return error instanceof ApiError ? error.message : 'The request could not be completed. Please try again.';
}
