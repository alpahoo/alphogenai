import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

const cfg = new pulumi.Config();

// Vars (prend d'abord l'env GitHub Actions, sinon la config Pulumi)
const accountId  = process.env.CF_ACCOUNT_ID     ?? cfg.require("cfAccountId");
const zoneName   = process.env.CF_DNS_ZONE       ?? cfg.require("cfDnsZone");
const r2Bucket   = process.env.CF_R2_BUCKET      ?? cfg.require("cfR2Bucket");     // <- EXISTANT
const workerName = process.env.CF_WORKER_NAME    ?? cfg.get("cfWorkerName")   ?? "alphogenai-worker";
const pagesProj  = process.env.CF_PAGES_PROJECT  ?? cfg.get("cfPagesProject") ?? "alphogenai-app";
const r2Binding  = process.env.CF_R2_BINDING     ?? "R2_BUCKET";

// --- Worker (Modules) + binding R2 vers BUCKET EXISTANT ---
const script = new cloudflare.WorkerScript("apiWorkerScript", {
  accountId,
  name: workerName,
  module: true,
  content: `export default {
    async fetch(req, env, ctx) {
      return new Response('ok from worker');
    }
  }`,
  // ✅ on BIND uniquement, on NE CRÉE PAS de bucket ici
  r2BucketBindings: [{
    name: r2Binding,
    bucketName: r2Bucket,
  }],
});

// --- Zone + DNS api.<zone> ---
const zone = cloudflare.getZoneOutput({ name: zoneName });

const apiCname = new cloudflare.Record("apiCname", {
  zoneId: zone.id,           // champ correct
  name: "api",
  type: "CNAME",
  value: zoneName,           // CNAME vers l’apex
  proxied: true,
});

// --- Route Worker sur api.<zone>/*
const workerRoute = new cloudflare.WorkerRoute("apiRoute", {
  zoneId: zone.id,
  pattern: `api.${zoneName}/*`,
  scriptName: script.name,
});

// --- Projet Cloudflare Pages
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
export const workerScript = script.name;
export const apiRecord = apiCname.name;
export const routePattern = workerRoute.pattern;
export const pages = pagesProject.name;
