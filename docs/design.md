# BeautyBook design system — Segment A + B

## Direction

BeautyBook uses a modern-minimal operational workbench with a warm editorial register. Public discovery may be more expressive; authenticated workspaces remain dense, calm, and task-first. The interface preserves every existing role, route, permission and booking action.

## Structure

- Public discovery: Marquee Hero with clear salon/service search and one primary action.
- Business/platform/customer apps: Workbench shell with persistent navigation, compact page header, filters, primary work surface and contextual drawers.
- Policies, onboarding and reports: Long Document rhythm with a readable 65–75 character measure.

## Visual language

- Display: Fraunces 600–700 for public/editorial emphasis only.
- Body: Be Vietnam Pro 400–700 for Vietnamese UI legibility.
- Tabular/outlier data: IBM Plex Mono 400–500.
- Canvas is warm oat, ink is berry-tinted near-black, accent is BeautyBook berry pink. Accent is reserved for the primary action, active state and focus signal.
- Surfaces use hairline borders and small elevation changes. No pervasive glassmorphism, gradient decoration or floating-card grids.

## Interaction contract

- Every action has default, hover, focus-visible, active, disabled, loading, error and success treatment.
- Minimum touch target is 44×44 px. Input and button heights align.
- Drawers/dialogs trap focus, close with Escape/backdrop/explicit close, and restore focus.
- Motion is limited to state transitions and calendar auto-scroll; reduced-motion users receive instant transitions.
- Empty states explain why they are empty and expose a relevant next action.

## Responsive contract

- Mobile-first; verify at 320, 375, 414 and 768 CSS px.
- No `100vw`, no horizontal document scroll, no wrapped primary affordances.
- Data tables collapse or scroll within a labelled region; scheduler remains an intentional horizontal work surface.
- Desktop sidebar becomes a modal sheet on narrow screens.

## Product-specific rules

- Calendar cards always show time, customer, service and status without hiding the leading hour.
- Notification rows open a detail view and route to the target entity.
- Combo and recurring bookings reuse the same price, availability and concurrency rules as normal bookings.
- Legal documents are uploaded to private storage; public images are served through opaque media IDs.

## Exports

### 2026-07-21 — Full product redesign contract

- Public details: Long Document with numbered editorial chapters for visit information, services, people, gallery and approved reviews.
- Authentication: Split Diptych with a project-owned media slot, explicit labels, inline validation and no demo-role controls.
- Customer checkout: one booking flow for authenticated customers and guests; guest contact is collected only at the final information step and account creation is optional.
- Authenticated applications: one Workbench shell whose navigation is filtered by real role and permission data; customer, staff, receptionist, manager, owner and platform responsibilities are not duplicated into separate visual products.
- Calendar: scheduler remains the primary operational surface; empty data keeps the time grid visible, contextual notifications deep-link to the relevant booking, and mobile retains an intentional scrollable calendar surface.
- Media: public pages render backend-provided URLs first and otherwise use named, ratio-stable slots from `src/config/homeMedia.js`; no network image fallback.
- Validation: all forms expose visible labels, required semantics, focus-visible states, inline errors and loading/disabled submission states.

### 2026-07-21 — Public discovery homepage

- Genre/tone: warm editorial luxury; premium but approachable.
- Macrostructure: Marquee Hero using an H2 split diptych, search-first marketplace entry and editorial section rhythm.
- Navigation/footer: N2 two-tier utility + discovery navigation on desktop, accessible drawer on mobile; Ft1 mast-headed footer.
- Media strategy: E8 photography slots with stable ratios; project-owned media only, configured in `src/config/homeMedia.js`.
- Data contract: public `GET /branches` and `GET /services/categories`; no homepage-wide promotion, availability or review claims without a matching public endpoint.
- Route contract: `/` for guest discovery, `/explore` for filtered results, existing `/explore/branches/:id` details and `/book` wizard remain the only conversion paths.

```css
/* Canonical public-discovery tokens live in frontend/tokens.css. */
:root {
  --color-paper: oklch(97% 0.008 25);
  --color-ink: oklch(20% 0.014 350);
  --color-accent: oklch(55% 0.19 356);
  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'Be Vietnam Pro', 'Noto Sans', system-ui, sans-serif;
  --maxw-page: 82rem;
}
```

### 2026-07-21 — Fresha-inspired marketplace refinement

- Inspiration boundary: borrow only the search-first marketplace information architecture and the fast route from discovery to booking; do not reproduce Fresha branding, copy, imagery, markup or pixel composition.
- Macrostructure: Ecosystem Index. The homepage opens with one expressive search surface, then moves through service categories and independently scrollable real-data rails before the concise product explanation.
- Hero: a left-biased headline and a large capsule search sit inside one restrained lavender field. Blue and peach remain semantic media-slot and section tints, not free-floating decoration.
- Navigation/footer: N5-inspired compact sticky capsule on desktop, accessible full-width bar and modal drawer on small screens; Ft5 statement close.
- Marketplace cards: F6 uniform product rhythm, 4:3 project-owned image slots, one information hierarchy (name, verified rating when present, address, category/price) and one clear route into details. No nested card chrome.
- Detail pages: a real gallery-led header, readable service/team/review sections and a desktop sticky booking panel. Mobile receives a C4-inspired bottom booking bar with safe-area padding.
- Staff language: public surfaces expose professional titles and service specialties, never internal authorization roles. “Bất kỳ chuyên viên phù hợp” remains the recommended booking choice.
- Data contract: every recommendation, rating, price, category, service, person and promotion comes from a public API response. Sections disappear or show a truthful state when the source is absent; no synthetic proximity or availability claims.
- Theme: custom tuned, “bright beauty marketplace, crisp and approachable”; axes `light / geometric-sans / cool-chromatic`. Be Vietnam Pro is the public display/body face for Vietnamese legibility; Fraunces remains limited to the BeautyBook wordmark accent.
- Interaction: rail arrows disable at their boundaries, filters remain keyboard-operable, no autoplay, no scroll hijacking, visible focus, 44 px targets and reduced-motion fallbacks.
- Authenticated Workbench tokens and scheduler behavior remain unchanged.

### 2026-07-22 — System-wide visual polish and depth refinement

- Scope boundary: this pass preserves the existing information architecture, routes, API calls, authentication, RBAC, business workflows, CustomerShell and scheduler behavior. It refines hierarchy and interaction without introducing a second design system.
- Foundation: `tokens.css` is the canonical source for complete neutral, berry, lavender, blue and peach scales; five surface levels; soft/base/strong/focus borders; XS–LG elevation; aligned typography, spacing, radius, duration and easing tokens.
- Depth model: public and customer discovery may use restrained asymmetric lavender/blue/peach fields. Salon workspaces use medium depth and clear task grouping. Platform administration remains data-first with flatter surfaces and stronger table/filter hierarchy.
- Shared control contract: all former native selects render through the shared accessible combobox/listbox. It supports controlled and uncontrolled values, keyboard navigation, selected checks, disabled/loading/empty states, click-outside dismissal, focus restoration, searchable long lists, ARIA semantics and a mobile bottom sheet.
- Customer empty state: the appointment page gives one primary booking action, one discovery action and recommendations loaded from the real public branches endpoint; loading, error and genuinely empty results are stated honestly.
- Motion/accessibility: motion is limited to purposeful state changes; focus-visible signals remain explicit; `prefers-reduced-motion` removes non-essential transitions and smooth scrolling.
- Responsive QA contract: public discovery, customer appointments, business scheduler and platform workbench must not create document-level horizontal overflow at 320, 375, 390, 768, 1024, 1280 or 1440 CSS px. Intentional table/calendar scrolling stays within its own labelled surface.
