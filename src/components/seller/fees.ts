/** Matches public.buyer_checkout: buyer pays net product price plus 1% service fee per line; seller fee is deducted from product revenue. */
export const ADMIN_FEE_PCT = 5;
export const SERVICE_FEE_PCT = 1;

export function calcCheckout(lines: number[], discount: number) {
  const subtotal = lines.reduce((s, n) => s + n, 0);
  const d = Math.min(Math.floor(discount), subtotal);
  let net = 0, adminFee = 0, serviceFee = 0;
  for (const line of lines) {
    const ldisc = subtotal > 0 ? Math.floor((d * line) / subtotal) : 0;
    const lnet = line - ldisc;
    net += lnet;
    adminFee += Math.round((lnet * ADMIN_FEE_PCT) / 100);
    serviceFee += Math.round((lnet * SERVICE_FEE_PCT) / 100);
  }
  return { subtotal, discount: subtotal - net, adminFee, serviceFee, total: net + serviceFee, sellerNet: net - adminFee };
}
