// The one type scale for the realtor, marketplace and shared screens. Sizes are in dp and deliberately few: a phone screen
// reads best with a short, steady ladder. Use these names in new code instead of typing a number.
//
// Phones also let people enlarge text system-wide. Without a limit that setting multiplies every size (often 1.3–2×), which
// is what made screens look "ultra zoomed". FONT_SCALE_LIMIT keeps a small amount of scaling for accessibility and stops there.

export const FONT_SCALE_LIMIT = 1.15;

export const type = {
  caption: 10.5, // tiny uppercase labels, badges, counters
  helper: 11.5, // helper and error text under inputs, tab labels, timestamps
  body: 12.5, // descriptions and secondary lines
  label: 13.5, // form labels, chips, list titles
  control: 14.5, // inputs, buttons, menu rows
  heading: 16, // card and section titles
  title: 18, // sheet titles, empty-state titles
  page: 20, // page titles
  stat: 22, // large numbers on stat cards
  display: 36, // one-off hero numbers (average rating)
} as const;

export type TypeToken = keyof typeof type;
