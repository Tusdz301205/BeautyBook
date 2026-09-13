const { parseControllerSource, permissionCoverageGaps } = require('../../../scripts/controller-metadata.cjs');

describe('Controller metadata AST scanner', () => {
  test('flags an authenticated route with no role or permission decorator', () => {
    const { routes } = parseControllerSource(`
      @Controller('example') class Example {
        @Get('private') list() { return []; }
        @Public() @Get('public') browse() { return []; }
      }
    `);
    expect(permissionCoverageGaps(routes)).toEqual(['GET /example/private']);
  });

  test('inherits class metadata and lets method metadata override, including empty arrays', () => {
    const { routes } = parseControllerSource(`
      @Controller('example') @Roles('CUSTOMER') @RequirePermission('booking:read:self')
      class Example {
        @Get() inherited() {}
        @Post() @Roles('BUSINESS_OWNER') @RequirePermission('booking:create:tenant') override() {}
        @Get('missing') @RequirePermission() missing() {}
      }
    `);
    expect(routes[0]).toMatchObject({ roles: ['CUSTOMER'], permissions: ['booking:read:self'] });
    expect(routes[1]).toMatchObject({ roles: ['BUSINESS_OWNER'], permissions: ['booking:create:tenant'] });
    expect(permissionCoverageGaps(routes)).toEqual(['GET /example/missing']);
  });

  test('handles aliased imports, static constants, multiline decorators and nested objects', () => {
    const { routes } = parseControllerSource(`
      import { Get as Read, Controller as Route } from '@nestjs/common';
      const BASE = 'bookings'; const ROLES = ['CUSTOMER'] as const;
      @Route(BASE) @Roles(...ROLES) class Example {
        @Read(':id') @RequireScope({level: 'SELF', options: {nested: true}})
        @RequirePermission('booking:read:self')
        async read(@Param('id') id: string): Promise<unknown> { return {id}; }
      }
    `);
    expect(routes[0]).toMatchObject({ path: '/bookings/{id}', verb: 'get', roles: ['CUSTOMER'], scope: {level: 'SELF'} });
  });

  test('does not mistake RequireScope permissions for PolicyGuard enforcement', () => {
    const { routes } = parseControllerSource(`
      @Controller('example') class Example {
        @Get() @RequireScope({scopeLevel: 'branch', permissions: ['booking:read:branch']}) list() {}
      }
    `);
    expect(permissionCoverageGaps(routes)).toEqual(['GET /example']);
    expect(routes[0].permissions).toEqual([]);
  });

  test('a reviewed exception does not exempt another HTTP method or a new child route', () => {
    const { routes } = parseControllerSource(`
      @Controller('example') class Example { @Get() read() {} @Post() write() {} @Get('other') other() {} }
    `);
    expect(permissionCoverageGaps(routes, { 'GET /example': 'Self-bound service check' }))
      .toEqual(['GET /example/other', 'POST /example']);
  });

  test('fails rather than silently dropping unresolved permission expressions', () => {
    expect(() => parseControllerSource(`
      @Controller('example') class Example { @Get() @RequirePermission(dynamicPermission()) list() {} }
    `)).toThrow('Cannot statically resolve');
  });
});
