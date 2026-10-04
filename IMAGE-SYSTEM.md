# BeautyBook image system

BeautyBook uses three image tiers for public pages.

## Storage

- Originals: `docs/generated-images/beautybook/originals/`
- Manifest: `docs/generated-images/beautybook/manifest.json`
- Production: `beauty-booking-web-main/beauty-booking-web-main/public/images/beautybook/`
- Mapping: `beauty-booking-web-main/beauty-booking-web-main/src/config/homeMedia.js`
- Optimizer: `beauty-booking-web-main/beauty-booking-web-main/scripts/optimize-beautybook-images.mjs`
- Entity optimizer: `beauty-booking-web-main/beauty-booking-web-main/scripts/optimize-entity-images.mjs`

Original PNG files remain in the local workspace and are excluded from the public Git repository. Transfer them separately when regeneration is needed. The optimized WebP files in `public` are committed and available to the running site.

Production filenames are lowercase English words separated by hyphens. PNG originals stay outside `public` so responsive WebP assets can be regenerated without shipping the source files.

## Tiers

1. Global assets are fixed editorial assets such as the home hero.
2. Reusable assets represent hair, nails, skincare, and spa categories only in global editorial sections.
3. Entity media is the real branch, service, or staff media returned by the API and always has priority.
4. Branch/business/service imagery is unique per entity. Reusable category artwork must never be used as an entity fallback.

Generated editorial assets are for global editorial UI only. They are not treated as real business galleries, service photos, or staff portraits.

`getServiceFallbackMedia()` and `getBranchFallbackMedia()` only accept entity-specific generated media attached to that entity. If no unique media exists, the UI stays visibly incomplete until a dedicated asset is supplied instead of silently reusing another entity's image.

## Rendering and performance

`HomeMedia` supports `srcSet`, `sizes`, intrinsic dimensions, fallback sources, and context-specific alt text. The home hero loads eagerly with high fetch priority. Images below the fold lazy-load and decode asynchronously.

Current WebP variants are 480/768/1024 for the portrait hero and 320/640/960 for reusable 4:3 images.

Regenerate assets from the frontend directory with `node scripts\\optimize-beautybook-images.mjs`.

Entity originals follow the exact `original` path exported in `entity-plan.json`. After adding generated entity originals, run `npm run images:optimize-entities` to create the responsive WebP files declared by each entity entry, then run `npm run images:sync-entity-media`.

## SEO

Meaningful images use concise Vietnamese alt text. Decorative auth imagery uses empty alt text. Generated fallbacks are described as editorial imagery rather than as photos of a specific business.

Public routes maintain title, meta description, robots directives, Open Graph metadata, Twitter metadata, and canonical URLs. Set `VITE_SITE_URL` to the real production origin from the deployment configuration before the production build. Relative BeautyBook social images become absolute from that origin. Localhost is deliberately rejected for sitemap generation.

`src/utils/seo.js` is the single browser-side metadata writer. Public branch, service, and staff details add schema.org data only from fields already returned and displayed by the API. Branch pages use `BeautySalon`, service pages use `Service`, staff pages use `Person`, and detail pages include `BreadcrumbList`. Preview, authentication, booking, customer, salon, admin, and unknown routes are `noindex`.

`npm run seo:generate` writes `public/robots.txt`. When `VITE_SITE_URL` is configured it also writes an absolute `public/sitemap.xml` containing the public landing pages plus branch and service URLs exported in `docs/generated-images/beautybook/entity-plan.json`. The normal production build runs this step automatically. Public staff URLs remain discoverable through branch and service links until a deployment-safe staff route export is added.

## Adding images

Place the source in `docs/generated-images/beautybook/originals/`, add an optimizer entry, regenerate WebP variants, and map the new asset in `src/config/homeMedia.js`. Keep prompt, dimensions, byte size, usage, alt text, and output paths in the manifest.

For facility-specific visuals, preserve each business brand and service mix. Prefer real uploaded media. Generated visuals must live in separate entity directories such as `businesses/<entity-key>/`, `branches/<entity-key>/`, and `services/<entity-key>/`.

Run `npm run qa:entity-images` after entity assets are generated. The check rejects identical SHA-256 content reused across different entities. Public explore QA also rejects duplicate image URLs between different service cards.

Run `npm run qa:explore-images` while the frontend is available at `http://localhost:5174` to capture desktop/mobile screenshots and validate service-card images, alt text, duplicates, broken sources, placeholders, and horizontal overflow.
