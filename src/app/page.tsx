"use client";

import { useState, useEffect, useRef } from "react";

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  green:  "#059669",
  cyan:   "#0284c7",
  purple: "#7c3aed",
  amber:  "#d97706",
  red:    "#dc2626",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormErrors {
  name?:    string;
  email?:   string;
  pass?:    string;
  confirm?: string;
  general?: string;
}

interface FieldProps {
  icon:        string;
  type:        string;
  placeholder: string;
  value:       string;
  onChange:    (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?:      string;
}

// ─── Particle canvas ──────────────────────────────────────────────────────────
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let id: number;
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const pts = Array.from({ length: 40 }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r:  Math.random() * 1.2 + 0.3,
      a:  Math.random() * 0.3 + 0.08,
    }));
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d  = Math.hypot(dx, dy);
          if (d < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(5,150,105,${0.06 * (1 - d / 100)})`;
            ctx.lineWidth   = 0.5;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
        const p = pts[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(5,150,105,${p.a})`;
        ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0)             p.x = canvas.width;
        if (p.x > canvas.width)  p.x = 0;
        if (p.y < 0)             p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      }
      id = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(id); ro.disconnect(); };
  }, []);
  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}

// ─── Input Field ──────────────────────────────────────────────────────────────
function Field({ icon, type, placeholder, value, onChange, error }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [show,    setShow]    = useState(false);
  const isPass = type === "password";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: "flex", alignItems: "center",
        background: focused ? "#f0fdf8" : "#f8fafc",
        border: `1.5px solid ${error ? C.red : focused ? C.green : "#e2e8f0"}`,
        borderRadius: 10, transition: "all .2s",
        boxShadow: focused ? `0 0 0 3px ${C.green}18` : "none",
      }}>
        <span style={{ padding: "0 0 0 13px", fontSize: 14, color: focused ? C.green : "#94a3b8", transition: "color .2s", lineHeight: 1, flexShrink: 0 }}>{icon}</span>
        <input
          type={isPass ? (show ? "text" : "password") : type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ flex: 1, padding: "12px 12px", background: "transparent", border: "none", outline: "none", fontSize: 13.5, color: "#1e2535", fontFamily: "'Space Grotesk',sans-serif" }}
        />
        {isPass && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            style={{ padding: "0 13px 0 0", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#94a3b8", transition: "color .2s", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = C.green)}
            onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
          >
            {show ? "◎" : "◉"}
          </button>
        )}
      </div>
      {error && <p style={{ fontSize: 11, color: C.red, marginTop: 4, paddingLeft: 2, fontFamily: "'JetBrains Mono',monospace" }}>⚠ {error}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [tab,     setTab]     = useState<"signin" | "signup">("signin");
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors,  setErrors]  = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const switchTab = (t: "signin" | "signup") => {
    setTab(t); setErrors({}); setName(""); setEmail(""); setPass(""); setConfirm("");
  };

  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (tab === "signup" && !name.trim()) e.name = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email";
    if (!pass) e.pass = "Password is required";
    else if (pass.length < 6) e.pass = "Min. 6 characters";
    if (tab === "signup" && pass !== confirm) e.confirm = "Passwords don't match";
    return e;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({}); setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1300));
      setSuccess(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code.includes("user-not-found") || code.includes("wrong-password"))
        setErrors({ pass: "Invalid email or password" });
      else if (code.includes("email-already-in-use"))
        setErrors({ email: "Email already in use" });
      else
        setErrors({ general: (err as { message?: string })?.message ?? "Something went wrong" });
    } finally { setLoading(false); }
  };

  const googleAuth = async () => {
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1100));
      setSuccess(true);
    } catch {
      setErrors({ general: "Google sign-in failed" });
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,400;1,700&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        html, body { height:100%; background:#f0f4f9; font-family:'Space Grotesk',sans-serif; }
        input::placeholder { color:#cbd5e1; }
        input:-webkit-autofill { -webkit-box-shadow:0 0 0 40px #f8fafc inset; -webkit-text-fill-color:#1e2535; }

        @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes pulse2  { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes popIn   { from{opacity:0;transform:scale(.7)} to{opacity:1;transform:scale(1)} }
        @keyframes drift   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(18px,-14px)} }
        @keyframes pulseRing { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(2.2);opacity:0} }

        .fu { animation:fadeUp .45s ease both; }
        .d1{animation-delay:.07s} .d2{animation-delay:.14s} .d3{animation-delay:.21s}
        .d4{animation-delay:.28s} .d5{animation-delay:.35s}

        .orb { position:absolute;border-radius:50%;pointer-events:none; }
        .orb1 { width:600px;height:600px;top:-250px;left:-150px;background:radial-gradient(circle,rgba(5,150,105,.10) 0%,transparent 68%);animation:drift 22s ease-in-out infinite; }
        .orb2 { width:450px;height:450px;bottom:-80px;right:-80px;background:radial-gradient(circle,rgba(124,58,237,.07) 0%,transparent 68%);animation:drift 28s ease-in-out infinite reverse; }

        .tab-btn {
          flex:1;padding:9px 12px;border:none;cursor:pointer;
          font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;
          border-radius:9px;transition:all .22s;
        }
        .tab-on  { background:#fff;color:#1e2535;box-shadow:0 1px 5px rgba(0,0,0,.09); border:1px solid #e2e8f0; }
        .tab-off { background:transparent;color:#94a3b8;border:1px solid transparent; }
        .tab-off:hover { color:#64748b; }

        .g-btn {
          width:100%;padding:12px;border-radius:10px;cursor:pointer;
          background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);
          display:flex;align-items:center;justify-content:center;gap:10px;
          font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:500;color:#64748b;
          transition:all .22s;
        }
        .g-btn:hover { border-color:#e2e8f0;color:#1e2535;background:#f8fafc; }
        .g-btn:disabled { opacity:.6;cursor:wait; }

        .sub-btn {
          width:100%;padding:13px;border-radius:10px;border:none;cursor:pointer;
          font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:700;
          background:linear-gradient(135deg,#0f766e,#059669,#0284c7);
          color:#fff;letter-spacing:.03em;
          transition:all .25s;
          box-shadow:0 4px 20px rgba(5,150,105,.35);
        }
        .sub-btn:hover:not(:disabled) { transform:translateY(-1px);box-shadow:0 8px 28px rgba(5,150,105,.45); }
        .sub-btn:disabled { opacity:.65;cursor:wait; }

        .feat-pill {
          display:flex;align-items:center;gap:10px;
          padding:8px 12px;border-radius:12px;
          background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);
          font-size:13px;color:rgba(255,255,255,.85);
          transition:all .22s;cursor:default;
        }
        .feat-pill:hover { background:rgba(255,255,255,.18); }

        .link-btn {
          background:none;border:none;cursor:pointer;
          font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:12.5px;
          color:${C.green};transition:color .2s;
        }
        .link-btn:hover { color:#0f766e; }

        @media(max-width:768px) {
          .split-left { display:none!important; }
          .split-right { flex:1!important; }
        }
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f0f4f9", position: "relative" }}>

        {/* ── LEFT PANEL ── */}
        <div className="split-left" style={{
          flex: "0 0 52%", position: "relative", overflow: "hidden",
          background: "linear-gradient(160deg,#0f766e 0%,#059669 45%,#0284c7 100%)",
          display: "flex", flexDirection: "column", padding: "28px 40px",
          boxShadow: "4px 0 40px rgba(5,150,105,.25)",
        }}>
          <Particles />
          <div className="orb orb1" /><div className="orb orb2" />

          {/* Logo */}
          <div className="fu" style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 2 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(255,255,255,.25)", border: "1px solid rgba(255,255,255,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", fontWeight: 700, flexShrink: 0 }}>✉</div>
            <div>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: "#fff", fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1 }}>InboxAI</p>
              <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: "rgba(255,255,255,.7)", letterSpacing: ".12em", fontWeight: 600, marginTop: 2 }}>POWERED BY GROQ</p>
            </div>
          </div>

          {/* Hero */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 2 }}>
            <h1 className="fu d2" style={{ fontFamily: "'Playfair Display',serif", fontSize: 38, fontWeight: 700, color: "#fff", lineHeight: 1.12, marginBottom: 14, letterSpacing: "-.01em" }}>
              Your Inbox.<br />
              <em style={{ fontStyle: "italic", color: "rgba(255,255,255,.85)" }}>Always in</em><br />
              <em style={{ fontStyle: "italic", color: "rgba(255,255,255,.85)" }}>Control.</em>
            </h1>

            <p className="fu d3" style={{ fontSize: 13, color: "rgba(255,255,255,.75)", lineHeight: 1.65, maxWidth: 360, marginBottom: 20 }}>
              Sign in to access AI-powered summaries, auto-scheduled meetings, and intelligent email insights across all your accounts.
            </p>

            <div className="fu d4" style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
              {[
                { icon: "✦", text: "AI daily & weekly email summaries" },
                { icon: "◫", text: "Auto-detect and schedule meetings" },
                { icon: "◉", text: "Multi-account inbox management" },
              ].map((f, i) => (
                <div key={i} className="feat-pill">
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", flexShrink: 0 }}>{f.icon}</span>
                  <span style={{ fontSize: 13 }}>{f.text}</span>
                </div>
              ))}
            </div>

            <div className="fu d5" style={{ display: "flex", gap: 0, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.25)" }}>
              {[
                { num: "3×",   lbl: "FASTER TRIAGE" },
                { num: "98%",  lbl: "UPTIME" },
                { num: "24/7", lbl: "MONITORING" },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{s.num}</p>
                  <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: "rgba(255,255,255,.8)", marginTop: 5, letterSpacing: ".06em", fontWeight: 600, whiteSpace: "nowrap" }}>{s.lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL — no card, form fills the space ── */}
        <div className="split-right" style={{
          flex: 1,
          background: "#f0f4f9",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 48px",
          overflowY: "auto",
        }}>
          <div style={{ width: "100%", maxWidth: 360 }}>

            {/* Tabs */}
            <div className="fu" style={{ display: "flex", gap: 4, padding: 4, background: "#e2e8f0", border: "1px solid #cbd5e1", borderRadius: 13, marginBottom: 30 }}>
              <button className={`tab-btn ${tab === "signin" ? "tab-on" : "tab-off"}`} onClick={() => switchTab("signin")}>Sign In</button>
              <button className={`tab-btn ${tab === "signup" ? "tab-on" : "tab-off"}`} onClick={() => switchTab("signup")}>Sign Up</button>
            </div>

            {/* Heading */}
            <div className="fu d1" style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: "#1e2535", marginBottom: 6, letterSpacing: "-.01em", lineHeight: 1.2 }}>
                {tab === "signin" ? "Welcome back" : "Create account"}
              </h2>
              <p style={{ fontSize: 13, color: "#64748b", fontFamily: "'Space Grotesk',sans-serif" }}>
                {tab === "signin" ? "Sign in to your InboxAI dashboard" : "Start monitoring your inbox today"}
              </p>
            </div>

            {/* Success state */}
            {success ? (
              <div style={{ textAlign: "center", padding: "36px 0", animation: "popIn .5s cubic-bezier(.34,1.56,.64,1) both" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${C.green}12`, border: `1px solid ${C.green}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: C.green, margin: "0 auto 16px" }}>✓</div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#1e2535", marginBottom: 6, fontFamily: "'Playfair Display',serif" }}>
                  {tab === "signin" ? "Signed in!" : "Account created!"}
                </p>
                <p style={{ fontSize: 13, color: "#64748b" }}>Redirecting to your dashboard…</p>
              </div>
            ) : (
              <form onSubmit={submit}>

                {errors.general && (
                  <div style={{ padding: "10px 14px", borderRadius: 9, marginBottom: 14, background: `${C.red}08`, border: `1px solid ${C.red}25`, fontSize: 12, color: C.red, fontFamily: "'JetBrains Mono',monospace" }}>
                    ⚠ {errors.general}
                  </div>
                )}

                {/* Google */}
                <div className="fu d1">
                  <button type="button" className="g-btn" onClick={googleAuth} disabled={loading}>
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </button>
                </div>

                {/* Divider */}
                <div className="fu d2" style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
                  <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#cbd5e1", letterSpacing: ".1em" }}>
                    {tab === "signin" ? "or sign in with email" : "or sign up with email"}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                </div>

                {/* Fields */}
                <div className="fu d3">
                  {tab === "signup" && (
                    <Field icon="◉" type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} error={errors.name} />
                  )}
                  <Field icon="✉" type="email" placeholder="you@gmail.com" value={email} onChange={e => setEmail(e.target.value)} error={errors.email} />
                  <Field icon="◈" type="password" placeholder="Password (min. 6 characters)" value={pass} onChange={e => setPass(e.target.value)} error={errors.pass} />
                  {tab === "signup" && (
                    <Field icon="◈" type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} error={errors.confirm} />
                  )}
                </div>

                {tab === "signin" && (
                  <div className="fu d3" style={{ textAlign: "right", margin: "-4px 0 14px" }}>
                    <button type="button" className="link-btn">Forgot password?</button>
                  </div>
                )}

                {/* Submit */}
                <div className="fu d4">
                  <button type="submit" className="sub-btn" disabled={loading}>
                    {loading ? (
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <span style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", animation: "spin .7s linear infinite", display: "inline-block" }} />
                        {tab === "signin" ? "Signing In…" : "Creating Account…"}
                      </span>
                    ) : (
                      tab === "signin" ? "Sign In →" : "Create Account →"
                    )}
                  </button>
                </div>

                <p className="fu d5" style={{ textAlign: "center", fontSize: 12.5, color: "#94a3b8", marginTop: 18 }}>
                  {tab === "signin"
                    ? <><span>Don&apos;t have an account?{" "}</span><button type="button" className="link-btn" onClick={() => switchTab("signup")}>Sign up free</button></>
                    : <><span>Already have an account?{" "}</span><button type="button" className="link-btn" onClick={() => switchTab("signin")}>Sign in</button></>
                  }
                </p>

              </form>
            )}

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 }}>
              <span style={{ position: "relative", width: 6, height: 6, borderRadius: "50%", background: C.green, display: "inline-block", flexShrink: 0 }}>
                <span style={{ position: "absolute", inset: -3, borderRadius: "50%", background: C.green, opacity: 0.35, animation: "pulseRing 2s ease-out infinite" }} />
              </span>
              <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: "#94a3b8", letterSpacing: ".12em" }}>
                PROTECTED BY FIREBASE · AES-256 · INBOXAI 2026
              </p>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}