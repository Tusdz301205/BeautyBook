# BeautyBook frontend design research

Research date: 2026-07-14. The references below inform interaction patterns only; no proprietary source or assets are copied.

## Product and users

BeautyBook combines a public beauty marketplace, customer booking portal, salon operations suite, and permission-scoped platform backoffice. Guest/Customer need confidence and low-friction booking. Staff/Receptionist need fast daily actions. Managers/Owners need scoped operations and reporting. Support/Compliance/Marketing/Finance/Admin need dense, auditable tools without cross-scope exposure.

## Problems in the existing frontend

- One shell visually conflates 11 roles into three labels.
- Pink/lavender covers backgrounds, borders, buttons, and statuses, weakening hierarchy.
- Page-local forms/tables/dialogs duplicate styles and omit consistent labels, errors, focus handling, and loading states.
- Operational pages mix English/Vietnamese and inconsistent density/radius.
- Many async pages collapse errors into toasts or blank/partial content.
- Charts still import palette data from `mockData.js` even when the metrics are real.
- Customer and booking screens are desktop compositions shrunk for mobile rather than mobile-first journeys.

## References reviewed

| Reference | Strengths | Limitations for BeautyBook | Pattern adopted |
|---|---|---|---|
| [Fresha Calendar](https://www.fresha.com/help-center/knowledge-base/calendar) | Staff/resource scheduling, blocked time, availability, cross-device operations | Proprietary product; broader feature set | Calendar hierarchy, resource clarity, operational filters |
| [Booksy Biz features](https://biz.booksy.com/features) | Salon/staff management, customer organization, revenue reporting | Feature-heavy and commercially branded | Role/task grouping and connected operational context |
| [Vagaro Calendar](https://www.vagaro.com/pro/calendar) | Day management from mobile, salon-specific calendar language | Dense product surface can overwhelm | Mobile daily schedule and clear task priority |
| [Mindbody Business app](https://www.mindbodyonline.com/en-gb/business/business-app) | Staff schedule and client operations on mobile | Class/fitness concepts are not all relevant | Staff-first mobile information order |
| [Calendly Scheduling page](https://help.calendly.com/hc/en-us/articles/360022356594-Home-page-overview?locale=en-us) | Progressive disclosure and compact scheduling tools | Meeting scheduling lacks salon resource complexity | Clear step ownership and contextual actions |
| [Stripe refunds documentation](https://docs.stripe.com/refunds) | Trustworthy payment/refund status and guarded destructive workflow | Payment provider semantics cannot be copied into existing workflow | Detail-first finance layout and explicit confirmation |
| [Shopify Polaris](https://polaris.shopify.com/) | Mature admin information architecture and reusable patterns | Shopify visual identity is not BeautyBook | Dense navigation, index/filter conventions |
| [shadcn/ui dashboard blocks](https://ui.shadcn.com/blocks?category=dashboard) | Responsive, accessible, composable shells/tables/charts | Installing wholesale would create migration risk | Component composition and state variants only |
| [FullCalendar React](https://fullcalendar.io/docs/react) | Documented calendar semantics and React integration | Resource timeline is premium-licensed | Day/week/month conventions; keep custom scheduler |
| [FullCalendar license](https://fullcalendar.io/license) | Clear split between MIT standard and commercial premium | Premium resource views require a commercial license | Explicit decision not to add premium dependency |

## Local UX/UI skill output

The repository generator was run for design-system, UX, typography, color, and React-stack recommendations. Useful outputs kept:

- Marketplace search/selection should minimize friction.
- Mobile-first forms need correct input types, autofill, required markers, and submit feedback.
- React dialogs must manage/restore focus; dynamic feedback needs live regions.
- `Be Vietnam Pro` is the preferred primary family for Vietnamese readability.
- A neutral premium palette gives operational data more hierarchy than beauty-category pink/lavender.

Generator outputs rejected:

- Pink/lavender on every surface.
- Glass navigation and repeated glass cards.
- Spring/bobbing/parallax motion.
- Calistoga as the operational heading font.

Those suggestions conflict with the supplied brief, dense workflows, and long Vietnamese labels. The curated `design-system/MASTER.md` overrides them.

## Chosen direction: Warm Editorial Operations

- Public/customer: warm neutral canvas, restrained editorial display moments, confident imagery, prominent search/step progress.
- Salon/platform: solid surfaces, high information density, crisp tables/calendars, sticky contextual controls, and minimal decorative motion.
- Brand accent: orchid/rose only for primary action and selection; ink and neutrals dominate.
- Typography: Be Vietnam Pro for all operational and Vietnamese content; optional Fraunces only for public brand statements.
- Icons: Lucide only. Status always includes readable text.

## Rejected directions

- Generic blue admin template: clear but erases product identity.
- Full beauty pink/lavender theme: low hierarchy and weak fit for finance/compliance.
- Full glassmorphism: poor density, contrast, and performance.
- Mixed component libraries: inconsistent interaction/accessibility and unnecessary bundle cost.
- Copying commercial templates: licensing and maintainability risk.
- FullCalendar Premium: licensing cost and unnecessary replacement of working scheduler logic.

## Implementation rules derived from research

- Four distinct shells: Public, Customer, Salon/Business, Platform.
- One token layer and one primitive layer; page components do not invent colors/radii.
- Forms use persistent labels and inline field errors; placeholder is supplemental only.
- Tables use priority columns/cards at 375px and never force whole-page horizontal scroll.
- Async routes provide shape-matched skeleton, contextual empty state, error message, and retry.
- Route navigation and action affordances are permission-driven; backend remains final enforcement.
