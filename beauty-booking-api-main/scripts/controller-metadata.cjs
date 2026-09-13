const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');
const ts = require('typescript');

const HTTP_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options', 'All']);
const METADATA_DECORATORS = new Set(['Controller', 'Public', 'Roles', 'RequirePermission', 'RequireScope', ...HTTP_DECORATORS]);

function sourceFiles(directory) {
  return readdirSync(directory).sort().flatMap((entry) => {
    const file = join(directory, entry);
    return statSync(file).isDirectory()
      ? sourceFiles(file)
      : entry.endsWith('.controller.ts') ? [file] : [];
  });
}

/** Static parsing only: controller imports are never executed by contract tooling. */
function parseControllerSource(source, file = 'fixture.controller.ts') {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (tree.parseDiagnostics.length) {
    throw new Error(file + ': ' + ts.flattenDiagnosticMessageText(tree.parseDiagnostics[0].messageText, '\n'));
  }
  const aliases = new Map();
  const constants = new Map();
  const declarations = [];
  const routes = [];
  for (const statement of tree.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
      for (const item of statement.importClause.namedBindings.elements) {
        aliases.set(item.name.text, item.propertyName?.text ?? item.name.text);
      }
    }
    if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          constants.set(declaration.name.text, declaration.initializer);
        }
      }
    }
  }

  function fail(node, message) {
    const { line } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
    throw new Error(`${file}:${line + 1}: ${message}`);
  }

  function value(node, resolving = new Set()) {
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) return value(node.expression, resolving);
    if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap((element) => {
      if (!ts.isSpreadElement(element)) return [value(element, resolving)];
      const items = value(element.expression, resolving);
      if (!Array.isArray(items)) fail(element, 'Expected an array spread in route metadata');
      return items;
    });
    if (ts.isObjectLiteralExpression(node)) {
      const result = {};
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) {
          Object.assign(result, value(property.expression, resolving));
        } else if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))) {
          result[property.name.text] = value(property.initializer, resolving);
        } else {
          fail(property, 'Unsupported property in route metadata');
        }
      }
      return result;
    }
    if (ts.isIdentifier(node) && constants.has(node.text) && !resolving.has(node.text)) {
      return value(constants.get(node.text), new Set([...resolving, node.text]));
    }
    fail(node, `Cannot statically resolve route metadata: ${node.getText(tree)}`);
  }

  function decorators(node) {
    const result = new Map();
    for (const decorator of ts.getDecorators(node) ?? []) {
      if (!ts.isCallExpression(decorator.expression)) continue;
      const call = decorator.expression;
      const rawName = ts.isIdentifier(call.expression) ? call.expression.text : undefined;
      const name = aliases.get(rawName) ?? rawName;
      if (!METADATA_DECORATORS.has(name)) continue;
      // TypeScript applies repeated decorators bottom-up; the first in source wins.
      if (!result.has(name)) result.set(name, call.arguments.flatMap((argument) => {
        if (!ts.isSpreadElement(argument)) return [value(argument)];
        const values = value(argument.expression);
        if (!Array.isArray(values)) fail(argument, 'Expected array spread in decorator arguments');
        return values;
      }));
    }
    return result;
  }

  function strings(input, node, name) {
    if (!Array.isArray(input) || input.some((item) => typeof item !== 'string')) fail(node, `${name} must resolve to string literals`);
    return input;
  }

  function metadata(node) {
    const all = decorators(node);
    const result = {
      isPublic: all.has('Public') ? true : undefined,
      roles: all.has('Roles') ? strings(all.get('Roles'), node, 'Roles') : undefined,
      permissions: all.has('RequirePermission') ? strings(all.get('RequirePermission'), node, 'RequirePermission') : undefined,
      scope: all.has('RequireScope') ? all.get('RequireScope')[0] : undefined,
    };
    if (all.has('RequireScope')) {
      if (!result.scope || Array.isArray(result.scope) || typeof result.scope !== 'object') fail(node, 'RequireScope requires an object');
      if (result.scope.roles !== undefined) strings(result.scope.roles, node, 'RequireScope.roles');
      if (result.scope.permissions !== undefined) strings(result.scope.permissions, node, 'RequireScope.permissions');
    }
    declarations.push(result);
    return { all, result };
  }

  function paths(input, node) {
    if (input === undefined) return [''];
    return strings(Array.isArray(input) ? input : [input], node, 'Route paths');
  }

  for (const controller of tree.statements.filter(ts.isClassDeclaration)) {
    const classMetadata = metadata(controller);
    if (!classMetadata.all.has('Controller')) continue;
    if (controller.heritageClauses?.some((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)) {
      fail(controller, 'Inherited controller routes need explicit scanner support');
    }
    const controllerArgument = classMetadata.all.get('Controller')[0];
    const prefixes = paths(typeof controllerArgument === 'object' && !Array.isArray(controllerArgument) && controllerArgument !== null
      ? controllerArgument.path : controllerArgument, controller);
    for (const member of controller.members.filter(ts.isMethodDeclaration)) {
      const methodMetadata = metadata(member);
      const routeDecorators = [...methodMetadata.all].filter(([name]) => HTTP_DECORATORS.has(name));
      if (!routeDecorators.length) continue;
      if (routeDecorators.length !== 1) fail(member, 'Multiple HTTP decorators need explicit scanner support');
      const [httpMethod, args] = routeDecorators[0];
      const effective = {};
      for (const key of ['isPublic', 'roles', 'permissions', 'scope']) {
        // Mirrors Reflector.getAllAndOverride([handler, class]), including empty arrays.
        effective[key] = methodMetadata.result[key] !== undefined ? methodMetadata.result[key] : classMetadata.result[key];
      }
      for (const prefix of prefixes) {
        for (const child of paths(args[0], member)) {
          const path = `/${[prefix, child].filter(Boolean).join('/')}`.replace(/\/+/g, '/').replace(/:([A-Za-z_]\w*)/g, '{$1}');
          routes.push({
            file, controller: controller.name?.text ?? '(anonymous)', method: member.name.getText(tree),
            prefix, path, verb: httpMethod.toLowerCase(), isPublic: effective.isPublic ?? false,
            roles: effective.roles ?? [], permissions: effective.permissions ?? [], scope: effective.scope,
            line: tree.getLineAndCharacterOfPosition(member.getStart(tree)).line + 1,
          });
        }
      }
    }
  }
  return { routes, declarations };
}

function scanControllers(root) {
  const parsed = sourceFiles(join(root, 'src')).map((file) => parseControllerSource(readFileSync(file, 'utf8'), relative(root, file).replaceAll('\\', '/')));
  return {
    routes: parsed.flatMap((result) => result.routes),
    declarations: parsed.flatMap((result) => result.declarations),
  };
}

function routeKey(route) {
  return `${route.verb.toUpperCase()} ${route.path}`;
}

function permissionCoverageGaps(routes, exceptions = {}) {
  return routes.filter((route) => !route.isPublic && route.permissions.length === 0 && !exceptions[routeKey(route)]).map(routeKey).sort();
}

module.exports = { parseControllerSource, scanControllers, routeKey, permissionCoverageGaps };
