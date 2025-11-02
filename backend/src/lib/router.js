import { parseRequest, readJsonBody, sendError } from './http.js';

function compilePath(path) {
  const parts = path.split('/').filter(Boolean);
  const keys = [];
  const pattern = parts
    .map((part) => {
      if (part.startsWith(':')) {
        keys.push(part.slice(1));
        return '([^/]+)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^/${pattern}$`), keys };
}

export class Router {
  constructor({ basePath = '' } = {}) {
    this.basePath = basePath.replace(/\/$/, '');
    this.routes = [];
  }

  register(method, path, handler) {
    const fullPath = `${this.basePath}${path}`.replace(/\/$/, '') || '/';
    const { regex, keys } = compilePath(fullPath === '/' ? '' : fullPath);
    this.routes.push({ method: method.toUpperCase(), regex, keys, handler });
  }

  get(path, handler) {
    this.register('GET', path, handler);
  }

  post(path, handler) {
    this.register('POST', path, handler);
  }

  put(path, handler) {
    this.register('PUT', path, handler);
  }

  patch(path, handler) {
    this.register('PATCH', path, handler);
  }

  delete(path, handler) {
    this.register('DELETE', path, handler);
  }

  use(path, router) {
    router.basePath = `${this.basePath}${path}`.replace(/\/$/, '');
    this.routes.push(...router.routes);
  }

  async handle(req, res, context = {}) {
    const method = (req.method || 'GET').toUpperCase();
    const { pathname } = parseRequest(req);
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = route.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1]);
      });
      req.params = params;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          req.body = await readJsonBody(req);
        } catch (error) {
          sendError(res, 400, error.message);
          return true;
        }
      }
      try {
        await route.handler(req, res, context);
      } catch (error) {
        console.error('Unhandled error:', error);
        sendError(res, 500, error.message || 'Error interno');
      }
      return true;
    }
    return false;
  }
}
