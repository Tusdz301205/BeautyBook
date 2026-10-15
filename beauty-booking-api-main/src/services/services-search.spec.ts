import { Prisma } from '@prisma/client';
import { ServicesService } from './services.service';

function fixture(rows: Array<Record<string, unknown>> = []) {
  const queryRaw = jest.fn<Promise<Array<Record<string, unknown>>>, [Prisma.Sql]>()
    .mockResolvedValue(rows);
  const service = new ServicesService({ $queryRaw: queryRaw } as never);
  return { service, queryRaw };
}

function compact(sql: Prisma.Sql) {
  return sql.sql.replace(/\s+/g, ' ').trim();
}

// SQL contract assertions inspect the query actually sent to Prisma. They do
// not execute SQL or establish live database/public API eligibility.
describe('ServicesService public search projection', () => {
  test('matches branch and business names in the same query as service names while retaining combined filters', async () => {
    const { service, queryRaw } = fixture();
    await service.search({ query: 'Salon Ngọc Tú', location: 'Hà Nội', maxPrice: 500000, page: 2, limit: 10 });
    const statement = queryRaw.mock.calls[0][0];
    const sql = compact(statement);
    expect(sql).toMatch(/OR regexp_replace\(btrim\(translate\(lower\(branch\."name"\)/);
    expect(sql).toMatch(/OR regexp_replace\(btrim\(translate\(lower\(business\."name"\)/);
    expect(sql).toContain('offering."price" <=');
    expect(sql).toContain('branch."deleted_at" IS NULL');
    expect(statement.values).toContain('%salon ngoc tu%');
    expect(statement.values.slice(-2)).toEqual([10, 11]);
  });

  test('selects one public image for the exact offering, with deterministic ties and no outer image join', async () => {
    const { service, queryRaw } = fixture();
    await service.search({});
    const sql = compact(queryRaw.mock.calls[0][0]);
    expect(sql).toContain('( SELECT media."url" FROM "service_images" image JOIN "media_files" media ON media."id" = image."media_id" WHERE image."service_id" = offering."id" AND media."visibility" = \'PUBLIC\' AND media."file_type" = \'IMAGE\' ORDER BY image."sort_order" ASC, image."id" ASC LIMIT 1 ) AS "imageUrl"');
    const outerQuery = sql.slice(sql.indexOf('FROM "services" offering'));
    expect(outerQuery).not.toContain('"service_images"');
    expect(outerQuery).not.toContain('"media_files"');
  });

  test('staff count allows unattached profiles and requires active, undeleted linked accounts', async () => {
    const { service, queryRaw } = fixture();
    await service.search({});
    const sql = compact(queryRaw.mock.calls[0][0]);
    expect(sql).toContain('COUNT(DISTINCT profile."id")::int AS "staff_count"');
    expect(sql).toContain('AND profile."status" = \'ACTIVE\' AND profile."is_bookable" = TRUE AND profile."public_visible" = TRUE AND profile."deleted_at" IS NULL');
    expect(sql).toContain('AND ( profile."user_id" IS NULL OR EXISTS ( SELECT 1 FROM "users" account WHERE account."id" = profile."user_id" AND account."is_active" = TRUE AND account."deleted_at" IS NULL ) )');
    expect(sql).toContain('AND COALESCE(staff."staff_count", 0) > 0');
  });

  test('retains all offering, catalog, branch and business public eligibility predicates', async () => {
    const { service, queryRaw } = fixture();
    await service.search({});
    const sql = compact(queryRaw.mock.calls[0][0]);
    for (const predicate of [
      'offering."deleted_at" IS NULL', 'offering."status" = \'ACTIVE\'', 'offering."bookable" = TRUE',
      'bs."deleted_at" IS NULL', 'bs."status" = \'ACTIVE\'',
      'branch."deleted_at" IS NULL', 'branch."status" = \'ACTIVE\'',
      'branch."review_status" = \'APPROVED\'', 'branch."operational_status" = \'ACTIVE\'',
      'business."deleted_at" IS NULL', 'business."status" IN (\'APPROVED\', \'ACTIVE\')',
      'business."booking_restricted_at" IS NULL',
    ]) expect(sql).toContain(predicate);
  });

  test('preserves imageUrl/null, numeric mapping, availability copy and one-row lookahead paging', async () => {
    // Synthetic raw rows test response mapping only; these are not live facts.
    const raw = { price: '120000', rating: '4.50', reviewCount: '2', availableStaffCount: '2', searchRank: '70' };
    const { service, queryRaw } = fixture([
      { ...raw, id: 'offering-a', imageUrl: '/api/v1/media/public/photo-a' },
      { ...raw, id: 'offering-b', imageUrl: null },
      { ...raw, id: 'offering-c', imageUrl: '/api/v1/media/public/photo-c' },
    ]);
    const result = await service.search({ page: 2, limit: 2 });
    expect(result).toEqual({
      data: [
        { id: 'offering-a', imageUrl: '/api/v1/media/public/photo-a', price: 120000, rating: 4.5, reviewCount: 2, availableStaffCount: 2, searchRank: 70, availabilitySummary: '2 chuyên viên đang nhận lịch' },
        { id: 'offering-b', imageUrl: null, price: 120000, rating: 4.5, reviewCount: 2, availableStaffCount: 2, searchRank: 70, availabilitySummary: '2 chuyên viên đang nhận lịch' },
      ], page: 2, limit: 2, hasMore: true,
    });
    const sql = queryRaw.mock.calls[0][0];
    expect(compact(sql)).toMatch(/OFFSET \? LIMIT \?$/);
    expect(sql.values.slice(-2)).toEqual([2, 3]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  test('an exhausted page retains empty results and search input remains parameterized', async () => {
    const { service, queryRaw } = fixture();
    const query = "'); DROP TABLE service_images; --";
    expect(await service.search({ query, page: 3, limit: 1 }))
      .toEqual({ data: [], page: 3, limit: 1, hasMore: false });
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.sql).not.toContain(query);
    expect(sql.values).toContain(query);
    expect(sql.values.slice(-2)).toEqual([2, 2]);
  });
});
