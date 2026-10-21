"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "@/lib/router";
import { LEAD_SOURCES } from "@/components/options";
import { useDb } from "@/data/store";
import { followUpDue, followUpOverdue, getCourse, getUser, isLeadOpen } from "@/data/selectors";
import type { Lead } from "@/data/types";
import { Button, DataTable, EmptyState, FilterBar, KanbanBoard, NameCell, SegmentedControl, StatusChip, type FilterDef } from "@/design-system";
import { formatRelative } from "@/lib/format";
import { dateKey, DEFAULT_TZ } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { AdminPage, Crumbs } from "@/layouts/AdminPage";
import { AddLeadDialog } from "./leads/AddLeadDialog";
import { LeadPanel } from "./leads/LeadPanel";
import { followUpLabel, ownerName, shortCourse, toKanbanLead } from "./leads/leadUtils";
import { useLeadStageMover } from "./leads/StageDialogs";
import "./admissions.css";

type View = "kanban" | "table";

/** Leads CRM: New → Contacted → Interview scheduled → Interviewed → Selected / Rejected → Enrolled. */
export function LeadsPage() {
  const db = useDb();
  const now = useNow(30000);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  // `?new=1` (from the Admissions dashboard) opens Add lead straight away.
  const [adding, setAdding] = useState<string | null>(() => (new URLSearchParams(window.location.search).get("new") === "1" ? "new" : null));
  const mover = useLeadStageMover();

  const view: View = params.get("view") === "table" ? "table" : "kanban";
  const course = params.get("course") || undefined;
  const owner = params.get("owner") || undefined;
  const source = params.get("source") || undefined;
  const due = params.get("due") || undefined; // "1" = due today or overdue, "overdue"
  const openId = params.get("lead");

  const setParam = (k: string, v?: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (v) n.set(k, v);
        else n.delete(k);
        return n;
      },
      { replace: k !== "lead" },
    );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return db.leads
      .filter((l) => {
        if (course && l.courseId !== course) return false;
        if (owner === "none" ? !!l.ownerId : owner && l.ownerId !== owner) return false;
        if (source && l.source !== source) return false;
        if (due === "1" && !followUpDue(l, now)) return false;
        if (due === "overdue" && !followUpOverdue(l, now)) return false;
        if (s && !(l.name.toLowerCase().includes(s) || l.email.toLowerCase().includes(s) || (digits.length >= 3 && l.phone.replace(/\D/g, "").includes(digits)))) return false;
        return true;
      })
      .sort((a, b) => Number(followUpDue(b, now)) - Number(followUpDue(a, now)) || b.updatedAt.localeCompare(a.updatedAt));
  }, [db.leads, q, course, owner, source, due, now]);

  const kanban = useMemo(() => filtered.map((l) => toKanbanLead(db, l, now)), [db, filtered, now]);

  const summary = useMemo(() => {
    const open = db.leads.filter(isLeadOpen);
    const today = dateKey(new Date(now), DEFAULT_TZ);
    return {
      open: open.length,
      due: open.filter((l) => followUpDue(l, now)).length,
      interviewsToday: db.leads.filter((l) => l.stage === "interview-scheduled" && l.interviewAt && dateKey(l.interviewAt, DEFAULT_TZ) === today).length,
      unassigned: db.leads.filter((l) => l.stage === "new" && !l.ownerId).length,
    };
  }, [db.leads, now]);

  const staff = db.users.filter((u) => (u.role === "admissions" || u.role === "super-admin") && u.status === "active");
  const filters: FilterDef[] = [
    { label: "Course", value: course ? shortCourse(getCourse(db, course)?.title) : undefined, options: db.courses.map((c) => ({ value: c.id, label: shortCourse(c.title) })), onSelect: (v) => setParam("course", v) },
    {
      label: "Owner",
      value: owner === "none" ? "Unassigned" : owner ? getUser(db, owner)?.name : undefined,
      options: [{ value: "none", label: "Unassigned" }, ...staff.map((u) => ({ value: u.id, label: u.name }))],
      onSelect: (v) => setParam("owner", v),
    },
    { label: "Source", value: source, options: [...LEAD_SOURCES], onSelect: (v) => setParam("source", v) },
    {
      label: "Follow-up",
      value: due === "1" ? "Due" : due === "overdue" ? "Overdue" : undefined,
      options: [
        { value: "1", label: "Due" },
        { value: "overdue", label: "Overdue" },
      ],
      onSelect: (v) => setParam("due", v),
    },
  ];
  const clearFilters = () => {
    setQ("");
    setParams((p) => {
      const n = new URLSearchParams();
      if (p.get("view")) n.set("view", p.get("view")!);
      if (p.get("lead")) n.set("lead", p.get("lead")!);
      return n;
    });
  };

  const toolbar = (
    <FilterBar
      searchPlaceholder="Search name, email or phone"
      searchValue={q}
      onSearch={setQ}
      filters={filters}
      end={
        <SegmentedControl<View>
          label="View"
          value={view}
          onChange={(v) => setParam("view", v === "table" ? "table" : undefined)}
          options={[
            { value: "kanban", label: "Kanban", icon: "grid" },
            { value: "table", label: "Table", icon: "list" },
          ]}
        />
      }
    />
  );

  const noMatch = <EmptyState icon="search" title="No leads match these filters" description="Try a different search or clear the filters." action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>} />;
  const noLeads = <EmptyState icon="inbox" title="No leads yet" description="Leads from the website, ads and walk-ins appear here. Add the first one to start the pipeline." action={<Button icon="plus" onClick={() => setAdding("new")}>Add lead</Button>} />;

  return (
    <AdminPage
      title="Leads CRM"
      breadcrumb={<Crumbs items={[{ label: "Admissions" }, { label: "Leads" }]} />}
      actions={
        <Button icon="plus" onClick={() => setAdding("new")}>
          Add lead
        </Button>
      }
    >
      <div className="adm-summary" aria-label="Pipeline summary">
        <span>
          <b>{summary.open}</b> open leads
        </span>
        <span>
          <b>{summary.due}</b> follow-ups due
        </span>
        <span>
          <b>{summary.interviewsToday}</b> interviews today
        </span>
        <span>
          <b>{summary.unassigned}</b> new without an owner
        </span>
      </div>

      {view === "kanban" ? (
        <>
          <div className="bl-card">{toolbar}</div>
          {!db.leads.length ? (
            <div className="bl-card">{noLeads}</div>
          ) : !filtered.length ? (
            <div className="bl-card">{noMatch}</div>
          ) : (
            <KanbanBoard leads={kanban} onOpen={(l) => setParam("lead", String(l.id))} onMove={(l, stage) => mover.move(String(l.id), stage as Lead["stage"])} onAdd={(stage) => setAdding(stage)} />
          )}
          <p className="caption">Drag a card to move it, or open it to change the stage from the keyboard. Overdue follow-ups sit at the top of each column.</p>
        </>
      ) : (
        <DataTable<Lead>
          toolbar={toolbar}
          rows={filtered}
          onRowClick={(l) => setParam("lead", l.id)}
          selectedId={openId || undefined}
          empty={db.leads.length ? noMatch : noLeads}
          footer={<span>{filtered.length === db.leads.length ? `${filtered.length} leads` : `Showing ${filtered.length} of ${db.leads.length} leads`}</span>}
          columns={[
            { key: "name", label: "Lead", render: (l) => <NameCell name={l.name} sub={l.email} /> },
            { key: "course", label: "Course", render: (l) => shortCourse(getCourse(db, l.courseId)?.title) },
            { key: "stage", label: "Stage", render: (l) => <StatusChip status={l.stage} /> },
            { key: "owner", label: "Owner", render: (l) => ownerName(db, l) || <span className="subtle">Unassigned</span> },
            {
              key: "followUp",
              label: "Follow-up",
              render: (l) =>
                isLeadOpen(l) && l.followUpOn ? (
                  followUpDue(l, now) ? (
                    <StatusChip status="follow-up-due">{followUpLabel(l.followUpOn, now).replace(/^./, (c) => c.toUpperCase())}</StatusChip>
                  ) : (
                    followUpLabel(l.followUpOn, now).replace(/^./, (c) => c.toUpperCase())
                  )
                ) : (
                  "—"
                ),
            },
            { key: "source", label: "Source" },
            { key: "updated", label: "Updated", render: (l) => <span className="nowrap">{formatRelative(l.updatedAt, now)}</span> },
          ]}
        />
      )}

      <LeadPanel leadId={openId} onClose={() => setParam("lead", undefined)} mover={mover} />
      <AddLeadDialog open={!!adding} stage={adding || undefined} onClose={() => setAdding(null)} onAdded={(id) => setParam("lead", id)} />
      {mover.dialogs}
    </AdminPage>
  );
}
