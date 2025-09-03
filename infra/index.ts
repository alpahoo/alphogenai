import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

const cfg = new pulumi.Config(); // namespace: le nom du projet Pulumi
const cfAccountId  = cfg.require("cfAccountId");   // fourni par le workflow
const cfDnsZone    = cfg.require("cfDnsZone");     // ex. alphogen.com
const cfWorkerName = cfg.require("cfWorkerName");  // ex. alphogenai-worker

// Route selon le stack (staging -> api-staging, prod -> api)
const stack = pulumi.getStack();
const routePattern = stack === "prod"
  ? "api.alphogen.com/*"
  : "api-staging.alphogen.com/*";

// Récupère la zone Cloudflare par nom de domaine
const zone = cloudflare.getZoneOutput({ name: cfDnsZone });

// Crée UNIQUEMENT la route du Worker vers ton script existant
export const workerRoute = new cloudflare.WorkerRoute("api-route", {
  zoneId: zone.id,
  pattern: routePattern,
  scriptName: cfWorkerName, // script déployé par Wrangler
});
