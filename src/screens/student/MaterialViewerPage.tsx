"use client";
import { useState } from "react";
import { errorMessage } from "@/components/useRun";
import { materialFileUrl } from "@/data/actions";
import { Link, useParams } from "@/lib/router";
import { getCourse, getMaterial } from "@/data/selectors";
import type { Material } from "@/data/types";
import { canSeeMaterial } from "@/data/studentSelectors";
import { Button, Card, EmptyState, Icon } from "@/design-system";
import { formatDate } from "@/lib/format";
import { StudentPage } from "@/layouts/StudentLayout";
import { useMe } from "./parts/useMe";
import { fileSize, KIND_ICON, KIND_LABEL } from "./parts/util";
import "./student.css";

export function MaterialViewerPage() {
  const { materialId = "" } = useParams();
  const { db, studentId, tz } = useMe();
  const material = getMaterial(db, materialId);
  const course = getCourse(db, material?.courseId);
  const back = { to: "/learn/materials", label: "Materials" };

  if (!material || !course || !canSeeMaterial(db, studentId, material)) {
    return (
      <StudentPage title="Material" back={back}>
        <Card>
          <EmptyState
            icon="lock"
            title="This material isn't available to you"
            description="Materials are shared with students in the course's batches, when the course has materials switched on."
            action={
              <Link to="/learn/materials" className="bl-btn bl-btn-secondary bl-btn-touch stu-action">
                Go to materials
              </Link>
            }
          />
        </Card>
      </StudentPage>
    );
  }

  const moduleTitle = course.modules.find((m) => m.id === material.moduleId)?.title;
  const subtitle = `${course.title}${moduleTitle ? ` · ${moduleTitle}` : ""} · Updated ${formatDate(material.updatedAt, tz)}`;

  return (
    <StudentPage title={material.title} subtitle={subtitle} back={back}>
      {material.kind === "notes" ? (
        <Card>
          <div className="reading stu-notes">
            {(material.body || "").split(/\n\s*\n/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </Card>
      ) : material.kind === "link" ? (
        <Card>
          <div className="stack">
            <p className="muted">This material is an external page. It opens in a new tab.</p>
            <code className="bl-mono caption" style={{ overflowWrap: "anywhere" }}>
              {material.url}
            </code>
            <div>
              <a href={material.url} target="_blank" rel="noopener noreferrer" className="bl-btn bl-btn-primary bl-btn-touch stu-action">
                <Icon name="external" />
                Open link
              </a>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="stack">
            <div className="stu-file">
              <span className="stu-kind" aria-hidden="true">
                <Icon name={KIND_ICON[material.kind]} />
              </span>
              <div className="stu-file-name">
                <div className="list-title">{material.fileName || material.title}</div>
                <div className="list-sub">
                  {KIND_LABEL[material.kind]}
                  {material.sizeKb ? ` · ${fileSize(material.sizeKb)}` : ""}
                </div>
              </div>
            </div>
            <DownloadFile material={material} />
          </div>
        </Card>
      )}
    </StudentPage>
  );
}

/** Downloads an uploaded slide deck or PDF through a short-lived signed link. */
function DownloadFile({ material }: { material: Material }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!material.filePath) {
    return (
      <div className="stack-1">
        <div>
          <Button variant="secondary" touch icon="download" disabled aria-describedby="stu-dl-why">
            Download
          </Button>
        </div>
        <p className="caption" id="stu-dl-why">
          The file hasn't been uploaded yet. Ask your course designer to add it.
        </p>
      </div>
    );
  }

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await materialFileUrl(material.id);
      if (!url) throw new Error();
      // The link is served as an attachment, so the page stays where it is.
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error && !err.message ? "The file couldn't be found. Ask your course designer to upload it again." : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-1">
      <div>
        <Button touch icon="download" disabled={busy} onClick={() => void download()}>
          {busy ? "Preparing download…" : "Download"}
        </Button>
      </div>
      {error ? (
        <p className="caption text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
