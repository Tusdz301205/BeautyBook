import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requiresIdempotency } from '../interceptors/idempotency.interceptor';

const { scanControllers } = require('../../../scripts/controller-metadata.cjs');

describe('Generated OpenAPI route/security contract', () => {
  const document = JSON.parse(readFileSync(join(process.cwd(), 'docs/openapi.generated.json'), 'utf8'));
  const routes = scanControllers(process.cwd()).routes;

  test('includes every controller operation with effective roles/permissions and authentication', () => {
    expect(Object.values(document.paths).reduce((count: number, path: object) => count + Object.keys(path).length, 0))
      .toBe(routes.length);
    for (const route of routes) {
      const operation = document.paths[route.path]?.[route.verb];
      expect(operation).toBeDefined();
      expect(operation['x-roles'] ?? []).toEqual(route.roles);
      expect(operation['x-permissions'] ?? []).toEqual(route.permissions);
      expect(operation['x-scope-requirement']).toEqual(route.scope);
      expect(operation.security).toEqual(route.isPublic ? undefined : [{ bearerAuth: [] }]);
    }
  });

  test('Idempotency-Key requirements match the runtime interceptor for all operations', () => {
    for (const route of routes) {
      const operation = document.paths[route.path][route.verb];
      const header = operation.parameters?.find((parameter) => parameter.in === 'header' && parameter.name === 'Idempotency-Key');
      expect(Boolean(header?.required)).toBe(requiresIdempotency(route.verb, route.path));
    }
    expect(document.paths['/bookings/{id}/items'].post.parameters).toContainEqual(expect.objectContaining({
      name: 'Idempotency-Key', in: 'header', required: true,
    }));
  });

  test('documents service-bound exceptions without advertising them as public', () => {
    const operation = document.paths['/ownership-transfers/{id}/accept'].patch;
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation['x-service-authorization']).toContain('newOwnerUserId');
  });
});
