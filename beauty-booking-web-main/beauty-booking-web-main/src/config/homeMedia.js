/**
 * Central media manifest for the public homepage.
 *
 * Keep values `null` until a project-owned asset has been approved and added.
 * Use paths served by this application (for example `/media/home/hero.webp`),
 * never remote stock-image URLs. The homepage will reserve the exact layout
 * space and show a production-safe placeholder while a slot is empty.
 */
export const homeMedia = Object.freeze({
  hero: Object.freeze({
    primary: null,
  }),
  categories: Object.freeze({}),
  salons: Object.freeze({}),
  availability: Object.freeze({
    editorial: null,
  }),
  finalCta: Object.freeze({
    editorial: null,
  }),
  auth: Object.freeze({
    login: null,
    register: null,
    recovery: null,
    invitation: null,
  }),
  details: Object.freeze({
    branch: null,
    service: null,
    staff: null,
  }),
});

export const homeMediaRatios = Object.freeze({
  hero: '4 / 5',
  category: '4 / 3',
  salon: '16 / 10',
  editorial: '16 / 9',
  auth: '5 / 4',
  detailHero: '4 / 3',
});

export function getHomeMedia(group, key) {
  return homeMedia[group]?.[key] ?? null;
}
