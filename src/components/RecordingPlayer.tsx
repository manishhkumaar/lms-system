"use client";
import { useEffect, useRef, useState } from "react";
import { recordingUrl } from "@/data/actions";
import type { Recording } from "@/data/types";
import { Icon } from "@/design-system";
import { formatDuration } from "@/lib/format";
import { errorMessage } from "./useRun";

/**
 * Plays a lecture recording. Uploaded recordings stream from storage through a short-lived signed
 * link; seeded demo recordings have no video file, so they get a simulated player that says so.
 */
export function RecordingPlayer({ recording, onPlay }: { recording: Recording; onPlay?: () => void }) {
  if (recording.status !== "ready") {
    return (
      <div className="player">
        <div className="player-center">
          <Icon name="clock" size="lg" />
          <div>Recording is processing. It'll be ready in a few minutes.</div>
        </div>
      </div>
    );
  }
  return recording.filePath ? <VideoPlayer recording={recording} onPlay={onPlay} /> : <DemoPlayer recording={recording} onPlay={onPlay} />;
}

function VideoPlayer({ recording, onPlay }: { recording: Recording; onPlay?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    recordingUrl(recording.id).then(
      (u) => {
        if (cancelled) return;
        if (u) setUrl(u);
        else setError("This recording has no video file. Ask Operations to upload it again.");
      },
      (err) => {
        if (!cancelled) setError(errorMessage(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [recording.id]);

  if (error) {
    return (
      <div className="player" role="alert">
        <div className="player-center">
          <Icon name="alert" size="lg" />
          <div>{error}</div>
        </div>
      </div>
    );
  }
  if (!url) {
    return (
      <div className="player" aria-busy="true">
        <div className="player-center">
          <Icon name="video" size="lg" />
          <div>Loading the recording…</div>
        </div>
      </div>
    );
  }
  return (
    <div className="player">
      <video
        controls
        preload="metadata"
        src={url}
        aria-label={`Recording: ${recording.title}`}
        onPlay={() => {
          if (!started.current) {
            started.current = true;
            onPlay?.();
          }
        }}
      />
    </div>
  );
}

function DemoPlayer({ recording, onPlay }: { recording: Recording; onPlay?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = recording.durationMins * 60;
  const started = useRef(false);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPos((p) => Math.min(total, p + 10)), 1000);
    return () => clearInterval(t);
  }, [playing, total]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return `${h ? h + ":" : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="stack-1">
      <div className="player" aria-label={`Recording: ${recording.title}`}>
        <div className="player-center">
          <button
            type="button"
            className="player-play"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => {
              if (!started.current) {
                started.current = true;
                onPlay?.();
              }
              setPlaying((p) => !p);
            }}
          >
            <Icon name={playing ? "more" : "play"} />
          </button>
          <div style={{ font: "500 13px/18px var(--font-sans)" }}>{playing ? "Playing" : pos ? "Paused" : `Play recording · ${formatDuration(recording.durationMins)}`}</div>
        </div>
        <div className="player-bar">
          <span>{fmt(pos)}</span>
          <span className="player-track">
            <span style={{ width: `${(pos / total) * 100}%` }} />
          </span>
          <span>{fmt(total)}</span>
        </div>
      </div>
      <p className="caption">This is demo data without a video file, so playback is simulated. Recordings uploaded by Operations play here in full.</p>
    </div>
  );
}
