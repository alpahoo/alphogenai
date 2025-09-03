import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

const cfg = new pulumi.Config();

const accountId  = process.env.CF_ACCOUNT_ID     ?? cfg.require("cfAccountId");
const zoneName   = process.env.CF_DNS_ZONE       ?? cfg.require("cfDnsZone");
const workerName = process.env.CF_WORKER_NAME    ?? cfg.get("cfWorkerName")   ?? "alphogenai-worker";
const pagesProj  = process.env.CF_PAGES_PROJECT  ?? cfg.get("cfPagesProject") ?? "alphogenai-app";

// --- Zone ---
const zone = cloudflare.getZoneOutput({ name: zoneName });

// --- DNS: api.<zone> CNAME -> <zone> (proxied) ---
const apiCname = new cloudflare.Record("apiCname", {
  zoneId: zone.id,
  name: "api",
  type: "CNAME",
  value: zoneName,
  proxied: true,
});

// --- Route Worker (le script est déployé par Wrangler, pas par Pulumi) ---
const workerRoute = new cloudflare.WorkerRoute("apiRoute", {
  zoneId: zone.id,
  pattern: `api.${zoneName}/*`,
  scriptName: workerName, // <-- référence directe, pas de création de Worker ici
});

// --- Projet Cloudflare Pages (créé par IaC) ---
const pagesProject = new cloudflare.PagesProject("appPages", {
  accountId,
  name: pagesProj,
  productionBranch: "main",
  buildConfig: {
    buildCommand: "npm run build",
    destinationDir: "out",
  },
});

// Exports
export const apiRecord = apiCname.name;
export const routePattern = workerRoute.pattern;
export const pages = pagesProject.name;
