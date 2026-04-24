"use client";

import { useEffect, useRef, useState } from "react";
import "./brochure.css";

// ============ PDF download (server-side via /api/brochure/pdf) ============
async function downloadBrochurePDF(setStatus: (s: string) => void) {
  setStatus("Generating PDF…");
  const res = await fetch("/api/brochure/pdf", { cache: "no-store" });
  if (!res.ok) {
    setStatus("");
    let detail = "";
    try { detail = JSON.stringify(await res.json()); } catch {}
    throw new Error(`PDF generation failed (${res.status}) ${detail}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "DeskHive-Brochure.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("");
}

// ============ Icons ============
type IconProps = { size?: number; stroke?: number; fill?: string };
const Icon = ({ size = 18, stroke = 1.75, fill = "none", children }: IconProps & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const IconCrown    = (p: IconProps) => <Icon {...p}><path d="M3 7l4 4 5-6 5 6 4-4v11H3z" /></Icon>;
const IconBolt     = (p: IconProps) => <Icon {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></Icon>;
const IconClock    = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
const IconSearch   = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></Icon>;
const IconGauge    = (p: IconProps) => <Icon {...p}><path d="M12 14l4-4"/><circle cx="12" cy="14" r="8"/><path d="M12 6V3"/></Icon>;
const IconNote     = (p: IconProps) => <Icon {...p}><path d="M5 4h11l3 3v13H5z"/><path d="M9 10h6M9 14h6M9 18h4"/></Icon>;
const IconFragment = (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Icon>;
const IconCheck    = (p: IconProps) => <Icon {...p}><path d="M4 12l5 5L20 6" /></Icon>;
const IconX        = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
const IconUpload   = (p: IconProps) => <Icon {...p}><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/></Icon>;
const IconUsers    = (p: IconProps) => <Icon {...p}><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a7 7 0 0114 0v1"/><path d="M16 3a4 4 0 010 8"/><path d="M22 21v-1a7 7 0 00-5-6.7"/></Icon>;
const IconSync     = (p: IconProps) => <Icon {...p}><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/><path d="M3 21v-5h5"/></Icon>;
const IconLayers   = (p: IconProps) => <Icon {...p}><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/></Icon>;
const IconFilter   = (p: IconProps) => <Icon {...p}><path d="M3 4h18l-7 9v6l-4 2v-8z" /></Icon>;
const IconLock     = (p: IconProps) => <Icon {...p}><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></Icon>;
const IconSpark    = (p: IconProps) => <Icon {...p}><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l4 4M14 14l4 4M6 18l4-4M14 10l4-4" /></Icon>;
const IconArrow    = (p: IconProps) => <Icon {...p}><path d="M5 12h14M13 5l7 7-7 7" /></Icon>;
const IconKanban   = (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="6" height="18" rx="1.5"/><rect x="11" y="3" width="6" height="12" rx="1.5"/><rect x="19" y="3" width="2" height="18" rx="1"/></Icon>;
const IconShield   = (p: IconProps) => <Icon {...p}><path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></Icon>;

// ============ Cover product mock ============
function CoverProductMock() {
  return (
    <div className="cover-mock-wrap">
      <div className="cover-mock cover-mock-back">
        <div className="mock-topbar">
          <span className="tf">Queue · Live</span>
          <div>
            <span className="tf-dot" /><span className="tf-dot" /><span className="tf-dot" />
          </div>
        </div>
        <div className="mock-kanban">
          {["New", "Working", "Needs reply", "Closed"].map((col, i) => (
            <div className="mk-col" key={col}>
              <div className="mk-col-h">{col} <span className="mk-count">{[12,8,4,92][i]}</span></div>
              {Array.from({length: [3,2,2,3][i]}).map((_, j) => (
                <div className={`mk-card ${i===1 && j===0 ? "mk-vip" : ""}`} key={j}>
                  {i===1 && j===0 && <div className="mk-crown">♛</div>}
                  <div className="mk-card-t" />
                  <div className="mk-card-t short" />
                  <div className={`mk-age age-${["fresh","warn","warn","hot"][((i+j)%4)]}`} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="cover-mock cover-mock-front">
        <div className="mock-topbar">
          <div className="tf-tabs">
            <span className="tf-tab active">#DH-4781</span>
            <span className="tf-tab">#DH-4780</span>
          </div>
          <span className="crown-badge"><IconCrown size={12}/> VIP</span>
        </div>
        <div className="mk-detail">
          <div className="mk-detail-head">
            <div>
              <div className="mk-detail-title">Withdrawal pending · account verification</div>
              <div className="mk-detail-sub">marcus.h@relay.bet · Level 4 · $84,200 LTD</div>
            </div>
            <div className="mk-age-chip">
              <span className="mk-age-dot"/> 00:02:41 fresh
            </div>
          </div>
          <div className="mk-notes">
            <div className="mk-note">
              <div className="mk-note-avatar">ER</div>
              <div className="mk-note-body">
                <div className="mk-note-meta">Elena R. <span>· 2m ago</span></div>
                <div className="mk-note-text">Acknowledged. Escalating to risk for live review.</div>
              </div>
            </div>
            <div className="mk-note">
              <div className="mk-note-avatar sys">DH</div>
              <div className="mk-note-body">
                <div className="mk-note-meta">System <span>· just now</span></div>
                <div className="mk-note-text">Pinned to top. Matched to VIP workflow #7.</div>
              </div>
            </div>
          </div>
          <div className="mk-reply">
            <div className="mk-reply-text">Marcus — we're on this…</div>
            <div className="mk-reply-actions">
              <span className="mk-chip">Templates</span>
              <span className="mk-chip">⌘↵ Send</span>
            </div>
          </div>
        </div>
      </div>

      <div className="cover-alert">
        <div className="cover-alert-icon"><IconBolt size={14}/></div>
        <div>
          <div className="ca-t">New VIP alert</div>
          <div className="ca-s">Jordan K. · Level 5 · Slots</div>
        </div>
        <div className="ca-dot"/>
      </div>
    </div>
  );
}

// ============ Pillar mocks ============
function PillarVipQueue() {
  const rows = [
    { vip: true,  name: "Marcus H.", lvl: "L4", issue: "Withdrawal pending", age: "00:02:41", hot: "fresh" },
    { vip: true,  name: "Jordan K.", lvl: "L5", issue: "Bonus not credited", age: "00:05:10", hot: "fresh" },
    { vip: false, name: "Talia B.",  lvl: "L2", issue: "Login loop",         age: "00:14:22", hot: "warn"  },
    { vip: false, name: "Arun S.",   lvl: "L1", issue: "Deposit failed",     age: "00:22:08", hot: "warn"  },
    { vip: false, name: "Reza M.",   lvl: "L2", issue: "Odds question",      age: "01:02:48", hot: "hot"   },
  ];
  return (
    <div className="pm-queue">
      <div className="pm-queue-head">
        <span className="label-caps" style={{fontSize:10}}>Priority queue</span>
        <span className="mono" style={{fontSize:10, color:"var(--muted-2)"}}>auto-sort · by VIP × age</span>
      </div>
      {rows.map((r,i) => (
        <div className={`pm-row ${r.vip ? "vip" : ""}`} key={i}>
          {r.vip ? <span className="pm-crown">♛</span> : <span />}
          <span className="pm-name">{r.name}</span>
          <span className="pm-lvl">{r.lvl}</span>
          <span className="pm-issue">{r.issue}</span>
          <span className={`pm-age age-${r.hot}`}><span className="dot"/>{r.age}</span>
        </div>
      ))}
    </div>
  );
}

function PillarAging() {
  const bars = [
    { c: "fresh", w: 48, label: "#DH-4781" },
    { c: "fresh", w: 38, label: "#DH-4780" },
    { c: "warn",  w: 62, label: "#DH-4774" },
    { c: "warn",  w: 74, label: "#DH-4769" },
    { c: "hot",   w: 92, label: "#DH-4755" },
  ];
  return (
    <div className="pm-aging">
      <div className="pm-aging-legend">
        <span><span className="age-chip age-fresh"/>Fresh · &lt;5m</span>
        <span><span className="age-chip age-warn"/>Aging · 5–30m</span>
        <span><span className="age-chip age-hot"/>Hot · &gt;30m</span>
      </div>
      <div className="pm-aging-bars">
        {bars.map((b,i) => (
          <div className="pm-bar-row" key={i}>
            <span className="pm-bar-label mono">{b.label}</span>
            <div className="pm-bar-track">
              <div className={`pm-bar-fill age-${b.c}`} style={{width: b.w + "%"}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PillarNotes() {
  return (
    <div className="pm-notes">
      <div className="pm-note">
        <div className="pm-note-dot"/>
        <div>
          <div className="pm-note-meta mono">Elena R. · 14:02</div>
          <div className="pm-note-body">Acknowledged · risk notified</div>
        </div>
      </div>
      <div className="pm-note">
        <div className="pm-note-dot grad"/>
        <div>
          <div className="pm-note-meta mono">Marcus H. · 14:04</div>
          <div className="pm-note-body">Received update · sending docs</div>
        </div>
      </div>
      <div className="pm-note">
        <div className="pm-note-dot"/>
        <div>
          <div className="pm-note-meta mono">Elena R. · 14:09</div>
          <div className="pm-note-body">Docs received · passing to KYC</div>
        </div>
      </div>
    </div>
  );
}

function PillarSearch() {
  const rows: [string, string, boolean][] = [
    ["Marcus Hale",  "marcus.h@relay.bet · VIP L4", true],
    ["Marcel Ruiz",  "m.ruiz@onx.io · L2",          false],
    ["Marcy Okafor", "+1 415 ••• 2210 · L1",        false],
  ];
  return (
    <div className="pm-search">
      <div className="pm-search-bar">
        <IconSearch size={14}/>
        <span className="pm-search-text">marc</span>
        <span className="pm-search-caret"/>
        <span className="pm-kbd">⌘K</span>
      </div>
      <div className="pm-search-list">
        {rows.map(([n, m, vip], i) => (
          <div className="pm-search-row" key={i}>
            {vip ? <span className="pm-crown sm">♛</span> : <span className="pm-avatar">{n[0]}</span>}
            <div>
              <div className="pm-search-n"><span className="hi">Marc</span>{n.slice(4)}</div>
              <div className="pm-search-m">{m}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PillarDashboard() {
  return (
    <div className="pm-dash">
      <div className="pm-dash-strip">
        <span className="pm-crown sm">♛</span>
        <span className="pm-dash-strip-t">3 VIPs waiting</span>
        <span className="pm-dash-strip-m mono">avg 2m 14s</span>
      </div>
      <div className="pm-dash-grid">
        <div className="pm-dash-card">
          <div className="pm-dash-kpi">247</div>
          <div className="label-caps" style={{fontSize:10}}>Open</div>
        </div>
        <div className="pm-dash-card">
          <div className="pm-dash-kpi">1m 48s</div>
          <div className="label-caps" style={{fontSize:10}}>Avg first touch</div>
        </div>
        <div className="pm-dash-card">
          <div className="pm-dash-kpi">96%</div>
          <div className="label-caps" style={{fontSize:10}}>VIP SLA</div>
        </div>
      </div>
      <div className="pm-dash-spark">
        <svg viewBox="0 0 240 40" preserveAspectRatio="none" width="100%" height="40">
          <defs>
            <linearGradient id="sparkG" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7131d6" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#0058bf" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d="M0 30 L30 24 L60 26 L90 18 L120 22 L150 12 L180 16 L210 8 L240 14 L240 40 L0 40 Z" fill="url(#sparkG)"/>
          <path d="M0 30 L30 24 L60 26 L90 18 L120 22 L150 12 L180 16 L210 8 L240 14" stroke="#7131d6" strokeWidth="1.5" fill="none"/>
        </svg>
      </div>
    </div>
  );
}

// ============ Slide content parts ============
function ProblemStats() {
  const stats = [
    { icon: <IconCrown size={22}/>,    num: "41",  unit: "%",     label: "of VIP tickets slip past SLA",        body: "Priority is detected only after a human sees the ticket. By then, the revenue has already walked.", accent: "" },
    { icon: <IconClock size={22}/>,    num: "6.4", unit: "min",   label: "median first response",               body: "Generic queues treat a $10 deposit and a $40k withdrawal the same. Ops pays the spread.",         accent: "accent-amber" },
    { icon: <IconFragment size={22}/>, num: "7",   unit: "tools", label: "open during an average shift",        body: "CRM, chat, risk, KYC, payments, wiki, notes. Context lives in tabs, not in tickets.",             accent: "accent-coral" },
  ];
  return (
    <>
      {stats.map((s, i) => (
        <div className={`stat-card ${s.accent}`} key={i}>
          <div>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-num">{s.num}<span className="unit">{s.unit}</span></div>
          </div>
          <div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-body">{s.body}</div>
          </div>
          <div style={{position:"absolute", top:28, right:28}}>
            <span className="mono" style={{fontSize:11, color:"var(--muted-2)", letterSpacing:"0.1em"}}>0{i+1}</span>
          </div>
        </div>
      ))}
    </>
  );
}

function Pillars() {
  const pillars = [
    { featured: true, kicker: "Pillar 01", icon: <IconCrown size={18}/>,  title: "VIP-aware queue.",            body: "Auto-prioritization by customer tier. VIPs pin to top with a crown badge — before they ask, before they churn.", mock: <PillarVipQueue/> },
    { kicker: "Pillar 02", icon: <IconGauge size={18}/>,  title: "Real-time ticket aging.",     body: "Color-coded freshness at a glance. Fresh, aging, hot. No math, no SLA dashboard.", mock: <PillarAging/> },
    { kicker: "Pillar 03", icon: <IconNote size={18}/>,   title: "Note-based response tracking.", body: "Replaces brittle SLA timers with a conversation thread ops can actually read.", mock: <PillarNotes/> },
    { kicker: "Pillar 04", icon: <IconSearch size={18}/>, title: "Fuzzy customer picker.",      body: "One bar, four keys. Match across name, email, customer ID, phone.", mock: <PillarSearch/> },
    { kicker: "Pillar 05", icon: <IconSpark size={18}/>,  title: "Live dashboards.",            body: "VIP alert strips, live feed, agent performance — streamed, not batched.", mock: <PillarDashboard/> },
  ];
  return (
    <>
      {pillars.map((p, i) => (
        <div className={`pillar ${p.featured ? "featured" : ""}`} key={i}>
          <div className="p-head">
            <div className="p-icon">{p.icon}</div>
            <div><div className="p-kicker">{p.kicker}</div></div>
          </div>
          <div>
            <div className="p-title">{p.title}</div>
            <div className="p-body" style={{marginTop: 8}}>{p.body}</div>
          </div>
          <div className="p-mock">{p.mock}</div>
        </div>
      ))}
    </>
  );
}

function ScaleGrid() {
  const feats = [
    { tag: "Data",   icon: <IconUpload size={16}/>, title: "CSV bulk import",      body: "Onboard a book of 50k customers in a single pass. Dedup, validate, map fields in one flow." },
    { tag: "Team",   icon: <IconUsers size={16}/>,  title: "Agent invite system",  body: "Roles, regions, and queue scopes baked in. Invite in, audit out." },
    { tag: "Sync",   icon: <IconSync size={16}/>,   title: "Firestore realtime",   body: "Sub-second sync across every open shift, every geography. No polling." },
    { tag: "Flow",   icon: <IconLayers size={16}/>, title: "Bulk actions",         body: "Close 400 stale tickets, reassign a shift, apply a tag — without leaving the queue." },
    { tag: "Views",  icon: <IconKanban size={16}/>, title: "Kanban + Table",       body: "Same data, two surfaces. Shift leads work in Kanban, analysts work in Table." },
    { tag: "Filter", icon: <IconFilter size={16}/>, title: "Filter presets",       body: "Save and share the filters that run your shift. Personal or team-wide." },
    { tag: "Trust",  icon: <IconShield size={16}/>, title: "Audit log",            body: "Every action, every actor, every millisecond. SOC 2 ready out of the box." },
    { tag: "Sec",    icon: <IconLock size={16}/>,   title: "SSO + SCIM",           body: "Okta, Entra, JumpCloud. Provisioning without a ticket." },
  ];
  return (
    <>
      {feats.map((f,i) => (
        <div className="feat-card" key={i}>
          <div className="f-tag">{f.tag}</div>
          <div className="f-icon">{f.icon}</div>
          <div className="f-title">{f.title}</div>
          <div className="f-body">{f.body}</div>
        </div>
      ))}
    </>
  );
}

function WhyCompare() {
  return (
    <>
      <div className="compare-head">
        <div>
          <div className="label-caps label-caps-grad">Before · After</div>
          <h2 className="display display-md" style={{margin: "14px 0 0"}}>
            The shift your ops<br/>team actually feels.
          </h2>
        </div>
      </div>
      <div className="compare-grid">
        <div className="compare-col before">
          <div className="c-kicker">Before DeskHive</div>
          <div className="c-title">Reactive, fragmented.</div>
          <ul>
            <li><span className="ico"><IconX size={12}/></span>VIPs discovered mid-ticket, after the damage.</li>
            <li><span className="ico"><IconX size={12}/></span>Seven tabs to resolve one withdrawal.</li>
            <li><span className="ico"><IconX size={12}/></span>SLA timers that everyone learns to game.</li>
            <li><span className="ico"><IconX size={12}/></span>Shift handoff = a paste in Slack.</li>
            <li><span className="ico"><IconX size={12}/></span>Audits assembled from screenshots.</li>
          </ul>
        </div>
        <div className="compare-col after">
          <div className="c-kicker">With DeskHive</div>
          <div className="c-title">Proactive, single-pane.</div>
          <ul>
            <li><span className="ico"><IconCheck size={12}/></span>VIPs pinned before an agent clicks.</li>
            <li><span className="ico"><IconCheck size={12}/></span>One surface. Context travels with the ticket.</li>
            <li><span className="ico"><IconCheck size={12}/></span>Response notes replace the stopwatch.</li>
            <li><span className="ico"><IconCheck size={12}/></span>Handoffs are a button. History is built-in.</li>
            <li><span className="ico"><IconCheck size={12}/></span>Audit log is the product, not a report.</li>
          </ul>
        </div>
      </div>
    </>
  );
}

function WhyQuote() {
  return (
    <>
      <div>
        <div className="quote-mark">&ldquo;</div>
        <p className="quote-body">
          DeskHive is the first tool our shift leads opened on day one and still have open at end of shift. Our VIP churn dropped before the training finished.
        </p>
      </div>
      <div>
        <div className="quote-attrib">
          <div className="avatar">NT</div>
          <div>
            <div className="who">Naomi T.</div>
            <div className="role">Director of Operations · Midsize sportsbook</div>
          </div>
        </div>
        <div className="quote-metrics">
          <div className="m">−62%<span className="l">Median first touch</span></div>
          <div className="m">+34%<span className="l">VIP retention</span></div>
        </div>
      </div>
    </>
  );
}

function QrPlaceholder() {
  const size = 21;
  const cells: number[] = [];
  let s = 0x9a3c7;
  for (let i = 0; i < size * size; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    cells.push(s % 2);
  }
  const isFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size-7 && y < 7) || (x < 7 && y >= size-7);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" shapeRendering="crispEdges">
      {cells.map((c, i) => {
        const x = i % size, y = Math.floor(i / size);
        if (isFinder(x, y)) return null;
        return c ? <rect key={i} x={x} y={y} width="1" height="1" fill="#1a1c1c"/> : null;
      })}
      {[[0,0],[size-7,0],[0,size-7]].map(([fx,fy], k) => (
        <g key={k}>
          <rect x={fx} y={fy} width="7" height="7" fill="#1a1c1c"/>
          <rect x={fx+1} y={fy+1} width="5" height="5" fill="#fff"/>
          <rect x={fx+2} y={fy+2} width="3" height="3" fill="#1a1c1c"/>
        </g>
      ))}
    </svg>
  );
}

function CtaPage() {
  return (
    <>
      <div className="cta-left">
        <div className="label-caps" style={{color: "#b08cff"}}>● The next move</div>
        <h2 className="display">
          See it run<br/>
          on your{" "}
          <span className="grad-text" style={{background: "linear-gradient(135deg,#c4a3ff,#7bb5ff)", WebkitBackgroundClip: "text", backgroundClip: "text"}}>own queue.</span>
        </h2>
        <p className="body-lg" style={{color: "rgba(255,255,255,0.65)", maxWidth: 560}}>
          30-minute walkthrough. We mirror a day of your traffic in a sandbox and
          hand you the keys. No slides, no pitch deck after this one.
        </p>
        <div style={{display: "flex", gap: 14, marginTop: 8}}>
          <a href="mailto:johnny.p.jabbour@gmail.com?subject=DeskHive%20walkthrough%20request"
             className="btn btn-primary" style={{textDecoration: "none"}}>
            Book a walkthrough <IconArrow size={14}/>
          </a>
        </div>
      </div>
      <div className="cta-panel">
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20}}>
          <div>
            <div className="wordmark on-dark" style={{fontSize: 20}}>
              <div className="mark"></div>DeskHive
            </div>
            <div className="body-sm" style={{color: "rgba(255,255,255,0.5)", marginTop: 10, maxWidth: 280}}>
              Support, re-engineered for teams that can&apos;t afford to wait.
            </div>
          </div>
          <div className="qr"><QrPlaceholder/></div>
        </div>
        <div>
          <div className="cta-row">
            <span className="k">Demo</span>
            <a href="mailto:johnny.p.jabbour@gmail.com?subject=DeskHive%20demo%20request" className="v" style={{textDecoration: "none"}}>
              Request a demo
            </a>
          </div>
          <div className="cta-row">
            <span className="k">Sales</span>
            <a href="mailto:johnny.p.jabbour@gmail.com" className="v" style={{textDecoration: "none"}}>
              johnny.p.jabbour@gmail.com
            </a>
          </div>
          <div className="cta-row"><span className="k">HQ</span><span className="v">Remote · EU / US</span></div>
        </div>
        <div style={{display: "flex", gap: 10, flexWrap: "wrap"}}>
          {["SOC 2 Type II","GDPR","ISO 27001","99.98% SLA"].map(t => (
            <span key={t} className="pill" style={{background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)"}}>{t}</span>
          ))}
        </div>
      </div>
    </>
  );
}

// ============ Slide wrapper: scales the 1920×1080 canvas down to container width ============
function Slide({ id, children, printMode = false }: { id: string; children: React.ReactNode; printMode?: boolean }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (printMode) return; // Skip scaling entirely for PDF render
    function update() {
      const w = wrapRef.current?.clientWidth ?? 1920;
      setScale(Math.min(1, w / 1920));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [printMode]);

  if (printMode) {
    return (
      <div className="brochure-slide-wrap brochure-slide-print" id={id} style={{ width: 1920, height: 1080 }}>
        <div style={{ width: 1920, height: 1080 }}>{children}</div>
      </div>
    );
  }

  return (
    <div className="brochure-slide-wrap" id={id} ref={wrapRef} style={{ height: 1080 * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 1920, height: 1080 }}>
        {children}
      </div>
    </div>
  );
}

// ============ Page ============
export default function BrochurePage() {
  const [exportStatus, setExportStatus] = useState("");
  const isExporting = exportStatus !== "";
  const [isPrintMode, setIsPrintMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsPrintMode(new URLSearchParams(window.location.search).get("print") === "1");
  }, []);

  async function handleDownload() {
    if (isExporting) return;
    try {
      await downloadBrochurePDF(setExportStatus);
    } catch (e) {
      console.error(e);
      setExportStatus("");
      alert("Could not generate PDF.\n\n" + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <>
      {/* Google fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;550;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <div className={`brochure-root${isPrintMode ? " brochure-print-mode" : ""}`}>
        {!isPrintMode && <nav className="brochure-bar" aria-label="Brochure navigation">
          <a href="#slide-cover">01 · Cover</a>
          <a href="#slide-problem">02 · Problem</a>
          <a href="#slide-product">03 · Product</a>
          <a href="#slide-scale">04 · Scale</a>
          <a href="#slide-why">05 · Why</a>
          <a href="#slide-cta">06 · CTA</a>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="brochure-bar-dl"
            aria-label="Download as PDF"
          >
            {isExporting ? "…" : "↓ PDF"}
          </button>
        </nav>}
        {!isPrintMode && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="brochure-fab"
            aria-label="Download as PDF"
          >
            {isExporting ? "…" : "↓ PDF"}
          </button>
        )}
        {isExporting && (
          <div className="brochure-export-overlay" role="status" aria-live="polite">
            <div className="brochure-export-card">
              <div className="brochure-export-spinner" />
              <div className="brochure-export-text">{exportStatus}</div>
            </div>
          </div>
        )}

        <div className="brochure-deck">
          {/* 01 — COVER */}
          <Slide id="slide-cover" printMode={isPrintMode}>
            <section className="brochure-slide slide-cover">
              <div className="aurora"></div>
              <div className="grid-bg"></div>
              <div className="topbar">
                <div className="wordmark"><div className="mark"></div>DeskHive</div>
                <div style={{display: "flex", gap: 10, alignItems: "center"}}>
                  <span className="pill grad"><span className="dot dot-pulse"></span> Live · v2.4</span>
                  <span className="pill">Enterprise · SOC 2</span>
                </div>
              </div>

              <div className="cover-grid">
                <div className="cover-left">
                  <div className="label-caps label-caps-grad">Support CRM · Built for Ops</div>
                  <h1 className="display display-xl cover-title">
                    Support,<br/>re-engineered<br/>for teams that<br/>
                    <span className="grad-text">can&apos;t afford to wait.</span>
                  </h1>
                  <p className="body-lg cover-sub">
                    A VIP-aware, real-time helpdesk for high-volume sports betting
                    operations. Built to find what matters, and answer it first.
                  </p>
                  <div className="cover-cta">
                    <a href="mailto:johnny.p.jabbour@gmail.com?subject=DeskHive%20walkthrough%20request"
                       className="btn btn-primary" style={{textDecoration: "none"}}>
                      Book a walkthrough →
                    </a>
                    <a href="mailto:johnny.p.jabbour@gmail.com"
                       className="btn btn-ghost" style={{textDecoration: "none"}}>
                      johnny.p.jabbour@gmail.com
                    </a>
                  </div>
                  <div className="cover-meta">
                    <div><span className="mono meta-num">99.98%</span><div className="label-caps">Realtime uptime</div></div>
                    <div><span className="mono meta-num">&lt;180ms</span><div className="label-caps">Ticket sync p95</div></div>
                    <div><span className="mono meta-num">24 / 7</span><div className="label-caps">Ops-grade support</div></div>
                  </div>
                </div>
                <div className="cover-right">
                  <CoverProductMock/>
                </div>
              </div>

              <div className="footer-bar">
                <div>deskhive.io</div>
                <div className="pagenum">01 / 06 · COVER</div>
                <div>© 2026 DeskHive Labs</div>
              </div>
            </section>
          </Slide>

          {/* 02 — PROBLEM */}
          <Slide id="slide-problem" printMode={isPrintMode}>
            <section className="brochure-slide slide-problem">
              <div className="grid-bg dense"></div>
              <div className="topbar">
                <div className="wordmark"><div className="mark"></div>DeskHive</div>
                <div className="label-caps">The Problem · 02</div>
              </div>
              <div className="problem-wrap">
                <div className="problem-head">
                  <div className="label-caps" style={{color: "var(--coral)"}}>● The state of support ops</div>
                  <h2 className="display display-md" style={{fontSize: 64}}>
                    Most helpdesks were built<br/>
                    for <span style={{color: "var(--muted-2)"}}>tickets</span> —<br/>
                    not for <span className="grad-text">VIPs at 2am.</span>
                  </h2>
                  <p className="body-lg" style={{maxWidth: 620, color: "var(--muted)"}}>
                    When a high-stakes customer hits an issue mid-bet, SLA timers,
                    tab-switching, and inbox triage aren&apos;t workflows — they&apos;re liabilities.
                  </p>
                </div>
                <div className="problem-stats"><ProblemStats/></div>
              </div>
              <div className="footer-bar">
                <div>The Problem</div>
                <div className="pagenum">02 / 06</div>
                <div>deskhive.io</div>
              </div>
            </section>
          </Slide>

          {/* 03 — PRODUCT */}
          <Slide id="slide-product" printMode={isPrintMode}>
            <section className="brochure-slide slide-product">
              <div className="topbar">
                <div className="wordmark"><div className="mark"></div>DeskHive</div>
                <div className="label-caps">The Product · 03</div>
              </div>
              <div className="product-wrap">
                <div className="product-head">
                  <div className="label-caps label-caps-grad">Five pillars, one surface</div>
                  <h2 className="headline" style={{margin: "10px 0 0", fontSize: 44, maxWidth: 1200}}>
                    Every pillar earns its pixel. No modules, no bloat — just the
                    primitives ops teams actually use, wired into <span className="grad-text">a single live queue.</span>
                  </h2>
                </div>
                <div className="pillars"><Pillars/></div>
              </div>
              <div className="footer-bar">
                <div>The Product · Core Pillars</div>
                <div className="pagenum">03 / 06</div>
                <div>deskhive.io</div>
              </div>
            </section>
          </Slide>

          {/* 04 — SCALE */}
          <Slide id="slide-scale" printMode={isPrintMode}>
            <section className="brochure-slide slide-scale">
              <div className="aurora" style={{opacity: 0.35}}></div>
              <div className="topbar">
                <div className="wordmark on-dark"><div className="mark"></div>DeskHive</div>
                <div className="label-caps" style={{color: "rgba(255,255,255,0.6)"}}>Built for Scale · 04</div>
              </div>
              <div className="scale-wrap">
                <div className="scale-head">
                  <div className="label-caps" style={{color: "#b08cff"}}>● Infrastructure</div>
                  <h2 className="display display-lg" style={{color: "#fff", margin: "18px 0 24px"}}>
                    Built to run at the<br/>
                    <span style={{background: "linear-gradient(135deg,#c4a3ff,#7bb5ff)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent"}}>edge of volume.</span>
                  </h2>
                  <p className="body-lg" style={{color: "rgba(255,255,255,0.65)", maxWidth: 560}}>
                    Firestore-backed real-time sync, audit-traceable every click,
                    shaped for teams that triple headcount in a week.
                  </p>
                </div>
                <div className="scale-grid"><ScaleGrid/></div>
              </div>
              <div className="footer-bar" style={{color: "rgba(255,255,255,0.5)"}}>
                <div>Built for Scale</div>
                <div className="pagenum" style={{color: "rgba(255,255,255,0.5)"}}>04 / 06</div>
                <div>deskhive.io</div>
              </div>
            </section>
          </Slide>

          {/* 05 — WHY */}
          <Slide id="slide-why" printMode={isPrintMode}>
            <section className="brochure-slide slide-why">
              <div className="grid-bg dense"></div>
              <div className="topbar">
                <div className="wordmark"><div className="mark"></div>DeskHive</div>
                <div className="label-caps">Why DeskHive · 05</div>
              </div>
              <div className="why-wrap">
                <div className="why-compare"><WhyCompare/></div>
                <div className="why-quote"><WhyQuote/></div>
              </div>
              <div className="footer-bar">
                <div>Why DeskHive</div>
                <div className="pagenum">05 / 06</div>
                <div>deskhive.io</div>
              </div>
            </section>
          </Slide>

          {/* 06 — CTA */}
          <Slide id="slide-cta" printMode={isPrintMode}>
            <section className="brochure-slide slide-cta">
              <div className="aurora"></div>
              <div className="topbar">
                <div className="wordmark on-dark"><div className="mark"></div>DeskHive</div>
                <div className="label-caps" style={{color: "rgba(255,255,255,0.6)"}}>Let&apos;s talk · 06</div>
              </div>
              <div className="cta-wrap"><CtaPage/></div>
              <div className="footer-bar" style={{color: "rgba(255,255,255,0.4)"}}>
                <div>© 2026 DeskHive Labs · Support re-engineered.</div>
                <div className="pagenum" style={{color: "rgba(255,255,255,0.4)"}}>06 / 06</div>
                <div>deskhive.io / demo</div>
              </div>
            </section>
          </Slide>
        </div>
      </div>
    </>
  );
}
