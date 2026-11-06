// Studio dashboard navigation. The bottom bar carries the four desktop bar items (dashboard, projects,
// messages, clients) plus "Studio", which opens the hub listing every other desktop section.
export const TAB_BAR = [
  { key: 'dashboard', label: 'Dashboard', path: '/professional/dashboard', glyph: '▦' },
  { key: 'clients', label: 'Clients', path: '/professional/clients', glyph: '☺' },
  { key: 'projects', label: 'Projects', path: '/professional/projects', glyph: '▤' },
  { key: 'messages', label: 'Messages', path: '/professional/messages', glyph: '✉' },
  { key: 'studio', label: 'Studio', path: '/professional/studio', glyph: '◈' },
] as const;

export interface StudioSection { key: string; label: string; hint: string; path: string; glyph: string; built: boolean }

// Every desktop dashboard section (same ids and groups as the desktop DESIGNER_NAV) reachable from the
// Studio hub. `built` is flipped to true as each section's screen lands.
export const STUDIO_SECTIONS: { group: string; items: StudioSection[] }[] = [
  { group: 'Pipeline', items: [
    { key: 'find_projects', label: 'Find projects', hint: 'Open client briefs near you', path: '/professional/find-projects', glyph: '⌕', built: true },
    { key: 'project_management', label: 'Project management', hint: 'Site logs, milestones & escrow sign-off', path: '/professional/project-management', glyph: '▥', built: true },
    { key: 'proposals', label: 'Proposals', hint: 'Quotes you have sent', path: '/professional/proposals', glyph: '▤', built: true },
    { key: 'bookings', label: 'Meetings', hint: 'Bookings & consultations', path: '/professional/bookings', glyph: '◷', built: true },
    { key: 'followups', label: 'Follow-ups', hint: 'Calls and reminders', path: '/professional/followups', glyph: '✆', built: true },
    { key: 'reports', label: 'Reports', hint: 'Studio reports', path: '/professional/reports', glyph: '▧', built: true },
    { key: 'shortlisted', label: 'Shortlisted', hint: 'Projects clients shortlisted you for', path: '/professional/shortlisted', glyph: '★', built: true },
  ] },
  { group: 'Growth', items: [
    { key: 'reviews', label: 'Reviews', hint: 'Client ratings & replies', path: '/professional/reviews', glyph: '☆', built: true },
    { key: 'analytics', label: 'Analytics', hint: 'Funnel, earnings & margins', path: '/professional/analytics', glyph: '▂', built: true },
  ] },
  { group: 'Studio', items: [
    { key: 'profile', label: 'Profile & portfolio', hint: 'Public profile, projects & credentials', path: '/professional/profile', glyph: '☺', built: true },
    { key: 'team', label: 'Team', hint: 'Invite and manage members', path: '/professional/team', glyph: '⚇', built: true },
    { key: 'services', label: 'Services', hint: 'What your studio offers', path: '/professional/services', glyph: '✦', built: true },
  ] },
  { group: 'Account', items: [
    { key: 'payments', label: 'Payments & invoices', hint: 'Escrow, payouts & tax invoices', path: '/professional/payments', glyph: '₹', built: true },
    { key: 'settings', label: 'Settings', hint: 'Notifications, areas & security', path: '/professional/settings', glyph: '⚙', built: true },
  ] },
];

export const MAIN_TAB_KEYS: string[] = ['dashboard', 'clients', 'projects', 'messages'];

export function activeTabKey(pathname: string): string {
  const segment = pathname.replace(/^\/professional\/?/, '').split('/')[0] || 'dashboard';
  return MAIN_TAB_KEYS.includes(segment) ? segment : 'studio';
}
