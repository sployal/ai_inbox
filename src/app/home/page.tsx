"use client";

import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Account {
  id: string; email: string; name: string; avatar: string; color: string;
  tracking: boolean; unread: number; lastSync: string; storage: number;
}
interface CalendarEvent {
  id: string; title: string; time: string; type: string;
  account: string; link?: string; color: string;
}
interface DailySummary {
  kind: "daily"; date: string; account: string; count: number;
  color: string; preview: string; sentiment: string;
}
interface WeeklySummary {
  kind: "weekly"; week: string; account: string; count: number;
  color: string; highlights: string[];
}
type Summary = DailySummary | WeeklySummary;
type SettingsKey = "aiSummary"|"autoSchedule"|"notifications"|"darkMode"|"compactView"|"weeklyDigest"|"priorityAlerts"|"analytics";
type Settings = Record<SettingsKey, boolean>;

// ─── Accent palette ───────────────────────────────────────────────────────────
const C = {
  green:  "#059669",
  cyan:   "#0284c7",
  purple: "#7c3aed",
  pink:   "#db2777",
  amber:  "#d97706",
  red:    "#dc2626",
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const ACCOUNTS: Account[] = [
  { id:"1", email:"alex@gmail.com",       name:"Alex M.",     avatar:"AM", color:C.green,  tracking:true,  unread:12,  lastSync:"2 min ago", storage:68 },
  { id:"2", email:"work.alex@gmail.com",  name:"Work",        avatar:"WK", color:C.cyan,   tracking:true,  unread:47,  lastSync:"Just now",  storage:42 },
  { id:"3", email:"newsletter@gmail.com", name:"Newsletters", avatar:"NL", color:C.pink,   tracking:false, unread:203, lastSync:"1 hr ago",  storage:91 },
];

const CALENDAR_DATA: Record<number, CalendarEvent[]> = {
  3:  [{ id:"e1",  title:"Q1 Review",        time:"10:00 AM", type:"meeting",  account:"work.alex@gmail.com", link:"https://meet.google.com/abc", color:C.cyan   }],
  7:  [{ id:"e2",  title:"Weekly Summary",   time:"All day",  type:"summary",  account:"alex@gmail.com",                                         color:C.green  }],
  11: [{ id:"e3",  title:"Design Sync",      time:"2:00 PM",  type:"meeting",  account:"work.alex@gmail.com", link:"https://zoom.us/j/123",       color:C.cyan   },
       { id:"e4",  title:"Project Deadline", time:"5:00 PM",  type:"deadline", account:"work.alex@gmail.com",                                    color:C.red    }],
  14: [{ id:"e5",  title:"Weekly Summary",   time:"All day",  type:"summary",  account:"alex@gmail.com",                                         color:C.green  }],
  18: [{ id:"e6",  title:"1:1 with Manager", time:"11:00 AM", type:"meeting",  account:"work.alex@gmail.com", link:"https://meet.google.com/xyz", color:C.cyan   }],
  21: [{ id:"e7",  title:"Weekly Summary",   time:"All day",  type:"summary",  account:"alex@gmail.com",                                         color:C.green  }],
  25: [{ id:"e8",  title:"Product Demo",     time:"3:00 PM",  type:"meeting",  account:"work.alex@gmail.com", link:"https://zoom.us/j/456",       color:C.purple }],
  27: [{ id:"e11", title:"Q1 Close Deadline",time:"EOD",      type:"deadline", account:"work.alex@gmail.com",                                    color:C.red    }],
  28: [{ id:"e9",  title:"Weekly Summary",   time:"All day",  type:"summary",  account:"alex@gmail.com",                                         color:C.green  }],
};

const DAYS   = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const getDaysInMonth = (y: number, m: number) => new Date(y, m+1, 0).getDate();
const getFirstDay    = (y: number, m: number) => new Date(y, m, 1).getDay();

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

  /* ── Sidebar (light) ── */
  .sidebar-light {
    background:linear-gradient(160deg,#0f766e 0%,#059669 45%,#0284c7 100%);
    border-right:none;
    box-shadow:4px 0 28px rgba(5,150,105,.25);
  }
  .nav-btn {
    display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:10px;cursor:pointer;
    font-size:13px;font-weight:500;transition:all .2s;border:1px solid transparent;background:transparent;
    color:rgba(255,255,255,.65);text-align:left;font-family:'Space Grotesk',sans-serif;
  }
  .nav-btn:hover { color:#fff;background:rgba(255,255,255,.15); }
  .nav-active    { background:rgba(255,255,255,.22)!important;border-color:rgba(255,255,255,.35)!important;color:#fff!important; }
  .trrow td      { transition:background .15s; }
  .trrow:hover td{ background:#f8fafc; }

  /* ── Bottom nav ── */
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
  }
  @media (max-width:460px) {
    .stats-grid  { grid-template-columns:1fr 1fr!important; }
  }
`;

// ─── Shared Components ────────────────────────────────────────────────────────
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

// ─── Clock — client-only to avoid SSR hydration mismatch ─────────────────────
function LiveClock() {
  const [mounted, setMounted] = useState(false);
  const [time,    setTime]    = useState("");

  useEffect(() => {
    setMounted(true);
    const fmt = () =>
      new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
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
function Dashboard() {
  const spark = [14,22,18,31,27,9,35,28,19,42,38,31,27,45];

  return (
    <Section>
      {/* Header */}
      <div className="fu" style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16 }}>
        <div>
          <p className="fm" style={{ fontSize:10,color:C.green,letterSpacing:".2em",marginBottom:10,fontWeight:600 }}>INBOX INTELLIGENCE DASHBOARD</p>
          <h1 className="fd" style={{ fontSize:50,color:"#1e2535",fontWeight:700,lineHeight:1.1 }}>
            Good morning,<br/><span style={{ fontStyle:"italic",color:C.green }}>Alex.</span>
          </h1>
          <p style={{ fontSize:13,color:"#64748b",marginTop:12 }}>Friday, February 27 · Your inboxes are active and monitored.</p>
        </div>

        {/* Clock card — fully light */}
        <div className="glass inset" style={{ padding:"18px 24px",borderRadius:16,textAlign:"right",background:"linear-gradient(135deg,#f0fdf8,#ecfdf5)",borderColor:`${C.green}30` }}>
          <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".18em",marginBottom:8 }}>SYSTEM CLOCK · UTC+0</p>
          <LiveClock />
          <div style={{ display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end",marginTop:10 }}>
            <span className="live" style={{ position:"relative",width:7,height:7,borderRadius:"50%",background:C.green,display:"inline-block" }}/>
            <span className="fm" style={{ fontSize:9,color:C.green,letterSpacing:".1em",fontWeight:600 }}>GROQ · CONNECTED</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="fu d1 stats-grid" style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(152px,1fr))",gap:14 }}>
        {[
          { label:"Emails Today",   value:"31",  delta:"+8",  sub:"vs yesterday",   color:C.green,  spark:true  },
          { label:"Total Unread",   value:"59",  delta:"-12", sub:"since morning",  color:C.cyan,   spark:false },
          { label:"Meetings Found", value:"2",   delta:"+2",  sub:"auto-scheduled", color:C.purple, spark:false },
          { label:"Response Rate",  value:"94%", delta:"+3%", sub:"7-day average",  color:C.amber,  spark:false },
          { label:"Tracked Accts",  value:"2/3", delta:"",    sub:"1 paused",       color:C.pink,   spark:false },
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
              {s.delta && <span className="fm" style={{ fontSize:11,color:s.delta.startsWith("+")? C.green : C.red,fontWeight:600 }}>{s.delta}</span>}
              <span style={{ fontSize:11,color:"#94a3b8" }}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary + Activity */}
      <div className="fu d2 col2" style={{ display:"grid",gridTemplateColumns:"1fr 300px",gap:20 }}>
        <div className="glass inset" style={{ borderRadius:20,padding:28,borderColor:`${C.green}30`,background:`${C.green}04` }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20 }}>
            <div style={{ width:38,height:38,borderRadius:12,background:`${C.green}18`,border:`1px solid ${C.green}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17 }}>✦</div>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:600,color:C.green,fontSize:13 }}>AI Daily Summary</p>
              <p className="fm" style={{ fontSize:10,color:"#94a3b8",marginTop:2 }}>groq/llama-3.1-70b · generated 2m ago</p>
            </div>
            <Tag color={C.green}>TODAY</Tag>
          </div>
          <div className="divider" style={{ marginBottom:20 }}/>
          <p style={{ fontSize:13.5,color:"#475569",lineHeight:1.78 }}>
            Your inbox across <strong style={{ color:"#1e2535" }}>2 accounts</strong> saw moderate activity today.{" "}
            <strong style={{ color:C.cyan }}>work.alex@gmail.com</strong> received{" "}
            <strong style={{ color:"#1e2535" }}>14 new messages</strong> — 3 flagged as high-priority including a follow-up from the design team and a billing alert.{" "}
            <strong style={{ color:C.green }}>alex@gmail.com</strong> had 5 messages, mostly personal correspondence.
          </p>
          <div style={{ marginTop:20,padding:"14px 16px",borderRadius:12,background:"#f8fafc",border:"1px solid #e2e8f0" }}>
            <p className="fm" style={{ fontSize:9,color:"#94a3b8",marginBottom:10,letterSpacing:".12em" }}>AI DETECTED ACTIONS</p>
            {[
              { icon:"📅", text:"Zoom call at 2:00 PM auto-added to calendar",  color:C.cyan  },
              { icon:"📅", text:"Google Meet at 4:30 PM auto-added to calendar", color:C.cyan  },
              { icon:"⚠️", text:"Stripe billing alert — action recommended",     color:C.amber },
            ].map((a, i) => (
              <div key={i} style={{ display:"flex",alignItems:"center",gap:10,marginTop:i>0?8:0 }}>
                <span style={{ fontSize:13 }}>{a.icon}</span>
                <span style={{ fontSize:12,color:"#475569" }}>{a.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass inset" style={{ borderRadius:20,padding:22 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
            <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".15em" }}>LIVE ACTIVITY</p>
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <span className="live" style={{ position:"relative",width:5,height:5,borderRadius:"50%",background:C.green,display:"inline-block" }}/>
              <span className="fm" style={{ fontSize:9,color:C.green }}>LIVE</span>
            </div>
          </div>
          {[
            { time:"09:41",type:"email",text:"Stripe billing alert received",  color:C.red,    border:`${C.red}50`   },
            { time:"09:38",type:"sync", text:"Inbox synced — 3 new messages",  color:C.green,  border:"transparent"  },
            { time:"09:22",type:"ai",   text:"Daily summary generated",        color:C.purple, border:"transparent"  },
            { time:"09:15",type:"email",text:"Design team follow-up",          color:C.amber,  border:`${C.amber}50` },
            { time:"08:59",type:"cal",  text:"Meeting detected: Design Sync",  color:C.cyan,   border:"transparent"  },
            { time:"08:44",type:"email",text:"Personal message from Jordan",   color:C.green,  border:"transparent"  },
            { time:"08:30",type:"sync", text:"Accounts synced on startup",     color:C.green,  border:"transparent"  },
          ].map((a, i) => (
            <div key={i} style={{ display:"flex",gap:10,padding:"9px 10px 9px 12px",borderRadius:8,borderLeft:`2px solid ${a.border}`,marginBottom:2,transition:"background .2s",cursor:"default" }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}>
              <div style={{ width:26,height:26,borderRadius:7,background:`${a.color}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,color:a.color }}>
                {a.type==="email"?"✉":a.type==="ai"?"✦":a.type==="cal"?"◫":"⟳"}
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:12,color:"#334155",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{a.text}</p>
                <p className="fm" style={{ fontSize:10,color:"#94a3b8",marginTop:1 }}>{a.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Digest */}
      <div className="fu d3 glass inset" style={{ borderRadius:20,padding:28,borderColor:`${C.purple}28`,background:`${C.purple}04` }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20 }}>
          <div style={{ width:38,height:38,borderRadius:12,background:`${C.purple}18`,border:`1px solid ${C.purple}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17 }}>◈</div>
          <div style={{ flex:1 }}>
            <p style={{ fontWeight:600,color:C.purple,fontSize:13 }}>AI Weekly Digest</p>
            <p className="fm" style={{ fontSize:10,color:"#94a3b8",marginTop:2 }}>FEB 21 – FEB 27 · 2026</p>
          </div>
          <Tag color={C.purple}>THIS WEEK</Tag>
        </div>
        <div className="divider" style={{ marginBottom:20 }}/>
        <div className="col2" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:24 }}>
          <p style={{ fontSize:13.5,color:"#475569",lineHeight:1.8 }}>
            This week you received <strong style={{ color:"#1e2535" }}>183 emails</strong> across all tracked accounts.
            Key themes: product roadmap <span style={{ color:"#94a3b8" }}>(28)</span>,
            client comms <span style={{ color:"#94a3b8" }}>(41)</span>,
            automated reports <span style={{ color:"#94a3b8" }}>(67)</span>.
            Average response time: <strong style={{ color:C.green }}>3.2 hours</strong>.
            Five meetings auto-detected.
          </p>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            {[
              { label:"Emails",       value:"183",  color:C.purple },
              { label:"Meetings",     value:"5",    color:C.cyan   },
              { label:"Avg Response", value:"3.2h", color:C.green  },
              { label:"Threads",      value:"41",   color:C.amber  },
            ].map((m, i) => (
              <div key={i} style={{ padding:"14px 12px",borderRadius:12,background:`${m.color}08`,border:`1px solid ${m.color}25`,textAlign:"center" }}>
                <p className="fd" style={{ fontSize:26,color:m.color }}>{m.value}</p>
                <p className="fm" style={{ fontSize:9,color:"#94a3b8",marginTop:4,letterSpacing:".1em" }}>{m.label.toUpperCase()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Meetings */}
      <div className="fu d4">
        <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".15em",marginBottom:14 }}>AUTO-DETECTED MEETINGS</p>
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {[
            { title:"Design Sync",        time:"Today · 2:00 PM",     via:"Zoom",        account:"work.alex@gmail.com", color:C.cyan,   status:"upcoming"  },
            { title:"Q1 Review Follow-up",time:"Tomorrow · 10:00 AM", via:"Google Meet", account:"work.alex@gmail.com", color:C.cyan,   status:"upcoming"  },
            { title:"Investor Call",      time:"Fri Mar 1 · 3:30 PM", via:"Zoom",        account:"work.alex@gmail.com", color:C.purple, status:"scheduled" },
          ].map((m, i) => (
            <div key={i} className="glass inset ghover" style={{ display:"flex",alignItems:"center",gap:16,padding:"16px 20px",borderRadius:14,cursor:"default" }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:m.color,flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14,color:"#1e2535",fontWeight:500 }}>{m.title}</p>
                <p style={{ fontSize:12,color:"#64748b",marginTop:2 }}>{m.time} · via {m.via}</p>
              </div>
              <p className="fm hide-mob" style={{ fontSize:11,color:"#94a3b8" }}>{m.account}</p>
              <Tag color={m.color}>{m.status}</Tag>
              <button style={{ fontSize:12,padding:"7px 16px",borderRadius:8,border:`1px solid ${m.color}50`,background:`${m.color}10`,color:m.color,cursor:"pointer",transition:"all .2s",fontFamily:"Space Grotesk,sans-serif",fontWeight:600 }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = `${m.color}22`}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = `${m.color}10`}>
                Join →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Priority Threads */}
      <div className="fu d5">
        <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".15em",marginBottom:14 }}>HIGH-PRIORITY THREADS</p>
        <div className="glass inset" style={{ borderRadius:16,overflow:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",minWidth:500 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #e2e8f0",background:"#f8fafc" }}>
                {["Subject","From","Account","Time","Priority",""].map((h, i) => (
                  <th key={i} className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".1em",padding:"12px 16px",textAlign:"left",fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { subject:"Stripe billing alert — action needed", from:"billing@stripe.com",  account:"work", time:"09:41 AM", priority:"high",   color:C.red   },
                { subject:"Re: Design System v2 feedback",        from:"maya@company.com",    account:"work", time:"08:15 AM", priority:"medium", color:C.amber },
                { subject:"Q1 OKR check-in — please review",      from:"manager@company.com", account:"work", time:"Yesterday",priority:"high",   color:C.red   },
                { subject:"Contract renewal — expires soon",       from:"legal@vendor.com",   account:"work", time:"Feb 26",   priority:"medium", color:C.amber },
              ].map((row, i) => (
                <tr key={i} className="trrow" style={{ borderBottom:"1px solid #f1f5f9",cursor:"default" }}>
                  <td style={{ fontSize:13,color:"#1e2535",padding:"13px 16px",maxWidth:230,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{row.subject}</td>
                  <td className="fm" style={{ fontSize:11,color:"#64748b",padding:"13px 16px" }}>{row.from}</td>
                  <td className="fm" style={{ fontSize:11,color:"#94a3b8",padding:"13px 16px" }}>{row.account}</td>
                  <td className="fm" style={{ fontSize:11,color:"#94a3b8",padding:"13px 16px" }}>{row.time}</td>
                  <td style={{ padding:"13px 16px" }}><Tag color={row.color}>{row.priority}</Tag></td>
                  <td style={{ padding:"13px 16px" }}>
                    <button className="fm" style={{ fontSize:10,color:"#94a3b8",background:"none",border:"none",cursor:"pointer",transition:"color .2s",fontWeight:600 }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = C.cyan}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"}>VIEW →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalendarSection() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [sel,   setSel]   = useState(today.getDate());

  const dim   = getDaysInMonth(year, month);
  const fd    = getFirstDay(year, month);
  const cells = Array.from({ length: fd + dim }, (_, i) => i < fd ? null : i - fd + 1);
  const events: CalendarEvent[] = CALENDAR_DATA[sel] ?? [];

  function prev() { month===0 ? (setMonth(11),setYear(y=>y-1)) : setMonth(m=>m-1); }
  function next() { month===11? (setMonth(0), setYear(y=>y+1)) : setMonth(m=>m+1); }

  return (
    <Section>
      <PageHead title="Calendar" />
      <div className="fu d1 col2" style={{ display:"grid",gridTemplateColumns:"1fr 280px",gap:22,alignItems:"start" }}>
        <div className="glass inset" style={{ borderRadius:20,padding:28 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28 }}>
            <button onClick={prev} style={{ width:36,height:36,borderRadius:10,background:"#f1f5f9",border:"1px solid #e2e8f0",color:"#1e2535",cursor:"pointer",fontSize:18,transition:"all .2s" }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background="#e2e8f0"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background="#f1f5f9"}>‹</button>
            <div style={{ textAlign:"center" }}>
              <p className="fd" style={{ fontSize:22,color:"#1e2535",fontWeight:700 }}>{MONTHS[month]}</p>
              <p className="fm" style={{ fontSize:11,color:"#94a3b8",marginTop:2 }}>{year}</p>
            </div>
            <button onClick={next} style={{ width:36,height:36,borderRadius:10,background:"#f1f5f9",border:"1px solid #e2e8f0",color:"#1e2535",cursor:"pointer",fontSize:18,transition:"all .2s" }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background="#e2e8f0"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background="#f1f5f9"}>›</button>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:8 }}>
            {DAYS.map(d => <div key={d} className="fm" style={{ textAlign:"center",fontSize:9,color:"#94a3b8",letterSpacing:".1em",padding:"6px 0" }}>{d}</div>)}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i}/>;
              const evts: CalendarEvent[] = CALENDAR_DATA[day] ?? [];
              const isToday = day===today.getDate()&&month===today.getMonth()&&year===today.getFullYear();
              const isSel   = day===sel;
              return (
                <button key={i} onClick={() => setSel(day)} style={{ aspectRatio:"1",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .18s",border:isToday?`1.5px solid ${C.green}`:isSel?"1px solid #cbd5e1":"1px solid transparent",background:isSel?`${C.green}12`:isToday?`${C.green}08`:"transparent",gap:3,padding:4 }}
                  onMouseEnter={e => { if(!isSel) (e.currentTarget as HTMLButtonElement).style.background="#f1f5f9"; }}
                  onMouseLeave={e => { if(!isSel) (e.currentTarget as HTMLButtonElement).style.background="transparent"; }}>
                  <span style={{ fontSize:12,fontWeight:isToday?700:400,color:isToday?C.green:isSel?"#1e2535":"#475569" }}>{day}</span>
                  {evts.length>0 && <div style={{ display:"flex",gap:2 }}>{evts.slice(0,3).map((ev: CalendarEvent, ei: number) => <span key={ei} style={{ width:4,height:4,borderRadius:"50%",background:ev.color }}/>)}</div>}
                </button>
              );
            })}
          </div>
          <div className="divider" style={{ margin:"20px 0" }}/>
          <div style={{ display:"flex",gap:20 }}>
            {[{label:"Meeting",color:C.cyan},{label:"Deadline",color:C.red},{label:"Summary",color:C.green}].map(l => (
              <div key={l.label} style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:l.color }}/>
                <span className="fm" style={{ fontSize:10,color:"#64748b" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass inset" style={{ borderRadius:20,padding:24 }}>
          <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".15em",marginBottom:4 }}>SELECTED</p>
          <p className="fd" style={{ fontSize:28,color:"#1e2535",fontWeight:700,marginBottom:20 }}>{MONTHS[month].slice(0,3)} {sel}</p>
          <div className="divider" style={{ marginBottom:20 }}/>
          {events.length===0 ? (
            <div style={{ textAlign:"center",padding:"44px 0" }}>
              <p style={{ fontSize:32,marginBottom:12,opacity:.15,color:"#94a3b8" }}>◌</p>
              <p style={{ fontSize:13,color:"#94a3b8" }}>No events this day</p>
            </div>
          ) : events.map((ev: CalendarEvent) => (
            <div key={ev.id} style={{ padding:16,borderRadius:14,background:`${ev.color}08`,border:`1px solid ${ev.color}30`,marginBottom:10 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:ev.color,flexShrink:0 }}/>
                <Tag color={ev.color}>{ev.type}</Tag>
              </div>
              <p style={{ fontSize:14,color:"#1e2535",fontWeight:500 }}>{ev.title}</p>
              <p className="fm" style={{ fontSize:11,color:"#64748b",marginTop:4 }}>{ev.time}</p>
              <p className="fm" style={{ fontSize:10,color:ev.color,marginTop:4 }}>{ev.account}</p>
              {ev.link && (
                <a href={ev.link} target="_blank" rel="noreferrer" className="fm" style={{ display:"inline-flex",alignItems:"center",gap:6,marginTop:10,fontSize:11,color:ev.color,textDecoration:"none",padding:"5px 10px",borderRadius:8,border:`1px solid ${ev.color}35`,background:`${ev.color}0e` }}>
                  ↗ Join Meeting
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="fu d2">
        <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".15em",marginBottom:14 }}>UPCOMING THIS MONTH</p>
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {[
            { title:"Q1 Review",        date:"Mar 3",  time:"10:00 AM", type:"meeting",  color:C.cyan   },
            { title:"Design Sync",      date:"Mar 11", time:"2:00 PM",  type:"meeting",  color:C.cyan   },
            { title:"Project Deadline", date:"Mar 11", time:"5:00 PM",  type:"deadline", color:C.red    },
            { title:"1:1 with Manager", date:"Mar 18", time:"11:00 AM", type:"meeting",  color:C.cyan   },
            { title:"Product Demo",     date:"Mar 25", time:"3:00 PM",  type:"meeting",  color:C.purple },
          ].map((ev, i) => (
            <div key={i} className="glass ghover" style={{ display:"flex",alignItems:"center",gap:16,padding:"14px 20px",borderRadius:14,cursor:"default" }}>
              <div style={{ width:48,textAlign:"center" }}>
                <p className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".1em" }}>MAR</p>
                <p className="fd" style={{ fontSize:22,color:"#1e2535",lineHeight:1 }}>{ev.date.split(" ")[1]}</p>
              </div>
              <div style={{ width:1,height:32,background:`${ev.color}60`,flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14,color:"#1e2535",fontWeight:500 }}>{ev.title}</p>
                <p className="fm" style={{ fontSize:11,color:"#64748b",marginTop:2 }}>{ev.time}</p>
              </div>
              <Tag color={ev.color}>{ev.type}</Tag>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Accounts ─────────────────────────────────────────────────────────────────
function AccountsSection() {
  const [accounts, setAccounts] = useState<Account[]>(ACCOUNTS);
  const toggle = (id: string) => setAccounts(a => a.map(x => x.id===id ? {...x,tracking:!x.tracking} : x));

  return (
    <Section>
      <PageHead title="Accounts" />
      <div className="fu d1 col3" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
        {[
          { label:"Total Connected",    value:"3",   color:C.green },
          { label:"Currently Tracking", value:"2",   color:C.cyan  },
          { label:"Total Unread",       value:"262", color:C.pink  },
        ].map((m, i) => (
          <div key={i} className="glass inset" style={{ padding:"18px 20px",borderRadius:14,textAlign:"center" }}>
            <p className="fd" style={{ fontSize:32,color:m.color }}>{m.value}</p>
            <p className="fm" style={{ fontSize:9,color:"#94a3b8",marginTop:6,letterSpacing:".1em" }}>{m.label.toUpperCase()}</p>
          </div>
        ))}
      </div>

      <button className="fu d2" style={{ display:"flex",alignItems:"center",gap:16,padding:"18px 24px",borderRadius:16,border:"1px dashed #cbd5e1",background:"transparent",color:"#64748b",cursor:"pointer",width:"100%",textAlign:"left",transition:"all .3s",fontFamily:"Space Grotesk,sans-serif" }}
        onMouseEnter={e => { const el=e.currentTarget as HTMLButtonElement; el.style.borderColor=C.green; el.style.color=C.green; el.style.background=`${C.green}08`; }}
        onMouseLeave={e => { const el=e.currentTarget as HTMLButtonElement; el.style.borderColor="#cbd5e1"; el.style.color="#64748b"; el.style.background="transparent"; }}>
        <div style={{ width:44,height:44,borderRadius:12,border:"1px dashed currentColor",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>+</div>
        <div>
          <p style={{ fontSize:14,fontWeight:500 }}>Connect a Gmail Account</p>
          <p className="fm" style={{ fontSize:11,color:"#94a3b8",marginTop:2 }}>OAuth 2.0 · AES-256 Encrypted · Read-only scopes</p>
        </div>
        <span style={{ marginLeft:"auto",fontSize:18 }}>→</span>
      </button>

      <div className="fu d3" style={{ display:"flex",flexDirection:"column",gap:16 }}>
        {accounts.map(a => (
          <div key={a.id} className="glass inset" style={{ borderRadius:20,padding:24,transition:"all .3s",opacity:a.tracking?1:.5 }}>
            <div style={{ display:"flex",alignItems:"center",gap:16 }}>
              <div style={{ width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${a.color},${a.color}99)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0,boxShadow:`0 4px 14px ${a.color}40` }}>{a.avatar}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <p style={{ fontSize:15,fontWeight:600,color:"#1e2535" }}>{a.name}</p>
                  <Tag color={a.tracking?C.green:"#94a3b8"}>{a.tracking?"● ACTIVE":"○ PAUSED"}</Tag>
                </div>
                <p className="fm" style={{ fontSize:12,color:"#64748b",marginTop:3 }}>{a.email}</p>
                <div style={{ display:"flex",gap:12,marginTop:5 }}>
                  <span className="fm" style={{ fontSize:11,color:"#64748b" }}>{a.unread} unread</span>
                  <span style={{ color:"#e2e8f0" }}>·</span>
                  <span className="fm" style={{ fontSize:11,color:"#94a3b8" }}>synced {a.lastSync}</span>
                </div>
              </div>
              <button className="toggle" onClick={() => toggle(a.id)} style={{ background:a.tracking?a.color:"#e2e8f0" }}>
                <div className="knob" style={{ left:a.tracking?"23px":"3px" }}/>
              </button>
            </div>
            {a.tracking && <>
              <div className="divider" style={{ margin:"20px 0" }}/>
              <div style={{ marginBottom:14 }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                  <span className="fm" style={{ fontSize:9,color:"#94a3b8",letterSpacing:".1em" }}>STORAGE USED</span>
                  <span className="fm" style={{ fontSize:10,color:a.color,fontWeight:600 }}>{a.storage}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width:`${a.storage}%`,background:a.storage>80?C.red:a.color }}/>
                </div>
              </div>
              <div className="col3" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10 }}>
                {[{label:"Daily Summary",value:"8:00 AM"},{label:"Weekly Digest",value:"Sunday"},{label:"Auto-Schedule",value:"Enabled"}].map(s => (
                  <div key={s.label} style={{ textAlign:"center",padding:"10px 12px",borderRadius:10,background:`${a.color}08`,border:`1px solid ${a.color}25` }}>
                    <p className="fm" style={{ fontSize:9,color:"#94a3b8",marginBottom:4,letterSpacing:".08em" }}>{s.label.toUpperCase()}</p>
                    <p style={{ fontSize:13,fontWeight:600,color:a.color }}>{s.value}</p>
                  </div>
                ))}
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
function SummariesSection() {
  const [tab, setTab] = useState<"daily"|"weekly">("daily");

  const daily: DailySummary[] = [
    { kind:"daily", date:"Feb 27", account:"work.alex@gmail.com", count:14, color:C.cyan,  preview:"Follow-up from design team, billing alert from Stripe, 3 high-priority items flagged. Zoom link at 2PM auto-scheduled.", sentiment:"⚠️ Action needed"   },
    { kind:"daily", date:"Feb 27", account:"alex@gmail.com",      count:5,  color:C.green, preview:"Personal correspondence, one dinner invitation, a reply from a friend, and a bank notification.",                       sentiment:"✓ No action"       },
    { kind:"daily", date:"Feb 26", account:"work.alex@gmail.com", count:9,  color:C.cyan,  preview:"Sprint planning notes, standup reminders, 1 Zoom link auto-scheduled. Product roadmap thread active.",                  sentiment:"📅 1 meeting added" },
    { kind:"daily", date:"Feb 26", account:"alex@gmail.com",      count:3,  color:C.green, preview:"Newsletter, bank statement notification, family group reply.",                                                           sentiment:"✓ No action"       },
    { kind:"daily", date:"Feb 25", account:"work.alex@gmail.com", count:21, color:C.cyan,  preview:"High email volume. Client contract thread escalated. 2 meetings scheduled. Legal review flagged.",                      sentiment:"⚠️ Escalation"     },
  ];

  const weekly: WeeklySummary[] = [
    { kind:"weekly", week:"Feb 21 – 27", account:"work.alex@gmail.com", count:98,  color:C.cyan,   highlights:["5 meetings scheduled","12 high-priority threads","3 pending replies","Avg response: 3.2h"] },
    { kind:"weekly", week:"Feb 21 – 27", account:"alex@gmail.com",      count:31,  color:C.green,  highlights:["2 events detected","1 subscription renewed","4 personal threads","Avg response: 6.1h"]    },
    { kind:"weekly", week:"Feb 14 – 20", account:"work.alex@gmail.com", count:112, color:C.cyan,   highlights:["7 meetings scheduled","Avg response: 2.8h","Product demo thread","Contract renewal"]       },
    { kind:"weekly", week:"Feb 7 – 13",  account:"work.alex@gmail.com", count:87,  color:C.purple, highlights:["4 meetings","Avg response: 4.1h","Onboarding docs sent","Q1 planning begun"]               },
  ];

  const items: Summary[] = tab==="daily" ? daily : weekly;

  return (
    <Section>
      <PageHead title="Summaries" />
      <div className="fu d1" style={{ display:"flex",gap:4,padding:4,borderRadius:14,background:"#f1f5f9",border:"1px solid #e2e8f0",width:"fit-content" }}>
        {(["daily","weekly"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:"8px 22px",borderRadius:10,fontSize:13,fontWeight:500,cursor:"pointer",textTransform:"capitalize",transition:"all .22s",background:tab===t?"#ffffff":"transparent",color:tab===t?"#1e2535":"#64748b",border:tab===t?"1px solid #e2e8f0":"1px solid transparent",boxShadow:tab===t?"0 1px 4px rgba(0,0,0,.08)":"none",fontFamily:"Space Grotesk,sans-serif" }}>{t}</button>
        ))}
      </div>

      <div className="fu d2" style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {items.map((item, i) => (
          <div key={i} className="glass inset ghover" style={{ borderRadius:16,padding:"20px 24px",cursor:"default",borderLeft:`3px solid ${item.color}` }}>
            <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10,flexWrap:"wrap" }}>
              <span className="fm" style={{ fontSize:11,color:item.color,fontWeight:600 }}>{item.account}</span>
              <span style={{ color:"#e2e8f0" }}>·</span>
              <span className="fm" style={{ fontSize:11,color:"#94a3b8" }}>{item.kind==="daily" ? item.date : item.week}</span>
              <span className="tag" style={{ marginLeft:"auto",background:"#f1f5f9",color:"#64748b",border:"1px solid #e2e8f0" }}>{item.count} emails</span>
            </div>
            {item.kind==="daily" ? (
              <>
                <p style={{ fontSize:13.5,color:"#475569",lineHeight:1.72 }}>{item.preview}</p>
                <p className="fm" style={{ fontSize:11,color:"#64748b",marginTop:10 }}>{item.sentiment}</p>
              </>
            ) : (
              <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                {item.highlights.map((h: string, hi: number) => (
                  <span key={hi} className="fm" style={{ fontSize:11,padding:"4px 10px",borderRadius:6,background:`${item.color}10`,border:`1px solid ${item.color}30`,color:item.color,fontWeight:600 }}>{h}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="fu d3 glass" style={{ borderRadius:16,padding:"18px 22px",display:"flex",alignItems:"center",gap:16,borderColor:`${C.green}30`,background:`${C.green}05` }}>
        <div style={{ width:36,height:36,borderRadius:10,background:`${C.green}18`,border:`1px solid ${C.green}35`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16 }}>✦</div>
        <div>
          <p style={{ fontSize:13,color:"#475569",lineHeight:1.6 }}>
            Summaries generated by <strong style={{ color:C.green }}>Groq · LLaMA 3.1 70B</strong> using only in-memory email metadata. Full email content is never stored.
          </p>
          <p className="fm" style={{ fontSize:10,color:"#94a3b8",marginTop:5,letterSpacing:".08em" }}>
            LATENCY: ~280ms · PRIVACY: COMPLIANT · REFRESH: EVERY 15 MIN
          </p>
        </div>
      </div>
    </Section>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function SettingsSection() {
  const [s, setS] = useState<Settings>({
    aiSummary:true, autoSchedule:true, notifications:true, darkMode:true,
    compactView:false, weeklyDigest:true, priorityAlerts:true, analytics:false,
  });
  const tog = (k: SettingsKey) => setS(x => ({...x,[k]:!x[k]}));

  const groups: { label:string; icon:string; color:string; items:{key:SettingsKey;label:string;desc:string}[] }[] = [
    { label:"AI Features",   icon:"✦", color:C.green,  items:[
      { key:"aiSummary",      label:"Daily AI Summary",       desc:"Generate a morning AI summary of your inbox at 8:00 AM" },
      { key:"weeklyDigest",   label:"Weekly Digest",          desc:"Receive a weekly rollup every Sunday with trends and highlights" },
      { key:"autoSchedule",   label:"Auto-Schedule Meetings", desc:"Detect meeting links in emails and add them to your calendar" },
      { key:"priorityAlerts", label:"Priority Alerts",        desc:"AI flags high-priority emails for immediate attention" },
    ]},
    { label:"Notifications", icon:"◈", color:C.cyan,   items:[
      { key:"notifications",  label:"Push Notifications",     desc:"Browser notifications for high-priority emails and detected meetings" },
    ]},
    { label:"Privacy",       icon:"🔒", color:C.amber,  items:[
      { key:"analytics",      label:"Usage Analytics",        desc:"Share anonymized usage data to help improve InboxAI" },
    ]},
    { label:"Interface",     icon:"◫", color:C.purple, items:[
      { key:"darkMode",       label:"Dark Mode",              desc:"Always-on dark theme — optimized for extended reading sessions" },
      { key:"compactView",    label:"Compact View",           desc:"Reduce spacing and padding for higher information density" },
    ]},
  ];

  return (
    <Section>
      <PageHead title="Settings" />
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
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:14,color:s[item.key]?"#1e2535":"#94a3b8",fontWeight:500,transition:"color .2s" }}>{item.label}</p>
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
          {["Disconnect All Accounts","Clear Summary History","Delete My Account"].map((label, i) => (
            <button key={i} style={{ fontSize:12,padding:"8px 16px",borderRadius:10,border:`1px solid ${C.red}35`,background:`${C.red}08`,color:C.red,cursor:"pointer",transition:"all .2s",fontFamily:"Space Grotesk,sans-serif",fontWeight:500 }}
              onMouseEnter={e => { const el=e.currentTarget as HTMLButtonElement; el.style.background=`${C.red}18`; el.style.borderColor=`${C.red}55`; }}
              onMouseLeave={e => { const el=e.currentTarget as HTMLButtonElement; el.style.background=`${C.red}08`; el.style.borderColor=`${C.red}35`; }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ textAlign:"center",paddingBottom:8 }}>
        <p className="fm" style={{ fontSize:9,color:"#cbd5e1",letterSpacing:".12em" }}>INBOXAI v2.0.0 · POWERED BY GROQ · MADE WITH ♥</p>
      </div>
    </Section>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Page() {
  const [active, setActive] = useState("dashboard");
  const [key,    setKey]    = useState(0);

  const nav = [
    { id:"dashboard", icon:"◈", label:"Dashboard" },
    { id:"calendar",  icon:"◫", label:"Calendar"  },
    { id:"summaries", icon:"✦", label:"Summaries" },
    { id:"accounts",  icon:"◉", label:"Accounts"  },
    { id:"settings",  icon:"⚙", label:"Settings"  },
  ];

  function go(id: string) { setActive(id); setKey(k => k+1); window.scrollTo(0,0); }

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:"100vh",background:"#f0f4f9",display:"flex",overflow:"hidden",position:"relative" }}>
        <div className="orb orb1"/><div className="orb orb2"/><div className="orb orb3"/>

        {/* ── Sidebar — fully light ── */}
        <aside className="sidebar sidebar-light" style={{ position:"fixed",top:0,left:0,bottom:0,width:220,zIndex:50,display:"flex",flexDirection:"column",padding:"28px 16px" }}>

          {/* Logo */}
          <div style={{ display:"flex",alignItems:"center",gap:12,padding:"0 8px",marginBottom:36 }}>
            <div style={{ width:38,height:38,borderRadius:12,background:"rgba(255,255,255,.25)",border:"1px solid rgba(255,255,255,.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",fontWeight:700 }}>✉</div>
            <div>
              <p className="fd" style={{ fontSize:17,color:"#fff",fontWeight:700,letterSpacing:"-.02em" }}>InboxAI</p>
              <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.7)",letterSpacing:".12em",fontWeight:600 }}>POWERED BY GROQ</p>
            </div>
          </div>

          {/* Nav links */}
          <nav style={{ flex:1,display:"flex",flexDirection:"column",gap:2 }}>
            <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.45)",letterSpacing:".15em",padding:"0 12px",marginBottom:8 }}>NAVIGATION</p>
            {nav.map(n => (
              <button key={n.id} onClick={() => go(n.id)} className={`nav-btn ${active===n.id?"nav-active":""}`}>
                <span style={{ fontSize:16,color:active===n.id?"#fff":"rgba(255,255,255,.6)",transition:"color .2s" }}>{n.icon}</span>
                {n.label}
                {active===n.id && <span style={{ marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:"#fff",display:"inline-block",opacity:.9 }}/>}
              </button>
            ))}
          </nav>

          <div style={{ height:1,background:"rgba(255,255,255,.2)",margin:"20px 8px" }}/>

          {/* Active inboxes */}
          <div>
            <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.45)",letterSpacing:".14em",padding:"0 4px",marginBottom:10 }}>ACTIVE INBOXES</p>
            {ACCOUNTS.filter(a => a.tracking).map(a => (
              <div key={a.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:8,cursor:"pointer",transition:"background .2s" }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.15)"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}>
                <div style={{ width:26,height:26,borderRadius:8,background:"rgba(255,255,255,.22)",border:"1px solid rgba(255,255,255,.35)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0 }}>{a.avatar}</div>
                <p className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.7)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1 }}>{a.email}</p>
                {a.unread>0 && <span className="fm" style={{ fontSize:10,color:"#fff",background:"rgba(255,255,255,.25)",padding:"1px 6px",borderRadius:4,flexShrink:0,fontWeight:600,border:"1px solid rgba(255,255,255,.3)" }}>{a.unread}</span>}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="main-offset" style={{ flex:1,overflowY:"auto",position:"relative",zIndex:10,paddingLeft:220 }}>
          <div key={key} className="main-pad" style={{ maxWidth:960,margin:"0 auto",padding:"48px 40px" }}>
            {active==="dashboard" && <Dashboard/>}
            {active==="calendar"  && <CalendarSection/>}
            {active==="summaries" && <SummariesSection/>}
            {active==="accounts"  && <AccountsSection/>}
            {active==="settings"  && <SettingsSection/>}
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
      </div>
    </>
  );
}