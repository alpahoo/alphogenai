export interface Env {
  APP_ADMIN_TOKEN: string;
  WEBHOOK_SECRET: string;

  RUNPOD_API_KEY?: string;
  RUNPOD_ENDPOINT_ID?: string; // si tu utilises l'API v2 par endpoint
  RUNPOD_API_URL?: string;     // ou bien URL complète (prioritaire si défini)

  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE?: string;

  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  R2_BUCKET?: R2Bucket;
}

type JSONValue =
  | null | string | number | boolean
  | JSONValue[] | { [k: string]: JSONValue };

const VERSION = "rp-only-" + new Date(Date.UTC(2025, 8, 4, 0, 0, 0)).toISOString(); // marqueur visible

/* ---------------- utils ---------------- */
const cors = () => ({
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type,x-webhook-secret,stripe-signature",
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
const isWebhook = (req: Request, env: Env) => {
  const secret = req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret") || "";
  const expectedSecret = env.WEBHOOK_SECRET;
  
  const headerEntries: string[][] = [];
  req.headers.forEach((value, key) => {
    headerEntries.push([key, value]);
  });
  
  
  return secret === expectedSecret;
};

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
  if (!r.ok) {
    if (r.status === 401) {
      throw new Error("runpod_unauthorized");
    }
    throw new Error(`runpod_http_${r.status}`);
  }
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
  
  try {
    const { data, error } = await supabase
      .from('jobs')
      .insert({ user_id: userId, status, payload, result })
      .select()
      .single();
    
    if (error) {
      console.error('Supabase job insert error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Supabase job record creation failed:', e);
    return null;
  }
}

async function logEvent(env: Env, type: string, payload: any) {
  const supabase = getSupabase(env);
  if (!supabase) return null;
  
  try {
    const { error } = await supabase
      .from('events')
      .insert({ type, payload });
    
    if (error) console.error('Event logging failed:', error);
  } catch (e) {
    console.error('Event logging exception:', e);
  }
}

async function validateJWT(env: Env, token: string) {
  const supabase = getSupabase(env);
  if (!supabase) throw new Error("supabase_not_configured");
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error(`jwt_invalid: ${error?.message || 'user not found'}`);
    return user;
  } catch (e: any) {
    console.error('JWT validation error:', e);
    throw new Error(`jwt_validation_failed: ${String(e?.message || e)}`);
  }
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
        const headers: Record<string, string> = {};
        req.headers.forEach((value, key) => {
          headers[key] = value;
        });
        await logEvent(env, path, { body, headers });
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

    if (req.method === "POST" && (path === "/rp/start" || path === "/jobs")) {
      console.log('POST /jobs endpoint called');
      
      if (!isAdmin(req, env)) {
        console.log('Authorization failed for POST /jobs');
        return unauthorized();
      }
      console.log('Authorization passed for POST /jobs');
      
      let payload: any = {};
      try { 
        const rawBody = await req.text();
        console.log('Raw request body:', rawBody);
        payload = JSON.parse(rawBody);
        console.log('Parsed payload:', JSON.stringify(payload));
      } catch (e) {
        console.error('JSON parsing failed:', e);
        return json({ ok: false, error: `json_parse_error: ${String(e)}` }, 400);
      }
      
      const input = { prompt: payload.prompt ?? "", ...payload };
      console.log('Job input prepared:', JSON.stringify(input));
      
      console.log('Checking RunPod configuration...');
      console.log('RUNPOD_API_KEY present:', !!env.RUNPOD_API_KEY);
      console.log('RUNPOD_ENDPOINT_ID present:', !!env.RUNPOD_ENDPOINT_ID);
      
      if (!env.RUNPOD_API_KEY || !env.RUNPOD_ENDPOINT_ID) {
        console.log('RunPod not configured, returning noop response');
        return json({ 
          ok: true, 
          status: "submitted", 
          provider: "noop", 
          provider_job_id: null,
          message: "runpod_not_configured"
        }, 202);
      }
      
      try {
        console.log('Attempting RunPod API call...');
        const rp = await runpodStart(env, input);
        console.log('RunPod response received:', JSON.stringify(rp));
        
        const id = rp.id || rp.jobId || rp.requestId || null;
        console.log('Extracted job ID:', id);
        
        const response = { 
          ok: true, 
          status: "submitted", 
          provider: "runpod", 
          provider_job_id: id, 
          result: rp 
        };
        console.log('Returning success response:', JSON.stringify(response));
        return json(response);
        
      } catch (e: any) {
        console.error('RunPod API call failed:', e);
        const errorMessage = String(e?.message || e || 'unknown_runpod_error');
        
        if (errorMessage.includes('runpod_unauthorized') || errorMessage.includes('runpod_http_401')) {
          console.log('RunPod unauthorized, returning noop response');
          return json({ 
            ok: true, 
            status: "submitted", 
            provider: "noop", 
            provider_job_id: null,
            message: "runpod_unauthorized"
          }, 202);
        }
        
        console.error('Returning error response for non-auth RunPod error');
        return json({ 
          ok: false, 
          error: errorMessage
        }, 500);
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

    if (req.method === "POST" && path === "/billing/checkout") {
      if (!env.STRIPE_SECRET_KEY) {
        return json({
          ok: true,
          provider: "noop",
          message: "stripe_not_configured"
        }, 202);
      }

      const authHeader = req.headers.get("authorization") || "";
      const tokenMatch = /^bearer\s+(.+)$/i.exec(authHeader);
      
      if (!tokenMatch) {
        return json({ ok: false, error: "missing_authorization" }, 401);
      }

      const token = tokenMatch[1];
      
      if (token !== env.APP_ADMIN_TOKEN) {
        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) {
          return json({ ok: false, error: "authentication_required" }, 401);
        }

        try {
          const user = await validateJWT(env, token);
          if (!user) {
            return json({ ok: false, error: "jwt_invalid" }, 401);
          }
        } catch (e: any) {
          return json({ ok: false, error: "authentication_error" }, 401);
        }
      }

      if (!env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY === "0" || env.STRIPE_SECRET_KEY === "placeholder") {
        return json({
          ok: true,
          provider: "noop",
          message: "stripe_not_configured"
        }, 202);
      }

      try {
        let payload: any = {};
        try { 
          payload = await req.json();
        } catch (e) {
          return json({ ok: false, error: "json_parse_error" }, 400);
        }
        
        const checkoutData = {
          mode: 'subscription',
          line_items: [{
            price: payload.price_id || 'price_default',
            quantity: 1,
          }],
          success_url: payload.success_url || 'https://alphogenai-app.pages.dev/billing?success=true',
          cancel_url: payload.cancel_url || 'https://alphogenai-app.pages.dev/billing?canceled=true',
        };

        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            'mode': checkoutData.mode,
            'line_items[0][price]': checkoutData.line_items[0].price,
            'line_items[0][quantity]': checkoutData.line_items[0].quantity.toString(),
            'success_url': checkoutData.success_url,
            'cancel_url': checkoutData.cancel_url,
          }),
        });

        if (!stripeResponse.ok) {
          const errorText = await stripeResponse.text();
          return json({ ok: false, error: 'stripe_error', details: errorText }, 500);
        }

        const session = await stripeResponse.json() as any;
        return json({
          ok: true,
          checkout_url: session.url,
          session_id: session.id
        });

      } catch (e: any) {
        return json({ ok: false, error: 'billing_error', details: String(e?.message || e) }, 500);
      }
    }

    if (req.method === "POST" && path === "/webhooks/stripe") {
      if (!env.STRIPE_WEBHOOK_SECRET) {
        return json({
          ok: true,
          provider: "noop",
          message: "stripe_webhook_not_configured"
        }, 202);
      }

      const signature = req.headers.get('stripe-signature');
      if (!signature) {
        return json({ ok: false, error: 'missing_signature' }, 400);
      }

      try {
        const body = await req.text();
        
        const elements = signature.split(',');
        const signatureElements: Record<string, string> = {};
        
        for (const element of elements) {
          const [key, value] = element.split('=');
          if (key && value) {
            signatureElements[key] = value;
          }
        }

        const timestamp = signatureElements.t;
        const expectedSignature = signatureElements.v1;

        if (!timestamp || !expectedSignature) {
          return json({ ok: false, error: 'invalid_signature_format' }, 400);
        }

        const payload = `${timestamp}.${body}`;
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(env.STRIPE_WEBHOOK_SECRET),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        
        const signature_bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
        const signature_hex = Array.from(new Uint8Array(signature_bytes))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        if (signature_hex !== expectedSignature) {
          return json({ ok: false, error: 'signature_mismatch' }, 400);
        }

        const event = JSON.parse(body);
        
        if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE) {
          if (event.type === 'checkout.session.completed' || 
              event.type === 'customer.subscription.updated' ||
              event.type === 'customer.subscription.deleted') {
            
            const subscription = event.data.object;
            const customerId = subscription.customer;
            const status = subscription.status || 'active';
            
            await fetch(`${env.SUPABASE_URL}/rest/v1/user_subscriptions`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
                'apikey': env.SUPABASE_SERVICE_ROLE,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
              },
              body: JSON.stringify({
                customer_id: customerId,
                status: status,
                subscription_id: subscription.id,
                updated_at: new Date().toISOString()
              })
            });
          }
        }

        return json({
          ok: true,
          event_type: event.type,
          processed: true
        });

      } catch (e: any) {
        return json({ ok: false, error: 'webhook_processing_error', details: String(e?.message || e) }, 500);
      }
    }

    return notFound();
  },
};
