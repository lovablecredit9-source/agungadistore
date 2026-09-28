/** Stable UUID-derived reference: never derive from the legacy serial order_number. */
export const orderCode = (order: { id: string; order_code?: string | null }) => `#${order.order_code || order.id.replace(/-/g, "").toLowerCase()}`;
