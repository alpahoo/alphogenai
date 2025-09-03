export interface Env {
  // Secrets
  APP_ADMIN_TOKEN: string;
  WEBHOOK_SECRET: string;
  RUNPOD_API_KEY?: string;
  RUNPOD_ENDPOINT_ID?: string;     // e.g. "xxxxxxxxxxxxxxxxxxxx"
  RUNPOD_API_URL?: string;         // facultatif, sinon construit depuis ENDPOINT_ID

  // R2 (nom souple : on accepte ASSETS ou R2 ou BUCKET)
  ASSETS?: R2Bucket;
  R2?: R2Bucket;
  BUCKET?: R2Bucket;
}

type JSONValue = null | string | number | boolean | JSONValue[] | { [k: string]: JSONValue };

const json = (data: JSONValue, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });

const corsHeaders = () => ({
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type,x-webhook-secret",
  "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
});

const notFound = () => json({ ok: false, error: "not_found" }, 404);
const unauthorized = () => json({ ok: false, error: "unauthorized" }, 401);

const getR2 = (env: Env): R2Bucket | undefined => (env.ASSETS || env.R2 || env.BUCKET);

/** --- Auth helpers --- */
const isAdmin = (req: Request, env: Env) => {
  const h = req.headers.get("authorization") || "";
  const m = /^bearer\s+(.+)$/i.exec(h);
  return m && m[1] === env.APP_ADMIN_TOKEN;
};
const isWebhook = (req: Request, env: Env) =>
  (req.headers.get("x-webhook-secret") || "") === env.WEBHOOK_SECRET;

/** --- RunPod helpers --- */
function runpodBase(env: Env) {
  if (env.RUNPOD_API_URL) return env.RUNPOD_API_URL.replace(/\/+$/, "");
  if (env.RUNPOD_ENDPOINT_ID) return `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}`;
  return null;
}

async function runpodStart(env: Env, input: any) {
  const base = runpodBase(env);
  if (!base || !env.RUNPOD_API_KEY) throw new Error("runpod_not_configured");
  const res = await fetch(`${base}/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`runpod_http_${res.status}`);
  return res.json<any>();
}

async function runpodStatus(env: Env, id: string) {
  const base = runpodBase(env);
  if (!base || !env.RUNPOD_API_KEY) throw new Error("runpod_not_configured");

  // On tente POST /status/{id}, puis GET si 404 (RunPod a plusieurs variantes)
  let res = await fetch(`${base}/status/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.RUNPOD_API_KEY}` },
  });
  if (res.status === 404) {
    res = await fetch(`${base}/status/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${env.RUNPOD_API_KEY}` },
    });
  }
  if (!res.ok) throw new Error(`runpod_http_${res.status}`);
  return res.json<any>();
}

/** --- Router --- */
export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const { pathname, searchParams } = url;

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // Health
    if (req.method === "GET" && pathname === "/health") {
      return json({ ok: true, ts: Date.now() });
    }

    // Webhooks (tests & réels)
    if (pathname.startsWith("/webhooks/")) {
      if (!isWebhook(req, env)) return unauthorized();
      // on lit le body pour debug / pass-through
      let received: any = null;
      try { received = await req.json(); } catch {}
      return json({ ok: true, path: pathname, received });
    }

    // Assets R2 : PUT/GET /assets/:key  (auth admin pour PUT)
    if (pathname.startsWith("/assets/")) {
      const key = pathname.replace(/^\/assets\//, "");
      const r2 = getR2(env);
      if (!r2) return json({ ok: false, error: "r2_not_configured" }, 500);

      if (req.method === "PUT") {
        if (!isAdmin(req, env)) return unauthorized();
        const body = await req.arrayBuffer();
        await r2.put(key, body, {
          httpMetadata: {
            contentType: req.headers.get("content-type") ?? "application/octet-stream",
          },
        });
        return json({ ok: true, key });
      }

      if (req.method === "GET") {
        const obj = await r2.get(key);
        if (!obj) return notFound();
        return new Response(obj.body, {
          headers: {
            "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
            ...corsHeaders(),
          },
        });
      }

      return json({ ok: false, error: "method_not_allowed" }, 405);
    }

    // Jobs : POST /jobs {prompt,...}  (admin)
    if (req.method === "POST" && pathname === "/jobs") {
      if (!isAdmin(req, env)) return unauthorized();
      let payload: any = {};
      try { payload = await req.json(); } catch {}
      const input = { prompt: payload.prompt ?? "", ...payload };

      try {
        const rp = await runpodStart(env, input);
        // RunPod renvoie souvent { id, status, ... }
        const id = rp.id || rp.jobId || rp.requestId || null;
        return json({
          ok: true,
          status: "submitted",
          provider: "runpod",
          provider_job_id: id,
          result: rp,
        });
      } catch (e: any) {
        return json({ ok: false, error: String(e?.message || e) }, 500);
      }
    }

    // Jobs : GET /jobs/:id  (admin)
    if (req.method === "GET" && pathname.startsWith("/jobs/")) {
      if (!isAdmin(req, env)) return unauthorized();
      const id = pathname.split("/").pop()!;
      try {
        const rp = await runpodStatus(env, id);
        return json({ ok: true, provider: "runpod", provider_job_id: id, result: rp });
      } catch (e: any) {
        return json({ ok: false, error: String(e?.message || e) }, 500);
      }
    }

    return notFound();
  },
};
