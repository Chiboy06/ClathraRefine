import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { UploadBody } from "@/lib/schema/api";
import { aws, awsEnabled } from "@/lib/server/aws";
import { audit } from "@/lib/server/audit";

/** Signed S3 upload URL for FLIR photos. Without AWS the file name is recorded only (demo store). */
export async function POST(req: Request) {
  const gate = await requirePerm("audit", { key: "upload", max: 30, windowMs: 60_000 });
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, UploadBody);
  if (!b.ok) return b.res;
  const safe = b.data.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
  const key = `audits/${crypto.randomUUID()}-${safe}`;
  await audit(gate.session, "upload_request", key, "ok", `${b.data.size} bytes`);
  if (!awsEnabled() || !process.env.S3_UPLOAD_BUCKET) return Response.json({ key, url: null, demo: true });
  const url = await getSignedUrl(
    aws().s3,
    new PutObjectCommand({ Bucket: process.env.S3_UPLOAD_BUCKET, Key: key, ContentType: b.data.type, ContentLength: b.data.size }),
    { expiresIn: 300 },
  );
  return Response.json({ key, url, demo: false });
}
