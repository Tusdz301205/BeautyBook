import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();
const src = join(root, 'src');

function files(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? files(path)
      : entry.endsWith('.controller.ts') ? [path] : [];
  });
}

function literals(source) {
  return [...source.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function isIdempotentMutation(verb, path) {
  if (verb !== 'post') return false;
  return [
    /^\/bookings$/,
    /^\/bookings\/\{[^}]+\}\/(?:change-requests|refund)$/,
    /^\/payments\/collect$/,
    /^\/payments\/\{[^}]+\}\/refund-requests$/,
    /^\/payments\/refunds\/\{[^}]+\}\/process$/,
    /^\/vouchers\/\{[^}]+\}\/grant$/,
  ].some((pattern) => pattern.test(path));
}

const errorResponse = (description) => ({
  description,
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
  },
});

const paths = {};
for (const file of files(src)) {
  const source = readFileSync(file, 'utf8');
  const prefix = /@Controller\((?:'([^']*)')?\)/.exec(source)?.[1] ?? '';
  const lines = source.split(/\r?\n/);
  let decorators = [];
  let collecting = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('@')) {
      decorators.push(trimmed);
      collecting = true;
      continue;
    }
    if (collecting && decorators.length && !/^(?:async\s+)?[A-Za-z_]\w*\s*\(/.test(trimmed)) {
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*')) decorators.push(trimmed);
      continue;
    }
    const method = /^(?:async\s+)?([A-Za-z_]\w*)\s*\(/.exec(trimmed);
    if (!method) {
      decorators = [];
      collecting = false;
      continue;
    }

    const metadata = decorators.join(' ');
    const route = /@(Get|Post|Patch|Delete|Put)\((?:'([^']*)')?\)/.exec(metadata);
    decorators = [];
    collecting = false;
    if (!route) continue;

    const verb = route[1].toLowerCase();
    const child = route[2] ?? '';
    const rawPath = [prefix, child].filter(Boolean).join('/');
    const path = `/${rawPath}`.replace(/:([A-Za-z_]\w*)/g, '{$1}').replace(/\/+/g, '/');
    const roles = literals(/@Roles\((.*?)\)/.exec(metadata)?.[1] ?? '');
    const permissions = literals(/@RequirePermission\((.*?)\)/.exec(metadata)?.[1] ?? '');
    const isPublic = metadata.includes('@Public()');
    const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
      name: match[1], in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
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
    paths[path][verb] = {
      tags: [prefix || 'root'],
      operationId: `${prefix.replace(/\W+/g, '_') || 'root'}_${method[1]}`,
      summary: method[1].replace(/([a-z])([A-Z])/g, '$1 $2'),
      ...(isPublic ? {} : { security: [{ bearerAuth: [] }] }),
      ...(roles.length ? { 'x-roles': roles } : {}),
      ...(permissions.length ? { 'x-permissions': permissions } : {}),
      ...(parameters.length ? { parameters } : {}),
      ...(!['get', 'delete'].includes(verb) ? {
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
      } : {}),
      responses: {
        200: { description: 'Success' },
        400: errorResponse('Validation error'),
        ...(!isPublic ? {
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        } : {}),
        ...(isIdempotentMutation(verb, path) ? { 409: errorResponse('Duplicate or conflicting request') } : {}),
      },
      'x-source': relative(root, file).replaceAll('\\', '/'),
    };
  }
}

const document = {
  openapi: '3.1.0',
  info: {
    title: 'Beauty Booking API',
    version: '1.0.0',
    description: 'Generated route, RBAC and security contract. DTO schemas remain enforced by class-validator.',
  },
  servers: [{ url: '/api/v1' }],
  paths: Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b))),
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['statusCode', 'message'],
        properties: {
          statusCode: { type: 'integer', example: 400 },
          message: {
            oneOf: [
              { type: 'string', example: 'Validation failed' },
              { type: 'array', items: { type: 'string' } },
            ],
          },
          error: { type: 'string', example: 'Bad Request' },
        },
      },
    },
  },
};

const output = join(root, 'docs', 'openapi.generated.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Generated ${Object.keys(paths).length} paths -> ${relative(root, output)}`);
