/*
 * Demo data, generated around "now" so every state is visible on first run:
 * a lecture live right now, the next one missing its link, a finished lecture waiting for its
 * recording, overdue follow-ups, a full upcoming batch and a completed one.
 * Settings → Reset demo data regenerates it.
 */
import { addDays, dateKey, DEFAULT_TZ, toZonedISO, weekdayOf, zonedISO } from "@/lib/time";
import type { Attendance, Batch, Course, DB, Enrolment, Lead, LeadActivity, LeadSource, LeadStage, Lecture, Material, Module, Recording, Student, User } from "./types";

export const SEED_VERSION = 3;

/** Password for every seeded demo account. */
export const DEMO_PASSWORD = "demo1234";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Day = Batch["days"][number];

/** n session dates on `days`, with dates[anchorIndex] = the first session day on/after anchorDate. */
function scheduleAround(anchorDate: string, days: Day[], n: number, anchorIndex: number): string[] {
  let anchor = anchorDate;
  while (!days.includes(weekdayOf(anchor))) anchor = addDays(anchor, 1);
  const before: string[] = [];
  let d = addDays(anchor, -1);
  while (before.length < anchorIndex) {
    if (days.includes(weekdayOf(d))) before.unshift(d);
    d = addDays(d, -1);
  }
  const after: string[] = [];
  d = addDays(anchor, 1);
  while (after.length < n - anchorIndex - 1) {
    if (days.includes(weekdayOf(d))) after.push(d);
    d = addDays(d, 1);
  }
  return [...before, anchor, ...after];
}

const mod = (id: string, title: string, lectures: Array<[string, number?]>): Module => ({
  id,
  title,
  lectures: lectures.map(([t, mins], i) => ({ id: `${id}-t${i + 1}`, title: t, durationMins: mins || 90 })),
});

const FIRST = ["Aarav", "Aditi", "Akash", "Anika", "Aryan", "Bhavna", "Chetan", "Deepika", "Dev", "Divya", "Farah", "Gaurav", "Harini", "Ishaan", "Ishita", "Jatin", "Kabir", "Karan", "Khushi", "Krish", "Lavanya", "Manav", "Meghna", "Mohit", "Naina", "Nikhil", "Nisha", "Omkar", "Pooja", "Pranav", "Rachana", "Riya", "Rohit", "Saanvi", "Sahil", "Sana", "Shreya", "Simran", "Tanvi", "Tarun", "Uday", "Varun", "Vidya", "Yash", "Zoya", "Amit", "Bhargav", "Charu", "Esha", "Gautam", "Hema", "Irfan", "Jaya", "Kunal", "Leela", "Mihir", "Nandini", "Parth", "Ritika", "Sameer"];
const LAST = ["Agarwal", "Bhat", "Chopra", "D'Souza", "Desai", "Fernandes", "Ghosh", "Gupta", "Iyer", "Jain", "Kapoor", "Khan", "Kulkarni", "Kumar", "Malhotra", "Menon", "Mishra", "Nair", "Patel", "Pillai", "Rao", "Reddy", "Saxena", "Sen", "Shah", "Sinha", "Thomas", "Varma", "Yadav", "Chatterjee", "Bose", "Hegde"];
const CITIES = ["Hyderabad", "Bengaluru", "Pune", "Mumbai", "Chennai", "Delhi", "Kochi", "Jaipur", "Kolkata", "Ahmedabad", "Indore", "Lucknow", "Visakhapatnam", "Coimbatore"];

export function createSeed(nowMs: number): DB {
  const rand = mulberry32(20261021);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const tz = DEFAULT_TZ;
  const today = dateKey(new Date(nowMs), tz);
  const iso = (ms: number) => new Date(ms).toISOString();
  const DAY = 86400000;

  /* ---------------- staff ---------------- */
  const staff = (id: string, name: string, email: string, role: User["role"], extra: Partial<User> = {}): User => ({
    id,
    name,
    email,
    role,
    status: "active",
    timeZone: tz,
    createdAt: iso(nowMs - 200 * DAY),
    lastActiveAt: iso(nowMs - Math.floor(rand() * 3 * DAY)),
    ...extra,
  });
  const users: User[] = [
    staff("usr-admin", "Kavya Menon", "kavya@example.in", "super-admin", { phone: "98480 11223" }),
    staff("usr-ops", "Anjali Rao", "anjali@example.in", "operations", { phone: "98480 22334" }),
    staff("usr-ops2", "Imran Sheikh", "imran@example.in", "operations"),
    staff("usr-cd", "Lakshmi Pillai", "lakshmi@example.in", "course-designer"),
    staff("usr-adm1", "Meera Nair", "meera@example.in", "admissions", { phone: "98480 33445" }),
    staff("usr-adm2", "Rohan Das", "rohan@example.in", "admissions"),
    { id: "usr-invited", name: "Deepak Bose", email: "deepak@example.in", role: "operations", status: "invited", activationToken: "welcome-deepak", timeZone: tz, createdAt: iso(nowMs - 2 * DAY) },
  ];

  /* ---------------- courses ---------------- */
  const courses: Course[] = [
    {
      id: "crs-fsw",
      code: "FSW",
      title: "Full-Stack Web Development",
      summary: "Build and ship modern web applications end to end: semantic HTML and CSS, JavaScript, React on the front end, Node.js, Express and PostgreSQL on the back end, then testing and deployment, finishing with a capstone project.",
      level: "Intermediate",
      durationWeeks: 9,
      fee: 85000,
      status: "published",
      materialsEnabled: true,
      designerId: "usr-cd",
      updatedAt: iso(nowMs - 12 * DAY),
      modules: [
        mod("fsw-m1", "Web foundations", [["HTML and semantic markup"], ["CSS layout with Flexbox and Grid"], ["JavaScript essentials"], ["DOM and events"]]),
        mod("fsw-m2", "Front-end with React", [["Components and props"], ["State and effects"], ["Routing and data fetching"], ["Forms and validation"]]),
        mod("fsw-m3", "Back-end with Node", [["Node.js and npm"], ["Async JavaScript and promises"], ["Modules and tooling"], ["Working with HTTP"], ["REST APIs with Express"], ["Auth & sessions"], ["Databases with PostgreSQL"], ["ORMs and migrations"]]),
        mod("fsw-m4", "Shipping", [["Testing basics"], ["Integration testing"], ["Security essentials"], ["Performance basics"], ["Deployment and CI"], ["Capstone kickoff"], ["Capstone reviews"], ["Capstone demos", 120]]),
      ],
    },
    {
      id: "crs-dap",
      code: "DAP",
      title: "Data Analytics with Python",
      summary: "Go from spreadsheets to analysis in Python: Pandas for cleaning and shaping data, SQL for reporting, charts and dashboards that tell a story, and the statistics to back your conclusions.",
      level: "Beginner",
      durationWeeks: 6,
      fee: 62000,
      status: "published",
      materialsEnabled: true,
      designerId: "usr-cd",
      updatedAt: iso(nowMs - 30 * DAY),
      modules: [
        mod("dap-m1", "Python for analysis", [["Python basics"], ["Intro to Pandas"], ["Data cleaning lab"], ["Grouping and aggregation"]]),
        mod("dap-m2", "SQL", [["SQL fundamentals"], ["Joins and window functions"], ["SQL for reporting"], ["Case study: sales data"]]),
        mod("dap-m3", "Visualisation", [["Matplotlib and Seaborn"], ["Storytelling with charts"], ["Dashboards with Streamlit"], ["Dashboard review"]]),
        mod("dap-m4", "Statistics", [["Descriptive statistics"], ["Probability basics"], ["Hypothesis testing"], ["Final project presentations", 120]]),
      ],
    },
    {
      id: "crs-uxd",
      code: "UXD",
      title: "UI/UX Design Foundations",
      summary: "Learn to research, design and validate digital products: interviews and personas, information architecture, wireframes, visual design and prototyping in Figma, and usability testing.",
      level: "Beginner",
      durationWeeks: 6,
      fee: 48000,
      status: "published",
      materialsEnabled: false,
      designerId: "usr-cd",
      updatedAt: iso(nowMs - 45 * DAY),
      modules: [
        mod("uxd-m1", "Research", [["Design thinking"], ["User interviews"], ["Personas and journeys"]]),
        mod("uxd-m2", "Design", [["Information architecture"], ["Wireframing"], ["Visual design basics"], ["Prototyping in Figma"]]),
        mod("uxd-m3", "Validate", [["Usability testing"], ["Accessibility basics"], ["Design critique"], ["Portfolio case study"], ["Final presentations", 120]]),
      ],
    },
    {
      id: "crs-cld",
      code: "CLD",
      title: "Cloud & DevOps Essentials",
      summary: "Linux, networking, containers and CI/CD for developers moving into operations roles.",
      level: "Advanced",
      durationWeeks: 4,
      fee: 72000,
      status: "draft",
      materialsEnabled: true,
      designerId: "usr-cd",
      updatedAt: iso(nowMs - 1 * DAY),
      modules: [
        mod("cld-m1", "Foundations", [["Linux and the shell", 180], ["Networking basics", 180], ["Git workflows", 180]]),
        mod("cld-m2", "Containers", [["Containers with Docker", 180], ["Docker Compose", 180]]),
        mod("cld-m3", "Delivery", [["CI/CD pipelines", 180], ["Infrastructure as code", 180], ["Monitoring and alerts", 180]]),
      ],
    },
  ];
  const templatesOf = (courseId: string) => courses.find((c) => c.id === courseId)!.modules.flatMap((m) => m.lectures);

  /* ---------------- batches + lectures ---------------- */
  interface BatchPlan {
    id: string;
    code: string;
    name: string;
    courseId: string;
    days: Day[];
    slot: [string, string];
    capacity: number;
    enrolled: number;
    instructors: string[];
    anchor: string;
    anchorIndex: number;
    lifecycle: Batch["lifecycle"];
    lectures: boolean;
  }
  const plans: BatchPlan[] = [
    { id: "bat-fsw-07", code: "FSW-07", name: "Full-Stack Web · Batch 07", courseId: "crs-fsw", days: ["Mon", "Wed", "Fri"], slot: ["18:30", "20:00"], capacity: 50, enrolled: 42, instructors: ["Vivek Krishnan"], anchor: today, anchorIndex: 12, lifecycle: "active", lectures: true },
    { id: "bat-dap-03", code: "DAP-03", name: "Data Analytics · Batch 03", courseId: "crs-dap", days: ["Tue", "Thu", "Sat"], slot: ["10:00", "11:30"], capacity: 40, enrolled: 40, instructors: ["Shalini Gupta"], anchor: today, anchorIndex: 8, lifecycle: "active", lectures: true },
    { id: "bat-uxd-02", code: "UXD-02", name: "UI/UX Design · Batch 02", courseId: "crs-uxd", days: ["Mon", "Wed"], slot: ["14:00", "15:30"], capacity: 30, enrolled: 24, instructors: ["Ritu Malhotra"], anchor: today, anchorIndex: 8, lifecycle: "active", lectures: true },
    { id: "bat-uxd-01", code: "UXD-01", name: "UI/UX Design · Batch 01", courseId: "crs-uxd", days: ["Mon", "Wed"], slot: ["14:00", "15:30"], capacity: 30, enrolled: 28, instructors: ["Ritu Malhotra"], anchor: addDays(today, -70), anchorIndex: 11, lifecycle: "active", lectures: true },
    { id: "bat-fsw-08", code: "FSW-08", name: "Full-Stack Web · Batch 08", courseId: "crs-fsw", days: ["Tue", "Thu", "Sat"], slot: ["19:00", "20:30"], capacity: 50, enrolled: 12, instructors: ["Vivek Krishnan", "Arvind Shetty"], anchor: addDays(today, 21), anchorIndex: 0, lifecycle: "active", lectures: true },
    { id: "bat-dap-04", code: "DAP-04", name: "Data Analytics · Batch 04", courseId: "crs-dap", days: ["Mon", "Wed", "Fri"], slot: ["07:30", "09:00"], capacity: 30, enrolled: 30, instructors: ["Shalini Gupta"], anchor: addDays(today, 35), anchorIndex: 0, lifecycle: "active", lectures: true },
    { id: "bat-cld-01", code: "CLD-01", name: "Cloud & DevOps · Batch 01", courseId: "crs-cld", days: ["Sat", "Sun"], slot: ["10:00", "13:00"], capacity: 25, enrolled: 0, instructors: ["Arvind Shetty"], anchor: addDays(today, 56), anchorIndex: 0, lifecycle: "draft", lectures: false },
  ];

  const batches: Batch[] = [];
  const lectures: Lecture[] = [];
  for (const p of plans) {
    const tpls = templatesOf(p.courseId);
    const dates = scheduleAround(p.anchor, p.days, tpls.length, p.anchorIndex);
    batches.push({
      id: p.id,
      code: p.code,
      name: p.name,
      courseId: p.courseId,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      capacity: p.capacity,
      instructors: p.instructors,
      timeZone: tz,
      days: p.days,
      slotStart: p.slot[0],
      slotEnd: p.slot[1],
      lifecycle: p.lifecycle,
      ownerId: "usr-ops",
      createdAt: iso(new Date(zonedISO(dates[0], "09:00", tz)).getTime() - 60 * DAY),
    });
    if (!p.lectures) continue;
    tpls.forEach((t, i) => {
      const start = zonedISO(dates[i], p.slot[0], tz);
      const endSlot = t.durationMins > 90 ? `${String(Number(p.slot[0].slice(0, 2)) + 2).padStart(2, "0")}${p.slot[0].slice(2)}` : p.slot[1];
      const end = zonedISO(dates[i], endSlot, tz);
      const startMs = new Date(start).getTime();
      const soon = startMs - nowMs < 3 * DAY;
      lectures.push({
        id: `lec-${p.code.toLowerCase()}-${i + 1}`,
        batchId: p.id,
        number: i + 1,
        title: t.title,
        start,
        end,
        timeZone: tz,
        instructor: p.instructors[0],
        meetingUrl: soon ? `https://meet.example.com/${p.code.toLowerCase()}-l${i + 1}` : undefined,
        linkPublished: soon,
        status: "scheduled",
      });
    });
  }

  // FSW-07 lecture 13 is live right now; lecture 14 hasn't had its link published.
  const live = lectures.find((l) => l.id === "lec-fsw-07-13")!;
  const liveStart = Math.floor((nowMs - 25 * 60000) / 300000) * 300000;
  Object.assign(live, {
    start: toZonedISO(liveStart, tz),
    end: toZonedISO(liveStart + 90 * 60000, tz),
    meetingUrl: "https://meet.example.com/fsw-07-l13",
    linkPublished: true,
  });
  const l14 = lectures.find((l) => l.id === "lec-fsw-07-14")!;
  l14.meetingUrl = undefined;
  l14.linkPublished = false;
  // One rescheduled lecture in DAP-03.
  const dapNext = lectures.filter((l) => l.batchId === "bat-dap-03" && new Date(l.start).getTime() > nowMs)[1];
  if (dapNext) {
    dapNext.previousStart = dapNext.start;
    dapNext.start = dapNext.start.replace("T10:00", "T11:00");
    dapNext.end = dapNext.end.replace("T11:30", "T12:30");
    dapNext.status = "rescheduled";
  }

  /* ---------------- students + enrolments ---------------- */
  const students: Student[] = [];
  const enrolments: Enrolment[] = [];
  const usedNames = new Set<string>(["Kavya Menon", "Anjali Rao", "Meera Nair", "Rohan Das", "Lakshmi Pillai"]);
  const propensity = new Map<string, number>();
  let sn = 0;
  const phone = () => `9${Math.floor(rand() * 9) + 1}${String(Math.floor(rand() * 1000)).padStart(3, "0")} ${String(Math.floor(rand() * 100000)).padStart(5, "0")}`;
  const emailFor = (name: string) => {
    const [f, ...rest] = name.toLowerCase().replace(/[^a-z ]/g, "").split(" ");
    return `${f}.${(rest.join("") || "x")[0]}${sn}@example.in`;
  };
  const newStudent = (name?: string, opts: Partial<Student> = {}): Student => {
    let n = name;
    while (!n || usedNames.has(n)) n = `${pick(FIRST)} ${pick(LAST)}`;
    usedNames.add(n);
    sn++;
    const s: Student = { id: `stu-${String(sn).padStart(3, "0")}`, name: n, email: emailFor(n), phone: phone(), city: pick(CITIES), createdAt: "", ...opts };
    students.push(s);
    propensity.set(s.id, 0.72 + rand() * 0.26);
    return s;
  };

  const named: Record<string, string[]> = {
    "bat-fsw-07": ["Priya Sharma", "Arjun Mehta", "Aditya Joshi"],
    "bat-dap-04": ["Sneha Iyer"],
    "bat-uxd-01": ["Rahul Verma"],
    "bat-fsw-08": ["Neha Kulkarni"],
  };
  for (const p of plans) {
    const b = batches.find((x) => x.id === p.id)!;
    const startMs = new Date(zonedISO(b.startDate, "09:00", tz)).getTime();
    const completed = b.endDate < today;
    for (let i = 0; i < p.enrolled; i++) {
      // Enrolled before the batch starts, and never in the future (upcoming batches start weeks from now).
      const enrolledAt = Math.min(startMs - Math.floor((5 + rand() * 40) * DAY), nowMs - Math.floor((0.2 + rand() * 20) * DAY));
      const s = newStudent(named[p.id]?.[i], { createdAt: iso(enrolledAt - 3 * DAY) });
      const fee = courses.find((c) => c.id === p.courseId)!.fee;
      enrolments.push({
        id: `enr-${s.id}-${p.code.toLowerCase()}`,
        studentId: s.id,
        batchId: p.id,
        enrolledAt: iso(enrolledAt),
        status: completed ? "completed" : "active",
        feePaid: rand() < 0.7 ? fee : Math.round(fee * 0.6),
      });
    }
  }
  const priya = students.find((s) => s.name === "Priya Sharma")!;
  const sneha = students.find((s) => s.name === "Sneha Iyer")!;
  const rahul = students.find((s) => s.name === "Rahul Verma")!;
  propensity.set(priya.id, 0.97);
  Object.assign(priya, { email: "priya@example.in", city: "Hyderabad", userId: "usr-priya" });
  Object.assign(sneha, { email: "sneha@example.in", city: "Chennai", userId: "usr-sneha" });
  Object.assign(rahul, { email: "rahul@example.in", city: "Pune", userId: "usr-rahul" });
  users.push(
    { id: "usr-priya", name: priya.name, email: priya.email, phone: priya.phone, role: "student", status: "active", timeZone: tz, studentId: priya.id, createdAt: priya.createdAt, lastActiveAt: iso(nowMs - 3600000) },
    { id: "usr-sneha", name: sneha.name, email: sneha.email, phone: sneha.phone, role: "student", status: "active", timeZone: tz, studentId: sneha.id, createdAt: sneha.createdAt },
    { id: "usr-rahul", name: rahul.name, email: rahul.email, phone: rahul.phone, role: "student", status: "active", timeZone: tz, studentId: rahul.id, createdAt: rahul.createdAt },
  );

  /* ---------------- recordings + attendance ---------------- */
  const recordings: Recording[] = [];
  const attendance: Attendance[] = [];
  const studentsByBatch = new Map<string, string[]>();
  for (const e of enrolments) studentsByBatch.set(e.batchId, [...(studentsByBatch.get(e.batchId) || []), e.studentId]);

  for (const b of batches) {
    const lecs = lectures.filter((l) => l.batchId === b.id);
    const ended = lecs.filter((l) => new Date(l.end).getTime() <= nowMs);
    const latestEnded = ended[ended.length - 1];
    for (const l of lecs) {
      const startMs = new Date(l.start).getTime();
      const endMs = new Date(l.end).getTime();
      const isEnded = endMs <= nowMs;
      const isLiveNow = startMs <= nowMs && nowMs < endMs;
      if (!isEnded && !isLiveNow) continue;
      // The latest lecture of a running batch hasn't been verified yet.
      const recent = l === latestEnded && nowMs - endMs < 4 * DAY;
      // Recordings: every ended lecture except the most recent of FSW-07 and DAP-03 (still to upload).
      const awaitingUpload = recent && (b.id === "bat-fsw-07" || b.id === "bat-dap-03");
      if (isEnded && !awaitingUpload) {
        const dur = Math.round((endMs - startMs) / 60000) - Math.floor(rand() * 8);
        recordings.push({
          id: `rec-${l.id.slice(4)}`,
          lectureId: l.id,
          batchId: b.id,
          title: l.title,
          durationMins: dur,
          fileName: `${b.code}_L${String(l.number).padStart(2, "0")}_${dateKey(l.start, tz)}.mp4`,
          sizeMb: Math.round(dur * (8 + rand() * 3)),
          status: "ready",
          uploadedAt: iso(endMs + (2 + rand() * 10) * 3600000),
          readyAt: iso(endMs + 13 * 3600000),
          uploadedBy: "usr-ops",
          published: !(recent && b.id === "bat-uxd-02"),
          views: Math.floor(rand() * (studentsByBatch.get(b.id)?.length || 10) * 1.4),
        });
      }
      // Attendance: provider-verified except for the most recent ended lecture and the live one.
      for (const sid of studentsByBatch.get(b.id) || []) {
        const r = rand();
        const p = propensity.get(sid) || 0.85;
        const joinedAt = iso(startMs + Math.floor(rand() * 9) * 60000);
        if (isLiveNow) {
          if (r < 0.62) attendance.push({ id: `att-${l.id}-${sid}`, lectureId: l.id, studentId: sid, joinedAt, verification: "unverified" });
          continue;
        }
        if (recent) {
          if (r < p) attendance.push({ id: `att-${l.id}-${sid}`, lectureId: l.id, studentId: sid, joinedAt, verification: "unverified" });
          continue;
        }
        const verifiedAt = iso(endMs + 2 * 3600000);
        if (r < p) attendance.push({ id: `att-${l.id}-${sid}`, lectureId: l.id, studentId: sid, joinedAt, verification: "present", verifiedBy: "provider", verifiedAt });
        else if (r < p + (1 - p) * 0.7) attendance.push({ id: `att-${l.id}-${sid}`, lectureId: l.id, studentId: sid, verification: "absent", verifiedBy: "provider", verifiedAt });
        // Joined but left within minutes: joined is not attended.
        else attendance.push({ id: `att-${l.id}-${sid}`, lectureId: l.id, studentId: sid, joinedAt, verification: "absent", verifiedBy: "provider", verifiedAt });
      }
    }
  }

  /* ---------------- leads ---------------- */
  const leads: Lead[] = [];
  const act = (at: number, by: string, kind: LeadActivity["kind"], text: string): LeadActivity => ({ id: `act-${leads.length}-${Math.floor(rand() * 1e6)}`, at: iso(at), by, kind, text });
  const sources: LeadSource[] = ["Website", "Instagram", "Referral", "Google Ads", "WhatsApp", "Walk-in", "Webinar"];
  const owners = ["usr-adm1", "usr-adm2"];
  const ownerName = (id?: string) => users.find((u) => u.id === id)?.name || "Kavya Menon";
  const courseIds = ["crs-fsw", "crs-fsw", "crs-dap", "crs-dap", "crs-uxd"];
  const interviewSlot = (dayOffset: number, time: string) => zonedISO(addDays(today, dayOffset), time, tz);

  interface LeadPlan {
    name?: string;
    stage: LeadStage;
    course?: string;
    source?: LeadSource;
    owner?: string | null;
    followUp?: number;
    interview?: [number, string];
    ageDays?: number;
    studentName?: string;
  }
  const leadPlans: LeadPlan[] = [
    { name: "Karthik Reddy", stage: "new", course: "crs-fsw", source: "Instagram", owner: "usr-adm1", ageDays: 0.1 },
    { name: "Fatima Shaikh", stage: "new", course: "crs-dap", source: "Website", owner: null, ageDays: 0.2 },
    { stage: "new", owner: null, ageDays: 0.5 },
    { stage: "new", owner: "usr-adm2", ageDays: 1 },
    { stage: "new", owner: null, ageDays: 1.5 },
    { stage: "new", owner: "usr-adm1", ageDays: 2, followUp: 0 },
    { stage: "new", owner: null, ageDays: 3 },
    { stage: "new", owner: "usr-adm2", ageDays: 4, followUp: -1 },
    { name: "Vikram Singh", stage: "contacted", course: "crs-fsw", source: "Referral", owner: "usr-adm1", followUp: 0, ageDays: 5 },
    { stage: "contacted", owner: "usr-adm1", followUp: -2, ageDays: 9 },
    { stage: "contacted", owner: "usr-adm2", followUp: 1, ageDays: 6 },
    { stage: "contacted", owner: "usr-adm2", followUp: 3, ageDays: 7 },
    { stage: "contacted", owner: "usr-adm1", followUp: 0, ageDays: 8 },
    { stage: "contacted", owner: "usr-adm2", followUp: 2, ageDays: 10 },
    { name: "Ananya Gupta", stage: "interview-scheduled", course: "crs-uxd", source: "Webinar", owner: "usr-adm2", interview: [2, "11:00"], ageDays: 12 },
    { stage: "interview-scheduled", owner: "usr-adm1", interview: [0, "15:00"], ageDays: 11 },
    { stage: "interview-scheduled", owner: "usr-adm1", interview: [1, "11:30"], ageDays: 9 },
    { stage: "interview-scheduled", owner: "usr-adm2", interview: [3, "16:00"], ageDays: 8 },
    { stage: "interview-scheduled", owner: "usr-adm1", interview: [4, "12:00"], ageDays: 14 },
    { name: "Siddharth Rao", stage: "interviewed", course: "crs-fsw", source: "Google Ads", owner: "usr-adm2", followUp: 1, interview: [-2, "11:00"], ageDays: 15 },
    { stage: "interviewed", owner: "usr-adm1", followUp: -1, interview: [-3, "15:00"], ageDays: 16 },
    { stage: "interviewed", owner: "usr-adm2", followUp: 2, interview: [-1, "12:00"], ageDays: 13 },
    { stage: "interviewed", owner: "usr-adm1", followUp: 0, interview: [-4, "16:30"], ageDays: 18 },
    { stage: "selected", course: "crs-fsw", owner: "usr-adm1", followUp: 1, interview: [-6, "11:00"], ageDays: 20 },
    { stage: "selected", course: "crs-dap", owner: "usr-adm2", followUp: 0, interview: [-5, "15:00"], ageDays: 19 },
    { stage: "selected", course: "crs-fsw", owner: "usr-adm2", interview: [-7, "12:00"], ageDays: 22 },
    { stage: "rejected", owner: "usr-adm1", interview: [-10, "11:00"], ageDays: 25 },
    { stage: "rejected", owner: "usr-adm2", ageDays: 30 },
    { stage: "rejected", owner: "usr-adm1", interview: [-14, "15:00"], ageDays: 28 },
    { stage: "rejected", owner: "usr-adm2", ageDays: 35 },
    { name: "Aditya Joshi", stage: "enrolled", course: "crs-fsw", source: "Referral", owner: "usr-adm2", studentName: "Aditya Joshi", ageDays: 80 },
    { name: "Neha Kulkarni", stage: "enrolled", course: "crs-fsw", source: "Instagram", owner: "usr-adm1", studentName: "Neha Kulkarni", ageDays: 25 },
    { name: "Sneha Iyer", stage: "enrolled", course: "crs-dap", source: "Website", owner: "usr-adm1", studentName: "Sneha Iyer", ageDays: 30 },
  ];
  // A few more enrolled leads drawn from the upcoming batches.
  const upcomingStudents = enrolments.filter((e) => e.batchId === "bat-fsw-08" || e.batchId === "bat-dap-04").slice(1, 9).map((e) => students.find((s) => s.id === e.studentId)!);
  for (const s of upcomingStudents) if (s.name !== "Sneha Iyer" && s.name !== "Neha Kulkarni") leadPlans.push({ name: s.name, stage: "enrolled", owner: pick(owners), studentName: s.name, ageDays: 20 + rand() * 30 });

  const REJECT = ["Prefers a weekend batch", "Fee outside budget this year", "Chose a college programme instead", "Not reachable after three attempts"];
  for (const lp of leadPlans) {
    const student = lp.studentName ? students.find((s) => s.name === lp.studentName) : undefined;
    let name = lp.name;
    while (!name || (usedNames.has(name) && !student)) name = `${pick(FIRST)} ${pick(LAST)}`;
    if (!student) usedNames.add(name);
    const enrolment = student ? enrolments.find((e) => e.studentId === student.id) : undefined;
    const batch = enrolment ? batches.find((b) => b.id === enrolment.batchId) : undefined;
    const courseId = batch?.courseId || lp.course || pick(courseIds);
    const owner = lp.owner === null ? undefined : lp.owner || pick(owners);
    const created = nowMs - (lp.ageDays ?? 5) * DAY;
    const by = ownerName(owner);
    const activity: LeadActivity[] = [act(created, "Website form", "stage", "Lead created")];
    const stagesPassed: LeadStage[] = ["contacted", "interview-scheduled", "interviewed", "selected", "enrolled"];
    const reached = lp.stage === "rejected" ? (lp.interview ? 3 : 1) : stagesPassed.indexOf(lp.stage) + 1;
    let t = created;
    for (let i = 0; i < reached; i++) {
      t += (0.3 + rand()) * DAY * 0.8;
      if (t > nowMs) t = nowMs - 3600000;
      const st = stagesPassed[i];
      if (st === "contacted") activity.unshift(act(t, by, "call", pick(["Called; interested in evening batches.", "Spoke for 10 minutes; wants syllabus and fee details on WhatsApp.", "Callback requested after 6 PM.", "Discussed EMI options; sending details."])));
      activity.unshift(act(t, by, "stage", `Moved to ${st === "interview-scheduled" ? "Interview scheduled" : st[0].toUpperCase() + st.slice(1)}`));
      if (st === "enrolled" && batch) activity.unshift(act(t, by, "enrolment", `Enrolled in ${batch.name}`));
    }
    if (lp.stage === "rejected") activity.unshift(act(Math.min(nowMs - 3600000, t + DAY), by, "stage", `Moved to Rejected: ${pick(REJECT)}`));
    if (lp.followUp !== undefined) activity.unshift(act(Math.min(nowMs - 1800000, t + 3600000), by, "follow-up", `Follow-up set for ${addDays(today, lp.followUp)}`));
    leads.push({
      id: `lead-${String(leads.length + 1).padStart(3, "0")}`,
      name,
      email: student?.email || `${name.toLowerCase().replace(/[^a-z ]/g, "").replace(" ", ".")}@example.in`,
      phone: student?.phone || phone(),
      city: student?.city || pick(CITIES),
      courseId,
      source: lp.source || pick(sources),
      stage: lp.stage,
      ownerId: owner,
      interviewAt: lp.interview ? interviewSlot(lp.interview[0], lp.interview[1]) : undefined,
      followUpOn: lp.followUp !== undefined ? addDays(today, lp.followUp) : undefined,
      createdAt: iso(created),
      updatedAt: activity[0].at,
      activity,
      studentId: student?.id,
      batchId: batch?.id,
      rejectionReason: lp.stage === "rejected" ? activity[0].text.replace("Moved to Rejected: ", "") : undefined,
    });
    if (student) student.leadId = leads[leads.length - 1].id;
  }

  /* ---------------- materials ---------------- */
  const m = (id: string, courseId: string, moduleId: string, title: string, kind: Material["kind"], extra: Partial<Material>): Material => ({
    id,
    courseId,
    moduleId,
    title,
    kind,
    updatedAt: iso(nowMs - Math.floor(rand() * 40) * DAY),
    ...extra,
  });
  const materials: Material[] = [
    m("mat-fsw-1", "crs-fsw", "fsw-m1", "Semantic HTML cheat sheet", "pdf", { fileName: "semantic-html-cheatsheet.pdf", sizeKb: 412 }),
    m("mat-fsw-2", "crs-fsw", "fsw-m1", "Flexbox and Grid: layout recipes", "notes", {
      body: "Use Flexbox for one direction at a time: a row of buttons, a toolbar, a card's header.\n\nUse Grid when you need rows and columns together: page layouts, galleries, dashboards.\n\nRecipe 1: centre anything. On the parent: display: grid; place-items: center.\n\nRecipe 2: a sidebar layout. grid-template-columns: 248px 1fr; collapse the first column under 768px.\n\nRecipe 3: responsive cards. grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px.",
    }),
    m("mat-fsw-3", "crs-fsw", "fsw-m2", "React components: slides", "slides", { fileName: "react-components.pdf", sizeKb: 2310 }),
    m("mat-fsw-4", "crs-fsw", "fsw-m2", "React documentation: Thinking in React", "link", { url: "https://react.dev/learn/thinking-in-react" }),
    m("mat-fsw-5", "crs-fsw", "fsw-m3", "REST APIs with Express: lecture notes", "notes", {
      body: "A REST API exposes resources at URLs and uses HTTP methods to act on them.\n\nGET /batches lists batches. GET /batches/:id reads one. POST /batches creates. PATCH /batches/:id updates part of one. DELETE removes.\n\nIn Express, a router groups related routes: const router = express.Router(); router.get('/', listBatches); app.use('/batches', router).\n\nReturn the right status codes: 200 for reads, 201 with the new resource for creates, 400 for validation errors with a message that says how to fix them, 404 when the resource doesn't exist.\n\nHomework: build GET and POST for /students with in-memory storage, then add validation for email and phone.",
    }),
    m("mat-fsw-6", "crs-fsw", "fsw-m3", "Express starter repository", "link", { url: "https://github.com/expressjs/express" }),
    m("mat-fsw-7", "crs-fsw", "fsw-m3", "Auth & sessions: pre-read", "notes", {
      body: "Before the next lecture, read about the difference between authentication (who you are) and authorisation (what you can do).\n\nWe'll compare session cookies with token-based auth, store passwords with a slow hash such as bcrypt or argon2, and protect routes with middleware that checks the user's role on the server.",
    }),
    m("mat-dap-1", "crs-dap", "dap-m1", "Pandas quick reference", "pdf", { fileName: "pandas-quick-reference.pdf", sizeKb: 688 }),
    m("mat-dap-2", "crs-dap", "dap-m1", "Data cleaning lab notebook", "link", { url: "https://pandas.pydata.org/docs/user_guide/missing_data.html" }),
    m("mat-dap-3", "crs-dap", "dap-m2", "SQL joins explained", "notes", {
      body: "INNER JOIN keeps rows that match in both tables.\n\nLEFT JOIN keeps every row from the left table and fills missing matches with NULL.\n\nWindow functions such as ROW_NUMBER() OVER (PARTITION BY batch ORDER BY score DESC) rank rows within groups without collapsing them.",
    }),
    m("mat-uxd-1", "crs-uxd", "uxd-m1", "Interview guide template", "pdf", { fileName: "interview-guide.pdf", sizeKb: 220 }),
  ];

  const settings = {
    orgName: "Batch LMS",
    defaultTimeZone: tz,
    joinOpensMinutesBefore: 0,
    autoPublishRecordings: false,
    linkReminderHours: 24,
    supportEmail: "support@example.in",
  };

  return { version: SEED_VERSION, meId: "usr-admin", users, courses, materials, batches, lectures, recordings, leads, students, enrolments, attendance, settings };
}
