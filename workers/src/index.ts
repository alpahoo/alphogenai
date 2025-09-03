import { createClient } from "@supabase/supabase-js";

/** Types Env = nom des bindings & secrets configurés dans Cloudflare */
type Env = {
  R2_BUCKET: R2Bucket;

  APP_ADMIN_TOKEN?: string;
  WEBHOOK_SECRET?: string;

  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE?: string;

  RUNPOD_API_KEY?: string;
  RUNPOD_ENDPOINT_ID?: string;
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type,x-webhook-secret",
  "access-control-allow-methods": "GET,PUT,POST,OPTIONS"
};

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...CORS, ...extra } });
const text = (data: string, status = 200, extra: Record<string, string> = {}) =>
  new Response(data, { status, headers: { ...CORS, ...extra } });

const unauthorized = () => json({ ok: false, error: "unauthorized" }, 401);
const notFound = () => json({ ok: false, error: "not_found" }, 404);

const isAdmin = (req: Request, env: Env) => {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(token && env.APP_ADMIN_TOKEN && token === env.APP_ADMIN_TOKEN);
};

const guessType = (key: string) => {
  const ext = (key.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    json: "application/json", txt: "text/plain; charset=utf-8",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    pdf: "application/pdf", mp4: "video/mp4", mp3: "audio/mpeg"
  };
  return map[ext] || "application/octet-stream";
};

function getSupabase(env: Env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const { pathname, searchParams } = url;

    // CORS preflight
    if (req.method === "OPTIONS") return text("ok", 204);

    // 1) Health
    if (req.method === "GET" && pathname === "/health") {
      return json({ ok: true, ts: Date.now() });
    }

    // 2) Assets (R2) - GET/PUT /assets/:key
    if (pathname.startsWith("/assets/")) {
      const key = decodeURIComponent(pathname.slice("/assets/".length));
      if (!key) return notFound();

      if (req.method === "GET") {
        const obj = await env.R2_BUCKET.get(key);
        if (!obj) return notFound();

        const headers: Record<string, string> = {
          "content-type": obj.httpMetadata?.contentType || guessType(key),
          "cache-control": "public, max-age=60",
          ...CORS
        };
        if (searchParams.get("download") === "1") {
          headers["content-disposition"] = `attachment; filename="${key.split("/").pop()}"`;
        }
        return new Response(obj.body, { headers });
      }

      if (req.method === "PUT") {
        if (!isAdmin(req, env)) return unauthorized();
        const contentType = req.headers.get("content-type") || guessType(key);
        await env.R2_BUCKET.put(key, req.body, { httpMetadata: { contentType } });
        return json({ ok: true, key });
      }
    }

    // 3) Jobs API
    // 3.a) POST /jobs  -> crée un job en DB (+ appelle RunPod si configuré)
    if (req.method === "POST" && pathname === "/jobs") {
      if (!isAdmin(req, env)) return unauthorized();
      const supabase = getSupabase(env);

      let payload: any = {};
      try { payload = await req.json(); } catch {}

      // 1) on crée le job en DB (si Supabase est configuré)
      let jobId: string | null = null;
      if (supabase) {
        const { data, error } = await supabase
          .from("jobs")
          .insert({ status: "queued", payload, provider: env.RUNPOD_API_KEY && env.RUNPOD_ENDPOINT_ID ? "runpod" : "noop" })
          .select("id")
          .single();
        if (error) return json({ ok: false, error: error.message }, 500);
        jobId = data.id;
      }

      // 2) on appelle RunPod si configuré, sinon "noop"
      let provider = "noop";
      let provider_job_id: string | null = null;
      let result: any = null;
      let status: string = "queued";

      if (env.RUNPOD_API_KEY && env.RUNPOD_ENDPOINT_ID) {
        provider = "runpod";
        const resp = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${env.RUNPOD_API_KEY}`
          },
          body: JSON.stringify({ input: payload })
        });

        status = resp.ok ? "submitted" : "error";
        try { result = await resp.json(); } catch { result = null; }
        provider_job_id = (result && (result.id || result.jobId || result.job_id)) || null;
      } else {
        status = "submitted";
        result = { note: "noop (configure RUNPOD_API_KEY & RUNPOD_ENDPOINT_ID to call provider)" };
      }

      // 3) on met à jour le job en DB (si Supabase)
      if (supabase && jobId) {
        const { error } = await supabase
          .from("jobs")
          .update({ status, result, provider, provider_job_id })
          .eq("id", jobId);
        if (error) return json({ ok: false, error: error.message }, 500);
      }

      return json({ ok: true, job_id: jobId, status, provider, provider_job_id, result }, 202);
    }

    // 3.b) GET /jobs/:id -> récupère l’état d’un job
    if (req.method === "GET" && pathname.startsWith("/jobs/")) {
      const jobId = pathname.split("/").pop()!;
      const supabase = getSupabase(env);
      if (!supabase) return json({ ok: false, error: "supabase_not_configured" }, 501);

      const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).single();
      if (error) return json({ ok: false, error: error.message }, 404);
      return json({ ok: true, job: data });
    }

    // 4) Webhooks: POST /webhooks/*
    if (req.method === "POST" && pathname.startsWith("/webhooks/")) {
      if (env.WEBHOOK_SECRET) {
        const sig = req.headers.get("x-webhook-secret");
        if (sig !== env.WEBHOOK_SECRET) return unauthorized();
      }
      const supabase = getSupabase(env);
      const event = await req.json().catch(() => null);

      // Insère l'événement si DB configurée
      if (supabase) {
        await supabase.from("events").insert({ type: pathname.slice("/webhooks/".length), payload: event });
      }
      return json({ ok: true, received: event, path: pathname });
    }

    // 5) Profil Supabase: GET /me  (vérifie un JWT utilisateur)
    if (req.method === "GET" && pathname === "/me") {
      const supabase = getSupabase(env);
      if (!supabase) return json({ ok: false, error: "supabase_not_configured" }, 501);

      const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (!bearer) return unauthorized();

      const { data, error } = await supabase.auth.getUser(bearer);
      if (error) return json({ ok: false, error: error.message }, 401);
      return json({ ok: true, user: data.user });
    }

    return notFound();
  }
} satisfies ExportedHandler<Env>;
