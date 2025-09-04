import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

const cfg = new pulumi.Config();
const accountId  = cfg.require("cfAccountId");
const zoneId     = cfg.require("cfZoneId");
const workerName = cfg.get("workerName") || "alphogenai-worker";
const apiSubdomain = cfg.get("apiSubdomain") || "api";

const stack = pulumi.getStack();

// Un pattern par stack — simple et clair
const routePattern =
  stack === "prod"
    ? `${apiSubdomain}.alphogen.com/*`
    : `${apiSubdomain}-staging.alphogen.com/*`;

// 1) On publie un *placeholder* de script pour que la route puisse
//    toujours se créer (Wrangler redéploiera ensuite le vrai code).
const script = new cloudflare.WorkersScript("worker-script", {
  accountId,
  name: workerName,
  content: `export default {async fetch(){return new Response("ok",{status:200})}}`
});

// 2) Route unique -> si elle n'existe pas Pulumi la crée.
//    (La CI supprime préventivement une éventuelle route conflictuelle.)
const route = new cloudflare.WorkerRoute("worker-route", {
  zoneId,
  pattern: routePattern,
  scriptName: workerName
}, { dependsOn: [script] });

// Expose quelques infos
export const routeCreated = route.pattern;
export const scriptDeployed = script.name;
