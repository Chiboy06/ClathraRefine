import "server-only";
import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { aws, awsEnabled as dynamoEnabled } from "./aws";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { seedFor } from "../demoData";

// One small store interface over Convex (production), DynamoDB (kept for reference) or an in-memory map (local demo and tests).
// Convex: every collection lives in the `records` table; conditional updates run in one Convex transaction.

export type Coll =
  | "commands"
  | "products"
  | "orders"
  | "audit_log"
  | "audits"
  | "tickets"
  | "shift"
  | "sites"
  | "rfqs"
  | "alarm_actions"
  | "role_requests"
  | "user_roles"
  | "settings"
  | "ledger"
  | "uploads"
  | "leads"
  | "training"
  | "sensors";

export type Item = Record<string, unknown> & { id: string; created_at: number };

const MAPPED: Partial<Record<Coll, { table: string; key: string }>> = {
  commands: { table: "ClathraCommands", key: "request_id" },
  products: { table: "ClathraProducts", key: "product_id" },
  orders: { table: "ClathraOrders", key: "order_id" },
};
const RECORDS = "ClathraRecords";

const convexUrl = process.env.CONVEX_URL; // server-only, so tests can switch it off at runtime
const serverKey = process.env.CONVEX_SERVER_KEY;
const convexOn = () => !!convexUrl && !!serverKey;
let cx: ConvexHttpClient | null = null;
const convex = () => (cx ??= new ConvexHttpClient(convexUrl!));
// Convex values cannot hold undefined; drop those keys like JSON does.
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const awsEnabled = () => !convexOn() && dynamoEnabled();

/** Sortable id: time first so newest-first listing is a plain reverse sort. */
export const newId = (now = Date.now()) => `${now.toString().padStart(15, "0")}#${crypto.randomUUID().slice(0, 8)}`;

// ---------------- memory backend ----------------
// shortcut: per server instance and lost on restart; set AWS_ROLE_ARN for durable storage.
type Mem = Map<Coll, Map<string, Item>>;
const g = globalThis as unknown as { __clathraMem?: Mem };
function mem(coll: Coll) {
  g.__clathraMem ??= new Map();
  let m = g.__clathraMem.get(coll);
  if (!m) {
    m = new Map((seedFor(coll) as Item[]).map((i) => [i.id, i]));
    g.__clathraMem.set(coll, m);
  }
  return m;
}

export type Cond = { field: string; eq?: unknown; ne?: unknown; gte?: number };

function checkConds(item: Item | undefined, conds: Cond[]) {
  if (!item) return false;
  return conds.every((c) => {
    const v = item[c.field];
    if ("eq" in c && v !== c.eq) return false;
    if ("ne" in c && v === c.ne) return false;
    if (c.gte !== undefined && !(typeof v === "number" && v >= c.gte)) return false;
    return true;
  });
}

// ---------------- API ----------------
export async function put(coll: Coll, item: Item) {
  if (convexOn()) {
    await convex().mutation(api.records.put, { serverKey: serverKey!, coll, key: item.id, created_at: item.created_at ?? Date.now(), data: plain(item) });
    return item;
  }
  if (!awsEnabled()) {
    mem(coll).set(item.id, structuredClone(item));
    return item;
  }
  const m = MAPPED[coll];
  await aws().ddb.send(
    new PutCommand(
      m ? { TableName: m.table, Item: { ...item, [m.key]: item.id } } : { TableName: RECORDS, Item: { ...item, pk: coll, sk: item.id } },
    ),
  );
  return item;
}

export async function get<T = Item>(coll: Coll, id: string): Promise<T | undefined> {
  if (convexOn()) return ((await convex().query(api.records.get, { serverKey: serverKey!, coll, key: id })) ?? undefined) as T | undefined;
  if (!awsEnabled()) return structuredClone(mem(coll).get(id)) as T | undefined;
  const m = MAPPED[coll];
  const out = await aws().ddb.send(
    new GetCommand(m ? { TableName: m.table, Key: { [m.key]: id } } : { TableName: RECORDS, Key: { pk: coll, sk: id } }),
  );
  return out.Item as T | undefined;
}

/** Newest first. */
export async function list<T = Item>(coll: Coll, limit = 200): Promise<T[]> {
  if (convexOn()) return (await convex().query(api.records.list, { serverKey: serverKey!, coll, limit })) as T[];
  if (!awsEnabled()) {
    return [...mem(coll).values()].sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, limit).map((i) => structuredClone(i)) as T[];
  }
  const m = MAPPED[coll];
  if (m) {
    // shortcut: Scan is fine for hackathon-sized tables; add a GSI on created_at past a few thousand rows.
    const out = await aws().ddb.send(new ScanCommand({ TableName: m.table, Limit: 1000 }));
    return ((out.Items ?? []) as Item[]).sort((a, b) => b.created_at - a.created_at).slice(0, limit) as T[];
  }
  const out = await aws().ddb.send(
    new QueryCommand({
      TableName: RECORDS,
      KeyConditionExpression: "pk = :p",
      ExpressionAttributeValues: { ":p": coll },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (out.Items ?? []) as T[];
}

/** Conditional update. Returns false when the condition fails, so callers can refuse cleanly. */
export async function update(coll: Coll, id: string, patch: Record<string, unknown>, conds: Cond[] = []): Promise<boolean> {
  if (convexOn()) {
    return convex().mutation(api.records.update, {
      serverKey: serverKey!,
      coll,
      key: id,
      patch: plain(patch),
      conds: conds.map((c) => ({ field: c.field, eq: c.eq, ne: c.ne, gte: c.gte, hasEq: "eq" in c, hasNe: "ne" in c })),
    });
  }
  if (!awsEnabled()) {
    const m = mem(coll);
    const cur = m.get(id);
    if (!cur || !checkConds(cur, conds)) return false;
    m.set(id, { ...cur, ...structuredClone(patch) });
    return true;
  }
  const mp = MAPPED[coll];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const sets = Object.entries(patch).map(([k, v], i) => {
    names[`#u${i}`] = k;
    values[`:u${i}`] = v;
    return `#u${i} = :u${i}`;
  });
  const condExpr = conds.map((c, i) => {
    names[`#c${i}`] = c.field;
    if ("eq" in c) {
      values[`:c${i}`] = c.eq;
      return `#c${i} = :c${i}`;
    }
    if ("ne" in c) {
      values[`:c${i}`] = c.ne;
      return `#c${i} <> :c${i}`;
    }
    values[`:c${i}`] = c.gte;
    return `#c${i} >= :c${i}`;
  });
  const keyField = mp ? mp.key : "sk";
  names["#key"] = keyField;
  condExpr.unshift("attribute_exists(#key)");
  try {
    await aws().ddb.send(
      new UpdateCommand({
        TableName: mp ? mp.table : RECORDS,
        Key: mp ? { [mp.key]: id } : { pk: coll, sk: id },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: condExpr.join(" AND "),
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
    return true;
  } catch (e) {
    if ((e as { name?: string }).name === "ConditionalCheckFailedException") return false;
    throw e;
  }
}
