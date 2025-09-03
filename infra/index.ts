import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

const cfg = new pulumi.Config();

const accountId = process.env.CF_ACCOUNT_ID ?? cfg.require("cfAccountId");
const zoneName  = process.env.CF_DNS_ZONE   ?? cfg.require("cfDnsZone");
const pagesProj = process.env.CF_PAGES_PROJECT ?? cfg.get("cfPagesProject") ?? "alphogenai-app";
const workerName = process.env.CF_WORKER_NAME ?? cfg.get("cfWorkerName") ?? "alphogenai-worker";

// 👇 nouveau : API_SUBDOMAIN (ex: "api" ou "api-staging")
const apiSubdomain = process.env.API_SUBDOMAIN ?? cfg.get("apiSubdomain") ?? "api";

const zone = cloudflare.getZoneOutput({ name: zoneName });

const apiCname = new cloudflare.Record("apiCname", {
  zoneId: zone.id,
  name: apiSubdomain,
  type: "CNAME",
  value: zoneName,
  proxied: true,
});

const workerRoute = new cloudflare.WorkerRoute("apiRoute", {
  zoneId: zone.id,
  pattern: `${apiSubdomain}.${zoneName}/*`,
  scriptName: workerName,
});

const pagesProject = new cloudflare.PagesProject("appPages", {
  accountId,
  name: pagesProj,
  productionBranch: "main",
  buildConfig: { buildCommand: "npm run build", destinationDir: "out" },
});

export const apiRecord = apiCname.name;
export const routePattern = workerRoute.pattern;
export const pages = pagesProject.name;
