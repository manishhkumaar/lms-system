"use client";
import { useEffect, useState } from "react";
import { publishLink, unpublishLink } from "@/data/actions";
import { useDb } from "@/data/store";
import { getBatch, lectureLabel, seatsFilled } from "@/data/selectors";
import type { Lecture } from "@/data/types";
import { Banner, Button, Dialog, TextField, useToast } from "@/design-system";
import { formatWhen, plural } from "@/lib/format";
import { errorMessage } from "./useRun";

/** Publish link / Update link. Students can Join only after a link is published. */
export function PublishLinkDialog({ open, onClose, lecture }: { open: boolean; onClose: () => void; lecture: Lecture }) {
  const db = useDb();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"publish" | "unpublish" | null>(null);
  const batch = getBatch(db, lecture.batchId);
  useEffect(() => {
    if (open) {
      setUrl(lecture.meetingUrl || "");
      setError(null);
    }
  }, [open, lecture.meetingUrl]);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy("publish");
    try {
      await publishLink(lecture.id, url);
      toast({ title: lecture.linkPublished ? "Link updated" : "Link published", description: `${plural(batch ? seatsFilled(db, batch.id) : 0, "student")} can join from ${formatWhen(lecture.start, lecture.end, lecture.timeZone)}.`, tone: "success" });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const unpublish = async () => {
    if (busy) return;
    setError(null);
    setBusy("unpublish");
    try {
      await unpublishLink(lecture.id);
      toast({ title: "Link unpublished", description: "Join is disabled for students until you publish a link again.", tone: "warning" });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={lecture.linkPublished ? "Update link" : "Publish link"}
      description={`${batch?.name} · ${lectureLabel(lecture)} · ${formatWhen(lecture.start, lecture.end, lecture.timeZone)}`}
      onSubmit={() => void submit()}
      footer={
        <>
          {lecture.linkPublished ? (
            <Button variant="ghost" style={{ marginRight: "auto" }} disabled={!!busy} onClick={() => void unpublish()}>
              {busy === "unpublish" ? "Unpublishing…" : "Unpublish link"}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!!busy}>
            {busy === "publish" ? "Publishing…" : lecture.linkPublished ? "Update link" : "Publish link"}
          </Button>
        </>
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <TextField label="Meeting link" mono required placeholder="https://meet.google.com/…" value={url} onChange={(e) => setUrl(e.target.value)} hint="Students see Join only after you publish this link, and only while the lecture is on." />
    </Dialog>
  );
}
