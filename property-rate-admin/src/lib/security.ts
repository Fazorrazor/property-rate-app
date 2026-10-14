import crypto from 'crypto';

/**
 * Enterprise Cryptographic Security Engine
 * Zero external dependencies: Uses native Node.js crypto module.
 */

function getAuthSecret(): string {
  const secret = process.env.ADMIN_AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[SECURITY FATAL] ADMIN_AUTH_SECRET or SUPABASE_SERVICE_ROLE_KEY must be configured in production.');
    }
    return 'dev-insecure-admin-auth-secret-do-not-use-in-production';
  }
  return secret;
}

/**
 * Derives a salted cryptographic hash using scrypt (memory-hard, resistant to GPU/ASIC attacks)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `$scrypt$v=1$n=16384,r=8,p=1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Timing-safe password verification supporting modern scrypt and seamless legacy migration
 */
export function verifyPassword(providedPassword: string, storedHashOrPlain: string | null | undefined): boolean {
  if (!providedPassword || !storedHashOrPlain) {
    return false;
  }

  // Modern scrypt format
  if (storedHashOrPlain.startsWith('$scrypt$')) {
    try {
      const parts = storedHashOrPlain.split('$');
      // format: $scrypt$v=1$n=16384,r=8,p=1$<salt_hex>$<hash_hex>
      if (parts.length < 6) return false;
      const salt = Buffer.from(parts[4], 'hex');
      const expectedHash = Buffer.from(parts[5], 'hex');
      const actualHash = crypto.scryptSync(providedPassword, salt, expectedHash.length, {
        N: 16384,
        r: 8,
        p: 1,
      });

      return crypto.timingSafeEqual(expectedHash, actualHash);
    } catch {
      return false;
    }
  }

  // Fallback for legacy plaintext password migration: timing-safe buffer comparison
  const providedBuf = Buffer.from(providedPassword, 'utf8');
  const storedBuf = Buffer.from(storedHashOrPlain, 'utf8');

  if (providedBuf.length !== storedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, storedBuf);
}

/**
 * Generates high-entropy cryptographic session tokens (192-bit)
 */
export function generateSecureSessionToken(): string {
  return `adm_${crypto.randomBytes(24).toString('base64url')}_${Date.now()}`;
}

/**
 * Creates a tamper-evident signed cookie string: `${rawPayload}.${signature}`
 */
export function createSignedSessionCookie(rawPayload: string): string {
  const signature = crypto
    .createHmac('sha256', getAuthSecret())
    .update(rawPayload)
    .digest('base64url');
  return `${rawPayload}.${signature}`;
}

/**
 * Validates and extracts payload from signed session cookie with timing-safe HMAC checks
 */
export function parseAndVerifySignedSessionCookie(cookieValue: string): {
  valid: boolean;
  adminId: string | null;
  sessionToken: string | null;
} {
  if (!cookieValue) return { valid: false, adminId: null, sessionToken: null };

  const dotIndex = cookieValue.lastIndexOf('.');

  // If cookie contains HMAC signature
  if (dotIndex !== -1) {
    const rawPayload = cookieValue.substring(0, dotIndex);
    const signature = cookieValue.substring(dotIndex + 1);

    const expectedSignature = crypto
      .createHmac('sha256', getAuthSecret())
      .update(rawPayload)
      .digest('base64url');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, adminId: null, sessionToken: null };
    }

    const [adminId, sessionToken, loginTimestampStr] = rawPayload.split(':');
    if (loginTimestampStr) {
      const loginTimestamp = parseInt(loginTimestampStr, 10);
      const MAX_SESSION_LIFETIME_MS = 7 * 60 * 1000; // Strict 7-minute hard ceiling
      if (!isNaN(loginTimestamp) && (Date.now() - loginTimestamp > MAX_SESSION_LIFETIME_MS)) {
        return { valid: false, adminId: null, sessionToken: null };
      }
    }
    return { valid: true, adminId: adminId || null, sessionToken: sessionToken || null };
  }

  // Strictly reject unsigned cookies: all sessions must be cryptographically signed
  return { valid: false, adminId: null, sessionToken: null };
}

/**
 * In-Memory Sliding-Window Rate Limiter
 * Guards against brute-force password guessing and automated credential stuffing
 */
interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Automatically clean up stale keys every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (record.lockedUntil && record.lockedUntil < now) {
      rateLimitMap.delete(key);
    } else if (now - record.firstAttemptAt > 60 * 60 * 1000) {
      rateLimitMap.delete(key);
    }
  }
}, 15 * 60 * 1000).unref();

export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 10 * 60 * 1000,
  lockoutDurationMs: number = 15 * 60 * 1000
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // If currently locked out
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  // Reset if window has elapsed
  if (now - record.firstAttemptAt > windowMs) {
    rateLimitMap.delete(identifier);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (record.attempts >= maxAttempts) {
    record.lockedUntil = now + lockoutDurationMs;
    const retryAfterSeconds = Math.ceil(lockoutDurationMs / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLoginAttempt(
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 10 * 60 * 1000,
  lockoutDurationMs: number = 15 * 60 * 1000
): { locked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  let record = rateLimitMap.get(identifier);

  if (!record || now - record.firstAttemptAt > windowMs) {
    record = { attempts: 1, firstAttemptAt: now };
    rateLimitMap.set(identifier, record);
    return { locked: false, retryAfterSeconds: 0 };
  }

  record.attempts += 1;

  if (record.attempts >= maxAttempts) {
    record.lockedUntil = now + lockoutDurationMs;
    return { locked: true, retryAfterSeconds: Math.ceil(lockoutDurationMs / 1000) };
  }

  return { locked: false, retryAfterSeconds: 0 };
}

export function clearRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}
