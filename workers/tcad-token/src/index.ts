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
  WORKER_SECRET?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Auth check: if a secret is configured, require it
    if (env.WORKER_SECRET) {
      const auth = request.headers.get('Authorization');
      if (auth !== `Bearer ${env.WORKER_SECRET}`) {
        return json({ error: 'Unauthorized' }, 401);
      }
    }

    try {
      const officeRes = await fetch(OFFICE_LOOKUP, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!officeRes.ok) {
        return json({ error: 'Office lookup failed', status: officeRes.status }, 502);
      }

      const officeData = (await officeRes.json()) as { results: { office: string } };
      const office = officeData.results.office;

      const tokenRes = await fetch(AUTH_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ office }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (!tokenRes.ok) {
        return json({ error: 'Token request failed', status: tokenRes.status }, 502);
      }

      const tokenData = (await tokenRes.json()) as { user: { token: string } };

      return json({ token: tokenData.user.token, expiresIn: 300 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return json({ error: message }, 500);
    }
  },
};
