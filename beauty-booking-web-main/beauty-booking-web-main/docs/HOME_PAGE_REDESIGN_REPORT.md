# BeautyBook — Home Page Redesign Report

Date: 2026-07-21

## Outcome

The public homepage has been rebuilt as a real beauty-service marketplace entry point with a warm editorial luxury direction. The implementation preserves the current React Router, API client, authentication, RBAC and five-step booking wizard.

The guest journey is now:

1. Discover the value proposition on `/`.
2. Search by salon, category, area or supported detailed filters.
3. Continue to `/explore` with URL-backed query parameters.
4. Open a real branch detail route.
5. Start `/book?branchId=...`; the existing booking store selects the requested branch.

## Design implementation

- Applied the project Hallmark system and the UI/UX Pro Max marketplace/search-first guidance.
- Preserved the locked BeautyBook type and colour system: Fraunces, Be Vietnam Pro, IBM Plex Mono, warm oat canvas and berry accent.
- Used a Marquee Hero with a split diptych rather than the previous generic card hero.
- Replaced the generic single-row site header with an N2 two-tier desktop navigation and an accessible mobile drawer.
- Added a mast-headed editorial footer instead of a generic multi-column footer.
- Added stable, centrally configured image slots. No remote, stock or generated image URL was added.
- Limited motion to the hero settle, drawer and loading states; reduced-motion removes them.

## Real data and API behaviour

The page reads only public data already provided by the backend:

- `GET /api/v1/branches`: featured salons, branch search, category/area/service/price filters, sort, approved-review rating, service count, booking count and price range.
- `GET /api/v1/services/categories`: category selector and category discovery grid.
- `GET /api/v1/branches/:id`: existing public branch detail page.
- Existing booking wizard routes under `/book`.

Loading, error, retry and empty states are implemented separately for branch and category data.

## Honest limitations

- Homepage promotions are intentionally omitted. `GET /promotions` is permission-protected; only service-specific promotion lookup is public. No campaign was fabricated.
- Homepage time slots are intentionally not listed. Availability requires a selected branch, service, staff member and date, so the page routes users into the real selection flow first.
- Testimonial cards are intentionally omitted because there is no public cross-marketplace review feed. Branch cards still show the real aggregate rating calculated only from approved reviews.
- No public account-registration route currently exists, so the header does not create a dead “Đăng ký” link. “Dành cho cơ sở” routes to the existing login.
- Media slots remain empty until approved project-owned assets are supplied.

## Adding approved images later

Update `src/config/homeMedia.js` with application-served asset paths. Keep the existing ratio keys:

- hero: `4 / 5`
- categories: `4 / 3`
- salons: `16 / 10`
- editorial slots: `16 / 9`

Example:

```js
hero: {
  primary: '/media/home/hero.webp',
}
```

Do not add stock-image URLs. If a path fails to load, the component falls back to the same stable placeholder.

## Accessibility and responsive checks

- Semantic header, nav, main, section, article, ordered list and footer structure.
- One H1 per route and sequential H2/H3 hierarchy.
- Labelled search controls and descriptive image-slot alternatives.
- Skip link, visible focus ring and 44 px minimum interactive targets.
- Mobile drawer supports backdrop close, explicit close and Escape; focus returns to the menu button.
- No document-level horizontal overflow at the tested 375, 768, 1024 and 1440 viewport settings.
- Desktop categories use four columns, salons use three; these collapse to two and one columns at tablet/mobile breakpoints.

## Verification

- Production build: passed (`vite build`, 3325 modules transformed).
- Docker image build: passed.
- Docker services: PostgreSQL, Redis and API became healthy; web started on port 8080.
- `/`: loaded 8 category tiles and 6 featured salon cards from the public API.
- `/explore`: loaded 13 category options and 23 eligible branches from the current database.
- Search test: “An Nhiên” produced 2 matching branches and encoded the search in the URL.
- Detail CTA: opened the matching `/explore/branches/:id` route without an error state.
- Booking CTA: opened `/book?branchId=...`; the requested branch was visibly selected on step 1/5.
- Link audit: no empty or `#`-only CTA links (the only hash-only link is the accessibility skip link with a real target).
- Runtime console: no page warnings or errors observed during the route checks.

## Files added

- `src/config/homeMedia.js`
- `src/components/public/HomeMedia.jsx`
- `src/components/public/PublicChrome.jsx`
- `src/styles/public-home.css`
- `docs/HOME_PAGE_REDESIGN_REPORT.md`

## Files updated

- `src/pages/Public/PublicHome.jsx`
- `src/pages/Public/PublicDetails.jsx`
- `src/components/layout/PublicShell.jsx`
- `src/styles/theme.css`
- `src/App.jsx`
- `tokens.css`
- project `design.md`
- project `.hallmark/log.json`

No backend controller, service, database schema, seed, auth guard, permission catalogue or booking business rule was modified for this redesign.
