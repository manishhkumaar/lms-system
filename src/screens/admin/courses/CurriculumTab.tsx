import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useRun } from "@/components/useRun";
import { addModule, moveModule, removeLectureTemplate, removeModule, renameModule } from "@/data/actions";
import type { Course, LectureTemplate, Module } from "@/data/types";
import { Button, Card, EmptyState, TextField } from "@/design-system";
import { formatDuration, plural } from "@/lib/format";
import { templateCount, templateMinutes } from "./courseBits";
import { TemplateDialog } from "./TemplateDialog";

/** Modules and their lecture templates, in teaching order. */
export function CurriculumTab({ course }: { course: Course }) {
  const run = useRun();
  const [newModule, setNewModule] = useState("");
  const [newModuleError, setNewModuleError] = useState<string>();
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [removingModule, setRemovingModule] = useState<Module | null>(null);
  const [tpl, setTpl] = useState<{ module: Module; template?: LectureTemplate } | null>(null);
  const [removingTpl, setRemovingTpl] = useState<{ module: Module; template: LectureTemplate } | null>(null);

  const addMod = async (e: FormEvent) => {
    e.preventDefault();
    if (!newModule.trim()) {
      setNewModuleError("Enter a module title, for example Back-end with Node.");
      return;
    }
    setNewModuleError(undefined);
    // Keep what was typed if it didn't save.
    if (await run(() => addModule(course.id, newModule), "Module added", "Add its lectures next.")) setNewModule("");
  };

  const saveRename = async (e: FormEvent) => {
    e.preventDefault();
    if (!renaming || !renaming.title.trim()) return;
    if (await run(() => renameModule(course.id, renaming.id, renaming.title), "Module renamed")) setRenaming(null);
  };

  // Lecture numbers run across modules: Lecture 13 is the 13th template overall.
  let offset = 0;
  const numbered = course.modules.map((m) => {
    const start = offset;
    offset += m.lectures.length;
    return { m, start };
  });

  return (
    <div className="stack-3">
      <div className="acd-summary">
        <span>
          <strong>{plural(course.modules.length, "module")}</strong>
        </span>
        <span>
          <strong>{plural(templateCount(course), "lecture")}</strong>
        </span>
        <span>
          <strong>{formatDuration(templateMinutes(course))}</strong> of live sessions
        </span>
        <span>Each batch of this course gets one live lecture per template.</span>
      </div>

      {course.modules.length === 0 ? (
        <Card>
          <EmptyState icon="layers" title="No modules yet" description="Organise the curriculum into modules, then add a lecture template for each live session." />
        </Card>
      ) : null}

      {numbered.map(({ m, start }, i) => {
        const mins = m.lectures.reduce((n, l) => n + l.durationMins, 0);
        const isRenaming = renaming?.id === m.id;
        return (
          <Card
            key={m.id}
            flush
            title={
              <span className="acd-module-title">
                <span className="acd-num">Module {i + 1}</span>
                {m.title}
              </span>
            }
            description={isRenaming ? undefined : `${plural(m.lectures.length, "lecture")}${mins ? ` · ${formatDuration(mins)}` : ""}`}
            actions={
              isRenaming ? undefined : (
                <span className="acd-actions">
                  <Button variant="ghost" icon="chevronDown" className="acd-icon-btn acd-rot" aria-label={`Move ${m.title} up`} disabled={i === 0} title={i === 0 ? "Already the first module" : undefined} onClick={() => void run(() => moveModule(course.id, m.id, -1))} />
                  <Button
                    variant="ghost"
                    icon="chevronDown"
                    className="acd-icon-btn"
                    aria-label={`Move ${m.title} down`}
                    disabled={i === course.modules.length - 1}
                    title={i === course.modules.length - 1 ? "Already the last module" : undefined}
                    onClick={() => void run(() => moveModule(course.id, m.id, 1))}
                  />
                  <Button variant="ghost" icon="edit" className="acd-icon-btn" aria-label={`Rename ${m.title}`} onClick={() => setRenaming({ id: m.id, title: m.title })} />
                  <Button variant="ghost" icon="trash" className="acd-icon-btn" aria-label={`Remove ${m.title}`} onClick={() => setRemovingModule(m)} />
                </span>
              )
            }
          >
            <ul className="list">
              {isRenaming ? (
                <li>
                  <form className="acd-inline-edit acd-grow" onSubmit={saveRename}>
                    <TextField label="Module title" value={renaming.title} autoFocus onChange={(e) => setRenaming({ id: m.id, title: e.target.value })} />
                    <Button type="submit" disabled={!renaming.title.trim()}>
                      Save
                    </Button>
                    <Button variant="secondary" onClick={() => setRenaming(null)}>
                      Cancel
                    </Button>
                  </form>
                </li>
              ) : null}
              {m.lectures.map((l, j) => (
                <li key={l.id}>
                  <span className="acd-num">{start + j + 1}</span>
                  <div className="acd-grow">
                    <div className="list-title">{l.title}</div>
                    <div className="list-sub">
                      <span className="bl-mono">{formatDuration(l.durationMins)}</span>
                      {l.summary ? ` · ${l.summary}` : ""}
                    </div>
                  </div>
                  <span className="acd-actions">
                    <Button variant="ghost" icon="edit" className="acd-icon-btn" aria-label={`Edit ${l.title}`} onClick={() => setTpl({ module: m, template: l })} />
                    <Button variant="ghost" icon="trash" className="acd-icon-btn" aria-label={`Remove ${l.title}`} onClick={() => setRemovingTpl({ module: m, template: l })} />
                  </span>
                </li>
              ))}
              {m.lectures.length === 0 ? (
                <li>
                  <span className="caption">No lectures in this module yet.</span>
                </li>
              ) : null}
              <li>
                <Button variant="ghost" icon="plus" onClick={() => setTpl({ module: m })}>
                  Add lecture
                </Button>
              </li>
            </ul>
          </Card>
        );
      })}

      <Card title="Add a module">
        <form className="acd-inline-edit" onSubmit={addMod}>
          <TextField label="Module title" placeholder="e.g. Back-end with Node" value={newModule} error={newModuleError} onChange={(e) => setNewModule(e.target.value)} />
          <Button type="submit" variant="secondary" icon="plus">
            Add module
          </Button>
        </form>
      </Card>

      {tpl ? <TemplateDialog open onClose={() => setTpl(null)} courseId={course.id} moduleId={tpl.module.id} moduleTitle={tpl.module.title} template={tpl.template} /> : null}

      <ConfirmDialog
        open={!!removingModule}
        title="Remove module"
        description={
          removingModule
            ? `Remove "${removingModule.title}" and its ${plural(removingModule.lectures.length, "lecture template")}? Batches that already have lectures scheduled keep them.`
            : ""
        }
        confirmLabel="Remove module"
        cancelLabel="Keep module"
        onConfirm={() => {
          if (removingModule) void run(() => removeModule(course.id, removingModule.id), "Module removed");
        }}
        onClose={() => setRemovingModule(null)}
      />
      <ConfirmDialog
        open={!!removingTpl}
        title="Remove lecture"
        description={removingTpl ? `Remove "${removingTpl.template.title}" from ${removingTpl.module.title}? Batches that already scheduled it keep their lecture.` : ""}
        confirmLabel="Remove lecture"
        cancelLabel="Keep lecture"
        onConfirm={() => {
          if (removingTpl) void run(() => removeLectureTemplate(course.id, removingTpl.module.id, removingTpl.template.id), "Lecture removed");
        }}
        onClose={() => setRemovingTpl(null)}
      />
    </div>
  );
}
