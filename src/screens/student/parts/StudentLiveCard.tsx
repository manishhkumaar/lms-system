import { useNavigate } from "@/lib/router";
import { errorMessage } from "@/components/useRun";
import { recordJoin } from "@/data/actions";
import { getBatch } from "@/data/selectors";
import { isInBatch, visibleRecording } from "@/data/studentSelectors";
import type { Lecture } from "@/data/types";
import { LiveClassCard, useToast } from "@/design-system";
import { formatDuration } from "@/lib/format";
import { tzLabel } from "@/lib/time";
import { useMe } from "./useMe";

/** The LiveClassCard wired to the store: Join records "joined" (not attendance) and opens the link. */
export function StudentLiveCard({ lecture, className }: { lecture: Lecture; className?: string }) {
  const { db, studentId, tz } = useMe();
  const nav = useNavigate();
  const toast = useToast();
  const batch = getBatch(db, lecture.batchId);
  const rec = visibleRecording(db, lecture.id);
  const enrolled = isInBatch(db, studentId, lecture.batchId);

  return (
    <LiveClassCard
      className={className}
      title={lecture.title}
      batch={batch ? `${batch.name} · Lecture ${lecture.number}` : `Lecture ${lecture.number}`}
      start={lecture.start}
      end={lecture.end}
      timeZone={tz}
      tzLabel={tzLabel(tz, new Date(lecture.start))}
      linkPublished={lecture.linkPublished}
      enrolled={enrolled}
      meetingUrl={lecture.meetingUrl}
      joinOpensMinutesBefore={db.settings.joinOpensMinutesBefore}
      recording={rec ? { duration: formatDuration(rec.durationMins) } : null}
      onJoin={() => {
        if (!studentId || !lecture.meetingUrl) return;
        const url = lecture.meetingUrl;
        // Open the tab now, while the click still counts as a user gesture; point it at the meeting
        // once the server has recorded the Join (it checks the batch, the link and the time).
        const win = window.open("", "_blank");
        if (win) win.opener = null;
        recordJoin(lecture.id, studentId).then(
          () => {
            if (win) win.location.href = url;
            else window.open(url, "_blank", "noopener");
            toast({ title: "You're marked as joined", description: "Attendance is confirmed after class.", tone: "info" });
          },
          (err) => {
            win?.close();
            toast({ title: errorMessage(err), tone: "danger" });
          },
        );
      }}
      onWatch={rec ? () => nav(`/learn/recordings/${rec.id}`) : undefined}
    />
  );
}
