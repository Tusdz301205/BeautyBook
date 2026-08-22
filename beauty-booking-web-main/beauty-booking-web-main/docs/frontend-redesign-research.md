# BeautyBook frontend redesign research

## 1. Product understanding

BeautyBook is four connected products sharing one permission model: a public beauty marketplace, a customer booking portal, a salon operations workspace, and a platform backoffice. The interface must feel premium to customers while remaining dense, predictable, and auditable for operators.

## 2. Existing frontend issues

- Route protection is permission-aware, but the visual shell still treats `admin`, `salon`, and `customer` as the full role model.
- Pages use real APIs, but loading, empty, retry, pagination, and error patterns are inconsistent.
- Scheduling KPI values are global instead of scoped to the visible date range.
- Day view uses staff rows with horizontal time; the target workflow needs vertical time and staff columns.
- Week view keeps a fixed staff rail and does not render a true seven-day time grid.
- Month view mixes aggregates and event cards instead of prioritizing daily operational volume.
- Large pages repeat raw table, button, drawer, and status CSS rather than shared primitives.
- The current pink/lavender palette is too dominant for an operational SaaS and reduces information hierarchy.

## 3. References reviewed

1. **Fresha calendar and scheduling** — domain reference for team/resource calendars, custom calendar filters, availability, blocked time, and multi-location operations. Used as behavior inspiration only; no proprietary code or visual assets copied.
2. **Cal.com** — scheduling information architecture, availability-first workflows, compact controls, and clear progressive disclosure. Open-source reference; implementation remains native to BeautyBook.
3. **FullCalendar React demos** — day grid and time grid conventions, sticky headers, all-day/date navigation, and accessible calendar semantics. Its non-premium bundle is MIT licensed, but BeautyBook keeps its current custom implementation to avoid a dependency migration.
4. **shadcn/ui dashboard blocks** — composable sidebar, metric, table, drawer, skeleton, and filter-bar patterns. Used as component-architecture inspiration; no bulk library installation.
5. **Linear-style operational SaaS patterns** — restraint, dense hierarchy, keyboard-visible focus, and low-noise surfaces. Used only as general interaction inspiration.

## 4. What was learned

- Scheduling tools should answer a different question per view: people/time in Day, date/time in Week, and operational volume in Month.
- Filters and KPI must share the same dataset and scope to avoid misleading operators.
- Beauty branding belongs in typography, imagery, and carefully placed accent—not every surface.
- Backoffice tables need stable columns and contextual drawers; mobile needs priority cards rather than compressed desktop tables.
- Permission-aware navigation must be paired with permission-aware actions and backend enforcement.

## 5. Chosen design direction

`Editorial Precision`: warm neutral surfaces, ink typography, a restrained orchid/rose accent, elegant serif only for brand/page emphasis, and Inter for operational UI. Light glass treatment is reserved for overlays and the public marketplace; data-heavy workspaces use solid high-contrast surfaces.

## 6. Rejected directions

- Full glassmorphism: weak hierarchy and expensive in dense calendars.
- Neon gradients and heavy animation: inappropriate for trusted business operations.
- Generic admin-template blue: loses BeautyBook identity.
- Full shadcn or TypeScript migration in one pass: unnecessary risk to current routing and API integrations.
- Copying commercial salon templates: licensing and maintainability risk.

## 7. Design system summary

- Body/UI: Inter; editorial display: Playfair Display.
- 4/8px spacing rhythm; 8/12/16px radii only.
- Solid white operational cards on warm neutral canvas.
- Orchid accent for primary actions and active navigation; semantic colors for status.
- 150–250ms motion with `prefers-reduced-motion` support.
- Lucide icons only; no emoji as structural UI.

## 8. Navigation architecture

- Platform: overview, salons, users, appointments, finance, campaigns, reports, reviews, risk, compliance, settings.
- Salon: overview, appointments, services, team, promotions, reviews, payments, reports, branch settings.
- Customer: appointments, profile, privacy, security.
- Public: marketplace and linear booking wizard.

Every item remains filtered by backend-provided permissions. `sessionType` selects the shell only.

## 9. Responsive strategy

- 1440/1024: persistent sidebar, dense tables, full calendar.
- 768: collapsible sidebar, horizontally scrollable Day/Week grids.
- 375: drawer navigation, priority cards, full-screen detail drawers, compact Month view.
- No whole-page horizontal overflow; only purpose-built grid scroll regions.

## 10. Accessibility strategy

- Visible `:focus-visible` ring and minimum 44px control targets.
- Buttons use labels/`aria-label`; drawers support Escape and focus restoration.
- Status always combines text/icon with color.
- Table headers, form labels, error messages, and live loading states remain semantic.
- Contrast target WCAG AA and reduced-motion preference respected.

