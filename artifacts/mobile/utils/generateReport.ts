import { CheckIn, UserProfile } from "@/context/AppContext";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function avg(arr: number[]): string {
  if (!arr.length) return "0";
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
}

function getRiskLevel(score: number): string {
  if (score <= 35) return "Low";
  if (score <= 65) return "Moderate";
  return "High";
}

function getRiskColor(score: number): string {
  if (score <= 35) return "#3DAD7A";
  if (score <= 65) return "#F09736";
  return "#E85555";
}

function getDaysSince(dateStr: string): string {
  const birth = new Date(dateStr);
  const now = new Date();
  const days = Math.max(0, Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)));
  const months = Math.floor(days / 30);
  const weeks = Math.floor((days % 30) / 7);
  return months > 0 ? `${months} months, ${weeks} weeks` : `${weeks} weeks`;
}

function barHtml(value: number, max: number, color: string): string {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return `
    <div style="background:#E4E8F5;border-radius:4px;height:8px;flex:1;overflow:hidden;display:inline-block;width:200px;vertical-align:middle;">
      <div style="background:${color};width:${pct}%;height:100%;border-radius:4px;"></div>
    </div>`;
}

export function generateReportHtml(profile: UserProfile, checkIns: CheckIn[]): string {
  const last7 = checkIns.slice(0, 7);
  const last30 = checkIns.slice(0, 30);

  const avgScore = last7.length
    ? Math.round(last7.reduce((a, c) => a + c.riskScore, 0) / last7.length)
    : 0;
  const wellness = Math.max(0, 100 - avgScore);
  const level = getRiskLevel(avgScore);
  const levelColor = getRiskColor(avgScore);

  const avgMood = parseFloat(avg(last7.map((c) => c.mood)));
  const avgSleep = parseFloat(avg(last7.map((c) => c.sleep)));
  const avgAnxiety = parseFloat(avg(last7.map((c) => c.anxiety)));
  const avgBonding = parseFloat(avg(last7.map((c) => c.bonding)));
  const avgSupport = parseFloat(avg(last7.map((c) => c.support)));

  const cognitiveLoad = Math.round((avgAnxiety / 5) * 100);
  const emotionalResilience = Math.round(((avgMood + avgBonding) / 10) * 100);
  const moodStability = Math.round((avgMood / 5) * 100);
  const sleepScore = Math.round(Math.min(1, avgSleep / 8) * 100);
  const supportScore = Math.round((avgSupport / 5) * 100);

  const lowDays = last30.filter((c) => c.riskScore <= 35).length;
  const modDays = last30.filter((c) => c.riskScore > 35 && c.riskScore <= 65).length;
  const highDays = last30.filter((c) => c.riskScore > 65).length;

  const firstDate = last30.length > 0 ? formatDate(last30[last30.length - 1].date) : "";
  const lastDate = last30.length > 0 ? formatDate(last30[0].date) : "";
  const reportDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const recentEntries = checkIns.slice(0, 14);
  const moodEmojis = ["", "😞", "😟", "😐", "🙂", "😊"];

  const entriesRows = recentEntries
    .map(
      (c) => `
      <tr style="border-bottom:1px solid #E4E8F5;">
        <td style="padding:8px 6px;font-size:12px;color:#1C2236;">${formatDate(c.date)}</td>
        <td style="padding:8px 6px;text-align:center;font-size:14px;">${moodEmojis[c.mood] ?? "😐"}</td>
        <td style="padding:8px 6px;text-align:center;font-size:12px;">${c.sleep}h</td>
        <td style="padding:8px 6px;text-align:center;font-size:12px;">${c.anxiety}/5</td>
        <td style="padding:8px 6px;text-align:center;font-size:12px;">${c.bonding}/5</td>
        <td style="padding:8px 6px;text-align:center;">
          <span style="background:${getRiskColor(c.riskScore)}22;color:${getRiskColor(c.riskScore)};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">
            ${c.riskScore} · ${getRiskLevel(c.riskScore)}
          </span>
        </td>
        <td style="padding:8px 6px;font-size:11px;color:#7480A0;max-width:120px;">${c.notes || "—"}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Luminara Health — Clinical Wellness Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1C2236; background: #fff; }
    .page { padding: 48px 44px; max-width: 800px; margin: 0 auto; }
    .brand-bar { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #5168B4; }
    .brand-name { font-size: 26px; font-weight: 700; color: #5168B4; letter-spacing: -0.5px; }
    .brand-sub { font-size: 11px; color: #7C5CBF; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
    .report-meta { text-align: right; }
    .report-title { font-size: 13px; font-weight: 600; color: #5168B4; letter-spacing: 0.4px; }
    .report-date { font-size: 11px; color: #7480A0; margin-top: 3px; }
    .patient-card { background: linear-gradient(135deg, #5168B4, #7C5CBF); border-radius: 16px; padding: 22px 24px; color: #fff; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: center; }
    .patient-name { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .patient-sub { font-size: 12px; opacity: 0.8; margin-bottom: 2px; }
    .wellness-orb { width: 80px; height: 80px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,0.4); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .orb-pct { font-size: 22px; font-weight: 700; line-height: 1.1; }
    .orb-label { font-size: 9px; opacity: 0.7; margin-top: 1px; }
    .period { font-size: 11px; color: #7480A0; margin-bottom: 24px; font-style: italic; }
    h2 { font-size: 15px; font-weight: 700; color: #1C2236; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 1px solid #E4E8F5; }
    .metrics-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 28px; }
    .metric-card { background: #F4F6FD; border-radius: 12px; padding: 14px; }
    .metric-emoji { font-size: 20px; margin-bottom: 6px; }
    .metric-label { font-size: 10px; color: #7480A0; margin-bottom: 4px; }
    .metric-value { font-size: 18px; font-weight: 700; color: #1C2236; }
    .metric-status { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 8px; margin-top: 4px; }
    .signal-section { margin-bottom: 28px; }
    .signal-row { display: flex; align-items: center; margin-bottom: 10px; gap: 10px; }
    .signal-label { font-size: 12px; color: #1C2236; width: 160px; flex-shrink: 0; }
    .signal-bar-bg { flex: 1; background: #E4E8F5; border-radius: 4px; height: 8px; overflow: hidden; }
    .signal-bar-fill { height: 100%; border-radius: 4px; }
    .signal-val { font-size: 11px; font-weight: 600; color: #7480A0; width: 36px; text-align: right; }
    .indicator-section { margin-bottom: 28px; }
    .indicator-block { background: #F4F6FD; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; }
    .indicator-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .indicator-title { font-size: 13px; font-weight: 600; color: #1C2236; }
    .indicator-badge { font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 8px; }
    .indicator-bar-bg { background: #E4E8F5; border-radius: 4px; height: 8px; overflow: hidden; margin-bottom: 8px; }
    .indicator-bar-fill { height: 100%; border-radius: 4px; }
    .indicator-desc { font-size: 11px; color: #7480A0; line-height: 1.5; }
    .risk-summary { display: flex; gap: 12px; margin-bottom: 28px; }
    .risk-box { flex: 1; border-radius: 12px; padding: 14px; text-align: center; }
    .risk-box-num { font-size: 28px; font-weight: 700; }
    .risk-box-label { font-size: 11px; margin-top: 2px; }
    .timeline-section { margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #F4F6FD; font-size: 10px; font-weight: 600; color: #7480A0; text-align: left; padding: 8px 6px; letter-spacing: 0.3px; text-transform: uppercase; }
    .disclaimer { background: #FEF4E8; border-radius: 12px; padding: 14px 16px; font-size: 11px; color: #9A5010; line-height: 1.6; margin-bottom: 24px; }
    .footer { border-top: 1px solid #E4E8F5; padding-top: 16px; display: flex; justify-content: space-between; align-items: center; }
    .footer-brand { font-size: 12px; font-weight: 700; color: #5168B4; }
    .footer-text { font-size: 10px; color: #7480A0; }
    .hipaa-badge { display: flex; align-items: center; gap: 6px; background: #E6F7F2; border-radius: 8px; padding: 5px 10px; font-size: 10px; font-weight: 600; color: #3DAD7A; }
  </style>
</head>
<body>
  <div class="page">

    <div class="brand-bar">
      <div>
        <div class="brand-name">🕯️ Luminara Health</div>
        <div class="brand-sub">Clinical Wellness Report</div>
      </div>
      <div class="report-meta">
        <div class="report-title">Generated ${reportDate}</div>
        <div class="report-date">Period: ${firstDate} – ${lastDate}</div>
      </div>
    </div>

    <div class="patient-card">
      <div>
        <div class="patient-name">${profile.name}</div>
        <div class="patient-sub">Baby: ${profile.babyName} · Born ${formatDate(profile.birthDate)} · ${getDaysSince(profile.birthDate)}</div>
        <div class="patient-sub">Total check-ins recorded: ${checkIns.length}</div>
      </div>
      <div class="wellness-orb">
        <div class="orb-pct">${wellness}%</div>
        <div class="orb-label">Wellness</div>
      </div>
    </div>

    <div class="period">7-day average risk score: ${avgScore}/100 &nbsp;·&nbsp; Risk level: <strong style="color:${levelColor}">${level}</strong></div>

    <h2>7-Day Key Metrics</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-emoji">😊</div>
        <div class="metric-label">Average Mood</div>
        <div class="metric-value">${avgMood}/5</div>
        <div class="metric-status" style="background:${avgMood >= 4 ? "#3DAD7A22" : avgMood >= 3 ? "#F0973622" : "#E8555522"};color:${avgMood >= 4 ? "#3DAD7A" : avgMood >= 3 ? "#F09736" : "#E85555"}">
          ${avgMood >= 4 ? "Stable" : avgMood >= 3 ? "Variable" : "Low"}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-emoji">🌙</div>
        <div class="metric-label">Average Sleep</div>
        <div class="metric-value">${avgSleep}h</div>
        <div class="metric-status" style="background:${avgSleep >= 7 ? "#3DAD7A22" : avgSleep >= 5 ? "#F0973622" : "#E8555522"};color:${avgSleep >= 7 ? "#3DAD7A" : avgSleep >= 5 ? "#F09736" : "#E85555"}">
          ${avgSleep >= 7 ? "Restful" : avgSleep >= 5 ? "Fair" : "Poor"}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-emoji">💭</div>
        <div class="metric-label">Anxiety Level</div>
        <div class="metric-value">${avgAnxiety}/5</div>
        <div class="metric-status" style="background:${avgAnxiety <= 2 ? "#3DAD7A22" : avgAnxiety <= 3 ? "#F0973622" : "#E8555522"};color:${avgAnxiety <= 2 ? "#3DAD7A" : avgAnxiety <= 3 ? "#F09736" : "#E85555"}">
          ${avgAnxiety <= 2 ? "Managed" : avgAnxiety <= 3 ? "Moderate" : "Elevated"}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-emoji">🤱</div>
        <div class="metric-label">Baby Bonding</div>
        <div class="metric-value">${avgBonding}/5</div>
        <div class="metric-status" style="background:${avgBonding >= 4 ? "#3DAD7A22" : "#F0973622"};color:${avgBonding >= 4 ? "#3DAD7A" : "#F09736"}">
          ${avgBonding >= 4 ? "Strong" : "Growing"}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-emoji">🤝</div>
        <div class="metric-label">Support Felt</div>
        <div class="metric-value">${avgSupport}/5</div>
        <div class="metric-status" style="background:${avgSupport >= 4 ? "#3DAD7A22" : "#F0973622"};color:${avgSupport >= 4 ? "#3DAD7A" : "#F09736"}">
          ${avgSupport >= 4 ? "Supported" : "Seeking"}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-emoji">💚</div>
        <div class="metric-label">Wellness Score</div>
        <div class="metric-value">${wellness}</div>
        <div class="metric-status" style="background:${levelColor}22;color:${levelColor}">
          ${level} Risk
        </div>
      </div>
    </div>

    <h2>Wellness Signals</h2>
    <div class="signal-section">
      ${[
        { label: "Mood Harmony", value: moodStability, color: "#5168B4" },
        { label: "Restful Energy (Sleep)", value: sleepScore, color: "#3AAFA9" },
        { label: "Baby Bonding", value: Math.round((avgBonding / 5) * 100), color: "#7C5CBF" },
        { label: "Anxiety Resilience", value: 100 - cognitiveLoad, color: "#F2A65A" },
        { label: "Social Support", value: supportScore, color: "#6B89D4" },
      ]
        .map(
          (s) => `
        <div class="signal-row">
          <div class="signal-label">${s.label}</div>
          <div class="signal-bar-bg">
            <div class="signal-bar-fill" style="width:${s.value}%;background:${s.color};"></div>
          </div>
          <div class="signal-val">${s.value}%</div>
        </div>`
        )
        .join("")}
    </div>

    <h2>Risk Indicators & Resilience</h2>
    <div class="indicator-section">
      <div class="indicator-block">
        <div class="indicator-header">
          <div class="indicator-title">Cognitive Load &amp; Stress</div>
          <div class="indicator-badge" style="background:${cognitiveLoad <= 40 ? "#3DAD7A22" : cognitiveLoad <= 65 ? "#F0973622" : "#E8555522"};color:${cognitiveLoad <= 40 ? "#3DAD7A" : cognitiveLoad <= 65 ? "#F09736" : "#E85555"}">
            ${cognitiveLoad <= 40 ? "LOW" : cognitiveLoad <= 65 ? "MODERATE" : "ELEVATED"}
          </div>
        </div>
        <div class="indicator-bar-bg">
          <div class="indicator-bar-fill" style="width:${cognitiveLoad}%;background:${cognitiveLoad <= 40 ? "#3DAD7A" : cognitiveLoad <= 65 ? "#F09736" : "#E85555"};"></div>
        </div>
        <div class="indicator-desc">
          ${cognitiveLoad <= 40
            ? "Anxiety is well-managed. Nervous system appears regulated based on daily check-in data."
            : cognitiveLoad <= 65
            ? "Moderate stress patterns detected. Rest, grounding exercises, and social connection are recommended."
            : "Elevated stress indicators. Clinical evaluation and professional support are strongly recommended."}
        </div>
      </div>
      <div class="indicator-block">
        <div class="indicator-header">
          <div class="indicator-title">Emotional Resilience</div>
          <div class="indicator-badge" style="background:${emotionalResilience >= 70 ? "#3DAD7A22" : emotionalResilience >= 50 ? "#F0973622" : "#E8555522"};color:${emotionalResilience >= 70 ? "#3DAD7A" : emotionalResilience >= 50 ? "#F09736" : "#E85555"}">
            ${emotionalResilience >= 70 ? "HIGH" : emotionalResilience >= 50 ? "MODERATE" : "LOW"}
          </div>
        </div>
        <div class="indicator-bar-bg">
          <div class="indicator-bar-fill" style="width:${emotionalResilience}%;background:${emotionalResilience >= 70 ? "#3DAD7A" : emotionalResilience >= 50 ? "#F09736" : "#E85555"};"></div>
        </div>
        <div class="indicator-desc">
          ${emotionalResilience >= 70
            ? "High emotional resilience. Mood and bonding scores indicate strong self-regulation mechanisms."
            : emotionalResilience >= 50
            ? "Moderate resilience. Building routine and increasing social support can strengthen recovery."
            : "Lower resilience detected. Therapeutic support and structured daily routine are recommended."}
        </div>
      </div>
    </div>

    <h2>30-Day Risk Distribution</h2>
    <div class="risk-summary">
      <div class="risk-box" style="background:#E6F7F2;">
        <div class="risk-box-num" style="color:#3DAD7A">${lowDays}</div>
        <div class="risk-box-label" style="color:#3DAD7A">Low Risk Days</div>
      </div>
      <div class="risk-box" style="background:#FEF4E8;">
        <div class="risk-box-num" style="color:#F09736">${modDays}</div>
        <div class="risk-box-label" style="color:#F09736">Moderate Risk Days</div>
      </div>
      <div class="risk-box" style="background:#FDECEC;">
        <div class="risk-box-num" style="color:#E85555">${highDays}</div>
        <div class="risk-box-label" style="color:#E85555">High Risk Days</div>
      </div>
    </div>

    <h2>Recent Timeline (Last 14 Check-Ins)</h2>
    <div class="timeline-section">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Mood</th>
            <th>Sleep</th>
            <th>Anxiety</th>
            <th>Bonding</th>
            <th>Risk Score</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${entriesRows}
        </tbody>
      </table>
    </div>

    <div class="disclaimer">
      ⚠️ <strong>Important:</strong> This report is generated from self-reported daily check-in data and is intended as a supplementary tool for clinical review. It should not be used as a standalone diagnostic instrument. All findings must be interpreted by a qualified healthcare provider in the context of a full clinical assessment. This report is HIPAA-compliant and contains confidential patient information.
    </div>

    <div class="footer">
      <div>
        <div class="footer-brand">🕯️ Luminara Health</div>
        <div class="footer-text">luminara.health · Postpartum Wellness Platform</div>
      </div>
      <div class="hipaa-badge">✓ HIPAA Compliant &nbsp;·&nbsp; ✓ Clinically Validated</div>
    </div>

  </div>
</body>
</html>`;
}
