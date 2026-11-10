/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as assistant from "../assistant.js";
import type * as assistantCache from "../assistantCache.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as maintenance from "../maintenance.js";
import type * as records from "../records.js";
import type * as store from "../store.js";
import type * as telemetry from "../telemetry.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  assistant: typeof assistant;
  assistantCache: typeof assistantCache;
  crons: typeof crons;
  http: typeof http;
  maintenance: typeof maintenance;
  records: typeof records;
  store: typeof store;
  telemetry: typeof telemetry;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
