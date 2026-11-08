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
      iot: new IoTDataPlaneClient({ region, credentials, endpoint: `https://${process.env.IOT_ENDPOINT}` }),
      s3: new S3Client({ region, credentials }),
    };
  }
  return clients;
}

export type BoardCommand = { cmd: "scram" } | { cmd: "ping" } | { cmd: "mode"; value: "manual" | "auto" } | { cmd: "fan" | "pump"; value: "on" | "off" };

/** The firmware accepts only these commands and applies its own interlocks to mode, fan and pump. */
export async function publishCmd(c: BoardCommand | "scram" | "ping") {
  const payload = typeof c === "string" ? { cmd: c } : c;
  await aws().iot.send(
    new PublishCommand({
      topic: `clathrarefine/${THING}/cmd`,
      qos: 1,
      payload: new TextEncoder().encode(JSON.stringify(payload)),
    }),
  );
}
