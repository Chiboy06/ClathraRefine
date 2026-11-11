import "server-only";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";
import { S3Client } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

/** AWS is used only when a role ARN is set; otherwise the app runs on the in-memory demo store. */
export const awsEnabled = () => !!process.env.AWS_ROLE_ARN;
export const THING = process.env.THING_NAME || "ESP32S3-N16R8-HARNESS-01";

let clients: { ddb: DynamoDBDocumentClient; iot: IoTDataPlaneClient; s3: S3Client } | null = null;

export function aws() {
  if (!awsEnabled()) throw new Error("AWS not configured");
  if (!clients) {
    const region = process.env.AWS_REGION || "eu-west-1";
    const credentials = awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN! });
    clients = {
      ddb: DynamoDBDocumentClient.from(new DynamoDBClient({ region, credentials }), { marshallOptions: { removeUndefinedValues: true } }),
      iot: new IoTDataPlaneClient({ region, credentials, endpoint: `https://${(process.env.IOT_ENDPOINT ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "")}` }),
      s3: new S3Client({ region, credentials }),
    };
  }
  return clients;
}

export type BoardCommand = { cmd: "scram" } | { cmd: "ping" } | { cmd: "mode"; value: "manual" | "auto" } | { cmd: "fan" | "pump"; value: "on" | "off" };

/** The firmware accepts only these commands and applies its own interlocks to mode, fan and pump. */
export async function publishCmd(c: BoardCommand | "scram" | "ping") {
  // Fan and pump also carry {"relay", "state"}: firmware D.2 switches relays only from that form.
  // Rev C and D.3 read cmd and value and ignore the extra fields.
  const payload =
    typeof c === "string" ? { cmd: c } : c.cmd === "fan" || c.cmd === "pump" ? { ...c, relay: c.cmd === "fan" ? 0 : 1, state: c.value === "on" } : c;
  try {
    await aws().iot.send(
      new PublishCommand({
        topic: `clathrarefine/${THING}/cmd`,
        qos: 1,
        payload: new TextEncoder().encode(JSON.stringify(payload)),
      }),
    );
  } catch (e) {
    throw new Error(commandSetupHint(e));
  }
}

/** Turns an AWS or OIDC failure into the one setting to fix. AWS messages carry no secrets. */
export function commandSetupHint(e: unknown): string {
  const err = e as { name?: string; message?: string; code?: string };
  const msg = `${err.name ?? ""} ${err.code ?? ""} ${err.message ?? ""}`;
  if (/OIDC|VERCEL_OIDC_TOKEN|x-vercel-oidc/i.test(msg)) return "Vercel did not issue an OIDC token: turn on OIDC Federation in Vercel › Settings › Security, then redeploy.";
  if (/AssumeRoleWithWebIdentity|InvalidIdentityToken|IDPRejectedClaim/i.test(msg)) return "AWS refused the dashboard role: check the OIDC identity provider and the role's trust policy (Connect a device › part 4).";
  if (/iot:Publish|ForbiddenException|AccessDenied|not authorized/i.test(msg)) return `The role may not publish: give it iot:Publish on clathrarefine/${THING}/cmd (Connect a device › part 4).`;
  if (/ENOTFOUND|getaddrinfo|EAI_AGAIN|UnknownEndpoint/i.test(msg)) return "IOT_ENDPOINT is not reachable: use the Device data endpoint from AWS IoT › Settings, for example xxxx-ats.iot.eu-west-1.amazonaws.com.";
  return `AWS refused the command: ${(err.name ?? "Error")}: ${err.message ?? "unknown error"}`;
}
