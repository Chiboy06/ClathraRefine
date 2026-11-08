import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.hourly("hourly rollups", { minuteUTC: 5 }, internal.maintenance.rollup, {});
crons.daily("purge raw telemetry older than 30 days", { hourUTC: 2, minuteUTC: 15 }, internal.maintenance.purge, {});

export default crons;
