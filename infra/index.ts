import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

// Config requise
const cfg = new pulumi.Config();
const dnsZone      = cfg.require("cfDnsZone");
const workerName   = cfg.require("cfWorkerName");
const apiSubdomain = cfg.require("apiSubdomain"); // "api" (prod) ou "api-staging" (staging)

// Récupère la zone Cloudflare pour créer la route Worker
const zone = cloudflare.getZoneOutput({ name: dnsZone });

// Route Worker: https://{apiSubdomain}.{dnsZone}/*
new cloudflare.WorkerRoute("api-route", {
  zoneId:   zone.id,
  pattern:  pulumi.interpolate`${apiSubdomain}.${dnsZone}/*`,
  scriptName: workerName,
});

// Exports utiles (logs Pulumi)
export const apiUrl = pulumi.interpolate`https://${apiSubdomain}.${dnsZone}`;
