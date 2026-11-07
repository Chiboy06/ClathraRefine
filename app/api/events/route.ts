import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { aws, awsEnabled, THING } from "@/lib/server/aws";
import { requirePerm } from "@/lib/roles";

export const dynamic = "force-dynamic";

/** Board events and command acknowledgements from ClathraEvents, newest first. */
export async function GET(req: Request) {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  if (!awsEnabled()) return Response.json([]);
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit") ?? 100) || 100, 1), 500);
  const out = await aws().ddb.send(
    new QueryCommand({
      TableName: "ClathraEvents",
      KeyConditionExpression: "#d = :d",
      ExpressionAttributeNames: { "#d": "device" },
      ExpressionAttributeValues: { ":d": THING },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return Response.json(out.Items ?? []);
}
