// Money helpers shared by the studio dashboard, analytics and revenue screens. Quotes are typed by
// studios as text ("₹45 L", "1.2 Cr" or a plain rupee number), so amounts are read in lakhs.

// Same parsing as the desktop analytics: "₹45 L", "1.2 Cr" or a plain rupee number -> lakhs.
export const lakhsOf = (priceEst?: string | number | null): number => {
  const raw = String(priceEst ?? '').replace(/[₹,\s]/g, '');
  const cr = raw.match(/([\d.]+)\s*[Cc][Rr]/);
  const l = raw.match(/([\d.]+)\s*[Ll]/);
  if (cr) return parseFloat(cr[1]) * 100;
  if (l) return parseFloat(l[1]);
  const n = parseFloat(raw);
  return Number.isNaN(n) ? 0 : n / 100000;
};

// Statuses of a proposal the client accepted (the project is awarded, running or finished).
export const WON_STATUSES = ['Won', 'Awarded', 'Accepted', 'Completed', 'In Progress', 'Work in Progress'];
export const isWonStatus = (status?: string): boolean => WON_STATUSES.includes(status || '');

export const formatRevenue = (lakhs: number): string => (lakhs >= 100 ? `₹${(lakhs / 100).toFixed(2)} Cr` : lakhs > 0 ? `₹${lakhs.toFixed(2).replace(/\.00$/, '')}L` : '₹0');
