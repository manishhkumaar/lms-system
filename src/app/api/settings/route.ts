import { apiContext } from "@/server/context";
import { bool, defined, handle, int, must, readJson, text } from "@/server/http";
import { toSettings } from "@/server/mappers";
import type { SettingsRow } from "@/server/rows";

/** Organisation settings. Super Admin only (also enforced by row-level security). */
export const PATCH = handle(async (req) => {
  const ctx = await apiContext("super-admin");
  const body = await readJson(req);
  const row = defined({
    org_name: text(body.orgName, "the organisation name", { max: 80 }),
    support_email: text(body.supportEmail, "a support email", { max: 200 }),
    default_time_zone: text(body.defaultTimeZone, "a time zone", { max: 64 }),
    join_opens_minutes_before: int(body.joinOpensMinutesBefore, "the join window", { min: 0, max: 60 }),
    link_reminder_hours: int(body.linkReminderHours, "the reminder time", { min: 1, max: 168 }),
    auto_publish_recordings: bool(body.autoPublishRecordings),
  });
  const saved = must(await ctx.supabase.from("org_settings").update(row).eq("id", 1).select("*").single<SettingsRow>());
  const settings = toSettings(saved);
  return { result: settings, patch: { settings } };
});
