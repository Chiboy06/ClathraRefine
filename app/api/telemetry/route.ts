import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { aws, awsEnabled, THING } from "@/lib/server/aws";
import { requirePerm } from "@/lib/roles";
import { TelemetryRow } from "@/lib/schema/telemetry";

export const dynamic = "force-dynamic";

/** Latest board readings, oldest first (guide section 6). */
export async function GET(req: Request) {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  if (!awsEnabled()) return new Response("LIVE mode needs AWS (AWS_ROLE_ARN not set)", { status: 503 });

  const asked = Number(new URL(req.url).searchParams.get("limit") ?? 150);
  const limit = Math.min(Math.max(Number.isFinite(asked) ? asked : 150, 1), 900);
  const out = await aws().ddb.send(
    new QueryCommand({
      TableName: "ClathraTelemetry",
      KeyConditionExpression: "#d = :d",
      ExpressionAttributeNames: { "#d": "device" },
      ExpressionAttributeValues: { ":d": THING },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  const rows = (out.Items ?? [])
    .reverse()
    .map((r) => TelemetryRow.safeParse(r))
    .filter((r) => r.success)
    .map((r) => ({
      ...r.data,
      // A disconnected MQ-2 reads near 0 V, which looks like clean air.
      check_sensor: r.data.exhaust_mv < 100 || r.data.ambient_mv < 100,
    }));
  return Response.json(rows);
}
