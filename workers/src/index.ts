export interface Env {
  APP_ADMIN_TOKEN: string;
  WEBHOOK_SECRET: string;

  RUNPOD_API_KEY?: string;
  RUNPOD_ENDPOINT_ID?: string; // si tu utilises l'API v2 par endpoint
  RUNPOD_API_URL?: string;     // ou bien URL complète (prioritaire si défini)

  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE?: string;

  R2_BUCKET?: R2Bucket;
}

type JSONValue =
  | null | string | number | boolean
  | JSONValue[] | { [k: string]: JSONValue };

const VERSION = "rp-only-" + new Date(Date.UTC(2025, 8, 4, 0, 0, 0)).toISOString(); // marqueur visible

/* ---------------- utils ---------------- */
const cors = () => ({
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type,x-webhook-secret",
  "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
});
const json = (data: JSONValue, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors() },
  });
const notFound = () => json({ ok: false, error: "not_found" }, 404);
const unauthorized = () => json({ ok: false, error: "unauthorized" }, 401);

const isAdmin = (req: Request, env: Env) => {
  const h = req.headers.get("authorization") || "";
  const m = /^bearer\s+(.+)$/i.exec(h);
  return !!m && m[1] === env.APP_ADMIN_TOKEN;
};
const isWebhook = (req: Request, env: Env) =>
  (req.headers.get("x-webhook-secret") || "") === env.WEBHOOK_SECRET;

const getR2 = (env: Env) => env.R2_BUCKET;

/* ------------- RunPod helpers ------------- */
function runpodBase(env: Env) {
  if (env.RUNPOD_API_URL) return env.RUNPOD_API_URL.replace(/\/+$/, "");
  if (env.RUNPOD_ENDPOINT_ID) return `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}`;
  return null;
}
async function runpodStart(env: Env, input: any) {
  const base = runpodBase(env);
  if (!base || !env.RUNPOD_API_KEY) throw new Error("runpod_not_configured");
  const r = await fetch(`${base}/run`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.RUNPOD_API_KEY}` },
    body: JSON.stringify({ input }),
  });
  if (!r.ok) throw new Error(`runpod_http_${r.status}`);
  return r.json<any>();
}
async function runpodStatus(env: Env, id: string) {
  const base = runpodBase(env);
  if (!base || !env.RUNPOD_API_KEY) throw new Error("runpod_not_configured");
  let r = await fetch(`${base}/status/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.RUNPOD_API_KEY}` },
  });
  if (r.status === 404) {
    r = await fetch(`${base}/status/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${env.RUNPOD_API_KEY}` },
    });
  }
  if (!r.ok) throw new Error(`runpod_http_${r.status}`);
  return r.json<any>();
}

/* ------------- Supabase helpers ------------- */
import { createClient } from '@supabase/supabase-js';

function getSupabase(env: Env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);
}

async function createJobRecord(env: Env, userId: string | null, payload: any, status: string, result?: any) {
  const supabase = getSupabase(env);
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('jobs')
    .insert({ user_id: userId, status, payload, result })
    .select()
    .single();
  
  if (error) throw new Error(`supabase_job_error: ${error.message}`);
  return data;
}

async function logEvent(env: Env, type: string, payload: any) {
  const supabase = getSupabase(env);
  if (!supabase) return null;
  
  const { error } = await supabase
    .from('events')
    .insert({ type, payload });
  
  if (error) console.error('Event logging failed:', error);
}

async function validateJWT(env: Env, token: string) {
  const supabase = getSupabase(env);
  if (!supabase) throw new Error("supabase_not_configured");
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error(`jwt_invalid: ${error?.message || 'user not found'}`);
  return user;
}

/* ---------------- Worker ---------------- */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") return new Response(null, { headers: cors() });

    if (req.method === "GET" && path === "/health") {
      return json({ ok: true, ts: Date.now() });
    }

    // Endpoint de diagnostic pour savoir QUI sert la requête
    if (req.method === "GET" && path === "/who") {
      return json({ ok: true, service: "worker", version: VERSION });
    }

    // Webhooks (protégés par X-Webhook-Secret)
    if (path.startsWith("/webhooks/")) {
      if (!isWebhook(req, env)) return unauthorized();
      let body: any = null;
      try { body = await req.json(); } catch {}
      
      try {
        const headerEntries: [string, string][] = [];
        req.headers.forEach((value, key) => headerEntries.push([key, value]));
        await logEvent(env, path, { body, headers: Object.fromEntries(headerEntries) });
      } catch (e) {
        console.error('Failed to log webhook event:', e);
      }
      
      return json({ ok: true, path, received: body });
    }

    // R2 objets simples
    if (path.startsWith("/assets/")) {
      const key = path.replace(/^\/assets\//, "");
      const r2 = getR2(env);
      if (!r2) return json({ ok: false, error: "r2_not_configured" }, 500);

      if (req.method === "PUT") {
        if (!isAdmin(req, env)) return unauthorized();
        const buf = await req.arrayBuffer();
        await r2.put(key, buf, {
          httpMetadata: { contentType: req.headers.get("content-type") ?? "application/octet-stream" },
        });
        return json({ ok: true, key });
      }
      if (req.method === "GET") {
        const obj = await r2.get(key);
        if (!obj) return notFound();
        
        let contentType = obj.httpMetadata?.contentType ?? "application/octet-stream";
        if (contentType === "application/octet-stream") {
          const ext = key.split('.').pop()?.toLowerCase();
          if (ext === 'txt') contentType = 'text/plain';
          else if (ext === 'json') contentType = 'application/json';
          else if (ext === 'html') contentType = 'text/html';
          else if (ext === 'css') contentType = 'text/css';
          else if (ext === 'js') contentType = 'application/javascript';
          else if (ext === 'png') contentType = 'image/png';
          else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
          else if (ext === 'gif') contentType = 'image/gif';
          else if (ext === 'pdf') contentType = 'application/pdf';
        }
        
        const headers: Record<string, string> = {
          "content-type": contentType,
          "cache-control": "public, max-age=60",
          ...cors()
        };
        
        if (url.searchParams.get('download') === '1') {
          headers['content-disposition'] = `attachment; filename="${key}"`;
        }
        
        return new Response(obj.body, { headers });
      }
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }

    // --- Aliases "rp/*" pour éviter toute collision avec d'anciens /jobs ---
    if (req.method === "POST" && (path === "/rp/start" || path === "/jobs")) {
      if (!isAdmin(req, env)) return unauthorized();
      let payload: any = {};
      try { payload = await req.json(); } catch {}
      const input = { prompt: payload.prompt ?? "", ...payload };
      
      let jobRecord = null;
      let status = "queued";
      let result = null;
      
      try {
        const rp = await runpodStart(env, input);
        const id = rp.id || rp.jobId || rp.requestId || null;
        status = "submitted";
        result = { provider: "runpod", provider_job_id: id, runpod_response: rp };
        
        try {
          jobRecord = await createJobRecord(env, null, input, status, result);
        } catch (e) {
          console.error('Failed to create job record:', e);
        }
        
        return json({ ok: true, status, provider: "runpod", provider_job_id: id, job_id: jobRecord?.id, result: rp });
      } catch (e: any) {
        if (String(e?.message || e).includes("runpod_not_configured")) {
          status = "noop";
          result = { provider: "noop", reason: "runpod_not_configured" };
          
          try {
            jobRecord = await createJobRecord(env, null, input, status, result);
          } catch (e) {
            console.error('Failed to create noop job record:', e);
          }
          
          return json({ ok: true, status: "submitted", provider: "noop", provider_job_id: null, job_id: jobRecord?.id }, 202);
        }
        
        status = "error";
        result = { error: String(e?.message || e) };
        
        try {
          jobRecord = await createJobRecord(env, null, input, status, result);
        } catch (e) {
          console.error('Failed to create error job record:', e);
        }
        
        return json({ ok: false, error: String(e?.message || e), job_id: jobRecord?.id }, 500);
      }
    }

    if (req.method === "GET" && (path.startsWith("/rp/status/") || path.startsWith("/jobs/"))) {
      if (!isAdmin(req, env)) return unauthorized();
      const id = path.split("/").pop()!;
      try {
        const rp = await runpodStatus(env, id);
        return json({ ok: true, provider: "runpod", provider_job_id: id, result: rp });
      } catch (e: any) {
        return json({ ok: false, error: String(e?.message || e) }, 500);
      }
    }

    if (req.method === "GET" && path === "/me") {
      const authHeader = req.headers.get("authorization") || "";
      const tokenMatch = /^bearer\s+(.+)$/i.exec(authHeader);
      
      if (!tokenMatch) {
        return json({ ok: false, error: "missing_jwt_token" }, 401);
      }
      
      try {
        const user = await validateJWT(env, tokenMatch[1]);
        if (!user) {
          return json({ ok: false, error: "user_not_found" }, 404);
        }
        return json({ ok: true, user: { id: user.id, email: user.email || null } });
      } catch (e: any) {
        if (String(e?.message || e).includes("supabase_not_configured")) {
          return json({ ok: true, provider: "noop", message: "supabase_not_configured" }, 501);
        }
        return json({ ok: false, error: String(e?.message || e) }, 401);
      }
    }

    return notFound();
  },
};
