"use client";

import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Account {
  id: string;
  email: string;
  name: string;
  avatar: string;
  color: string;
  tracking: boolean;
  unread: number;
  lastSync: string;
  storage: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  type: string;
  account: string;
  link?: string;
  color: string;
}

interface DailySummary {
  kind: "daily";
  date: string;
  account: string;
  count: number;
  color: string;
  preview: string;
  sentiment: string;
}

interface WeeklySummary {
  kind: "weekly";
  week: string;
  account: string;
  count: number;
  color: string;
  highlights: string[];
}

type Summary = DailySummary | WeeklySummary;

type SettingsKey =
  | "aiSummary"
  | "autoSchedule"
  | "notifications"
  | "darkMode"
  | "compactView"
  | "weeklyDigest"
  | "priorityAlerts"
  | "analytics";

type Settings = Record<SettingsKey, boolean>;

// ─── Data ─────────────────────────────────────────────────────────────────────
const ACCOUNTS: Account[] = [
  { id: "1", email: "alex@gmail.com",        name: "Alex M.",     avatar: "AM", color: "#00ffaa", tracking: true,  unread: 12,  lastSync: "2 min ago", storage: 68 },
  { id: "2", email: "work.alex@gmail.com",   name: "Work",        avatar: "WK", color: "#38d9ff", tracking: true,  unread: 47,  lastSync: "Just now",  storage: 42 },
  { id: "3", email: "newsletter@gmail.com",  name: "Newsletters", avatar: "NL", color: "#ff5cf7", tracking: false, unread: 203, lastSync: "1 hr ago",  storage: 91 },
];

const CALENDAR_DATA: Record<number, CalendarEvent[]> = {
  3:  [{ id:"e1",  title:"Q1 Review",        time:"10:00 AM", type:"meeting",  account:"work.alex@gmail.com", link:"https://meet.google.com/abc", color:"#38d9ff" }],
  7:  [{ id:"e2",  title:"Weekly Summary",   time:"All day",  type:"summary",  account:"alex@gmail.com",                                         color:"#00ffaa" }],
  11: [{ id:"e3",  title:"Design Sync",      time:"2:00 PM",  type:"meeting",  account:"work.alex@gmail.com", link:"https://zoom.us/j/123",       color:"#38d9ff" },
       { id:"e4",  title:"Project Deadline", time:"5:00 PM",  type:"deadline", account:"work.alex@gmail.com",                                    color:"#ff5252" }],
  14: [{ id:"e5",  title:"Weekly Summary",   time:"All day",  type:"summary",  account:"alex@gmail.com",                                         color:"#00ffaa" }],
  18: [{ id:"e6",  title:"1:1 with Manager", time:"11:00 AM", type:"meeting",  account:"work.alex@gmail.com", link:"https://meet.google.com/xyz", color:"#38d9ff" }],
  21: [{ id:"e7",  title:"Weekly Summary",   time:"All day",  type:"summary",  account:"alex@gmail.com",                                         color:"#00ffaa" }],
  25: [{ id:"e8",  title:"Product Demo",     time:"3:00 PM",  type:"meeting",  account:"work.alex@gmail.com", link:"https://zoom.us/j/456",       color:"#b96dff" }],
  27: [{ id:"e11", title:"Q1 Close Deadline",time:"EOD",      type:"deadline", account:"work.alex@gmail.com",                                    color:"#ff5252" }],
  28: [{ id:"e9",  title:"Weekly Summary",   time:"All day",  type:"summary",  account:"alex@gmail.com",                                         color:"#00ffaa" }],
};

const DAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const getFirstDay   = (y: number, m: number) => new Date(y, m, 1).getDay();

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,400;1,700&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:#05080f; color:#fff; font-family:'Space Grotesk',sans-serif; }
  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:4px; }
  .fd { font-family:'Playfair Display',serif; }
  .fm { font-family:'JetBrains Mono',monospace; }

  @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulseRing { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.4);opacity:0} }
  @keyframes drift { 0%,100%{transform:translate(0,0)} 50%{transform:translate(25px,-18px)} }
  @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }

  .fu { animation:fadeUp 0.5s ease both; }
  .d1{animation-delay:.07s} .d2{animation-delay:.14s} .d3{animation-delay:.21s} .d4{animation-delay:.28s} .d5{animation-delay:.35s}

  .orb { position:fixed; border-radius:50%; pointer-events:none; z-index:0; }
  .orb1 { width:700px;height:700px;top:-280px;left:-200px;background:radial-gradient(circle,rgba(0,255,170,.09) 0%,transparent 70%);animation:drift 20s ease-in-out infinite; }
  .orb2 { width:600px;height:600px;bottom:-120px;right:-140px;background:radial-gradient(circle,rgba(185,109,255,.08) 0%,transparent 70%);animation:drift 26s ease-in-out infinite reverse; }
  .orb3 { width:400px;height:400px;top:40%;left:42%;background:radial-gradient(circle,rgba(56,217,255,.05) 0%,transparent 70%);animation:drift 18s ease-in-out infinite;animation-delay:-8s; }

  .glass { background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(14px); }
  .inset { box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 40px rgba(0,0,0,.55); }
  .ghover { transition:background .22s,transform .22s; }
  .ghover:hover { background:rgba(255,255,255,.065)!important;transform:translateY(-1px); }
  .divider { height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,.09),transparent); }

  .tag {
    display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:5px;
    font-size:10px;letter-spacing:.07em;text-transform:uppercase;
    font-family:'JetBrains Mono',monospace;font-weight:500;
  }
  .progress-bar { height:2px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden; }
  .progress-fill { height:100%;border-radius:2px;transition:width 1.2s ease; }
  .toggle { width:44px;height:24px;border-radius:12px;position:relative;cursor:pointer;transition:background .3s;flex-shrink:0;border:none; }
  .knob { position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .3s cubic-bezier(.34,1.56,.64,1);box-shadow:0 2px 8px rgba(0,0,0,.4); }
  .sparkline { display:flex;align-items:flex-end;gap:2px;height:32px; }
  .sbar { width:4px;min-height:4px;border-radius:2px 2px 0 0; }
  .live::before { content:'';position:absolute;inset:-3px;border-radius:50%;background:inherit;animation:pulseRing 2s ease-out infinite; }
  .ticker-wrap { overflow:hidden; }
  .ticker-inner { display:flex;width:max-content;animation:ticker 32s linear infinite; }
  .ticker-inner:hover { animation-play-state:paused; }

  .nav-btn {
    display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:10px;cursor:pointer;
    font-size:13px;font-weight:500;transition:all .2s;border:1px solid transparent;background:transparent;
    color:rgba(255,255,255,.38);text-align:left;font-family:'Space Grotesk',sans-serif;
  }
  .nav-btn:hover { color:rgba(255,255,255,.78);background:rgba(255,255,255,.05); }
  .nav-active { background:rgba(0,255,170,.09)!important;border-color:rgba(0,255,170,.22)!important;color:#fff!important; }
  .trrow td { transition:background .15s; }
  .trrow:hover td { background:rgba(255,255,255,.025); }

  .bottom-nav {
    display:none;position:fixed;bottom:0;left:0;right:0;z-index:100;
    background:rgba(5,8,15,.97);border-top:1px solid rgba(255,255,255,.09);
    backdrop-filter:blur(22px);padding:6px 0 max(8px,env(safe-area-inset-bottom));
  }
  .bnav-item {
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:3px;flex:1;padding:4px 0;cursor:pointer;border:none;background:transparent;
    color:rgba(255,255,255,.3);font-family:'Space Grotesk',sans-serif;
    font-size:10px;font-weight:500;transition:color .2s;letter-spacing:.02em;
  }
  .bnav-item.active { color:#00ffaa; }
  .bnav-icon { font-size:19px;line-height:1; }

  @media (max-width:768px) {
    .sidebar { display:none!important; }
    .bottom-nav { display:flex!important; }
    .main-offset { padding-left:0!important; }
    .main-pad { padding:24px 18px 88px!important; }
    .col2 { grid-template-columns:1fr!important; }
    .stats-grid { grid-template-columns:repeat(2,1fr)!important; }
    .col3 { grid-template-columns:1fr 1fr!important; }
    .hide-mob { display:none!important; }
    .title-lg { font-size:34px!important; }
  }
  @media (max-width:460px) {
    .stats-grid { grid-template-columns:1fr 1fr!important; }
  }
`;

// ─── Shared Components ────────────────────────────────────────────────────────
function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ display:"flex",flexDirection:"column",gap:34 }}>{children}</div>;
}
function PageHead({ title }: { title: string }) {
  return (
    <div className="fu">
      <h2 className="fd title-lg" style={{ fontSize:46,color:"#fff",fontWeight:700,lineHeight:1.05 }}>{title}</h2>
    </div>
  );
}
function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className="tag" style={{ background:`${color}1a`,color,border:`1px solid ${color}30` }}>{children}</span>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const spark = [14,22,18,31,27,9,35,28,19,42,38,31,27,45];

  return (
    <Section>
      {/* Header */}
      <div className="fu" style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16 }}>
        <div>
          <p className="fm" style={{ fontSize:10,color:"rgba(0,255,170,.75)",letterSpacing:".22em",marginBottom:10 }}>INBOX INTELLIGENCE DASHBOARD</p>
          <h1 className="fd" style={{ fontSize:52,color:"#fff",fontWeight:700,lineHeight:1.1 }}>
            Good morning,<br/><span style={{ fontStyle:"italic",color:"#00ffaa" }}>Alex.</span>
          </h1>
          <p style={{ fontSize:13,color:"rgba(255,255,255,.4)",marginTop:12 }}>Friday, February 27 · Your inboxes are active and monitored.</p>
        </div>
        <div className="glass inset" style={{ padding:"16px 22px",borderRadius:16,textAlign:"right" }}>
          <p className="fm" style={{ fontSize:26,color:"#fff",letterSpacing:"-.02em" }}>
            {time.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
          </p>
          <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.22)",marginTop:4,letterSpacing:".12em" }}>SYSTEM CLOCK · UTC+0</p>
          <div style={{ display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end",marginTop:10 }}>
            <span className="live" style={{ position:"relative",width:7,height:7,borderRadius:"50%",background:"#00ffaa",display:"inline-block" }}/>
            <span className="fm" style={{ fontSize:9,color:"rgba(0,255,170,.8)",letterSpacing:".1em" }}>GROQ · CONNECTED</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="fu d1 stats-grid" style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(152px,1fr))",gap:14 }}>
        {[
          { label:"Emails Today",   value:"31",  delta:"+8",  sub:"vs yesterday",   color:"#00ffaa", spark:true  },
          { label:"Total Unread",   value:"59",  delta:"-12", sub:"since morning",  color:"#38d9ff", spark:false },
          { label:"Meetings Found", value:"2",   delta:"+2",  sub:"auto-scheduled", color:"#b96dff", spark:false },
          { label:"Response Rate",  value:"94%", delta:"+3%", sub:"7-day average",  color:"#ffb830", spark:false },
          { label:"Tracked Accts",  value:"2/3", delta:"",    sub:"1 paused",       color:"#ff5cf7", spark:false },
        ].map((s, i) => (
          <div key={i} className="glass inset ghover" style={{ padding:"20px 18px",borderRadius:16,cursor:"default" }}>
            <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.3)",letterSpacing:".12em",marginBottom:10 }}>{s.label.toUpperCase()}</p>
            <p className="fd" style={{ fontSize:36,color:"#fff",lineHeight:1 }}>{s.value}</p>
            {s.spark && (
              <div className="sparkline" style={{ marginTop:10 }}>
                {spark.map((v, j) => <div key={j} className="sbar" style={{ height:`${(v/45)*100}%`,background:j===spark.length-1?s.color:`${s.color}38` }}/>)}
              </div>
            )}
            <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:s.spark?8:14 }}>
              {s.delta && <span className="fm" style={{ fontSize:11,color:s.delta.startsWith("+")?"#00ffaa":"#ff5252" }}>{s.delta}</span>}
              <span style={{ fontSize:11,color:"rgba(255,255,255,.3)" }}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary + Activity */}
      <div className="fu d2 col2" style={{ display:"grid",gridTemplateColumns:"1fr 300px",gap:20 }}>
        <div className="glass inset" style={{ borderRadius:20,padding:28,borderColor:"rgba(0,255,170,.16)",background:"rgba(0,255,170,.03)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20 }}>
            <div style={{ width:38,height:38,borderRadius:12,background:"rgba(0,255,170,.16)",border:"1px solid rgba(0,255,170,.26)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17 }}>✦</div>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:600,color:"#00ffaa",fontSize:13 }}>AI Daily Summary</p>
              <p className="fm" style={{ fontSize:10,color:"rgba(255,255,255,.25)",marginTop:2 }}>groq/llama-3.1-70b · generated 2m ago</p>
            </div>
            <Tag color="#00ffaa">TODAY</Tag>
          </div>
          <div className="divider" style={{ marginBottom:20 }}/>
          <p style={{ fontSize:13.5,color:"rgba(255,255,255,.65)",lineHeight:1.78 }}>
            Your inbox across <strong style={{ color:"#fff" }}>2 accounts</strong> saw moderate activity today.{" "}
            <strong style={{ color:"#38d9ff" }}>work.alex@gmail.com</strong> received{" "}
            <strong style={{ color:"#fff" }}>14 new messages</strong> — 3 flagged as high-priority including a follow-up from the design team and a billing alert.{" "}
            <strong style={{ color:"#00ffaa" }}>alex@gmail.com</strong> had 5 messages, mostly personal correspondence.
          </p>
          <div style={{ marginTop:20,padding:"14px 16px",borderRadius:12,background:"rgba(255,255,255,.028)",border:"1px solid rgba(255,255,255,.07)" }}>
            <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.3)",marginBottom:10,letterSpacing:".12em" }}>AI DETECTED ACTIONS</p>
            {[
              { icon:"📅", text:"Zoom call at 2:00 PM auto-added to calendar",   color:"#38d9ff" },
              { icon:"📅", text:"Google Meet at 4:30 PM auto-added to calendar",  color:"#38d9ff" },
              { icon:"⚠️", text:"Stripe billing alert — action recommended",      color:"#ffb830" },
            ].map((a, i) => (
              <div key={i} style={{ display:"flex",alignItems:"center",gap:10,marginTop:i>0?8:0 }}>
                <span style={{ fontSize:13 }}>{a.icon}</span>
                <span style={{ fontSize:12,color:"rgba(255,255,255,.55)" }}>{a.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass inset" style={{ borderRadius:20,padding:22 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
            <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.3)",letterSpacing:".15em" }}>LIVE ACTIVITY</p>
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <span className="live" style={{ position:"relative",width:5,height:5,borderRadius:"50%",background:"#00ffaa",display:"inline-block" }}/>
              <span className="fm" style={{ fontSize:9,color:"rgba(0,255,170,.7)" }}>LIVE</span>
            </div>
          </div>
          {[
            { time:"09:41",type:"email",text:"Stripe billing alert received",  color:"#ff5252",border:"rgba(255,82,82,.35)"  },
            { time:"09:38",type:"sync", text:"Inbox synced — 3 new messages",  color:"#00ffaa",border:"transparent"          },
            { time:"09:22",type:"ai",   text:"Daily summary generated",        color:"#b96dff",border:"transparent"          },
            { time:"09:15",type:"email",text:"Design team follow-up",          color:"#ffb830",border:"rgba(255,184,48,.28)" },
            { time:"08:59",type:"cal",  text:"Meeting detected: Design Sync",  color:"#38d9ff",border:"transparent"          },
            { time:"08:44",type:"email",text:"Personal message from Jordan",   color:"#00ffaa",border:"transparent"          },
            { time:"08:30",type:"sync", text:"Accounts synced on startup",     color:"#00ffaa",border:"transparent"          },
          ].map((a, i) => (
            <div key={i} style={{ display:"flex",gap:10,padding:"9px 10px 9px 13px",borderRadius:8,borderLeft:`2px solid ${a.border}`,marginBottom:2,transition:"background .2s",cursor:"default" }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.035)"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}>
              <div style={{ width:26,height:26,borderRadius:7,background:`${a.color}1a`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12 }}>
                {a.type==="email"?"✉":a.type==="ai"?"✦":a.type==="cal"?"◫":"⟳"}
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:12,color:"rgba(255,255,255,.72)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{a.text}</p>
                <p className="fm" style={{ fontSize:10,color:"rgba(255,255,255,.25)",marginTop:1 }}>{a.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Digest */}
      <div className="fu d3 glass inset" style={{ borderRadius:20,padding:28,borderColor:"rgba(185,109,255,.2)",background:"rgba(185,109,255,.04)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20 }}>
          <div style={{ width:38,height:38,borderRadius:12,background:"rgba(185,109,255,.18)",border:"1px solid rgba(185,109,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17 }}>◈</div>
          <div style={{ flex:1 }}>
            <p style={{ fontWeight:600,color:"#b96dff",fontSize:13 }}>AI Weekly Digest</p>
            <p className="fm" style={{ fontSize:10,color:"rgba(255,255,255,.25)",marginTop:2 }}>FEB 21 – FEB 27 · 2026</p>
          </div>
          <Tag color="#b96dff">THIS WEEK</Tag>
        </div>
        <div className="divider" style={{ marginBottom:20 }}/>
        <div className="col2" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:24 }}>
          <p style={{ fontSize:13.5,color:"rgba(255,255,255,.62)",lineHeight:1.8 }}>
            This week you received <strong style={{ color:"#fff" }}>183 emails</strong> across all tracked accounts.
            Key themes: product roadmap <span style={{ color:"rgba(255,255,255,.4)" }}>(28)</span>,
            client comms <span style={{ color:"rgba(255,255,255,.4)" }}>(41)</span>,
            automated reports <span style={{ color:"rgba(255,255,255,.4)" }}>(67)</span>.
            Average response time: <strong style={{ color:"#00ffaa" }}>3.2 hours</strong>.
            Five meetings auto-detected. Three newsletters arrived but account is paused.
          </p>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            {[
              { label:"Emails",       value:"183",  color:"#b96dff" },
              { label:"Meetings",     value:"5",    color:"#38d9ff" },
              { label:"Avg Response", value:"3.2h", color:"#00ffaa" },
              { label:"Threads",      value:"41",   color:"#ffb830" },
            ].map((m, i) => (
              <div key={i} style={{ padding:"14px 12px",borderRadius:12,background:"rgba(255,255,255,.035)",border:"1px solid rgba(255,255,255,.07)",textAlign:"center" }}>
                <p className="fd" style={{ fontSize:26,color:m.color }}>{m.value}</p>
                <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.32)",marginTop:4,letterSpacing:".1em" }}>{m.label.toUpperCase()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Meetings */}
      <div className="fu d4">
        <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.3)",letterSpacing:".15em",marginBottom:14 }}>AUTO-DETECTED MEETINGS</p>
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {[
            { title:"Design Sync",        time:"Today · 2:00 PM",      via:"Zoom",        account:"work.alex@gmail.com", color:"#38d9ff", status:"upcoming"   },
            { title:"Q1 Review Follow-up",time:"Tomorrow · 10:00 AM",  via:"Google Meet", account:"work.alex@gmail.com", color:"#38d9ff", status:"upcoming"   },
            { title:"Investor Call",      time:"Fri Mar 1 · 3:30 PM",  via:"Zoom",        account:"work.alex@gmail.com", color:"#b96dff", status:"scheduled"  },
          ].map((m, i) => (
            <div key={i} className="glass inset ghover" style={{ display:"flex",alignItems:"center",gap:16,padding:"16px 20px",borderRadius:14,cursor:"default" }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:m.color,boxShadow:`0 0 12px ${m.color}`,flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14,color:"#fff",fontWeight:500 }}>{m.title}</p>
                <p style={{ fontSize:12,color:"rgba(255,255,255,.38)",marginTop:2 }}>{m.time} · via {m.via}</p>
              </div>
              <p className="fm hide-mob" style={{ fontSize:11,color:"rgba(255,255,255,.22)" }}>{m.account}</p>
              <Tag color={m.color}>{m.status}</Tag>
              <button style={{ fontSize:12,padding:"7px 16px",borderRadius:8,border:`1px solid ${m.color}38`,background:`${m.color}12`,color:m.color,cursor:"pointer",transition:"all .2s",fontFamily:"Space Grotesk,sans-serif" }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = `${m.color}28`}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = `${m.color}12`}>
                Join →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Priority Threads */}
      <div className="fu d5">
        <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.3)",letterSpacing:".15em",marginBottom:14 }}>HIGH-PRIORITY THREADS</p>
        <div className="glass inset" style={{ borderRadius:16,overflow:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",minWidth:500 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid rgba(255,255,255,.07)" }}>
                {["Subject","From","Account","Time","Priority",""].map((h, i) => (
                  <th key={i} className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.28)",letterSpacing:".1em",padding:"12px 16px",textAlign:"left",fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { subject:"Stripe billing alert — action needed", from:"billing@stripe.com",  account:"work", time:"09:41 AM", priority:"high",   color:"#ff5252" },
                { subject:"Re: Design System v2 feedback",        from:"maya@company.com",    account:"work", time:"08:15 AM", priority:"medium", color:"#ffb830" },
                { subject:"Q1 OKR check-in — please review",      from:"manager@company.com", account:"work", time:"Yesterday",priority:"high",   color:"#ff5252" },
                { subject:"Contract renewal — expires soon",       from:"legal@vendor.com",   account:"work", time:"Feb 26",   priority:"medium", color:"#ffb830" },
              ].map((row, i) => (
                <tr key={i} className="trrow" style={{ borderBottom:"1px solid rgba(255,255,255,.045)",cursor:"default" }}>
                  <td style={{ fontSize:13,color:"rgba(255,255,255,.75)",padding:"13px 16px",maxWidth:230,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{row.subject}</td>
                  <td className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.4)",padding:"13px 16px" }}>{row.from}</td>
                  <td className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.32)",padding:"13px 16px" }}>{row.account}</td>
                  <td className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.3)",padding:"13px 16px" }}>{row.time}</td>
                  <td style={{ padding:"13px 16px" }}><Tag color={row.color}>{row.priority}</Tag></td>
                  <td style={{ padding:"13px 16px" }}>
                    <button className="fm" style={{ fontSize:10,color:"rgba(255,255,255,.3)",background:"none",border:"none",cursor:"pointer",transition:"color .2s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#fff"}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,.3)"}>VIEW →</button>
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

  function prev() { month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1); }
  function next() { month === 11 ? (setMonth(0),  setYear(y => y + 1)) : setMonth(m => m + 1); }

  return (
    <Section>
      <PageHead title="Calendar" />

      <div className="fu d1 col2" style={{ display:"grid",gridTemplateColumns:"1fr 280px",gap:22,alignItems:"start" }}>
        <div className="glass inset" style={{ borderRadius:20,padding:28 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28 }}>
            <button onClick={prev} style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",color:"#fff",cursor:"pointer",fontSize:18,transition:"all .2s" }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.14)"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.07)"}>‹</button>
            <div style={{ textAlign:"center" }}>
              <p className="fd" style={{ fontSize:22,color:"#fff",fontWeight:700 }}>{MONTHS[month]}</p>
              <p className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.3)",marginTop:2 }}>{year}</p>
            </div>
            <button onClick={next} style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",color:"#fff",cursor:"pointer",fontSize:18,transition:"all .2s" }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.14)"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.07)"}>›</button>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:8 }}>
            {DAYS.map(d => <div key={d} className="fm" style={{ textAlign:"center",fontSize:9,color:"rgba(255,255,255,.25)",letterSpacing:".1em",padding:"6px 0" }}>{d}</div>)}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i}/>;
              const evts: CalendarEvent[] = CALENDAR_DATA[day] ?? [];
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSel   = day === sel;
              return (
                <button key={i} onClick={() => setSel(day)} style={{ aspectRatio:"1",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .18s",border:isToday?"1px solid rgba(0,255,170,.5)":isSel?"1px solid rgba(255,255,255,.2)":"1px solid transparent",background:isSel?"rgba(0,255,170,.09)":"transparent",gap:3,padding:4 }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.05)"; }}
                  onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                  <span style={{ fontSize:12,fontWeight:isToday?700:400,color:isToday?"#00ffaa":isSel?"#fff":"rgba(255,255,255,.5)" }}>{day}</span>
                  {evts.length > 0 && <div style={{ display:"flex",gap:2 }}>{evts.slice(0,3).map((ev: CalendarEvent, ei: number) => <span key={ei} style={{ width:4,height:4,borderRadius:"50%",background:ev.color,boxShadow:`0 0 4px ${ev.color}` }}/>)}</div>}
                </button>
              );
            })}
          </div>
          <div className="divider" style={{ margin:"20px 0" }}/>
          <div style={{ display:"flex",gap:20 }}>
            {[{label:"Meeting",color:"#38d9ff"},{label:"Deadline",color:"#ff5252"},{label:"Summary",color:"#00ffaa"}].map(l => (
              <div key={l.label} style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:l.color,boxShadow:`0 0 6px ${l.color}` }}/>
                <span className="fm" style={{ fontSize:10,color:"rgba(255,255,255,.32)" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass inset" style={{ borderRadius:20,padding:24 }}>
          <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.25)",letterSpacing:".15em",marginBottom:4 }}>SELECTED</p>
          <p className="fd" style={{ fontSize:28,color:"#fff",fontWeight:700,marginBottom:20 }}>{MONTHS[month].slice(0,3)} {sel}</p>
          <div className="divider" style={{ marginBottom:20 }}/>
          {events.length === 0 ? (
            <div style={{ textAlign:"center",padding:"44px 0" }}>
              <p style={{ fontSize:32,marginBottom:12,opacity:.18 }}>◌</p>
              <p style={{ fontSize:13,color:"rgba(255,255,255,.28)" }}>No events this day</p>
            </div>
          ) : events.map((ev: CalendarEvent) => (
            <div key={ev.id} style={{ padding:16,borderRadius:14,background:`${ev.color}0c`,border:`1px solid ${ev.color}28`,marginBottom:10 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:ev.color,boxShadow:`0 0 8px ${ev.color}`,flexShrink:0 }}/>
                <Tag color={ev.color}>{ev.type}</Tag>
              </div>
              <p style={{ fontSize:14,color:"#fff",fontWeight:500 }}>{ev.title}</p>
              <p className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.38)",marginTop:4 }}>{ev.time}</p>
              <p className="fm" style={{ fontSize:10,color:ev.color,marginTop:4 }}>{ev.account}</p>
              {ev.link && (
                <a href={ev.link} target="_blank" rel="noreferrer" className="fm" style={{ display:"inline-flex",alignItems:"center",gap:6,marginTop:10,fontSize:11,color:ev.color,textDecoration:"none",padding:"5px 10px",borderRadius:8,border:`1px solid ${ev.color}32`,background:`${ev.color}0d` }}>
                  ↗ Join Meeting
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="fu d2">
        <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.3)",letterSpacing:".15em",marginBottom:14 }}>UPCOMING THIS MONTH</p>
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {[
            { title:"Q1 Review",        date:"Mar 3",  time:"10:00 AM", type:"meeting",  color:"#38d9ff" },
            { title:"Design Sync",      date:"Mar 11", time:"2:00 PM",  type:"meeting",  color:"#38d9ff" },
            { title:"Project Deadline", date:"Mar 11", time:"5:00 PM",  type:"deadline", color:"#ff5252" },
            { title:"1:1 with Manager", date:"Mar 18", time:"11:00 AM", type:"meeting",  color:"#38d9ff" },
            { title:"Product Demo",     date:"Mar 25", time:"3:00 PM",  type:"meeting",  color:"#b96dff" },
          ].map((ev, i) => (
            <div key={i} className="glass ghover" style={{ display:"flex",alignItems:"center",gap:16,padding:"14px 20px",borderRadius:14,cursor:"default" }}>
              <div style={{ width:48,textAlign:"center" }}>
                <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.28)",letterSpacing:".1em" }}>MAR</p>
                <p className="fd" style={{ fontSize:22,color:"#fff",lineHeight:1 }}>{ev.date.split(" ")[1]}</p>
              </div>
              <div style={{ width:1,height:32,background:`${ev.color}50`,flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14,color:"#fff",fontWeight:500 }}>{ev.title}</p>
                <p className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.32)",marginTop:2 }}>{ev.time}</p>
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
  const toggle = (id: string) => setAccounts(a => a.map(x => x.id === id ? { ...x, tracking: !x.tracking } : x));

  return (
    <Section>
      <PageHead title="Accounts" />

      <div className="fu d1 col3" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
        {[
          { label:"Total Connected",    value:"3",   color:"#00ffaa" },
          { label:"Currently Tracking", value:"2",   color:"#38d9ff" },
          { label:"Total Unread",       value:"262", color:"#ff5cf7" },
        ].map((m, i) => (
          <div key={i} className="glass inset" style={{ padding:"18px 20px",borderRadius:14,textAlign:"center" }}>
            <p className="fd" style={{ fontSize:32,color:m.color }}>{m.value}</p>
            <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.3)",marginTop:6,letterSpacing:".1em" }}>{m.label.toUpperCase()}</p>
          </div>
        ))}
      </div>

      <button className="fu d2" style={{ display:"flex",alignItems:"center",gap:16,padding:"18px 24px",borderRadius:16,border:"1px dashed rgba(255,255,255,.14)",background:"transparent",color:"rgba(255,255,255,.4)",cursor:"pointer",width:"100%",textAlign:"left",transition:"all .3s",fontFamily:"Space Grotesk,sans-serif" }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor="rgba(0,255,170,.35)"; el.style.color="#00ffaa"; el.style.background="rgba(0,255,170,.05)"; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor="rgba(255,255,255,.14)"; el.style.color="rgba(255,255,255,.4)"; el.style.background="transparent"; }}>
        <div style={{ width:44,height:44,borderRadius:12,border:"1px dashed currentColor",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>+</div>
        <div>
          <p style={{ fontSize:14,fontWeight:500 }}>Connect a Gmail Account</p>
          <p className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.25)",marginTop:2 }}>OAuth 2.0 · AES-256 Encrypted · Read-only scopes</p>
        </div>
        <span style={{ marginLeft:"auto",fontSize:18 }}>→</span>
      </button>

      <div className="fu d3" style={{ display:"flex",flexDirection:"column",gap:16 }}>
        {accounts.map(a => (
          <div key={a.id} className="glass inset" style={{ borderRadius:20,padding:24,transition:"all .3s",opacity:a.tracking?1:.5 }}>
            <div style={{ display:"flex",alignItems:"center",gap:16 }}>
              <div style={{ width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${a.color}cc,${a.color}44)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#000",flexShrink:0 }}>{a.avatar}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <p style={{ fontSize:15,fontWeight:600,color:"#fff" }}>{a.name}</p>
                  <Tag color={a.tracking?"#00ffaa":"rgba(255,255,255,.3)"}>{a.tracking?"● ACTIVE":"○ PAUSED"}</Tag>
                </div>
                <p className="fm" style={{ fontSize:12,color:"rgba(255,255,255,.35)",marginTop:3 }}>{a.email}</p>
                <div style={{ display:"flex",gap:12,marginTop:5 }}>
                  <span className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.35)" }}>{a.unread} unread</span>
                  <span style={{ color:"rgba(255,255,255,.14)" }}>·</span>
                  <span className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.25)" }}>synced {a.lastSync}</span>
                </div>
              </div>
              <button className="toggle" onClick={() => toggle(a.id)} style={{ background:a.tracking?a.color:"rgba(255,255,255,.12)" }}>
                <div className="knob" style={{ left:a.tracking?"23px":"3px" }}/>
              </button>
            </div>
            {a.tracking && <>
              <div className="divider" style={{ margin:"20px 0" }}/>
              <div style={{ marginBottom:14 }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                  <span className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.3)",letterSpacing:".1em" }}>STORAGE USED</span>
                  <span className="fm" style={{ fontSize:10,color:a.color }}>{a.storage}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width:`${a.storage}%`,background:a.storage>80?"#ff5252":a.color }}/>
                </div>
              </div>
              <div className="col3" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10 }}>
                {[{label:"Daily Summary",value:"8:00 AM"},{label:"Weekly Digest",value:"Sunday"},{label:"Auto-Schedule",value:"Enabled"}].map(s => (
                  <div key={s.label} style={{ textAlign:"center",padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)" }}>
                    <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.25)",marginBottom:4,letterSpacing:".08em" }}>{s.label.toUpperCase()}</p>
                    <p style={{ fontSize:13,fontWeight:500,color:a.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </>}
          </div>
        ))}
      </div>

      <div className="fu d4 glass" style={{ borderRadius:16,padding:"16px 20px",borderColor:"rgba(255,184,48,.18)",background:"rgba(255,184,48,.04)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <span style={{ fontSize:18 }}>🔒</span>
          <div>
            <p style={{ fontSize:13,fontWeight:500,color:"rgba(255,184,48,.9)" }}>End-to-end encrypted & privacy-first</p>
            <p style={{ fontSize:12,color:"rgba(255,255,255,.35)",marginTop:3,lineHeight:1.6 }}>Credentials stored with AES-256. Email content is never stored — AI processing is ephemeral and in-memory only. InboxAI requests read-only OAuth scopes.</p>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Summaries ────────────────────────────────────────────────────────────────
function SummariesSection() {
  const [tab, setTab] = useState<"daily" | "weekly">("daily");

  const daily: DailySummary[] = [
    { kind:"daily", date:"Feb 27", account:"work.alex@gmail.com", count:14, color:"#38d9ff", preview:"Follow-up from design team, billing alert from Stripe, 3 high-priority items flagged. Zoom link at 2PM auto-scheduled.", sentiment:"⚠️ Action needed" },
    { kind:"daily", date:"Feb 27", account:"alex@gmail.com",      count:5,  color:"#00ffaa", preview:"Personal correspondence, one dinner invitation, a reply from a friend, and a bank notification.",                       sentiment:"✓ No action"    },
    { kind:"daily", date:"Feb 26", account:"work.alex@gmail.com", count:9,  color:"#38d9ff", preview:"Sprint planning notes, standup reminders, 1 Zoom link auto-scheduled. Product roadmap thread active.",                  sentiment:"📅 1 meeting added" },
    { kind:"daily", date:"Feb 26", account:"alex@gmail.com",      count:3,  color:"#00ffaa", preview:"Newsletter, bank statement notification, family group reply.",                                                           sentiment:"✓ No action"    },
    { kind:"daily", date:"Feb 25", account:"work.alex@gmail.com", count:21, color:"#38d9ff", preview:"High email volume. Client contract thread escalated. 2 meetings scheduled. Legal review flagged.",                      sentiment:"⚠️ Escalation"  },
  ];

  const weekly: WeeklySummary[] = [
    { kind:"weekly", week:"Feb 21 – 27", account:"work.alex@gmail.com", count:98,  color:"#38d9ff", highlights:["5 meetings scheduled","12 high-priority threads","3 pending replies","Avg response: 3.2h"] },
    { kind:"weekly", week:"Feb 21 – 27", account:"alex@gmail.com",      count:31,  color:"#00ffaa", highlights:["2 events detected","1 subscription renewed","4 personal threads","Avg response: 6.1h"]    },
    { kind:"weekly", week:"Feb 14 – 20", account:"work.alex@gmail.com", count:112, color:"#38d9ff", highlights:["7 meetings scheduled","Avg response: 2.8h","Product demo thread","Contract renewal"]       },
    { kind:"weekly", week:"Feb 7 – 13",  account:"work.alex@gmail.com", count:87,  color:"#38d9ff", highlights:["4 meetings","Avg response: 4.1h","Onboarding docs sent","Q1 planning begun"]               },
  ];

  const items: Summary[] = tab === "daily" ? daily : weekly;

  return (
    <Section>
      <PageHead title="Summaries" />

      <div className="fu d1" style={{ display:"flex",gap:4,padding:4,borderRadius:14,background:"rgba(255,255,255,.045)",border:"1px solid rgba(255,255,255,.08)",width:"fit-content" }}>
        {(["daily","weekly"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:"8px 22px",borderRadius:10,fontSize:13,fontWeight:500,cursor:"pointer",textTransform:"capitalize",transition:"all .22s",background:tab===t?"rgba(255,255,255,.12)":"transparent",color:tab===t?"#fff":"rgba(255,255,255,.38)",border:"none",fontFamily:"Space Grotesk,sans-serif" }}>{t}</button>
        ))}
      </div>

      <div className="fu d2" style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {items.map((item, i) => (
          <div key={i} className="glass inset ghover" style={{ borderRadius:16,padding:"20px 24px",cursor:"default",borderLeft:`3px solid ${item.color}`,transition:"all .25s" }}>
            <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10,flexWrap:"wrap" }}>
              <span className="fm" style={{ fontSize:11,color:item.color }}>{item.account}</span>
              <span style={{ color:"rgba(255,255,255,.15)" }}>·</span>
              <span className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.3)" }}>
                {item.kind === "daily" ? item.date : item.week}
              </span>
              <span className="tag" style={{ marginLeft:"auto",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.42)",border:"1px solid rgba(255,255,255,.09)" }}>{item.count} emails</span>
            </div>
            {item.kind === "daily" ? (
              <>
                <p style={{ fontSize:13.5,color:"rgba(255,255,255,.65)",lineHeight:1.72 }}>{item.preview}</p>
                <p className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.35)",marginTop:10 }}>{item.sentiment}</p>
              </>
            ) : (
              <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                {item.highlights.map((h: string, hi: number) => (
                  <span key={hi} className="fm" style={{ fontSize:11,padding:"4px 10px",borderRadius:6,background:`${item.color}14`,border:`1px solid ${item.color}28`,color:item.color }}>{h}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="fu d3 glass" style={{ borderRadius:16,padding:"18px 22px",display:"flex",alignItems:"center",gap:16,borderColor:"rgba(0,255,170,.16)",background:"rgba(0,255,170,.03)" }}>
        <div style={{ width:36,height:36,borderRadius:10,background:"rgba(0,255,170,.14)",border:"1px solid rgba(0,255,170,.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16 }}>✦</div>
        <div>
          <p style={{ fontSize:13,color:"rgba(255,255,255,.65)",lineHeight:1.6 }}>
            Summaries generated by <strong style={{ color:"#00ffaa" }}>Groq · LLaMA 3.1 70B</strong> using only in-memory email metadata. Full email content is never stored.
          </p>
          <p className="fm" style={{ fontSize:10,color:"rgba(255,255,255,.25)",marginTop:5,letterSpacing:".08em" }}>
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
    aiSummary: true, autoSchedule: true, notifications: true, darkMode: true,
    compactView: false, weeklyDigest: true, priorityAlerts: true, analytics: false,
  });
  const tog = (k: SettingsKey) => setS(x => ({ ...x, [k]: !x[k] }));

  const groups: { label: string; icon: string; color: string; items: { key: SettingsKey; label: string; desc: string }[] }[] = [
    { label:"AI Features",   icon:"✦", color:"#00ffaa", items:[
      { key:"aiSummary",      label:"Daily AI Summary",       desc:"Generate a morning AI summary of your inbox at 8:00 AM" },
      { key:"weeklyDigest",   label:"Weekly Digest",          desc:"Receive a weekly rollup every Sunday with trends and highlights" },
      { key:"autoSchedule",   label:"Auto-Schedule Meetings", desc:"Detect meeting links in emails and add them to your calendar" },
      { key:"priorityAlerts", label:"Priority Alerts",        desc:"AI flags high-priority emails for immediate attention" },
    ]},
    { label:"Notifications", icon:"◈", color:"#38d9ff", items:[
      { key:"notifications",  label:"Push Notifications",     desc:"Browser notifications for high-priority emails and detected meetings" },
    ]},
    { label:"Privacy",       icon:"🔒", color:"#ffb830", items:[
      { key:"analytics",      label:"Usage Analytics",        desc:"Share anonymized usage data to help improve InboxAI" },
    ]},
    { label:"Interface",     icon:"◫", color:"#b96dff", items:[
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
            <div style={{ width:28,height:28,borderRadius:8,background:`${g.color}1e`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>{g.icon}</div>
            <p className="fm" style={{ fontSize:9,color:g.color,letterSpacing:".15em" }}>{g.label.toUpperCase()}</p>
          </div>
          <div className="glass inset" style={{ borderRadius:16,overflow:"hidden" }}>
            {g.items.map((item, ii) => (
              <div key={item.key} style={{ display:"flex",alignItems:"center",gap:16,padding:"18px 22px",borderBottom:ii<g.items.length-1?"1px solid rgba(255,255,255,.055)":"none",cursor:"pointer",transition:"background .2s" }}
                onClick={() => tog(item.key)}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.03)"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:14,color:s[item.key]?"#fff":"rgba(255,255,255,.5)",fontWeight:500,transition:"color .2s" }}>{item.label}</p>
                  <p style={{ fontSize:12,color:"rgba(255,255,255,.3)",marginTop:2 }}>{item.desc}</p>
                </div>
                <button className="toggle" style={{ background:s[item.key]?g.color:"rgba(255,255,255,.12)" }}
                  onClick={e => { e.stopPropagation(); tog(item.key); }}>
                  <div className="knob" style={{ left:s[item.key]?"23px":"3px" }}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="fu glass" style={{ borderRadius:16,padding:"20px 24px",borderColor:"rgba(255,82,82,.22)",background:"rgba(255,82,82,.04)" }}>
        <p className="fm" style={{ fontSize:9,color:"#ff5252",letterSpacing:".15em",marginBottom:14 }}>DANGER ZONE</p>
        <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
          {["Disconnect All Accounts","Clear Summary History","Delete My Account"].map((label, i) => (
            <button key={i} style={{ fontSize:12,padding:"8px 16px",borderRadius:10,border:"1px solid rgba(255,82,82,.25)",background:"rgba(255,82,82,.06)",color:"#ff5252",cursor:"pointer",transition:"all .2s",fontFamily:"Space Grotesk,sans-serif" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background="rgba(255,82,82,.16)"; el.style.borderColor="rgba(255,82,82,.45)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background="rgba(255,82,82,.06)"; el.style.borderColor="rgba(255,82,82,.25)"; }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ textAlign:"center",paddingBottom:8 }}>
        <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.14)",letterSpacing:".12em" }}>INBOXAI v2.0.0 · POWERED BY GROQ · MADE WITH ♥</p>
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

  function go(id: string) { setActive(id); setKey(k => k + 1); window.scrollTo(0, 0); }

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:"100vh",background:"#05080f",display:"flex",overflow:"hidden",position:"relative" }}>
        <div className="orb orb1"/><div className="orb orb2"/><div className="orb orb3"/>

        {/* ── Sidebar ── */}
        <aside className="sidebar" style={{ position:"fixed",top:0,left:0,bottom:0,width:220,zIndex:50,display:"flex",flexDirection:"column",borderRight:"1px solid rgba(255,255,255,.07)",background:"rgba(5,8,15,.94)",backdropFilter:"blur(22px)",padding:"28px 16px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,padding:"0 8px",marginBottom:36 }}>
            <div style={{ width:38,height:38,borderRadius:12,background:"linear-gradient(135deg,#00ffaa,#00b377)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"0 0 28px rgba(0,255,170,.3)",color:"#000",fontWeight:700 }}>✉</div>
            <div>
              <p className="fd" style={{ fontSize:17,color:"#fff",fontWeight:700,letterSpacing:"-.02em" }}>InboxAI</p>
              <p className="fm" style={{ fontSize:9,color:"rgba(0,255,170,.6)",letterSpacing:".12em" }}>POWERED BY GROQ</p>
            </div>
          </div>

          <nav style={{ flex:1,display:"flex",flexDirection:"column",gap:2 }}>
            <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.2)",letterSpacing:".15em",padding:"0 12px",marginBottom:8 }}>NAVIGATION</p>
            {nav.map(n => (
              <button key={n.id} onClick={() => go(n.id)} className={`nav-btn ${active===n.id?"nav-active":""}`}>
                <span style={{ fontSize:16,color:active===n.id?"#00ffaa":"inherit",transition:"color .2s" }}>{n.icon}</span>
                {n.label}
                {active===n.id && <span style={{ marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:"#00ffaa",boxShadow:"0 0 10px #00ffaa",display:"inline-block" }}/>}
              </button>
            ))}
          </nav>

          <div className="divider" style={{ margin:"20px 8px" }}/>

          <div>
            <p className="fm" style={{ fontSize:9,color:"rgba(255,255,255,.2)",letterSpacing:".14em",padding:"0 4px",marginBottom:10 }}>ACTIVE INBOXES</p>
            {ACCOUNTS.filter(a => a.tracking).map(a => (
              <div key={a.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:8,cursor:"pointer",transition:"background .2s" }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.045)"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}>
                <div style={{ width:26,height:26,borderRadius:8,background:`${a.color}22`,border:`1px solid ${a.color}45`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:a.color,flexShrink:0 }}>{a.avatar}</div>
                <p className="fm" style={{ fontSize:11,color:"rgba(255,255,255,.42)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1 }}>{a.email}</p>
                {a.unread > 0 && <span className="fm" style={{ fontSize:10,color:a.color,background:`${a.color}1a`,padding:"1px 5px",borderRadius:4,flexShrink:0 }}>{a.unread}</span>}
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