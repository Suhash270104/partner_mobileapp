// The payment return page of the website, where Cashfree's full-page checkout ends. The server sends
// its exact address as order.returnUrl; the path alone is the fallback for a server that does not send
// it yet. A payment view watches for this address to know the checkout is over.
const RETURN_PATH = '/payments/return';

const addressParts = (url: string) => {
  const match = /^https?:\/\/([^/?#]+)([^?#]*)/i.exec(url);
  return match ? { host: match[1].toLowerCase(), path: match[2].replace(/\/+$/, '') } : null;
};

export function isPaymentReturn(url: string, returnUrl?: string): boolean {
  const target = addressParts(url);
  if (!target) return false;
  const expected = returnUrl ? addressParts(returnUrl) : null;
  return expected ? target.host === expected.host && target.path === expected.path : target.path.endsWith(RETURN_PATH);
}
