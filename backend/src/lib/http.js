import { StringDecoder } from 'string_decoder';
import { parse as parseUrl } from 'url';

export function parseRequest(req) {
  const { pathname, query } = parseUrl(req.url || '', true);
  return { pathname: pathname || '/', query: query || {} };
}

export async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder('utf8');
    let buffer = '';

    req.on('data', (chunk) => {
      buffer += decoder.write(chunk);
    });

    req.on('end', () => {
      buffer += decoder.end();
      if (!buffer) {
        resolve({});
        return;
      }
      try {
        const data = JSON.parse(buffer);
        resolve(data);
      } catch (error) {
        reject(new Error('JSON inválido'));
      }
    });

    req.on('error', reject);
  });
}

export function sendJson(res, statusCode, data, headers = {}) {
  const payload = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers
  });
  res.end(payload);
}

export function sendNoContent(res) {
  res.writeHead(204);
  res.end();
}

export function sendError(res, statusCode, message, details) {
  sendJson(res, statusCode, { message, ...(details ? { details } : {}) });
}
