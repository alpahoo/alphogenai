import { createClient } from "@supabase/supabase-js";

type Env = {
  R2_BUCKET: R2Bucket;
  APP_ADMIN_TOKEN?: string;
  WEBHOOK_SECRET?: string;
  RUNPOD_API_KEY?: string;
  RUNPOD_ENDPOINT_ID?: string; // RunPod "endpoint" ID
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE?: string;
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type,x-webhook-secret",
  "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
};

const json = (data: any, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders, ...extra },
  });

const text = (data: string, status = 200, extra: Record<string, string> = {}) =>
  new Response(data, { status, headers: { ...corsHeaders, ...extra } });

const unauthorized = () => json({ ok: false, error: "unauthorized" }, 401);
const notFound = () => json({ ok: false, error: "not_found" }, 404);

const guessType = (key: string) => {
  const ext = (key.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    json: "application/json",
    txt: "text/plain; charset=utf-8",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
  };
  return map[ext] || "application/octet-stream";
};

const isAdmin = (req: Request, env: Env) => {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return token && env.APP_ADMIN_TOKEN && token === env.APP_ADMIN_TOKEN;
};

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    const { pathname, searchParams } = url;

    // CORS preflight
    if (req.method === "OPTIONS") return text("ok", 204);

    // 1) Health
    if (req.method === "GET" && pathname === "/health") {
      return json({ ok: true, ts: Date.now() });
    }

    // 2) Assets (R2)
    if (pathname.startsWith("/assets/")) {
      const key = decodeURIComponent(pathname.slice("/assets/".length));
      if (!key) return notFound();

      if (req.method === "GET") {
        const obj = await env.R2_BUCKET.get(key);
        if (!obj) return notFound();

        const headers: Record<string, string> = {
          "content-type": obj.httpMetadata?.contentType || guessType(key),
          "cache-control": "public, max-age=60",
          ...corsHeaders,
        };
        if (searchParams.get("download") === "1") {
          headers["content-disposition"] = `attachment; filename="${key.split("/").pop()}"`;
        }
        return new Response(obj.body, { headers });
      }

      if (req.method === "PUT") {
        if (!isAdmin(req, env)) return unauthorized();
        const contentType = req.headers.get("content-type") || guessType(key);
        await env.R2_BUCKET.put(key, req.body, {
          httpMetadata: { contentType },
        });
        return json({ ok: true, key });
      }
    }

    // 3) Jobs (RunPod)
    if (req.method === "POST" && pathname === "/jobs") {
      if (!isAdmin(req, env)) return unauthorized();
      let payload: unknown;
      try {
        payload = await req.json();
      } catch {
        payload = {};
      }

      if (env.RUNPOD_API_KEY && env.RUNPOD_ENDPOINT_ID) {
        const resp = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${env.RUNPOD_API_KEY}`,
          },
          body: JSON.stringify({ input: payload }),
        });
        const data = await resp.json().catch(() => null);
        return json({ ok: resp.ok, provider: "runpod", data }, resp.ok ? 200 : 502);
      } else {
        // Mode "noop" pour dev sans secrets
        return json(
          { ok: true, provider: "noop", note: "Set RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID to call RunPod.", input: payload },
          202
        );
      }
    }

    // 4) Webhooks (signature simple)
    if (req.method === "POST" && pathname.startsWith("/webhooks/")) {
      if (env.WEBHOOK_SECRET) {
        const sig = req.headers.get("x-webhook-secret");
        if (sig !== env.WEBHOOK_SECRET) return unauthorized();
      }
      const event = await req.json().catch(() => null);
      // Ici tu peux router selon pathname (/webhooks/supabase, /webhooks/stripe, ...)
      return json({ ok: true, received: event, path: pathname });
    }

    // 5) Supabase: GET /me  (exemple d’intégration)
    if (req.method === "GET" && pathname === "/me") {
      const url = env.SUPABASE_URL;
      const key = env.SUPABASE_SERVICE_ROLE;
      if (!url || !key) return json({ ok: false, error: "supabase_not_configured" }, 501);

      const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (!bearer) return unauthorized();

      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await supabase.auth.getUser(bearer);
      if (error) return json({ ok: false, error: error.message }, 401);
      return json({ ok: true, user: data.user });
    }

    return notFound();
  },
} satisfies ExportedHandler<Env>;
