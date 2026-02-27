const TCAD_API = 'https://prod-container.trueprodigyapi.com';
const OFFICE_LOOKUP = `${TCAD_API}/trueprodigy/officelookup/travis.prodigycad.com`;
const AUTH_TOKEN = `${TCAD_API}/trueprodigy/cadpublic/auth/token`;
const UPSTREAM_TIMEOUT_MS = 8_000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

interface Env {
  // Required: set via `wrangler secret put WORKER_SECRET`
  WORKER_SECRET?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** Decode JWT payload and return `exp - iat` (seconds), or null on failure. */
function getJwtLifetime(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1])) as { exp?: number; iat?: number };
    if (typeof payload.exp === 'number' && typeof payload.iat === 'number') {
      return payload.exp - payload.iat;
    }
    return null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Auth required — reject if secret is not configured or doesn't match
    const auth = request.headers.get('Authorization');
    if (!env.WORKER_SECRET || auth !== `Bearer ${env.WORKER_SECRET}`) {
      return json({ error: 'Unauthorized' }, 401);
    }

    try {
      const officeRes = await fetch(OFFICE_LOOKUP, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!officeRes.ok) {
        return json({ error: 'Office lookup failed', status: officeRes.status }, 502);
      }

      const officeData = (await officeRes.json()) as { results?: { office?: string } };
      const office = officeData?.results?.office;
      if (!office) {
        return json({ error: 'Office lookup returned unexpected shape' }, 502);
      }

      const tokenRes = await fetch(AUTH_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ office }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (!tokenRes.ok) {
        return json({ error: 'Token request failed', status: tokenRes.status }, 502);
      }

      const tokenData = (await tokenRes.json()) as { user?: { token?: string } };
      const token = tokenData?.user?.token;
      if (!token) {
        return json({ error: 'Auth token missing in TCAD response' }, 502);
      }

      const expiresIn = getJwtLifetime(token) ?? 300;

      return json({ token, expiresIn });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return json({ error: message }, 500);
    }
  },
};
