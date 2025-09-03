import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

const cfg = new pulumi.Config();
const accountId      = cfg.require("cfAccountId");
const dnsZone        = cfg.require("cfDnsZone");
const pagesProject   = cfg.require("cfPagesProject");
const workerName     = cfg.require("cfWorkerName");
const apiSubdomain   = cfg.require("apiSubdomain"); // "api" en prod, "api-staging" en staging

// Récupère la zone Cloudflare (pour les routes Workers)
const zone = cloudflare.getZoneOutput({ name: dnsZone });

// 👉 IMPORTANT : on NE CRÉE PLUS le projet Pages.
//    On le "lit" seulement par son nom ; s'il n'existe pas, Wranger (app_deploy) le créera.
const existingPages = cloudflare.getPagesProjectOutput({
  accountId,
  name: pagesProject,
});

// Route Worker: https://{apiSubdomain}.{dnsZone}/*
new cloudflare.WorkerRoute("api-route", {
  zoneId: zone.id,
  pattern: pulumi.interpolate`${apiSubdomain}.${dnsZone}/*`,
  scriptName: workerName,
});

// Exports (pour logs Pulumi)
export const apiUrl = pulumi.interpolate`https://${apiSubdomain}.${dnsZone}`;
export const pagesName = existingPages.name;
