import { useState } from "react";
import { cx, initials } from "../utils";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { StatusChip, type Status } from "./StatusChip";

export interface KanbanLead {
  id: string | number;
  stage: string;
  name: string;
  course: string;
  source?: string;
  /** "Thu 23 Oct · 11:00 IST" */
  interview?: string;
  /** "today", "tomorrow", "23 Oct" */
  followUp?: string;
  /** Overdue or due today: shown in warning and sorted to the top. */
  followUpDue?: boolean;
  updated?: string;
  owner?: string;
  status?: Status;
}

export interface LeadCardProps {
  lead: KanbanLead;
  onOpen?: (lead: KanbanLead) => void;
  dragging?: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/** One prospective student in the Leads Kanban. */
export function LeadCard({ lead: l, onOpen, dragging, draggable = true, onDragStart, onDragEnd }: LeadCardProps) {
  return (
    <div
      className={cx("bl-lead", dragging && "dragging")}
      draggable={draggable}
      tabIndex={0}
      role={onOpen ? "button" : undefined}
      aria-label={onOpen ? `${l.name}, ${l.course}. Open lead` : undefined}
      onClick={onOpen ? () => onOpen(l) : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(l);
              }
            }
          : undefined
      }
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(l.id));
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
    >
      <div>
        <div className="bl-lead-name">{l.name}</div>
        <div className="bl-lead-meta">{l.course + (l.source ? " · " + l.source : "")}</div>
      </div>
      {l.interview ? (
        <div className="bl-lead-meta bl-mono" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Icon name="calendar" />
          {l.interview}
        </div>
      ) : null}
      {l.status ? (
        <div>
          <StatusChip status={l.status} />
        </div>
      ) : null}
      <div className="bl-lead-foot">
        {l.followUp ? (
          <span className={l.followUpDue ? "due" : undefined} style={l.followUpDue ? undefined : { display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="clock" />
            {"Follow up " + l.followUp}
          </span>
        ) : (
          <span>{l.updated || ""}</span>
        )}
        {l.owner ? (
          <span className="bl-avatar" title={l.owner}>
            {initials(l.owner)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export const STAGES: Array<[key: string, label: string]> = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["interview-scheduled", "Interview scheduled"],
  ["interviewed", "Interviewed"],
  ["selected", "Selected"],
  ["rejected", "Rejected"],
  ["enrolled", "Enrolled"],
];

export interface KanbanBoardProps {
  leads: KanbanLead[];
  stages?: Array<[key: string, label: string]>;
  onOpen?: (lead: KanbanLead) => void;
  /** Called when a card is dropped on another column. */
  onMove?: (lead: KanbanLead, toStage: string) => void;
  /** Shows the + button on each column. */
  onAdd?: (stage: string) => void;
}

/** The Leads CRM pipeline. Cards are draggable between columns when onMove is given. */
export function KanbanBoard({ leads, stages = STAGES, onOpen, onMove, onAdd }: KanbanBoardProps) {
  const [dragId, setDragId] = useState<string | number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="bl-board">
      {stages.map(([key, label]) => {
        const items = leads
          .filter((l) => l.stage === key)
          .sort((a, b) => Number(!!b.followUpDue) - Number(!!a.followUpDue));
        return (
          <section
            key={key}
            className={cx("bl-col", over === key && dragId != null && "drop")}
            aria-label={label}
            onDragOver={
              onMove
                ? (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (over !== key) setOver(key);
                  }
                : undefined
            }
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === key ? null : o));
            }}
            onDrop={
              onMove
                ? (e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    const lead = leads.find((l) => String(l.id) === id);
                    setOver(null);
                    setDragId(null);
                    if (lead && lead.stage !== key) onMove(lead, key);
                  }
                : undefined
            }
          >
            <div className="bl-col-head">
              <StatusChip status={key}>{label}</StatusChip>
              <span className="bl-col-count">{items.length}</span>
              {onAdd ? (
                <Button variant="ghost" icon="plus" aria-label={"Add lead to " + label} style={{ marginLeft: "auto", height: 28, padding: "0 6px" }} onClick={() => onAdd(key)} />
              ) : null}
            </div>
            {items.map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                onOpen={onOpen}
                draggable={!!onMove}
                dragging={dragId === l.id}
                onDragStart={() => setDragId(l.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOver(null);
                }}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

KanbanBoard.stages = STAGES;
