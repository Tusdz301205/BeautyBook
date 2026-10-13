import { BranchesService } from './branches.service';

// An independent, selection-aware database fake: it applies predicates and
// order/offset/limit before projecting rows, rather than returning canned cards.
function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every(item => matches(row, item));
    if (key === 'OR') return value.some(item => matches(row, item));
    const actual = row[key];
    if (value === null || typeof value !== 'object') return actual === value;
    if ('some' in value) return actual?.some(item => matches(item, value.some)) ?? false;
    if ('is' in value) return actual != null && matches(actual, value.is);
    if ('in' in value) return value.in.includes(actual);
    if ('gte' in value || 'lte' in value) {
      return (value.gte === undefined || actual >= value.gte) && (value.lte === undefined || actual <= value.lte);
    }
    return actual != null && matches(actual, value);
  });
}

function offering(id: string, price: number, categoryId = 'skin', extra: any = {}) {
  return {
    id, name: 'Facial', price, categoryId, deletedAt: null, status: 'ACTIVE',
    durationMinutes: 30, category: { id: categoryId, name: categoryId },
    _count: { bookingServices: 0 }, ...extra,
  };
}

function branch(id: string, createdAt: number, prices: number[], rating: number, bookings: number, extra: any = {}) {
  return {
    id, createdAt: new Date(createdAt), businessId: 'biz', name: id,
    deletedAt: null, status: 'ACTIVE', reviewStatus: 'APPROVED', operationalStatus: 'ACTIVE',
    addressLine: 'Address', districtId: 'district',
    business: { id: 'biz', name: 'Business', status: 'ACTIVE', deletedAt: null, bookingRestrictedAt: null, description: null },
    district: { id: 'district', name: 'District', province: { name: 'Province' } },
    services: prices.map((price, index) => offering(`${id}-s${index}`, price)),
    staff: [{ status: 'ACTIVE', deletedAt: null, isBookable: true, publicVisible: true, userId: null }],
    images: [], workingHours: [],
    bookings: Array.from({ length: bookings }, (_, index) => ({
      id: `${id}-booking${index}`, deletedAt: null,
      review: { overallRating: rating, status: 'APPROVED', deletedAt: null },
    })),
    ...extra,
  };
}

function fixture() {
  return [
    branch('z-new', 60, [900], 1, 1),
    branch('y-new', 50, [800], 2, 2),
    branch('d-middle', 40, [400], 3, 3),
    branch('c-old', 30, [100, 1000], 4, 4),
    // Deliberately reversed IDs with equal date, price, rating and popularity.
    branch('b-old', 10, [10], 5, 5),
    branch('a-old', 10, [10], 5, 5),
  ];
}

function database(rows: any[]) {
  const findMany = jest.fn(async (args: any) => {
    let found = rows.filter(row => matches(row, args.where));
    const orders = args.orderBy ? (Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]) : [];
    found.sort((left, right) => {
      for (const order of orders) {
        const [key, direction]: [string, any] = Object.entries(order)[0];
        const a = key === 'bookings' ? left.bookings.length : left[key];
        const b = key === 'bookings' ? right.bookings.length : right[key];
        const comparison = a < b ? -1 : a > b ? 1 : 0;
        if (comparison) return comparison * ((key === 'bookings' ? direction._count : direction) === 'desc' ? -1 : 1);
      }
      return 0;
    });
    const start = args.skip ?? 0;
    found = found.slice(start, args.take === undefined ? undefined : start + args.take);
    return found.map(row => {
      if (args.select) return Object.fromEntries(Object.keys(args.select).filter(key => args.select[key]).map(key => [key, row[key]]));
      const { bookings, staff, services, ...scalars } = row;
      return {
        ...scalars,
        services: services.filter(item => matches(item, args.include.services.where)),
        _count: {
          services: services.filter(item => matches(item, args.include._count.select.services.where)).length,
          bookings: bookings.filter(item => matches(item, args.include._count.select.bookings.where)).length,
          staff: staff.filter(item => matches(item, args.include._count.select.staff.where)).length,
        },
      };
    });
  });
  const priceGroupBy = jest.fn(async (args: any) => {
    const services = rows.flatMap(row => row.services.map(item => ({ ...item, branchId: row.id }))).filter(item => matches(item, args.where));
    return [...new Set<string>(services.map(item => item.branchId))].map(branchId => {
      const prices = services.filter(item => item.branchId === branchId).map(item => item.price);
      return { branchId, _min: { price: Math.min(...prices) }, _max: { price: Math.max(...prices) } };
    });
  });
  const bookingGroupBy = jest.fn(async (args: any) => {
    const bookings = rows.flatMap(row => row.bookings.map(item => ({ ...item, branchId: row.id }))).filter(item => matches(item, args.where));
    return [...new Set<string>(bookings.map(item => item.branchId))].map(branchId => ({
      branchId, _count: { _all: bookings.filter(item => item.branchId === branchId).length },
    }));
  });
  const queryRaw = jest.fn(async (sql: any) => {
    if (sql.sql.includes('AVG(')) {
      return rows.filter(row => sql.values.includes(row.id)).flatMap(row => {
        const reviews = row.bookings.filter(item =>
          (!sql.sql.includes('b.deleted_at IS NULL') || item.deletedAt === null)
          && item.review
          && (!sql.sql.includes('r.deleted_at IS NULL') || item.review.deletedAt === null)
          && (!sql.sql.includes("r.status = 'APPROVED'") || item.review.status === 'APPROVED'),
        ).map(item => item.review.overallRating);
        return reviews.length ? [{ branchId: row.id, rating: (reviews.reduce((a, b) => a + b, 0) / reviews.length).toFixed(2) }] : [];
      });
    }
    if (sql.sql.includes('FROM districts')) return [{ id: 'district' }];
    if (sql.sql.includes('FROM services')) return rows.flatMap(row => row.services.filter(item => item.name === 'Facial').map(item => ({ id: item.id })));
    if (sql.sql.includes('FROM branches')) return rows.filter(row => row.businessId === 'biz').map(row => ({ id: row.id }));
    throw new Error(`Unexpected SQL: ${sql.sql}`);
  });
  const prisma = {
    branch: { findMany }, branchServiceOffering: { groupBy: priceGroupBy },
    booking: { groupBy: bookingGroupBy }, $queryRaw: queryRaw,
  };
  return { prisma, service: new BranchesService(prisma as any, {} as any, {} as any) };
}

describe('BranchesService global public sorting', () => {
  test.each([
    ['price_asc', ['a-old', 'b-old', 'c-old', 'd-middle', 'y-new', 'z-new']],
    ['price_desc', ['c-old', 'z-new', 'y-new', 'd-middle', 'a-old', 'b-old']],
    ['rating', ['a-old', 'b-old', 'c-old', 'd-middle', 'y-new', 'z-new']],
    ['popular', ['a-old', 'b-old', 'c-old', 'd-middle', 'y-new', 'z-new']],
    ['newest', ['z-new', 'y-new', 'd-middle', 'c-old', 'a-old', 'b-old']],
    [undefined, ['z-new', 'y-new', 'd-middle', 'c-old', 'a-old', 'b-old']],
  ])('%s selects global winners before paging and breaks ties by ID', async (sort, expected) => {
    const { service } = database(fixture());
    const first = await service.findAll({ sort, page: 1, limit: 2 });
    expect(first.map(card => card.id)).toEqual(expected.slice(0, 2));
    const second = await service.findAll({ sort, page: 2, limit: 2 });
    const third = await service.findAll({ sort, page: 3, limit: 2 });
    expect([...first, ...second, ...third].map(card => card.id)).toEqual(expected);
  });

  test.each(['price_asc', 'price_desc', 'rating', 'popular'])('%s is stable when a tie straddles pages', async sort => {
    const rows = [branch('b', 20, [10], 5, 1), branch('a', 10, [10], 5, 1)];
    const { service } = database(rows);
    expect((await service.findAll({ sort, page: 1, limit: 1 }))[0].id).toBe('a');
    expect((await service.findAll({ sort, page: 2, limit: 1 }))[0].id).toBe('b');
  });

  test.each(['price_asc', 'price_desc', 'rating', 'popular'])('%s ranks lightweight candidates and hydrates only final IDs', async sort => {
    const { service, prisma } = database(fixture());
    const cards = await service.findAll({ sort, limit: 2 });
    const calls = prisma.branch.findMany.mock.calls.map(([args]) => args);
    const candidate = calls.find(args => args.select);
    expect(candidate).toBeDefined();
    expect(candidate.select).toEqual({ id: true });
    expect(candidate.skip).toBeUndefined();
    expect(candidate.take).toBeUndefined(); // No hidden candidate cap.
    const hydration = calls.filter(args => args.include);
    expect(hydration).toHaveLength(1);
    expect(hydration[0].include.bookings).toBeUndefined();
    expect(hydration[0].include.reviews).toBeUndefined();
    expect(hydration[0].take).toBe(2);
    const selected = fixture().filter(row => matches(row, hydration[0].where)).map(row => row.id).sort();
    expect(selected).toEqual(cards.map(card => card.id).sort());
    if (sort === 'rating') {
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw.mock.calls[0][0].values).toEqual(expect.arrayContaining(fixture().map(row => row.id)));
    } else {
      expect(prisma.$queryRaw.mock.calls[0][0].values).toEqual(cards.map(card => card.id));
    }
  });

  test.each(['price_asc', 'price_desc'])('%s uses exactly matched category/name/price services for ranking and cards', async sort => {
    const rows = [branch('z', 30, [150], 1, 1), branch('b', 20, [120], 1, 1), branch('a', 10, [110, 190], 1, 1)];
    rows[0].services.push(offering('cheap-other-category', 105, 'hair'), offering('expensive-other-name', 200, 'skin', { name: 'Massage' }));
    rows[1].services.push(offering('inactive', 199, 'skin', { status: 'INACTIVE' }), offering('deleted', 198, 'skin', { deletedAt: new Date() }));
    rows[2].services.push(offering('below-range', 10), offering('above-range', 500));
    const { service, prisma } = database(rows);
    const cards = await service.findAll({ sort, categoryId: 'skin', serviceQuery: 'Facial', minPrice: 100, maxPrice: 200, limit: 1 });
    expect(cards[0]).toMatchObject({ id: 'a', minPrice: 110, maxPrice: 190, services: 2, categoryServiceCount: 2 });
    expect(cards[0].categories).toEqual([{ id: 'skin', name: 'skin' }]);
    const aggregate = prisma.branchServiceOffering.groupBy.mock.calls[0][0];
    const hydration = prisma.branch.findMany.mock.calls.find(([args]) => args.include)![0];
    expect(aggregate.where).toMatchObject(hydration.include.services.where);
    expect(aggregate.where.branchId.in.sort()).toEqual(['a', 'b', 'z']);
  });

  test('rating excludes pending/deleted reviews and deleted bookings; missing ratings stay zero', async () => {
    const good = branch('a-good', 10, [10], 4, 1);
    const bad = branch('z-bad', 30, [10], 1, 1);
    bad.bookings.push(
      { deletedAt: null, review: { overallRating: 5, status: 'PENDING', deletedAt: null } },
      { deletedAt: null, review: { overallRating: 5, status: 'APPROVED', deletedAt: new Date() } },
      { deletedAt: new Date(), review: { overallRating: 5, status: 'APPROVED', deletedAt: null } },
    );
    const { service } = database([bad, branch('b-unrated', 20, [10], 0, 0), good]);
    const cards = await service.findAll({ sort: 'rating', limit: 3 });
    expect(cards.map(card => [card.id, card.rating])).toEqual([['a-good', 4], ['z-bad', 1], ['b-unrated', 0]]);
  });

  test('rating ties use the existing displayed precision', async () => {
    const a = branch('a', 10, [10], 4, 20);
    const z = branch('z', 30, [10], 4, 25);
    a.bookings[0].review.overallRating = 5; // 4.05 -> displayed 4.1
    z.bookings[0].review.overallRating = 5;
    z.bookings[1].review.overallRating = 5; // 4.08 -> displayed 4.1
    const { service } = database([z, a]);
    expect((await service.findAll({ sort: 'rating', limit: 1 }))[0]).toMatchObject({ id: 'a', rating: 4.1 });
  });

  test('popular sorts by the same nondeleted count displayed on the card', async () => {
    const inflated = branch('z', 30, [10], 1, 10);
    inflated.bookings.slice(1).forEach(item => { item.deletedAt = new Date(); });
    const { service } = database([inflated, branch('a', 10, [10], 1, 2)]);
    const cards = await service.findAll({ sort: 'popular', limit: 2 });
    expect(cards.map(card => [card.id, card.bookings])).toEqual([['a', 2], ['z', 1]]);
  });

  test.each(['price_asc', 'price_desc'])('%s retains empty price as null, ordered last for management', async sort => {
    const { service } = database([branch('empty', 30, [], 0, 0), branch('priced', 10, [0], 0, 0)]);
    const cards = await service.findAll({ sort, limit: 1 }, true);
    expect(cards[0]).toMatchObject({ id: 'priced', minPrice: 0, maxPrice: 0 });
    expect((await service.findAll({ sort, page: 2, limit: 1 }, true))[0]).toMatchObject({ id: 'empty', minPrice: null, maxPrice: null });
  });

  test.each(['price_asc', 'price_desc', 'rating', 'popular'])('%s preserves all public eligibility and search intersections', async sort => {
    const valid = branch('valid', 10, [100], 3, 1);
    const excluded = [
      { deletedAt: new Date() }, { status: 'PENDING' }, { reviewStatus: 'PENDING_REVIEW' },
      { operationalStatus: 'INACTIVE' }, { services: [] }, { staff: [] },
      { business: { ...valid.business, status: 'PENDING' } },
      { business: { ...valid.business, bookingRestrictedAt: new Date() } },
      { business: { ...valid.business, deletedAt: new Date() } },
      { districtId: 'other', district: { id: 'other' } },
      { businessId: 'other-tenant' },
      { staff: [{ ...valid.staff[0], publicVisible: false }] },
      { staff: [{ ...valid.staff[0], isBookable: false }] },
      { staff: [{ ...valid.staff[0], userId: 'disabled', user: { isActive: false, deletedAt: null } }] },
    ].map((extra, index) => branch(`excluded-${index}`, 100, [100], 5, 5, extra));
    const { service, prisma } = database([...excluded, valid]);
    const cards = await service.findAll({ sort, districtId: 'district', area: 'area', search: 'business', serviceQuery: 'Facial', categoryId: 'skin', minPrice: 50, maxPrice: 150, limit: 1 });
    expect(cards.map(card => card.id)).toEqual(['valid']);
    const candidateWhere = prisma.branch.findMany.mock.calls[0][0].where;
    const hydrateWhere = prisma.branch.findMany.mock.calls.find(([args]) => args.include)![0].where;
    expect(hydrateWhere).toMatchObject(candidateWhere);
    for (const call of prisma.branchServiceOffering.groupBy.mock.calls) expect(call[0].where.branchId.in).toEqual(['valid']);
    for (const call of prisma.booking.groupBy.mock.calls) expect(call[0].where.branchId.in).toEqual(['valid']);
  });

  test('includeNonPublic preserves management status and inactive matched service projection', async () => {
    const pending = branch('pending', 10, [50], 5, 1, { status: 'PENDING', reviewStatus: 'DRAFT', operationalStatus: 'INACTIVE', staff: [] });
    pending.services[0].status = 'INACTIVE';
    const { service } = database([branch('active', 30, [10], 1, 1), pending]);
    expect((await service.findAll({ sort: 'price_asc', status: 'Chờ duyệt', categoryId: 'skin', limit: 1 }, true))[0])
      .toMatchObject({ id: 'pending', status: 'PENDING', minPrice: 50, services: 1 });
  });

  test('candidate IDs and text filters remain SQL parameters, including SQL-shaped input', async () => {
    const id = "x'); DROP TABLE reviews; --";
    const { service, prisma } = database([branch(id, 10, [10], 5, 1)]);
    const input = "'); drop table branches; --";
    const cards = await service.findAll({ sort: 'rating', search: input, serviceQuery: input, area: input, limit: 1 });
    expect(cards[0].id).toBe(id);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    for (const [sql] of prisma.$queryRaw.mock.calls) {
      expect(sql.sql).not.toContain(input);
      expect(sql.sql).not.toContain(id);
      expect(sql.values).toContain(sql.sql.includes('AVG(') ? id : `%${input}%`);
    }
  });

  test.each(['price_asc', 'rating', 'popular'])('%s returns empty without aggregate/hydration for no candidates or an exhausted page', async sort => {
    const empty = database([]);
    expect(await empty.service.findAll({ sort })).toEqual([]);
    expect(empty.prisma.$queryRaw).not.toHaveBeenCalled();
    expect(empty.prisma.branchServiceOffering.groupBy).not.toHaveBeenCalled();
    expect(empty.prisma.booking.groupBy).not.toHaveBeenCalled();
    const exhausted = database(fixture());
    expect(await exhausted.service.findAll({ sort, page: 100, limit: 2 })).toEqual([]);
    expect(exhausted.prisma.branch.findMany.mock.calls.every(([args]) => args.select)).toBe(true);
  });
});
