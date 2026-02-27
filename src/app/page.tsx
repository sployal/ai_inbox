"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Section = "dashboard" | "calendar" | "accounts" | "summaries";

interface EmailAccount {
  id: string;
  email: string;
  name: string;
  avatar: string;
  color: string;
  tracking: boolean;
  unread: number;
  provider: "gmail";
}

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  type: "meeting" | "deadline" | "summary";
  account: string;
  link?: string;
  color: string;
}

interface DayData {
  [day: number]: CalendarEvent[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const ACCOUNTS: EmailAccount[] = [
  { id: "1", email: "alex@gmail.com", name: "Alex M.", avatar: "AM", color: "#34d399", tracking: true, unread: 12, provider: "gmail" },
  { id: "2", email: "work.alex@gmail.com", name: "Work", avatar: "WK", color: "#60a5fa", tracking: true, unread: 47, provider: "gmail" },
  { id: "3", email: "newsletter@gmail.com", name: "Newsletters", avatar: "NL", color: "#f472b6", tracking: false, unread: 203, provider: "gmail" },
];

const CALENDAR_DATA: DayData = {
  3:  [{ id:"e1", title:"Q1 Review", time:"10:00 AM", type:"meeting", account:"work.alex@gmail.com", link:"https://meet.google.com/abc", color:"#60a5fa" }],
  7:  [{ id:"e2", title:"Weekly Summary", time:"All day", type:"summary", account:"alex@gmail.com", color:"#34d399" }],
  11: [{ id:"e3", title:"Design Sync", time:"2:00 PM", type:"meeting", account:"work.alex@gmail.com", link:"https://zoom.us/j/123", color:"#60a5fa" }, { id:"e4", title:"Project Deadline", time:"5:00 PM", type:"deadline", account:"work.alex@gmail.com", color:"#f87171" }],
  14: [{ id:"e5", title:"Weekly Summary", time:"All day", type:"summary", account:"alex@gmail.com", color:"#34d399" }],
  18: [{ id:"e6", title:"1:1 with Manager", time:"11:00 AM", type:"meeting", account:"work.alex@gmail.com", link:"https://meet.google.com/xyz", color:"#60a5fa" }],
  21: [{ id:"e7", title:"Weekly Summary", time:"All day", type:"summary", account:"alex@gmail.com", color:"#34d399" }],
  25: [{ id:"e8", title:"Product Demo", time:"3:00 PM", type:"meeting", account:"work.alex@gmail.com", link:"https://zoom.us/j/456", color:"#60a5fa" }],
  28: [{ id:"e9", title:"Weekly Summary", time:"All day", type:"summary", account:"alex@gmail.com", color:"#34d399" }],
};

const DAILY_SUMMARY = `Your inbox across 2 accounts saw moderate activity today. **work.alex@gmail.com** received 14 new messages — 3 flagged as high-priority including a follow-up from the design team and a billing alert. **alex@gmail.com** had 5 messages, mostly personal correspondence. 

AI detected **2 upcoming meeting links** auto-scheduled to your calendar: a Zoom call at 2:00 PM and a Google Meet at 4:30 PM.`;

const WEEKLY_SUMMARY = `This week you received **183 emails** across all tracked accounts. Key themes: product roadmap discussions (28 emails), client communications (41 emails), and automated reports (67 emails). 

Notable: Response time averaged **3.2 hours**. 5 meetings were auto-detected and added to your calendar. 3 newsletters were received but account is paused.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlowOrb({ className }: { className: string }) {
  return <div className={`absolute rounded-full blur-3xl opacity-20 pointer-events-none ${className}`} />;
}

function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group
        ${active
          ? "bg-white/10 text-white shadow-lg shadow-black/20"
          : "text-white/40 hover:text-white/80 hover:bg-white/5"
        }`}
    >
      <span className={`text-lg transition-transform duration-200 group-hover:scale-110 ${active ? "scale-110" : ""}`}>{icon}</span>
      <span className="tracking-wide">{label}</span>
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />}
    </button>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 p-5 backdrop-blur-sm hover:bg-white/8 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl">
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10`} style={{ background: color }} />
      <p className="text-xs text-white/40 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>{value}</p>
      <p className="text-xs text-white/50">{sub}</p>
    </div>
  );
}

// ─── Main Sections ─────────────────────────────────────────────────────────────

function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-[0.3em] mb-1">Friday, February 27</p>
        <h1 className="text-4xl font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
          Good morning, Alex.
        </h1>
        <p className="text-white/50 mt-1 text-sm">Here's what happened across your inboxes today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Emails Today" value="31" sub="↑ 8 from yesterday" color="#34d399" />
        <StatCard label="Unread" value="59" sub="Across 2 accounts" color="#60a5fa" />
        <StatCard label="Meetings" value="2" sub="Auto-scheduled" color="#a78bfa" />
        <StatCard label="Tracked Accounts" value="2/3" sub="1 paused" color="#f472b6" />
      </div>

      {/* Daily AI Summary */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-sm">✦</div>
          <div>
            <p className="text-sm font-semibold text-emerald-400" style={{ fontFamily: "'Syne', sans-serif" }}>AI Daily Summary</p>
            <p className="text-xs text-white/30">Generated by Groq · Just now</p>
          </div>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Today</span>
        </div>
        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{DAILY_SUMMARY}</p>
      </div>

      {/* Weekly Summary */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/5 border border-violet-500/20 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm">◈</div>
          <div>
            <p className="text-sm font-semibold text-violet-400" style={{ fontFamily: "'Syne', sans-serif" }}>AI Weekly Digest</p>
            <p className="text-xs text-white/30">Feb 21 – Feb 27</p>
          </div>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">This Week</span>
        </div>
        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{WEEKLY_SUMMARY}</p>
      </div>

      {/* Recent Meetings Detected */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Auto-Detected Meetings</p>
        <div className="space-y-2">
          {[
            { title: "Design Sync", time: "Today · 2:00 PM", via: "Zoom", account: "work.alex@gmail.com", color: "#60a5fa" },
            { title: "Q1 Review Follow-up", time: "Tomorrow · 10:00 AM", via: "Google Meet", account: "work.alex@gmail.com", color: "#60a5fa" },
          ].map((m, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all duration-200">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">{m.title}</p>
                <p className="text-xs text-white/40">{m.time} · via {m.via}</p>
              </div>
              <p className="text-xs text-white/30 hidden sm:block truncate max-w-[140px]">{m.account}</p>
              <button className="text-xs px-3 py-1 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all">Join</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarSection() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => (i < firstDay ? null : i - firstDay + 1));

  const selectedEvents = selectedDay ? (CALENDAR_DATA[selectedDay] || []) : [];

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-white/40 uppercase tracking-[0.3em] mb-1">Schedule</p>
        <h2 className="text-4xl font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>Calendar</h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="xl:col-span-2 rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm">
          {/* Month Nav */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all flex items-center justify-center">‹</button>
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>{MONTHS[month]} {year}</h3>
            <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all flex items-center justify-center">›</button>
          </div>

          {/* Day Labels */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs text-white/30 uppercase tracking-widest py-1">{d}</div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const events = CALENDAR_DATA[day] || [];
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = day === selectedDay;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  className={`relative aspect-square rounded-xl flex flex-col items-center justify-start pt-1.5 text-xs transition-all duration-150 hover:bg-white/10
                    ${isSelected ? "bg-white/15 ring-1 ring-white/30" : ""}
                    ${isToday && !isSelected ? "ring-1 ring-emerald-500/60" : ""}
                  `}
                >
                  <span className={`font-medium ${isToday ? "text-emerald-400" : isSelected ? "text-white" : "text-white/60"}`}>
                    {day}
                  </span>
                  {events.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {events.slice(0, 3).map((ev, ei) => (
                        <span key={ei} className="w-1 h-1 rounded-full" style={{ background: ev.color }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day Detail Panel */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-4">
            {selectedDay ? `${MONTHS[month]} ${selectedDay}` : "Select a day"}
          </p>
          {selectedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <span className="text-3xl mb-2 opacity-30">◌</span>
              <p className="text-sm text-white/30">No events this day</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map(ev => (
                <div key={ev.id} className="rounded-xl p-4 border border-white/10" style={{ background: `${ev.color}10` }}>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: ev.color, boxShadow: `0 0 8px ${ev.color}` }} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{ev.title}</p>
                      <p className="text-xs text-white/40 mt-0.5">{ev.time}</p>
                      <p className="text-xs mt-1" style={{ color: ev.color }}>{ev.account}</p>
                      {ev.link && (
                        <a href={ev.link} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs mt-2 px-2 py-0.5 rounded-lg border transition-all hover:opacity-80"
                          style={{ borderColor: `${ev.color}40`, color: ev.color }}>
                          ↗ Join Meeting
                        </a>
                      )}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/40 capitalize">{ev.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
            <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Legend</p>
            {[
              { label: "Meeting", color: "#60a5fa" },
              { label: "Deadline", color: "#f87171" },
              { label: "Summary", color: "#34d399" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                <span className="text-xs text-white/40">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountsSection() {
  const [accounts, setAccounts] = useState(ACCOUNTS);

  function toggleTracking(id: string) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, tracking: !a.tracking } : a));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-white/40 uppercase tracking-[0.3em] mb-1">Connected</p>
        <h2 className="text-4xl font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>Accounts</h2>
      </div>

      {/* Add Account */}
      <button className="w-full flex items-center gap-4 p-4 rounded-2xl border border-dashed border-white/20 text-white/40 hover:border-white/40 hover:text-white/60 transition-all duration-200 group">
        <div className="w-10 h-10 rounded-xl border border-dashed border-white/20 flex items-center justify-center text-lg group-hover:border-white/40 transition-all">+</div>
        <div className="text-left">
          <p className="text-sm font-medium">Connect Gmail Account</p>
          <p className="text-xs text-white/30">Sign in with Google OAuth</p>
        </div>
      </button>

      {/* Account Cards */}
      <div className="space-y-4">
        {accounts.map(account => (
          <div key={account.id}
            className={`rounded-2xl border p-5 backdrop-blur-sm transition-all duration-300 ${account.tracking ? "bg-white/5 border-white/10" : "bg-white/2 border-white/5 opacity-60"}`}>
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-black flex-shrink-0"
                style={{ background: account.color }}>
                {account.avatar}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{account.name}</p>
                <p className="text-xs text-white/40 truncate">{account.email}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                    {account.unread} unread
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${account.tracking ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/30"}`}>
                    {account.tracking ? "● Tracking" : "○ Paused"}
                  </span>
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggleTracking(account.id)}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${account.tracking ? "bg-emerald-500" : "bg-white/20"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-300 ${account.tracking ? "left-6" : "left-0.5"}`} />
              </button>
            </div>

            {account.tracking && (
              <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-3">
                {[
                  { label: "Daily Summary", value: "8:00 AM" },
                  { label: "Weekly Digest", value: "Sunday" },
                  { label: "Auto-Schedule", value: "On" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-xs text-white/30 mb-0.5">{s.label}</p>
                    <p className="text-xs font-medium" style={{ color: account.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummariesSection() {
  const [tab, setTab] = useState<"daily" | "weekly">("daily");

  const dailyItems = [
    { date: "Feb 27", account: "work.alex@gmail.com", count: 14, color: "#60a5fa", preview: "Follow-up from design team, billing alert, 3 high-priority items flagged." },
    { date: "Feb 27", account: "alex@gmail.com", count: 5, color: "#34d399", preview: "Personal correspondence, one invitation, a reply from a friend." },
    { date: "Feb 26", account: "work.alex@gmail.com", count: 9, color: "#60a5fa", preview: "Sprint planning notes, standup reminders, 1 Zoom link auto-scheduled." },
    { date: "Feb 26", account: "alex@gmail.com", count: 3, color: "#34d399", preview: "Newsletter, bank statement notification, family group reply." },
  ];

  const weeklyItems = [
    { week: "Feb 21 – 27", account: "work.alex@gmail.com", count: 98, color: "#60a5fa", highlights: ["5 meetings scheduled", "12 high-priority threads", "3 pending replies"] },
    { week: "Feb 21 – 27", account: "alex@gmail.com", count: 31, color: "#34d399", highlights: ["2 events detected", "1 subscription renewed", "4 personal threads"] },
    { week: "Feb 14 – 20", account: "work.alex@gmail.com", count: 112, color: "#60a5fa", highlights: ["7 meetings scheduled", "Avg response: 2.8h", "Product demo thread"] },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-white/40 uppercase tracking-[0.3em] mb-1">AI-Generated</p>
        <h2 className="text-4xl font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>Summaries</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        {(["daily", "weekly"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-200 ${tab === t ? "bg-white/15 text-white" : "text-white/40 hover:text-white/60"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "daily" ? (
        <div className="space-y-3">
          {dailyItems.map((item, i) => (
            <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-5 hover:bg-white/8 transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: item.color }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium" style={{ color: item.color }}>{item.account}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/30">{item.date}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">{item.count} emails</span>
                    </div>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{item.preview}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {weeklyItems.map((item, i) => (
            <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-5 hover:bg-white/8 transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: item.color }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium" style={{ color: item.color }}>{item.account}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/30">{item.week}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">{item.count} emails</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.highlights.map((h, hi) => (
                      <span key={hi} className="text-xs px-2 py-1 rounded-lg border border-white/10 text-white/50">{h}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Root Page ─────────────────────────────────────────────────────────────────
export default function Page() {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");

  const sections: { id: Section; icon: string; label: string }[] = [
    { id: "dashboard", icon: "◈", label: "Dashboard" },
    { id: "calendar", icon: "◫", label: "Calendar" },
    { id: "summaries", icon: "✦", label: "Summaries" },
    { id: "accounts", icon: "◉", label: "Accounts" },
  ];

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .shimmer { background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%); background-size: 200% 100%; animation: shimmer 3s infinite; }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      <div className="min-h-screen bg-[#080c12] flex overflow-hidden">
        {/* Ambient Orbs */}
        <GlowOrb className="w-96 h-96 bg-emerald-500 -top-20 -left-20" />
        <GlowOrb className="w-80 h-80 bg-violet-600 top-1/2 -right-20" />
        <GlowOrb className="w-64 h-64 bg-blue-500 bottom-10 left-1/3" />

        {/* Sidebar */}
        <aside className="relative z-10 w-64 flex-shrink-0 flex flex-col border-r border-white/5 bg-white/2 backdrop-blur-xl p-5">
          {/* Logo */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black font-bold text-sm">✉</div>
              <div>
                <p className="text-sm font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>InboxAI</p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest">Powered by Groq</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-1 flex-1">
            {sections.map(s => (
              <NavItem key={s.id} icon={s.icon} label={s.label} active={activeSection === s.id} onClick={() => setActiveSection(s.id)} />
            ))}
          </nav>

          {/* Account Pills */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            <p className="text-[10px] text-white/20 uppercase tracking-widest px-1 mb-2">Active Accounts</p>
            {ACCOUNTS.filter(a => a.tracking).map(a => (
              <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer">
                <div className="w-6 h-6 rounded-lg text-[10px] font-bold text-black flex items-center justify-center flex-shrink-0" style={{ background: a.color }}>
                  {a.avatar}
                </div>
                <p className="text-xs text-white/40 truncate">{a.email}</p>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-4xl mx-auto p-8 lg:p-10">
            {activeSection === "dashboard" && <Dashboard />}
            {activeSection === "calendar" && <CalendarSection />}
            {activeSection === "summaries" && <SummariesSection />}
            {activeSection === "accounts" && <AccountsSection />}
          </div>
        </main>
      </div>
    </>
  );
}
