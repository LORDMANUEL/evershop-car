import { pbkdf2Sync, randomBytes, createHmac } from 'crypto';

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha512';

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  const computed = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return timingSafeEqual(computed, hash);
}

function timingSafeEqual(a, b) {
  const hashA = createHmac('sha512', 'timing-safe').update(a).digest('hex');
  const hashB = createHmac('sha512', 'timing-safe').update(b).digest('hex');
  return hashA === hashB;
}

export function signToken(payload, secret, expiresInMinutes = 60) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + expiresInMinutes * 60 * 1000;
  const data = JSON.stringify({ ...payload, iat: issuedAt, exp: expiresAt });
  const signature = createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(data).toString('base64url') + '.' + signature;
}

export function verifyToken(token, secret) {
  const [dataB64, signature] = token.split('.');
  if (!dataB64 || !signature) return null;
  const dataJson = Buffer.from(dataB64, 'base64url').toString('utf8');
  const expected = createHmac('sha256', secret).update(dataJson).digest('hex');
  if (!timingSafeEqual(expected, signature)) return null;
  const payload = JSON.parse(dataJson);
  if (payload.exp && payload.exp < Date.now()) {
    return null;
  }
  return payload;
}
