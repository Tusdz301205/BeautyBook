# BeautyBook Design System

This file is the global source of truth. Page overrides live in `design-system/pages/` and may only document deviations.

## Brand

BeautyBook combines premium beauty discovery with dependable salon operations. The interface should feel considered, calm, and trustworthy—not decorative, playful, or template-like.

## Palette

| Token | Value | Use |
|---|---:|---|
| `--color-canvas` | `#F7F6F4` | Application background |
| `--color-surface` | `#FFFFFF` | Cards, tables, panels |
| `--color-surface-subtle` | `#F1EFEC` | Quiet controls and grouped rows |
| `--color-ink` | `#18181B` | Primary text and dark actions |
| `--color-ink-soft` | `#52525B` | Secondary text |
| `--color-muted` | `#71717A` | Metadata |
| `--color-border` | `#E4E1DD` | Dividers and borders |
| `--color-brand` | `#C0266D` | Primary BeautyBook accent |
| `--color-brand-strong` | `#9D174D` | Hover/active accent |
| `--color-brand-soft` | `#FCE7F3` | Selected and highlighted surfaces |
| `--color-focus` | `#2563EB` | Keyboard focus ring |
| `--color-danger` | `#B42318` | Destructive actions |

Status colors are semantic and must not replace their text labels: Pending amber, Confirmed blue, Checked-in cyan, In-progress violet, Completed green, Cancelled red, No-show gray.

## Typography

- UI/body: Be Vietnam Pro, 14–16px, weights 400/500/600/700. Noto Sans and system sans are fallbacks.
- Brand/page emphasis: Fraunces, used sparingly for public hero and selected marketplace statements; never for dense operational controls.
- Numeric data: Be Vietnam Pro tabular numerals; code/IDs may use IBM Plex Mono.
- No body copy below 12px; normal operational copy targets 14px.

## Spacing and layout

- Base rhythm: 4px; primary increments: 8, 12, 16, 24, 32, 48.
- Page gutter: 16px mobile, 24px tablet, 32px desktop.
- Content max-width: 1600px for data workspaces, 1200px for forms/settings.
- Dense tables and calendars may scroll inside their own bounded region only.

## Shape and depth

- Radius: 8px controls, 12px cards, 16px large panels/drawers.
- Shadow: border-first surfaces; light shadow only for floating popovers/drawers.
- Glass/blur: overlays and public hero only, never all backoffice cards.

## Motion

- 150ms hover/focus, 200–250ms drawers and menus.
- Do not animate layout bounds or use bounce/parallax in workspaces.
- Respect `prefers-reduced-motion`.

## Components

- Buttons: primary brand, secondary ink-outline, quiet ghost, destructive red.
- Inputs: persistent label, helper/error slot, 44px minimum height.
- Cards: solid surface, 1px border, restrained radius.
- Tables: sticky header when useful, server pagination, priority-card mobile fallback.
- Drawer: right side on desktop, full-screen mobile, Escape-close and labelled title.
- StatusBadge: centralized config; icon/text plus color.
- Loading: shape-matched skeleton. Empty and error states include context and recovery action.
- Charts: one accent series plus semantic comparison colors; no rainbow palettes.

## Shells

- Platform: dense operational sidebar and context-aware topbar.
- Salon: business/branch context visible; scheduling and daily operations prioritized.
- Customer: lighter top navigation and appointment-first content.
- Public: editorial marketplace header and linear booking journey.

## Accessibility

- WCAG AA text contrast.
- Visible 2px `:focus-visible` ring with offset.
- 44px minimum pointer target.
- Semantic landmarks, headings, table headers, form labels, and live feedback.
- Color is never the only status signal.

## Forbidden

- Emoji as structural icons.
- Raw hex values scattered across components.
- Pink/lavender on every surface.
- Placeholder-only forms.
- Dead actions, fake metrics, fake timestamps, or production mock data.
- Role-only UI checks when a permission check exists.
- Whole-page horizontal overflow.
