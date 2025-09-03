import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

const cfg = new pulumi.Config();
const accountId  = process.env.CF_ACCOUNT_ID     || cfg.require("cfAccountId");
const zoneName   = process.env.CF_DNS_ZONE       || cfg.require("cfDnsZone");       // ex: alphogen.com
const r2Bucket   = process.env.CF_R2_BUCKET      || cfg.get("cfR2Bucket")   || "alphogenai-assets";
const workerName = process.env.CF_WORKER_NAME    || cfg.get("cfWorkerName") || "alphogenai-worker";
const pagesProj  = process.env.CF_PAGES_PROJECT  || cfg.get("cfPagesProject") || "alphogenai-app";

// Bucket R2
const bucket = new cloudflare.R2Bucket("assetsBucket", { accountId, name: r2Bucket });

// Worker (avec binding R2)
const script = new cloudflare.WorkerScript("apiWorkerScript", {
  accountId, name: workerName, module: true,
  content: `export default { async fetch(req, env) { return new Response('ok from worker') } }`,
  r2Buckets: [{ variableName: process.env.CF_R2_BINDING || "R2_BUCKET", bucketName: bucket.name }],
});

// DNS zone + route Worker (api.alphogen.com/*)
const zone = cloudflare.getZoneOutput({ name: zoneName });
const apiCname = new cloudflare.Record("apiCname", {  // crée le CNAME api → apex (proxied)
  zoneId: zone.zoneId, name: "api", type: "CNAME", value: zoneName, proxied: true,
});
const workerRoute = new cloudflare.WorkerRoute("apiRoute", {
  zoneId: zone.zoneId, pattern: `api.${zoneName}/*`, scriptName: script.name,
});

// Projet Pages (créé par Pulumi)
const pagesProject = new cloudflare.PagesProject("appPages", {
  accountId, name: pagesProj, productionBranch: "main",
  buildConfig: { buildCommand: "npm run build", destinationDir: "out" }
});

export const r2BucketName = bucket.name;
export const worker = script.name;
export const route = workerRoute.pattern;
export const pages = pagesProject.name;
