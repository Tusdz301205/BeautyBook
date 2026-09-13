import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import metadata from './controller-metadata.cjs';
import permissionExceptions from './permission-exceptions.cjs';

const root = process.cwd();
const { scanControllers, routeKey } = metadata;

// Contract tests compare every operation with runtime requiresIdempotency.
function isIdempotentMutation(verb, path) {
  if (verb !== 'post') return false;
  return [
    /^\/bookings(?:\/guest)?$/,
    /^\/bookings\/[^/]+\/(?:change-requests|refund|items)$/,
    /^\/payments\/collect$/,
    /^\/payments\/[^/]+\/refund-requests$/,
    /^\/payments\/refunds\/[^/]+\/process$/,
    /^\/payments\/packages\/[^/]+\/purchases$/,
    /^\/payments\/package-installments\/[^/]+\/pay$/,
    /^\/payments\/package-purchases\/[^/]+\/sessions\/reserve$/,
    /^\/payments\/transactions\/[^/]+\/(?:verify|reverse)$/,
    /^\/payments\/platform-statements\/generate$/,
    /^\/vouchers\/[^/]+\/grant$/,
  ].some((pattern) => pattern.test(path));
}

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
});

const paths = {};
for (const route of scanControllers(root).routes) {
  const { prefix, path, verb, roles, permissions, isPublic, method } = route;
  if (verb === 'all') throw new Error('OpenAPI requires explicit HTTP verbs: ' + routeKey(route));
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1], in: 'path', required: true, schema: { type: 'string' },
  }));
  if (isIdempotentMutation(verb, path)) {
    parameters.push({
      name: 'Idempotency-Key', in: 'header', required: true,
      schema: { type: 'string', minLength: 1, maxLength: 128 },
    });
  }
  if (verb === 'get' && ['/branches', '/services'].includes(path)) {
    parameters.push(
      { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
    );
  }

  paths[path] ??= {};
  if (paths[path][verb]) throw new Error('Duplicate route: ' + routeKey(route));
  paths[path][verb] = {
    tags: [prefix || 'root'],
    operationId: route.controller + '_' + method + '_' + verb,
    summary: method.replace(/([a-z])([A-Z])/g, '$1 $2'),
    ...(isPublic ? {} : { security: [{ bearerAuth: [] }] }),
    ...(roles.length ? { 'x-roles': roles } : {}),
    ...(permissions.length ? { 'x-permissions': permissions } : {}),
    // RequireScope.permissions alone is not consumed by PolicyGuard.
    ...(route.scope ? { 'x-scope-requirement': route.scope } : {}),
    ...(permissionExceptions[routeKey(route)] ? { 'x-service-authorization': permissionExceptions[routeKey(route)] } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(!['get', 'delete', 'head', 'options'].includes(verb) ? {
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
      },
    } : {}),
    responses: {
      200: { description: 'Success (consult the controller for the exact success status and response schema)' },
      400: errorResponse('Validation error'),
      ...(!isPublic ? { 401: errorResponse('Unauthorized'), 403: errorResponse('Forbidden') } : {}),
      ...(isIdempotentMutation(verb, path) ? { 409: errorResponse('Duplicate or conflicting request') } : {}),
    },
    'x-source': route.file,
    'x-source-line': route.line,
  };
}

const document = {
  openapi: '3.1.0',
  info: {
    title: 'Beauty Booking API', version: '1.0.0',
    description: 'Generated route and declared authorization inventory. Handler metadata overrides class metadata. DTO schemas and exact success responses are not inferred; class-validator and controller implementations remain authoritative.',
  },
  servers: [{ url: '/api/v1' }],
  paths: Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b))),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      ErrorResponse: {
        type: 'object', required: ['statusCode', 'message'],
        properties: {
          statusCode: { type: 'integer', example: 400 },
          message: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
          error: { type: 'string', example: 'Bad Request' },
        },
      },
    },
  },
};

const output = join(root, 'docs', 'openapi.generated.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(document, null, 2) + '\n');
console.log('Generated ' + Object.keys(paths).length + ' paths -> ' + relative(root, output));
