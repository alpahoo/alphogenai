export default {
  async fetch(req: Request) {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("AlphoGenAI Worker OK");
  }
} satisfies ExportedHandler;
