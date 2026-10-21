import { apiContext } from "@/server/context";
import { handle } from "@/server/http";
import { buildSnapshot } from "@/server/snapshot";

/** Everything the signed-in person may see. Row-level security filters it per role. */
export const GET = handle(async () => {
  const ctx = await apiContext();
  return { result: await buildSnapshot(ctx) };
});
