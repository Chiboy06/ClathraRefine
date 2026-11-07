import { requirePerm } from "@/lib/roles";

export const dynamic = "force-dynamic";

/** Serves the public device certificate and Amazon Root CA 1 only. A private key is refused even if misconfigured. */
export async function GET(req: Request) {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  const file = new URL(req.url).searchParams.get("file");
  const pem = (file === "device" ? process.env.DEVICE_CERT_PEM : file === "rootca" ? process.env.AMAZON_ROOT_CA_PEM : undefined)?.replace(/\\n/g, "\n");
  if (!pem) return new Response("Certificate not configured on the server", { status: 404 });
  if (/PRIVATE KEY/.test(pem) || !/BEGIN CERTIFICATE/.test(pem)) return new Response("Refused: not a public certificate", { status: 500 });
  return new Response(pem, {
    headers: {
      "Content-Type": "application/x-pem-file",
      "Content-Disposition": `attachment; filename="${file === "device" ? "device-certificate.pem.crt" : "AmazonRootCA1.pem"}"`,
    },
  });
}
