"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthUser { id: string; email: string; name?: string; avatar?: string; }

interface ConnectedAccount {
  id: string;
  gmail_address: string;
  display_name: string | null;
  avatar_initials: string;
  color: string;
  is_tracking: boolean;
  total_unread: number;
  storage_used_pct: number;
  last_synced_at: string | null;
  last_sync_status: string;
  token_expires_at: string;
  ai_settings: Record<string, boolean | string | number>;
}

interface Email {
  id: string;
  connected_account_id: string;
  gmail_message_id: string;
  subject: string | null;
  sender_email: string | null;
  sender_name: string | null;
  received_at: string;
  snippet: string | null;
  is_unread: boolean;
  is_starred: boolean;
  ai_priority: "high" | "medium" | "low" | "none" | null;
  ai_category: string | null;
  ai_sentiment: string | null;
  ai_requires_action: boolean;
  ai_meeting_detected: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  meeting_link: string | null;
  meeting_platform: string | null;
  organizer_email: string | null;
  status: string;
  color: string | null;
  connected_account_id: string;
}

interface Summary {
  id: string;
  connected_account_id: string;
  summary_type: "daily" | "weekly";
  period_start: string;
  period_end: string;
  summary_text: string;
  sentiment: string | null;
  action_required: boolean;
  action_items: string[] | null;
  email_count: number;
  high_priority_count: number;
  meetings_detected: number;
  model_used: string;
  created_at: string;
}

interface DashboardStats {
  totalUnread: number;
  trackedAccounts: number;
  totalAccounts: number;
  emailsToday: number;
  meetingsThisWeek: number;
  highPriorityUnread: number;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

// ─── Accent palette ───────────────────────────────────────────────────────────
const C = {
  green:  "#059669",
  cyan:   "#0284c7",
  purple: "#7c3aed",
  pink:   "#db2777",
  amber:  "#d97706",
  red:    "#dc2626",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const getFirstDay    = (y: number, m: number) => new Date(y, m, 1).getDay();

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return "Just now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function priorityColor(p: string | null): string {
  if (p === "high")   return C.red;
  if (p === "medium") return C.amber;
  return C.green;
}

function greetingTime(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,400;1,700&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:#f0f4f9; color:#1e2535; font-family:'Space Grotesk',sans-serif; }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:4px; }
  .fd { font-family:'Playfair Display',serif; }
  .fm { font-family:'JetBrains Mono',monospace; }

  @keyframes fadeUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulseRing { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(2.2);opacity:0} }
  @keyframes drift     { 0%,100%{transform:translate(0,0)} 50%{transform:translate(22px,-16px)} }
  @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

  .fu { animation:fadeUp .45s ease both; }
  .d1{animation-delay:.07s} .d2{animation-delay:.14s} .d3{animation-delay:.21s} .d4{animation-delay:.28s} .d5{animation-delay:.35s}

  .orb { position:fixed;border-radius:50%;pointer-events:none;z-index:0; }
  .orb1 { width:700px;height:700px;top:-300px;left:-180px;background:radial-gradient(circle,rgba(5,150,105,.1) 0%,transparent 68%);animation:drift 22s ease-in-out infinite; }
  .orb2 { width:550px;height:550px;bottom:-100px;right:-120px;background:radial-gradient(circle,rgba(124,58,237,.08) 0%,transparent 68%);animation:drift 28s ease-in-out infinite reverse; }
  .orb3 { width:380px;height:380px;top:38%;left:44%;background:radial-gradient(circle,rgba(2,132,199,.07) 0%,transparent 68%);animation:drift 19s ease-in-out infinite;animation-delay:-7s; }

  .glass  { background:#ffffff; border:1px solid #e2e8f0; }
  .inset  { box-shadow:0 1px 3px rgba(0,0,0,.05),0 4px 20px rgba(0,0,0,.06); }
  .ghover { transition:background .2s,transform .2s,box-shadow .2s; }
  .ghover:hover { background:#f8fafc!important;transform:translateY(-1px);box-shadow:0 6px 24px rgba(0,0,0,.09)!important; }
  .divider { height:1px;background:#e2e8f0; }
  .skel { background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:shimmer 1.4s ease infinite;border-radius:8px; }

  .tag {
    display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:6px;
    font-size:10px;letter-spacing:.06em;text-transform:uppercase;
    font-family:'JetBrains Mono',monospace;font-weight:600;
  }
  .progress-bar  { height:3px;background:#e2e8f0;border-radius:3px;overflow:hidden; }
  .progress-fill { height:100%;border-radius:3px;transition:width 1.2s ease; }
  .toggle { width:44px;height:24px;border-radius:12px;position:relative;cursor:pointer;transition:background .3s;flex-shrink:0;border:none; }
  .knob   { position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .3s cubic-bezier(.34,1.56,.64,1);box-shadow:0 1px 5px rgba(0,0,0,.22); }
  .sparkline { display:flex;align-items:flex-end;gap:2px;height:32px; }
  .sbar  { width:4px;min-height:4px;border-radius:2px 2px 0 0; }
  .live::before { content:'';position:absolute;inset:-3px;border-radius:50%;background:inherit;animation:pulseRing 2s ease-out infinite; }
  .spin { animation:spin .8s linear infinite; }

  .sidebar-light {
    background:linear-gradient(160deg,#0f766e 0%,#059669 45%,#0284c7 100%);
    border-right:none;
    box-shadow:4px 0 28px rgba(5,150,105,.25);
    transition:width .28s cubic-bezier(.4,0,.2,1);
    overflow:hidden;
  }
  .sb-label { transition:opacity .2s,max-width .25s; white-space:nowrap; overflow:hidden; }
  .sb-collapsed .sb-label { opacity:0; max-width:0; }
  .collapse-btn {
    width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,.35);
    background:rgba(255,255,255,.18);color:#fff;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    font-size:14px;transition:background .2s;flex-shrink:0;line-height:1;
  }
  .collapse-btn:hover { background:rgba(255,255,255,.32); }
  .nav-btn {
    display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:10px;cursor:pointer;
    font-size:13px;font-weight:500;transition:all .2s;border:1px solid transparent;background:transparent;
    color:rgba(255,255,255,.65);text-align:left;font-family:'Space Grotesk',sans-serif;
  }
  .nav-btn:hover { color:#fff;background:rgba(255,255,255,.15); }
  .nav-active    { background:rgba(255,255,255,.22)!important;border-color:rgba(255,255,255,.35)!important;color:#fff!important; }
  .trrow td      { transition:background .15s; }
  .trrow:hover td{ background:#f8fafc; }
  .cal-grid { display:grid; grid-template-columns:1fr 290px; gap:20px; align-items:start; }
  .bottom-nav {
    display:none;position:fixed;bottom:0;left:0;right:0;z-index:100;
    background:rgba(255,255,255,.97);border-top:1px solid #e2e8f0;
    backdrop-filter:blur(20px);padding:6px 0 max(8px,env(safe-area-inset-bottom));
  }
  .bnav-item {
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:3px;flex:1;padding:4px 0;cursor:pointer;border:none;background:transparent;
    color:#94a3b8;font-family:'Space Grotesk',sans-serif;
    font-size:10px;font-weight:500;transition:color .2s;letter-spacing:.02em;
  }
  .bnav-item.active { color:#059669; }
  .bnav-icon { font-size:19px;line-height:1; }

  @media (max-width:768px) {
    .sidebar     { display:none!important; }
    .bottom-nav  { display:flex!important; }
    .main-offset { padding-left:0!important; }
    .main-pad    { padding:24px 18px 88px!important; }
    .col2        { grid-template-columns:1fr!important; }
    .stats-grid  { grid-template-columns:repeat(2,1fr)!important; }
    .col3        { grid-template-columns:1fr 1fr!important; }
    .hide-mob    { display:none!important; }
    .title-lg    { font-size:34px!important; }
    .cal-grid    { grid-template-columns:1fr!important; }
  }
  @media (max-width:460px) {
    .stats-grid  { grid-template-columns:1fr 1fr!important; }
  }
`;

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ display:"flex",flexDirection:"column",gap:30 }}>{children}</div>;
}
function PageHead({ title }: { title: string }) {
  return (
    <div className="fu">
      <h2 className="fd title-lg" style={{ fontSize:44,color:"#1e2535",fontWeight:700,lineHeight:1.05 }}>{title}</h2>
    </div>
  );
}
function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className="tag" style={{ background:`${color}18`,color,border:`1px solid ${color}40` }}>{children}</span>;
}
function Skel({ w, h }: { w: string | number; h: number }) {
  return <div className="skel" style={{ width:w, height:h }}/>;
}
function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{ textAlign:"center",padding:"48px 0" }}>
      <p style={{ fontSize:36,marginBottom:12,opacity:.2 }}>{icon}</p>
      <p style={{ fontSize:14,color:"#64748b",fontWeight:500 }}>{title}</p>
      <p style={{ fontSize:12,color:"#cbd5e1",marginTop:4 }}>{sub}</p>
    </div>
  );
}

// Toast notification
function Toast({ msg, color, onClose }: { msg: string; color: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  const isGood = color === C.green;
  return (
    <div style={{
      position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
      zIndex:9999,padding:"12px 20px",borderRadius:12,
      background:isGood?"#f0fdf8":"#fef2f2",
      border:`1px solid ${color}40`,boxShadow:"0 8px 32px rgba(0,0,0,.12)",
      display:"flex",alignItems:"center",gap:10,
      fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:500,
      color,whiteSpace:"nowrap",animation:"fadeUp .3s ease both",
    }}>
      {msg}
      <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color,fontSize:16,lineHeight:1,padding:0,marginLeft:4 }}>×</button>
    </div>
  );
}

function LiveClock() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  useEffect(() => {
    setMounted(true);
    const fmt = () => new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    setTime(fmt());
    const t = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="fm" style={{ fontSize:26,color:"#1e2535",letterSpacing:"-.02em",minWidth:160,textAlign:"right" }}>
      {mounted ? time : "──:──:── ──"}
    </p>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ user, accounts }: { user: AuthUser | null; accounts: ConnectedAccount[] }) {
  const [stats,    setStats]    = useState<DashboardStats | null>(null);
  const [emails,   setEmails]   = useState<Email[]>([]);
  const [events,   setEvents]   = useState<CalendarEvent[]>([]);
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [genning,  setGenning]  = useState(false);
  const spark = [14,22,18,31,27,9,35,28,19,42,38,31,27,45];

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Dashboard stats via RPC
      const { data: st } = await supabase.rpc("get_dashboard_stats", { p_user_id: user.id });
      if (st) setStats(st as DashboardStats);

      // High priority unread emails
      const accountIds = accounts.map(a => a.id);
      if (accountIds.length > 0) {
        const { data: em } = await supabase
          .from("emails")
          .select("*")
          .in("connected_account_id", accountIds)
          .in("ai_priority", ["high","medium"])
          .eq("is_unread", true)
          .order("received_at", { ascending: false })
          .limit(6);
        if (em) setEmails(em as Email[]);
      }

      // Today's calendar events
      const today = new Date().toISOString().split("T")[0];
      const { data: ev } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .eq("event_date", today)
        .eq("status", "scheduled")
        .order("start_time");
      if (ev) setEvents(ev as CalendarEvent[]);

      // Latest daily summary across any account
      if (accountIds.length > 0) {
        const { data: sm } = await supabase
          .from("summaries")
          .select("*")
          .in("connected_account_id", accountIds)
          .eq("summary_type", "daily")
          .order("period_start", { ascending: false })
          .limit(1)
          .single();
        if (sm) setSummary(sm as Summary);
      }
    } finally {
      setLoading(false);
    }
  }, [user, accounts]);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time: new emails
  useEffect(() => {
    if (!accounts.length) return;
    const ids = accounts.map(a => a.id);
    const channel = supabase.channel("dash-realtime")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "emails",
      }, (payload) => {
        const email = payload.new as Email;
        if (ids.includes(email.connected_account_id)) {
          setEmails(prev => [email, ...prev].slice(0, 6));
          setStats(prev => prev ? { ...prev, emailsToday: prev.emailsToday + 1, totalUnread: prev.totalUnread + (email.is_unread ? 1 : 0) } : prev);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [accounts]);

  // Generate AI daily summary via Groq
  const generateSummary = async () => {
    if (!accounts.length || genning) return;
    setGenning(true);
    try {
      const acct = accounts.find(a => a.is_tracking) ?? accounts[0];
      const today = new Date().toISOString().split("T")[0];
      const { data: recentEmails } = await supabase
        .from("emails")
        .select("subject,sender_email,received_at,snippet,ai_priority,ai_category,ai_sentiment")
        .eq("connected_account_id", acct.id)
        .gte("received_at", today)
        .order("received_at", { ascending: false })
        .limit(30);

      if (!recentEmails?.length) { setGenning(false); return; }

      const prompt = `You are an AI email assistant. Summarize today's inbox activity for ${acct.gmail_address} in 2-3 sentences. Be specific about senders, priorities, and any action items. Return JSON only: { "summary": "...", "actionItems": ["..."], "sentiment": "positive|neutral|negative|mixed" }

Emails today: ${JSON.stringify(recentEmails.map(e => ({ subject: e.subject, from: e.sender_email, time: e.received_at, priority: e.ai_priority, snippet: e.snippet?.slice(0,80) })))}`;

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY ?? ""}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          max_tokens: 400,
          response_format: { type: "json_object" },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        const periodStart = today;
        const periodEnd   = today;

        const { data: newSummary } = await supabase
          .from("summaries")
          .upsert({
            connected_account_id: acct.id,
            summary_type:  "daily",
            period_start:  periodStart,
            period_end:    periodEnd,
            summary_text:  parsed.summary,
            sentiment:     parsed.sentiment,
            action_required: (parsed.actionItems?.length ?? 0) > 0,
            action_items:  parsed.actionItems ?? [],
            email_count:   recentEmails.length,
            model_used:    "llama-3.1-70b-versatile",
          }, { onConflict: "connected_account_id,summary_type,period_start" })
          .select()
          .single();

        if (newSummary) setSummary(newSummary as Summary);
      }
    } catch(e) { console.error("[generateSummary]", e); }
    finally { setGenning(false); }
  };

  const name = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "there";

  return (
    <Section>
      {/* Header */}
      <div className="fu" style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16 }}>
        <div>
          <p className="fm" style={{ fontSize:10,color:C.green,letterSpacing:".2em",marginBottom:10,fontWeight:600 }}>INBOX INTELLIGENCE DASHBOARD</p>
          <h1 className="fd" style={{ fontSize:50,color:"#1e2535",fontWeight:700,lineHeight:1.1 }}>
            {greetingTime()},<br/>
            <span style={{ fontStyle:"italic",color:C.green }}>{name}.</span>
          </h1>
          <p style={{ fontSize:13,color:"#64748b",marginTop:12 }}>
            {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})} · {accounts.filter(a=>a.is_tracking).length} inbox{accounts.filter(a=>a.is_tracking).length!==1?"es":""} active and monitored.
          </p>
        </div>
        <div className="glass inset" style={{ padding:"18px 24px",borderRadius:16,textAlign:"right",background:"linear-gradient(135deg,#f0fdf8,#ecfdf5)",borderColor:`${C.green}30` }}>
          <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".18em",marginBottom:8 }}>SYSTEM CLOCK · LOCAL</p>
          <LiveClock />
          <div style={{ display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end",marginTop:10 }}>
            <span className="live" style={{ position:"relative",width:7,height:7,borderRadius:"50%",background:C.green,display:"inline-block" }}/>
            <span className="fm" style={{ fontSize:9,color:C.green,letterSpacing:".1em",fontWeight:600 }}>GROQ · CONNECTED</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="fu d1 stats-grid" style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(152px,1fr))",gap:14 }}>
        {loading ? Array(5).fill(0).map((_, i) => (
          <div key={i} className="glass inset" style={{ padding:"20px 18px",borderRadius:16 }}><Skel w="60%" h={14}/><Skel w="40%" h={36}/></div>
        )) : [
          { label:"Emails Today",      value: String(stats?.emailsToday ?? 0),           delta:"+today", sub:"across all inboxes", color:C.green,  spark:true  },
          { label:"Total Unread",      value: String(stats?.totalUnread ?? 0),            delta:"",       sub:"unread messages",   color:C.cyan,   spark:false },
          { label:"Meetings Found",    value: String(stats?.meetingsThisWeek ?? 0),       delta:"+week",  sub:"this week",         color:C.purple, spark:false },
          { label:"High Priority",     value: String(stats?.highPriorityUnread ?? 0),     delta:"",       sub:"need attention",    color:C.red,    spark:false },
          { label:"Tracked Accounts",  value: `${stats?.trackedAccounts ?? 0}/${stats?.totalAccounts ?? 0}`, delta:"", sub:"inboxes active", color:C.pink, spark:false },
        ].map((s, i) => (
          <div key={i} className="glass inset ghover" style={{ padding:"20px 18px",borderRadius:16,cursor:"default" }}>
            <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".12em",marginBottom:10 }}>{s.label.toUpperCase()}</p>
            <p className="fd" style={{ fontSize:36,color:"#1e2535",lineHeight:1 }}>{s.value}</p>
            {s.spark && (
              <div className="sparkline" style={{ marginTop:10 }}>
                {spark.map((v, j) => <div key={j} className="sbar" style={{ height:`${(v/45)*100}%`,background:j===spark.length-1?s.color:`${s.color}40` }}/>)}
              </div>
            )}
            <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:s.spark?8:14 }}>
              {s.delta && <span className="fm" style={{ fontSize:11,color:C.green,fontWeight:600 }}>{s.delta}</span>}
              <span style={{ fontSize:11,color:"#94a3b8" }}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* AI Summary + Activity */}
      <div className="fu d2 col2" style={{ display:"grid",gridTemplateColumns:"1fr 300px",gap:20 }}>
        {/* AI Summary */}
        <div className="glass inset" style={{ borderRadius:20,padding:28,borderColor:`${C.green}30`,background:`${C.green}04` }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20 }}>
            <div style={{ width:38,height:38,borderRadius:12,background:`${C.green}18`,border:`1px solid ${C.green}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17 }}>✦</div>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:600,color:C.green,fontSize:13 }}>AI Daily Summary</p>
              <p className="fm" style={{ fontSize:10,color:"#94a3b8",marginTop:2 }}>
                {summary ? `groq/${summary.model_used} · ${fmtTime(summary.created_at)}` : "Not yet generated"}
              </p>
            </div>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              {summary && <Tag color={C.green}>TODAY</Tag>}
              <button onClick={generateSummary} disabled={genning || !accounts.length}
                style={{ fontSize:11,padding:"6px 14px",borderRadius:8,border:`1px solid ${C.green}50`,background:`${C.green}10`,color:C.green,cursor:genning?"not-allowed":"pointer",fontFamily:"Space Grotesk,sans-serif",fontWeight:600,opacity:genning?0.7:1,display:"flex",alignItems:"center",gap:6 }}>
                {genning ? <span className="spin" style={{ display:"inline-block" }}>↻</span> : "↻"} Refresh
              </button>
            </div>
          </div>
          <div className="divider" style={{ marginBottom:20 }}/>
          {loading ? (
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}><Skel w="100%" h={14}/><Skel w="90%" h={14}/><Skel w="75%" h={14}/></div>
          ) : summary ? (
            <>
              <p style={{ fontSize:13.5,color:"#475569",lineHeight:1.78 }}>{summary.summary_text}</p>
              {summary.action_items && summary.action_items.length > 0 && (
                <div style={{ marginTop:20,padding:"14px 16px",borderRadius:12,background:"#f8fafc",border:"1px solid #e2e8f0" }}>
                  <p className="fm" style={{ fontSize:9,color:"#94a3b8",marginBottom:10,letterSpacing:".12em" }}>AI DETECTED ACTIONS</p>
                  {summary.action_items.map((a, i) => (
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:10,marginTop:i>0?8:0 }}>
                      <span style={{ fontSize:13 }}>📌</span>
                      <span style={{ fontSize:12,color:"#475569" }}>{a}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign:"center",padding:"24px 0" }}>
              <p style={{ fontSize:13,color:"#94a3b8" }}>No summary yet — click Refresh to generate one.</p>
              {accounts.length === 0 && <p style={{ fontSize:12,color:"#cbd5e1",marginTop:4 }}>Connect a Gmail account first.</p>}
            </div>
          )}
        </div>

        {/* Live Activity from real emails */}
        <div className="glass inset" style={{ borderRadius:20,padding:22 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
            <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".15em" }}>RECENT EMAILS</p>
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <span className="live" style={{ position:"relative",width:5,height:5,borderRadius:"50%",background:C.green,display:"inline-block" }}/>
              <span className="fm" style={{ fontSize:9,color:C.green }}>LIVE</span>
            </div>
          </div>
          {loading ? Array(5).fill(0).map((_, i) => (
            <div key={i} style={{ display:"flex",gap:10,padding:"8px 0",marginBottom:4 }}>
              <Skel w={26} h={26}/><div style={{ flex:1 }}><Skel w="80%" h={12}/></div>
            </div>
          )) : emails.length === 0 ? (
            <EmptyState icon="📭" title="No emails yet" sub="Emails will appear here after sync"/>
          ) : emails.map((email, i) => {
            const pColor = priorityColor(email.ai_priority);
            return (
              <div key={email.id} style={{ display:"flex",gap:10,padding:"9px 10px 9px 12px",borderRadius:8,borderLeft:`2px solid ${email.ai_priority==="high"?pColor:"transparent"}`,marginBottom:2,transition:"background .2s",cursor:"default" }}
                onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background="#f8fafc"}
                onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background="transparent"}>
                <div style={{ width:26,height:26,borderRadius:7,background:`${pColor}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,color:pColor }}>✉</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <p style={{ fontSize:12,color:"#334155",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{email.subject ?? "(no subject)"}</p>
                  <p className="fm" style={{ fontSize:10,color:"#94a3b8",marginTop:1 }}>{email.sender_name ?? email.sender_email ?? "Unknown"} · {fmtTime(email.received_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's meetings */}
      {events.length > 0 && (
        <div className="fu d3">
          <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".15em",marginBottom:14 }}>TODAY'S MEETINGS</p>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {events.map(ev => {
              const acct = accounts.find(a => a.id === ev.connected_account_id);
              return (
                <div key={ev.id} className="glass inset ghover" style={{ display:"flex",alignItems:"center",gap:16,padding:"16px 20px",borderRadius:14,cursor:"default" }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:ev.color??C.cyan,flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:14,color:"#1e2535",fontWeight:500 }}>{ev.title}</p>
                    <p style={{ fontSize:12,color:"#64748b",marginTop:2 }}>{ev.start_time ?? "All day"} · via {ev.meeting_platform ?? "Calendar"}</p>
                  </div>
                  <p className="fm hide-mob" style={{ fontSize:11,color:"#94a3b8" }}>{acct?.gmail_address}</p>
                  <Tag color={ev.color??C.cyan}>scheduled</Tag>
                  {ev.meeting_link && (
                    <a href={ev.meeting_link} target="_blank" rel="noreferrer"
                      style={{ fontSize:12,padding:"7px 16px",borderRadius:8,border:`1px solid ${ev.color??C.cyan}50`,background:`${ev.color??C.cyan}10`,color:ev.color??C.cyan,textDecoration:"none",fontFamily:"Space Grotesk,sans-serif",fontWeight:600 }}>
                      Join →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* High Priority Threads */}
      <div className="fu d4">
        <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".15em",marginBottom:14 }}>HIGH-PRIORITY THREADS</p>
        {loading ? <Skel w="100%" h={180}/> : emails.filter(e=>e.ai_priority==="high"||e.ai_priority==="medium").length === 0 ? (
          <div className="glass inset" style={{ borderRadius:16,padding:"32px 0" }}>
            <EmptyState icon="✅" title="No high-priority emails" sub="You're all caught up"/>
          </div>
        ) : (
          <div className="glass inset" style={{ borderRadius:16,overflow:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",minWidth:500 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #e2e8f0",background:"#f8fafc" }}>
                  {["Subject","From","Account","Time","Priority",""].map((h,i) => (
                    <th key={i} className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".1em",padding:"12px 16px",textAlign:"left",fontWeight:600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emails.filter(e=>e.ai_priority==="high"||e.ai_priority==="medium").map(row => {
                  const acct = accounts.find(a=>a.id===row.connected_account_id);
                  const pCol = priorityColor(row.ai_priority);
                  return (
                    <tr key={row.id} className="trrow" style={{ borderBottom:"1px solid #f1f5f9",cursor:"default" }}>
                      <td style={{ fontSize:13,color:"#1e2535",padding:"13px 16px",maxWidth:230,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{row.subject ?? "(no subject)"}</td>
                      <td className="fm" style={{ fontSize:11,color:"#64748b",padding:"13px 16px" }}>{row.sender_email ?? "—"}</td>
                      <td className="fm" style={{ fontSize:11,color:"#94a3b8",padding:"13px 16px" }}>{acct?.display_name ?? acct?.gmail_address?.split("@")[0] ?? "—"}</td>
                      <td className="fm" style={{ fontSize:11,color:"#94a3b8",padding:"13px 16px" }}>{fmtTime(row.received_at)}</td>
                      <td style={{ padding:"13px 16px" }}><Tag color={pCol}>{row.ai_priority ?? "—"}</Tag></td>
                      <td style={{ padding:"13px 16px" }}>
                        <button className="fm" style={{ fontSize:10,color:"#94a3b8",background:"none",border:"none",cursor:"pointer",fontWeight:600 }}
                          onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.color=C.cyan}
                          onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.color="#94a3b8"}>VIEW →</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalendarSection({ user, accounts }: { user: AuthUser | null; accounts: ConnectedAccount[] }) {
  const today = new Date();
  const [year,    setYear]    = useState(today.getFullYear());
  const [month,   setMonth]   = useState(today.getMonth());
  const [sel,     setSel]     = useState(today.getDate());
  const [events,  setEvents]  = useState<CalendarEvent[]>([]);
  const [allEvts, setAllEvts] = useState<Record<number, CalendarEvent[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const start = new Date(year, month, 1).toISOString().split("T")[0];
    const end   = new Date(year, month + 1, 0).toISOString().split("T")[0];
    supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", user.id)
      .gte("event_date", start)
      .lte("event_date", end)
      .eq("status", "scheduled")
      .order("start_time")
      .then(({ data }) => {
        if (!data) return;
        const byDay: Record<number, CalendarEvent[]> = {};
        (data as CalendarEvent[]).forEach(ev => {
          const d = new Date(ev.event_date).getDate();
          if (!byDay[d]) byDay[d] = [];
          byDay[d].push(ev);
        });
        setAllEvts(byDay);
        setLoading(false);
      });
  }, [user, year, month]);

  useEffect(() => {
    setEvents(allEvts[sel] ?? []);
  }, [sel, allEvts]);

  const dim   = getDaysInMonth(year, month);
  const fd    = getFirstDay(year, month);
  const cells = Array.from({ length: fd + dim }, (_, i) => i < fd ? null : i - fd + 1);

  function prev() { month===0 ? (setMonth(11),setYear(y=>y-1)) : setMonth(m=>m-1); }
  function next() { month===11? (setMonth(0), setYear(y=>y+1)) : setMonth(m=>m+1); }

  const typeIcon: Record<string,string> = { meeting:"📅", deadline:"🚨", summary:"✦", reminder:"🔔", other:"📌" };
  const typeColor: Record<string,string> = { meeting:C.cyan, deadline:C.red, summary:C.green, reminder:C.amber, other:C.purple };

  return (
    <Section>
      <PageHead title="Calendar" />
      <div className="fu d1 cal-grid">
        {/* Calendar grid */}
        <div style={{ borderRadius:24,overflow:"hidden",boxShadow:"0 8px 40px rgba(5,150,105,.13)" }}>
          <div style={{ background:"linear-gradient(135deg,#0f766e,#059669,#0284c7)",padding:"28px 32px 24px" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <button onClick={prev} style={{ width:38,height:38,borderRadius:12,background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.3)",color:"#fff",cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center" }}>‹</button>
              <div style={{ textAlign:"center" }}>
                <p className="fm" style={{ fontSize:10,color:"rgba(255,255,255,.6)",letterSpacing:".18em",marginBottom:4 }}>{year}</p>
                <p className="fd" style={{ fontSize:32,color:"#fff",fontWeight:700 }}>{MONTHS[month]}</p>
              </div>
              <button onClick={next} style={{ width:38,height:38,borderRadius:12,background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.3)",color:"#fff",cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center" }}>›</button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginTop:24,gap:4 }}>
              {DAYS.map(d => <div key={d} className="fm" style={{ textAlign:"center",fontSize:9,color:"rgba(255,255,255,.55)",letterSpacing:".12em",padding:"4px 0" }}>{d}</div>)}
            </div>
          </div>
          <div style={{ background:"#fff",padding:"16px 20px 24px" }}>
            {loading ? <Skel w="100%" h={240}/> : (
              <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6 }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={i}/>;
                  const evts = allEvts[day] ?? [];
                  const isToday = day===today.getDate()&&month===today.getMonth()&&year===today.getFullYear();
                  const isSel   = day===sel;
                  return (
                    <button key={i} onClick={() => setSel(day)}
                      style={{ aspectRatio:"1",borderRadius:14,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .18s",gap:4,padding:4,border:"none",background:isSel?"linear-gradient(135deg,#059669,#0284c7)":isToday?"#f0fdf8":"transparent",boxShadow:isSel?"0 4px 16px rgba(5,150,105,.35)":"none",outline:isToday&&!isSel?`2px solid ${C.green}`:"none" }}>
                      <span style={{ fontSize:13,fontWeight:isSel||isToday?700:400,color:isSel?"#fff":isToday?C.green:"#475569",lineHeight:1 }}>{day}</span>
                      {evts.length>0 && (
                        <div style={{ display:"flex",gap:3 }}>
                          {evts.slice(0,3).map((ev, ei) => (
                            <span key={ei} style={{ width:5,height:5,borderRadius:"50%",background:isSel?"rgba(255,255,255,.8)":(ev.color??typeColor[ev.event_type]??C.cyan) }}/>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ display:"flex",gap:18,marginTop:20,paddingTop:16,borderTop:"1px solid #f1f5f9",justifyContent:"center" }}>
              {[{label:"Meeting",color:C.cyan},{label:"Deadline",color:C.red},{label:"Summary",color:C.green}].map(l => (
                <div key={l.label} style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <span style={{ width:8,height:8,borderRadius:"50%",background:l.color }}/>
                  <span className="fm" style={{ fontSize:10,color:"#64748b",fontWeight:500 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected date panel */}
        <div style={{ borderRadius:20,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,.07)" }}>
          <div style={{ background:"linear-gradient(135deg,#f0fdf8,#e0f2fe)",padding:"20px 24px",borderBottom:"1px solid #e2e8f0" }}>
            <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".15em",marginBottom:4 }}>SELECTED DATE</p>
            <div style={{ display:"flex",alignItems:"baseline",gap:8 }}>
              <p className="fd" style={{ fontSize:36,color:"#1e2535",fontWeight:700,lineHeight:1 }}>{sel}</p>
              <p className="fd" style={{ fontSize:18,color:"#64748b",fontStyle:"italic" }}>{MONTHS[month]}</p>
            </div>
            <p className="fm" style={{ fontSize:10,color:"#94a3b8",marginTop:4 }}>{events.length} event{events.length!==1?"s":""}</p>
          </div>
          <div style={{ background:"#fff",padding:16 }}>
            {events.length===0 ? (
              <EmptyState icon="📭" title="No events" sub="Enjoy your free day"/>
            ) : events.map(ev => {
              const evColor = ev.color ?? typeColor[ev.event_type] ?? C.cyan;
              return (
                <div key={ev.id} style={{ marginBottom:12,borderRadius:16,overflow:"hidden",border:`1px solid ${evColor}25` }}>
                  <div style={{ height:4,background:`linear-gradient(90deg,${evColor},${evColor}88)` }}/>
                  <div style={{ padding:"14px 16px",background:`${evColor}05` }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
                      <Tag color={evColor}>{ev.event_type}</Tag>
                      <span style={{ fontSize:16 }}>{typeIcon[ev.event_type]}</span>
                    </div>
                    <p style={{ fontSize:14,color:"#1e2535",fontWeight:600 }}>{ev.title}</p>
                    <p className="fm" style={{ fontSize:11,color:"#64748b",marginTop:4 }}>🕐 {ev.start_time ?? "All day"}</p>
                    {ev.organizer_email && <p className="fm" style={{ fontSize:10,color:evColor,marginTop:3,fontWeight:600 }}>{ev.organizer_email}</p>}
                    {ev.meeting_link && (
                      <a href={ev.meeting_link} target="_blank" rel="noreferrer"
                        style={{ display:"inline-flex",alignItems:"center",gap:6,marginTop:12,fontSize:12,color:"#fff",textDecoration:"none",padding:"7px 14px",borderRadius:10,background:`linear-gradient(135deg,${evColor},${evColor}cc)`,fontFamily:"Space Grotesk,sans-serif",fontWeight:600 }}>
                        ↗ Join Meeting
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Accounts ─────────────────────────────────────────────────────────────────
function AccountsSection({ user, accounts, onRefresh }: { user: AuthUser | null; accounts: ConnectedAccount[]; onRefresh: () => void }) {
  const [localAccounts, setLocalAccounts] = useState<ConnectedAccount[]>(accounts);

  useEffect(() => { setLocalAccounts(accounts); }, [accounts]);

  const handleToggle = async (id: string, current: boolean) => {
    setLocalAccounts(prev => prev.map(a => a.id===id ? {...a,is_tracking:!current} : a));
    await supabase.from("connected_accounts").update({ is_tracking: !current, paused_at: !current ? null : new Date().toISOString() }).eq("id", id);
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Disconnect this account? All synced emails and summaries will be removed.")) return;
    await supabase.from("connected_accounts").delete().eq("id", id);
    setLocalAccounts(prev => prev.filter(a => a.id !== id));
    onRefresh();
  };

  const handleSync = async (connectedAccountId: string) => {
    if (!user) return;
    try {
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectedAccountId, userId: user.id }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error("Sync failed:", err);
    }
  };

  const total  = localAccounts.length;
  const active = localAccounts.filter(a => a.is_tracking).length;
  const unread = localAccounts.reduce((s, a) => s + a.total_unread, 0);

  return (
    <Section>
      <PageHead title="Accounts" />

      {/* Stats */}
      <div className="fu d1 col3" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
        {[
          { label:"Total Connected",    value:String(total),  color:C.green },
          { label:"Currently Tracking", value:String(active), color:C.cyan  },
          { label:"Total Unread",       value:String(unread), color:C.pink  },
        ].map((m,i) => (
          <div key={i} className="glass inset" style={{ padding:"18px 20px",borderRadius:14,textAlign:"center" }}>
            <p className="fd" style={{ fontSize:32,color:m.color }}>{m.value}</p>
            <p className="fm" style={{ fontSize:9,color:"#94a3b8",marginTop:6,letterSpacing:".1em" }}>{m.label.toUpperCase()}</p>
          </div>
        ))}
      </div>

      {/* Connect button — hits the real OAuth route */}
      <button className="fu d2"
        onClick={() => { window.location.href = "/api/gmail/connect"; }}
        style={{ display:"flex",alignItems:"center",gap:16,padding:"18px 24px",borderRadius:16,border:"1px dashed #cbd5e1",background:"transparent",color:"#64748b",cursor:"pointer",width:"100%",textAlign:"left",transition:"all .3s",fontFamily:"Space Grotesk,sans-serif" }}
        onMouseEnter={e => { const el=e.currentTarget as HTMLButtonElement; el.style.borderColor=C.green; el.style.color=C.green; el.style.background=`${C.green}08`; }}
        onMouseLeave={e => { const el=e.currentTarget as HTMLButtonElement; el.style.borderColor="#cbd5e1"; el.style.color="#64748b"; el.style.background="transparent"; }}>
        <div style={{ width:44,height:44,borderRadius:12,border:"1px dashed currentColor",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>+</div>
        <div>
          <p style={{ fontSize:14,fontWeight:500 }}>Connect a Gmail Account</p>
          <p className="fm" style={{ fontSize:11,color:"#94a3b8",marginTop:2 }}>OAuth 2.0 · AES-256 Encrypted · Read-only scopes</p>
        </div>
        <span style={{ marginLeft:"auto",fontSize:18 }}>→</span>
      </button>

      {/* Account cards */}
      <div className="fu d3" style={{ display:"flex",flexDirection:"column",gap:16 }}>
        {localAccounts.length === 0 ? (
          <div className="glass inset" style={{ borderRadius:20,padding:"48px 0" }}>
            <EmptyState icon="📭" title="No accounts connected" sub="Click above to connect your first Gmail inbox"/>
          </div>
        ) : localAccounts.map(a => (
          <div key={a.id} className="glass inset" style={{ borderRadius:20,padding:24,opacity:a.is_tracking?1:.55,transition:"opacity .3s" }}>
            <div style={{ display:"flex",alignItems:"center",gap:16 }}>
              <div style={{ width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${a.color},${a.color}99)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0,boxShadow:`0 4px 14px ${a.color}40` }}>
                {a.avatar_initials}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                  <p style={{ fontSize:15,fontWeight:600,color:"#1e2535" }}>{a.display_name ?? a.gmail_address.split("@")[0]}</p>
                  <Tag color={a.is_tracking?C.green:"#94a3b8"}>{a.is_tracking?"● ACTIVE":"○ PAUSED"}</Tag>
                  {a.last_sync_status==="error" && <Tag color={C.red}>SYNC ERROR</Tag>}
                </div>
                <p className="fm" style={{ fontSize:12,color:"#64748b",marginTop:3 }}>{a.gmail_address}</p>
                <div style={{ display:"flex",gap:12,marginTop:5,flexWrap:"wrap" }}>
                  <span className="fm" style={{ fontSize:11,color:"#64748b" }}>{a.total_unread} unread</span>
                  <span style={{ color:"#e2e8f0" }}>·</span>
                  <span className="fm" style={{ fontSize:11,color:"#94a3b8" }}>synced {a.last_synced_at ? fmtTime(a.last_synced_at) : "never"}</span>
                </div>
              </div>
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <button onClick={() => handleSync(a.id)}
                  style={{ fontSize:11,padding:"6px 12px",borderRadius:8,border:`1px solid ${C.cyan}40`,background:`${C.cyan}08`,color:C.cyan,cursor:"pointer",fontFamily:"Space Grotesk,sans-serif",fontWeight:600 }}>
                  ↻ Sync
                </button>
                <button className="toggle" onClick={() => handleToggle(a.id, a.is_tracking)} style={{ background:a.is_tracking?a.color:"#e2e8f0" }}>
                  <div className="knob" style={{ left:a.is_tracking?"23px":"3px" }}/>
                </button>
              </div>
            </div>

            {a.is_tracking && <>
              <div className="divider" style={{ margin:"20px 0" }}/>
              <div style={{ marginBottom:14 }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                  <span className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".1em" }}>STORAGE USED</span>
                  <span className="fm" style={{ fontSize:10,color:a.color,fontWeight:600 }}>{a.storage_used_pct}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width:`${a.storage_used_pct}%`,background:a.storage_used_pct>80?C.red:a.color }}/>
                </div>
              </div>
              <div style={{ display:"flex",justifyContent:"flex-end" }}>
                <button onClick={() => handleDisconnect(a.id)}
                  style={{ fontSize:11,padding:"6px 14px",borderRadius:8,border:`1px solid ${C.red}35`,background:`${C.red}08`,color:C.red,cursor:"pointer",fontFamily:"Space Grotesk,sans-serif",fontWeight:500 }}>
                  Disconnect
                </button>
              </div>
            </>}
          </div>
        ))}
      </div>

      <div className="fu d4 glass" style={{ borderRadius:16,padding:"16px 20px",borderColor:`${C.amber}35`,background:`${C.amber}06` }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <span style={{ fontSize:18 }}>🔒</span>
          <div>
            <p style={{ fontSize:13,fontWeight:600,color:C.amber }}>End-to-end encrypted & privacy-first</p>
            <p style={{ fontSize:12,color:"#64748b",marginTop:3,lineHeight:1.6 }}>Credentials stored with AES-256. Email content is never stored — AI processing is ephemeral and in-memory only. InboxAI requests read-only OAuth scopes.</p>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Summaries ────────────────────────────────────────────────────────────────
function SummariesSection({ accounts }: { accounts: ConnectedAccount[] }) {
  const [tab,       setTab]      = useState<"daily"|"weekly">("daily");
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [genning,   setGenning]  = useState<string | null>(null);

  const loadSummaries = useCallback(async () => {
    if (!accounts.length) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("summaries")
      .select("*")
      .in("connected_account_id", accounts.map(a => a.id))
      .eq("summary_type", tab)
      .order("period_start", { ascending: false })
      .limit(20);
    setSummaries((data as Summary[]) ?? []);
    setLoading(false);
  }, [accounts, tab]);

  useEffect(() => { loadSummaries(); }, [loadSummaries]);

  const generateForAccount = async (acct: ConnectedAccount) => {
    if (genning) return;
    setGenning(acct.id);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: recentEmails } = await supabase
        .from("emails")
        .select("subject,sender_email,received_at,snippet,ai_priority,ai_category")
        .eq("connected_account_id", acct.id)
        .gte("received_at", tab==="daily" ? today : new Date(Date.now()-7*86400000).toISOString())
        .order("received_at", { ascending: false })
        .limit(50);

      if (!recentEmails?.length) { setGenning(null); return; }

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY ?? ""}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-70b-versatile",
          messages: [{
            role: "user",
            content: `Summarize this ${tab} inbox activity for ${acct.gmail_address} in 2-3 clear sentences. Mention key senders, topics, and action items. Return JSON only: { "summary": "...", "actionItems": ["..."], "sentiment": "positive|neutral|negative|mixed" }

Emails: ${JSON.stringify(recentEmails.map(e => ({ subject: e.subject, from: e.sender_email, priority: e.ai_priority, snippet: e.snippet?.slice(0,80) })))}`,
          }],
          temperature: 0.4,
          max_tokens: 500,
          response_format: { type: "json_object" },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        const periodStart = tab==="daily" ? today : new Date(Date.now()-7*86400000).toISOString().split("T")[0];
        const periodEnd   = today;

        await supabase.from("summaries").upsert({
          connected_account_id: acct.id,
          summary_type:    tab,
          period_start:    periodStart,
          period_end:      periodEnd,
          summary_text:    parsed.summary,
          sentiment:       parsed.sentiment,
          action_required: (parsed.actionItems?.length ?? 0) > 0,
          action_items:    parsed.actionItems ?? [],
          email_count:     recentEmails.length,
          model_used:      "llama-3.1-70b-versatile",
        }, { onConflict: "connected_account_id,summary_type,period_start" });

        await loadSummaries();
      }
    } catch(e) { console.error("[generateSummary]", e); }
    setGenning(null);
  };

  return (
    <Section>
      <PageHead title="Summaries" />

      {/* Tabs */}
      <div className="fu d1" style={{ display:"flex",gap:4,padding:4,borderRadius:14,background:"#f1f5f9",border:"1px solid #e2e8f0",width:"fit-content" }}>
        {(["daily","weekly"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:"8px 22px",borderRadius:10,fontSize:13,fontWeight:500,cursor:"pointer",textTransform:"capitalize",transition:"all .22s",background:tab===t?"#ffffff":"transparent",color:tab===t?"#1e2535":"#64748b",border:tab===t?"1px solid #e2e8f0":"1px solid transparent",fontFamily:"Space Grotesk,sans-serif" }}>{t}</button>
        ))}
      </div>

      {/* Generate buttons per account */}
      <div className="fu d2" style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
        {accounts.filter(a=>a.is_tracking).map(acct => (
          <button key={acct.id} onClick={() => generateForAccount(acct)} disabled={genning===acct.id}
            style={{ fontSize:12,padding:"8px 16px",borderRadius:10,border:`1px solid ${acct.color}40`,background:`${acct.color}08`,color:acct.color,cursor:"pointer",fontFamily:"Space Grotesk,sans-serif",fontWeight:600,display:"flex",alignItems:"center",gap:6,opacity:genning===acct.id?0.6:1 }}>
            {genning===acct.id ? <span className="spin" style={{ display:"inline-block" }}>↻</span> : "✦"} Generate {tab} for {acct.display_name ?? acct.gmail_address.split("@")[0]}
          </button>
        ))}
      </div>

      {/* Summaries list */}
      <div className="fu d3" style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {loading ? Array(3).fill(0).map((_,i) => (
          <div key={i} className="glass inset" style={{ borderRadius:16,padding:"20px 24px" }}><Skel w="40%" h={12}/><Skel w="100%" h={48} /></div>
        )) : summaries.length===0 ? (
          <div className="glass inset" style={{ borderRadius:20 }}>
            <EmptyState icon="✦" title="No summaries yet" sub={`Click "Generate ${tab}" above to create one`}/>
          </div>
        ) : summaries.map(item => {
          const acct = accounts.find(a=>a.id===item.connected_account_id);
          const col  = acct?.color ?? C.green;
          const sentimentIcon: Record<string,string> = { positive:"✅",neutral:"◎",negative:"⚠️",mixed:"◈" };
          return (
            <div key={item.id} className="glass inset ghover" style={{ borderRadius:16,padding:"20px 24px",cursor:"default",borderLeft:`3px solid ${col}` }}>
              <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap" }}>
                <span className="fm" style={{ fontSize:11,color:col,fontWeight:600 }}>{acct?.gmail_address ?? "—"}</span>
                <span style={{ color:"#e2e8f0" }}>·</span>
                <span className="fm" style={{ fontSize:11,color:"#94a3b8" }}>{fmtDate(item.period_start)}</span>
                <span className="tag" style={{ marginLeft:"auto",background:"#f1f5f9",color:"#64748b",border:"1px solid #e2e8f0" }}>{item.email_count} emails</span>
                {item.sentiment && <span style={{ fontSize:14 }}>{sentimentIcon[item.sentiment]}</span>}
              </div>
              <p style={{ fontSize:13.5,color:"#475569",lineHeight:1.72 }}>{item.summary_text}</p>
              {item.action_items && item.action_items.length > 0 && (
                <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:14 }}>
                  {item.action_items.map((a,i) => (
                    <span key={i} className="fm" style={{ fontSize:11,padding:"4px 10px",borderRadius:6,background:`${col}10`,border:`1px solid ${col}30`,color:col,fontWeight:600 }}>→ {a}</span>
                  ))}
                </div>
              )}
              <p className="fm" style={{ fontSize:10,color:"#cbd5e1",marginTop:10,letterSpacing:".08em" }}>MODEL: {item.model_used.toUpperCase()}</p>
            </div>
          );
        })}
      </div>

      <div className="fu d4 glass" style={{ borderRadius:16,padding:"18px 22px",display:"flex",alignItems:"center",gap:16,borderColor:`${C.green}30`,background:`${C.green}05` }}>
        <div style={{ width:36,height:36,borderRadius:10,background:`${C.green}18`,border:`1px solid ${C.green}35`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16 }}>✦</div>
        <div>
          <p style={{ fontSize:13,color:"#475569",lineHeight:1.6 }}>
            Summaries generated by <strong style={{ color:C.green }}>Groq · LLaMA 3.1 70B</strong> using only in-memory email metadata. Full email content is never stored.
          </p>
          <p className="fm" style={{ fontSize:10,color:"#94a3b8",marginTop:5,letterSpacing:".08em" }}>PRIVACY: COMPLIANT · METADATA ONLY</p>
        </div>
      </div>
    </Section>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
type SettingsKey = "aiSummary"|"autoSchedule"|"notifications"|"darkMode"|"compactView"|"weeklyDigest"|"priorityAlerts"|"analytics";
type Settings    = Record<SettingsKey,boolean>;

function SettingsSection({ user }: { user: AuthUser | null }) {
  const [s, setS] = useState<Settings>({
    aiSummary:true, autoSchedule:true, notifications:true, darkMode:true,
    compactView:false, weeklyDigest:true, priorityAlerts:true, analytics:false,
  });
  const tog = (k: SettingsKey) => setS(x => ({...x,[k]:!x[k]}));

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const groups: { label:string;icon:string;color:string;items:{key:SettingsKey;label:string;desc:string}[] }[] = [
    { label:"AI Features",   icon:"✦", color:C.green,  items:[
      { key:"aiSummary",      label:"Daily AI Summary",       desc:"Generate a morning AI summary of your inbox at 8:00 AM" },
      { key:"weeklyDigest",   label:"Weekly Digest",          desc:"Weekly rollup every Sunday with trends and highlights" },
      { key:"autoSchedule",   label:"Auto-Schedule Meetings", desc:"Detect meeting links in emails and add them to calendar" },
      { key:"priorityAlerts", label:"Priority Alerts",        desc:"AI flags high-priority emails for immediate attention" },
    ]},
    { label:"Notifications", icon:"◈", color:C.cyan,   items:[
      { key:"notifications",  label:"Push Notifications",     desc:"Browser notifications for high-priority emails and meetings" },
    ]},
    { label:"Privacy",       icon:"🔒", color:C.amber,  items:[
      { key:"analytics",      label:"Usage Analytics",        desc:"Share anonymized usage data to help improve InboxAI" },
    ]},
    { label:"Interface",     icon:"◫", color:C.purple, items:[
      { key:"darkMode",       label:"Dark Mode",              desc:"Always-on dark theme — optimized for extended reading" },
      { key:"compactView",    label:"Compact View",           desc:"Reduce spacing and padding for higher information density" },
    ]},
  ];

  return (
    <Section>
      <PageHead title="Settings" />

      {user && (
        <div className="fu glass inset" style={{ borderRadius:16,padding:"18px 22px",display:"flex",alignItems:"center",gap:16 }}>
          <div style={{ width:44,height:44,borderRadius:12,background:`${C.green}15`,border:`1px solid ${C.green}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:C.green }}>
            {user.name?.charAt(0)?.toUpperCase() ?? user.email?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:14,fontWeight:600,color:"#1e2535" }}>{user.name ?? "—"}</p>
            <p className="fm" style={{ fontSize:12,color:"#64748b" }}>{user.email}</p>
          </div>
          <button onClick={handleSignOut}
            style={{ fontSize:12,padding:"8px 16px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",cursor:"pointer",fontFamily:"Space Grotesk,sans-serif",fontWeight:500 }}>
            Sign out
          </button>
        </div>
      )}

      {groups.map((g, gi) => (
        <div key={gi} className="fu" style={{ animationDelay:`${gi*.08}s` }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
            <div style={{ width:28,height:28,borderRadius:8,background:`${g.color}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>{g.icon}</div>
            <p className="fm" style={{ fontSize:9,color:g.color,letterSpacing:".15em",fontWeight:600 }}>{g.label.toUpperCase()}</p>
          </div>
          <div className="glass inset" style={{ borderRadius:16,overflow:"hidden" }}>
            {g.items.map((item, ii) => (
              <div key={item.key} style={{ display:"flex",alignItems:"center",gap:16,padding:"18px 22px",borderBottom:ii<g.items.length-1?"1px solid #f1f5f9":"none",cursor:"pointer",transition:"background .2s" }}
                onClick={() => tog(item.key)}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background="#f8fafc"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background="transparent"}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:14,color:s[item.key]?"#1e2535":"#94a3b8",fontWeight:500 }}>{item.label}</p>
                  <p style={{ fontSize:12,color:"#94a3b8",marginTop:2 }}>{item.desc}</p>
                </div>
                <button className="toggle" style={{ background:s[item.key]?g.color:"#e2e8f0" }}
                  onClick={e => { e.stopPropagation(); tog(item.key); }}>
                  <div className="knob" style={{ left:s[item.key]?"23px":"3px" }}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="fu glass" style={{ borderRadius:16,padding:"20px 24px",borderColor:`${C.red}30`,background:`${C.red}04` }}>
        <p className="fm" style={{ fontSize:9,color:C.red,letterSpacing:".15em",marginBottom:14,fontWeight:600 }}>DANGER ZONE</p>
        <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
          {["Disconnect All Accounts","Clear Summary History","Delete My Account"].map((label,i) => (
            <button key={i} style={{ fontSize:12,padding:"8px 16px",borderRadius:10,border:`1px solid ${C.red}35`,background:`${C.red}08`,color:C.red,cursor:"pointer",fontFamily:"Space Grotesk,sans-serif",fontWeight:500 }}
              onMouseEnter={e => { const el=e.currentTarget as HTMLButtonElement; el.style.background=`${C.red}18`; }}
              onMouseLeave={e => { const el=e.currentTarget as HTMLButtonElement; el.style.background=`${C.red}08`; }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ textAlign:"center",paddingBottom:8 }}>
        <p className="fm" style={{ fontSize:9,color:"#cbd5e1",letterSpacing:".12em" }}>INBOXAI v2.0.0 · POWERED BY GROQ · BUILT WITH ♥</p>
      </div>
    </Section>
  );
}

// ─── Root Page ────────────────────────────────────────────────────────────────
export default function Page() {
  const [active,    setActive]    = useState("dashboard");
  const [key,       setKey]       = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [accounts,  setAccounts]  = useState<ConnectedAccount[]>([]);
  const [toast,     setToast]     = useState<{ msg: string; color: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const SW = collapsed ? 64 : 220;

  const loadAccounts = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at");
    if (data) setAccounts(data as ConnectedAccount[]);
  }, []);

  useEffect(() => {
    // Auth + URL params
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const u: AuthUser = {
          id:     data.user.id,
          email:  data.user.email ?? "",
          name:   data.user.user_metadata?.full_name ?? data.user.user_metadata?.name,
          avatar: data.user.user_metadata?.avatar_url,
        };
        setUser(u);
        loadAccounts(u.id);
      }
      setAuthLoading(false);
    });

    // Handle OAuth redirect results
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error     = params.get("error");

    if (connected) {
      setToast({ msg: `✓ ${decodeURIComponent(connected)} connected!`, color: C.green });
      window.history.replaceState({}, "", "/home");
    } else if (error) {
      const messages: Record<string,string> = {
        oauth_denied:       "Google sign-in was cancelled.",
        no_refresh_token:   "Please revoke InboxAI access in Google and try again.",
        oauth_state_expired:"OAuth session expired. Please try again.",
        db_error:           "Failed to save account. Please try again.",
        oauth_failed:       "Connection failed. Please try again.",
      };
      setToast({ msg: `⚠ ${messages[error] ?? "Something went wrong."}`, color: C.red });
      window.history.replaceState({}, "", "/home");
    }

    // Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        const u: AuthUser = {
          id:     session.user.id,
          email:  session.user.email ?? "",
          name:   session.user.user_metadata?.full_name,
          avatar: session.user.user_metadata?.avatar_url,
        };
        setUser(u);
        loadAccounts(u.id);
      } else {
        setUser(null);
        setAccounts([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadAccounts]);

  const nav = [
    { id:"dashboard", icon:"◈", label:"Dashboard" },
    { id:"calendar",  icon:"◫", label:"Calendar"  },
    { id:"summaries", icon:"✦", label:"Summaries" },
    { id:"accounts",  icon:"◉", label:"Accounts"  },
    { id:"settings",  icon:"⚙", label:"Settings"  },
  ];

  function go(id: string) { setActive(id); setKey(k=>k+1); window.scrollTo(0,0); }

  if (authLoading) {
    return (
      <>
        <style>{css}</style>
        <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f0f4f9" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#059669,#0284c7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 16px" }}>✉</div>
            <p className="fm" style={{ fontSize:10,color:"#94a3b8",letterSpacing:".2em" }}>LOADING INBOXAI...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:"100vh",background:"#f0f4f9",display:"flex",overflow:"hidden",position:"relative" }}>
        <div className="orb orb1"/><div className="orb orb2"/><div className="orb orb3"/>

        {/* ── Sidebar ── */}
        <aside className={`sidebar sidebar-light${collapsed?" sb-collapsed":""}`}
          style={{ position:"fixed",top:0,left:0,bottom:0,width:SW,zIndex:50,display:"flex",flexDirection:"column",padding:"24px 12px",overflowX:"hidden" }}>

          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:32,padding:"0 4px",minWidth:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1,overflow:"hidden" }}>
              <div style={{ width:36,height:36,borderRadius:11,background:"rgba(255,255,255,.25)",border:"1px solid rgba(255,255,255,.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,color:"#fff",fontWeight:700,flexShrink:0 }}>✉</div>
              {!collapsed && (
                <div className="sb-label">
                  <p className="fd" style={{ fontSize:16,color:"#fff",fontWeight:700,letterSpacing:"-.02em" }}>InboxAI</p>
                  <p className="fm" style={{ fontSize:8,color:"rgba(255,255,255,.7)",letterSpacing:".12em",fontWeight:600 }}>POWERED BY GROQ</p>
                </div>
              )}
            </div>
            <button className="collapse-btn" onClick={() => setCollapsed(c=>!c)}>
              {collapsed ? "›" : "‹"}
            </button>
          </div>

          <nav style={{ flex:1,display:"flex",flexDirection:"column",gap:2 }}>
            {!collapsed && <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.45)",letterSpacing:".15em",padding:"0 10px",marginBottom:8 }}>NAVIGATION</p>}
            {nav.map(n => (
              <button key={n.id} onClick={() => go(n.id)}
                className={`nav-btn ${active===n.id?"nav-active":""}`}
                title={collapsed ? n.label : undefined}
                style={{ justifyContent:collapsed?"center":"flex-start",padding:collapsed?"10px":"10px 12px",gap:collapsed?0:10 }}>
                <span style={{ fontSize:17,color:active===n.id?"#fff":"rgba(255,255,255,.65)",flexShrink:0 }}>{n.icon}</span>
                {!collapsed && <span className="sb-label">{n.label}</span>}
                {!collapsed && active===n.id && <span style={{ marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:"#fff",display:"inline-block" }}/>}
              </button>
            ))}
          </nav>

          <div style={{ height:1,background:"rgba(255,255,255,.2)",margin:"16px 4px" }}/>

          {/* Active inboxes in sidebar */}
          <div>
            {!collapsed && <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.45)",letterSpacing:".14em",padding:"0 4px",marginBottom:10 }}>ACTIVE INBOXES</p>}
            {accounts.filter(a=>a.is_tracking).length === 0 && !collapsed && (
              <p style={{ fontSize:11,color:"rgba(255,255,255,.4)",padding:"0 4px",fontStyle:"italic" }}>No accounts yet</p>
            )}
            {accounts.filter(a=>a.is_tracking).map(a => (
              <div key={a.id}
                style={{ display:"flex",alignItems:"center",gap:collapsed?0:8,padding:"7px 6px",borderRadius:8,cursor:"pointer",transition:"background .2s",justifyContent:collapsed?"center":"flex-start" }}
                title={collapsed ? a.gmail_address : undefined}
                onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background="rgba(255,255,255,.15)"}
                onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background="transparent"}>
                <div style={{ width:26,height:26,borderRadius:8,background:"rgba(255,255,255,.22)",border:"1px solid rgba(255,255,255,.35)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0,position:"relative" }}>
                  {a.avatar_initials}
                  {collapsed && a.total_unread>0 && <span style={{ position:"absolute",top:-4,right:-4,width:8,height:8,borderRadius:"50%",background:"#fbbf24",border:"1.5px solid #059669" }}/>}
                </div>
                {!collapsed && <>
                  <p className="fm sb-label" style={{ fontSize:11,color:"rgba(255,255,255,.7)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1 }}>{a.gmail_address}</p>
                  {a.total_unread>0 && <span className="fm" style={{ fontSize:10,color:"#fff",background:"rgba(255,255,255,.25)",padding:"1px 6px",borderRadius:4,flexShrink:0,fontWeight:600,border:"1px solid rgba(255,255,255,.3)" }}>{a.total_unread}</span>}
                </>}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="main-offset" style={{ flex:1,overflowY:"auto",position:"relative",zIndex:10,paddingLeft:SW,transition:"padding-left .28s cubic-bezier(.4,0,.2,1)" }}>
          <div key={key} className="main-pad" style={{ maxWidth:960,margin:"0 auto",padding:"48px 40px" }}>
            {active==="dashboard" && <Dashboard user={user} accounts={accounts}/>}
            {active==="calendar"  && <CalendarSection user={user} accounts={accounts}/>}
            {active==="summaries" && <SummariesSection accounts={accounts}/>}
            {active==="accounts"  && <AccountsSection user={user} accounts={accounts} onRefresh={() => user && loadAccounts(user.id)}/>}
            {active==="settings"  && <SettingsSection user={user}/>}
          </div>
        </main>

        {/* ── Bottom nav (mobile) ── */}
        <nav className="bottom-nav">
          {nav.map(n => (
            <button key={n.id} onClick={() => go(n.id)} className={`bnav-item ${active===n.id?"active":""}`}>
              <span className="bnav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        {/* ── Toast ── */}
        {toast && <Toast msg={toast.msg} color={toast.color} onClose={() => setToast(null)}/>}
      </div>
    </>
  );
}