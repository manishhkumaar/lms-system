"use client";
import { useEffect, useMemo, useState } from "react";
import { ActionError, uploadRecording } from "@/data/actions";
import { useDb } from "@/data/store";
import { getBatch, getLecture, isEnded, lectureLabel, recordingForLecture } from "@/data/selectors";
import type { ID } from "@/data/types";
import { Banner, Button, Dialog, SelectField, TextField, useToast } from "@/design-system";
import { formatDate, formatRange24, formatWhen } from "@/lib/format";
import { minutesBetween } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { errorMessage } from "./useRun";

/** Upload recording for a finished lecture: the video goes to storage, then it's recorded against the lecture. */
export function UploadRecordingDialog({ open, onClose, lectureId: fixed }: { open: boolean; onClose: () => void; lectureId?: ID }) {
  const db = useDb();
  const now = useNow(60000);
  const toast = useToast();
  const [lectureId, setLectureId] = useState<ID>(fixed || "");
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(
    () =>
      db.lectures
        .filter((l) => isEnded(l, now) && !recordingForLecture(db, l.id))
        .sort((a, b) => b.start.localeCompare(a.start))
        .map((l) => ({ value: l.id, label: `${getBatch(db, l.batchId)?.code} · ${lectureLabel(l)} · ${l.title} · ${formatDate(l.start, l.timeZone)} ${formatRange24(l.start, l.end, l.timeZone)}` })),
    [db, now],
  );

  useEffect(() => {
    if (!open) return;
    setLectureId(fixed || candidates[0]?.value || "");
    setFile(null);
    setError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const lecture = getLecture(db, lectureId);
  useEffect(() => {
    if (lecture) setDuration(String(minutesBetween(lecture.start, lecture.end)));
  }, [lecture?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (busy) return;
    setError(null);
    try {
      if (!lecture) throw new ActionError("Choose the lecture this recording belongs to.");
      if (!file) throw new ActionError("Choose the video file to upload.");
      const mins = Number(duration);
      if (!mins || mins < 1) throw new ActionError("Enter the recording length in minutes.");
      setBusy(true);
      const rec = await uploadRecording({ lectureId: lecture.id, batchId: lecture.batchId, file, durationMins: mins });
      toast({
        title: "Recording uploaded",
        description: rec.published ? "Students in the batch can watch it now." : "Publish it to the batch from Recordings when you're ready.",
        tone: "success",
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Upload recording"
      description={lecture ? `${getBatch(db, lecture.batchId)?.name} · ${lectureLabel(lecture)} · ${formatWhen(lecture.start, lecture.end, lecture.timeZone)}` : "Recordings attach to a finished lecture."}
      width={560}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon="upload" disabled={busy || (!candidates.length && !fixed)}>
            {busy ? "Uploading…" : "Upload recording"}
          </Button>
        </>
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {!fixed ? (
        candidates.length ? (
          <SelectField label="Lecture" required value={lectureId} onChange={(e) => setLectureId(e.target.value)} options={candidates} hint="Only finished lectures without a recording are listed." />
        ) : (
          <Banner tone="success">Every finished lecture already has a recording.</Banner>
        )
      ) : null}
      <TextField
        label="Video file"
        type="file"
        accept="video/*"
        required
        disabled={busy}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        hint={file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1048576))} MB` : "MP4 or MOV from the meeting provider"}
      />
      <TextField label="Length (minutes)" type="number" min={1} required disabled={busy} value={duration} onChange={(e) => setDuration(e.target.value)} />
      {busy ? <p className="caption">Uploading the video. Keep this window open until it finishes.</p> : null}
    </Dialog>
  );
}
