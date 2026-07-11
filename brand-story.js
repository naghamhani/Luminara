/* ---------- the flame mark ---------- */
function flameSVG(id, outer, glow, cradle) {
    // The "Kept Flame": a flat flame cupped by two hands.
    // Pass cradle = "none" to omit the hands (used by the phase row).
    var hands = (cradle && cradle !== "none")
        ? '<path fill="none" stroke="' + cradle + '" stroke-width="4.5" stroke-linecap="round" d="M22,58 C22,86 78,86 78,58"/>'
        : '';
    return '' +
    '<svg viewBox="0 0 100 100" role="img" aria-hidden="true">' +
      '<defs>' +
        '<radialGradient id="glow_' + id + '" cx="50%" cy="46%" r="52%">' +
          '<stop offset="0" stop-color="' + glow + '" stop-opacity="0.55"/>' +
          '<stop offset="1" stop-color="' + glow + '" stop-opacity="0"/>' +
        '</radialGradient>' +
      '</defs>' +
      '<circle cx="50" cy="48" r="40" fill="url(#glow_' + id + ')"/>' +
      '<path fill="' + outer + '" d="M50,16 C57,32 68,41 68,55 C68,69 60,77 50,77 C40,77 32,69 32,55 C32,41 43,32 50,16 Z"/>' +
      '<path fill="#FFF3D6" opacity="0.92" d="M50,38 C54,48 60,53 60,62 C60,70 56,75 50,75 C44,75 40,70 40,62 C40,53 46,48 50,38 Z"/>' +
      hands +
    '</svg>';
}

const titleFlame = document.getElementById("titleFlame");
if (titleFlame) titleFlame.innerHTML = flameSVG("t", "#F6A94C", "#FFD98A", "#FBF7F9");

const logoFlame = document.getElementById("logoFlame");
if (logoFlame) logoFlame.innerHTML  = flameSVG("l", "#F6A94C", "#FFD98A", "#8C6FBF");

const closeFlame = document.getElementById("closeFlame");
if (closeFlame) closeFlame.innerHTML = flameSVG("c", "#F6A94C", "#FFD98A", "#FBF7F9");

/* phase-tinted flames — labels carry data-i18n so the language toggle can translate them */
const phases = [
    { outer: "#E17D9B", glow: "#FFB3C6", label: "Menstrual",  key: "phase.menstrual" },
    { outer: "#3AAFA9", glow: "#9BE7E2", label: "Follicular", key: "phase.follicular" },
    { outer: "#F2A65A", glow: "#FFD98A", label: "Ovulation",  key: "phase.ovulation" },
    { outer: "#B0729E", glow: "#C9B6F2", label: "Luteal",     key: "phase.luteal" },
];
document.getElementById("phaseRow").innerHTML = phases.map((p, i) =>
    '<div class="flame-cell">' + flameSVG("p" + i, p.outer, p.glow, "none") +
    '<div class="cap" data-i18n="' + p.key + '">' + p.label + '</div></div>'
).join("");

/* ---------- a little phone illustration (no external assets) ---------- */
function deviceSVG(kind) {
    const head =
    '<svg class="device" viewBox="0 0 300 600" role="img" aria-label="Luminara app screen">' +
      '<defs>' +
        '<linearGradient id="hdr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8C6FBF"/><stop offset="1" stop-color="#B0729E"/></linearGradient>' +
        '<radialGradient id="fl" cx="50%" cy="40%" r="55%"><stop offset="0" stop-color="#FFD98A"/><stop offset="0.6" stop-color="#F2A65A"/><stop offset="1" stop-color="#E8892E"/></radialGradient>' +
      '</defs>' +
      '<rect x="8" y="8" width="284" height="584" rx="44" fill="#3A2F52"/>' +
      '<rect x="18" y="18" width="264" height="564" rx="36" fill="#FBF7F9"/>' +
      '<rect x="120" y="30" width="60" height="10" rx="5" fill="#3A2F52" opacity="0.25"/>';
    // header card with flame + phase
    const body =
      '<rect x="34" y="58" width="232" height="120" rx="22" fill="url(#hdr)"/>' +
      '<path fill="url(#fl)" d="M84,86 C90,102 104,110 104,128 C104,144 95,156 84,156 C73,156 64,144 64,128 C64,110 78,102 84,86 Z"/>' +
      '<text x="120" y="98" font-family="Manrope" font-size="12" font-weight="700" fill="#EEF0FB" data-i18n="phone.phase">Luteal phase</text>' +
      '<text x="120" y="120" font-family="Manrope" font-size="10" font-weight="600" fill="#EEE6F8" data-i18n="phone.day">Day 22 of ~29</text>' +
      '<text x="120" y="150" font-family="Manrope" font-size="10" font-weight="600" fill="#EEE6F8" data-i18n="phone.next">Next period in 7 days</text>' +
      // 2x3 grid tiles
      tiles();
    function tiles() {
        const labels = [["Cycle","#3AAFA9","phone.tile.cycle"],["Labs","#8C6FBF","phone.tile.labs"],["Records","#B0729E","phone.tile.records"],["Meds","#F2A65A","phone.tile.meds"],["Check-in","#E17D9B","phone.tile.checkin"],["Partner","#3AAFA9","phone.tile.partner"]];
        let s = "";
        labels.forEach((l, i) => {
            const col = i % 2, row = (i / 2) | 0;
            const x = 34 + col * 120, y = 196 + row * 88;
            s += '<rect x="' + x + '" y="' + y + '" width="108" height="76" rx="18" fill="#FFFFFF" stroke="#EDE2EC"/>' +
                 '<circle cx="' + (x + 22) + '" cy="' + (y + 26) + '" r="11" fill="' + l[1] + '" opacity="0.9"/>' +
                 '<text x="' + (x + 16) + '" y="' + (y + 58) + '" font-family="Manrope" font-size="11" font-weight="700" fill="#3A2F52" data-i18n="' + l[2] + '">' + l[0] + '</text>';
        });
        return s;
    }
    // bottom lock/privacy pill
    const foot =
      '<rect x="60" y="474" width="180" height="30" rx="15" fill="#EEF0FB"/>' +
      '<circle cx="80" cy="489" r="5" fill="#3AAFA9"/>' +
      '<text x="94" y="493" font-family="Manrope" font-size="10" font-weight="700" fill="#6E52A0" data-i18n="phone.encrypted">Encrypted on this device</text>' +
      '<rect x="110" y="556" width="80" height="6" rx="3" fill="#3A2F52" opacity="0.25"/>' +
    '</svg>';
    return head + body + foot;
}
/* ---------- loading-state phone: the app is still being built ---------- */
function loadingPhoneSVG() {
    return `
    <svg class="device" viewBox="0 0 440 620" role="img" aria-label="The Luminara app — still loading, under construction">
      <defs>
        <linearGradient id="edgeW" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#FFD98A"/><stop offset=".5" stop-color="#B0729E"/><stop offset="1" stop-color="#6E52A0"/>
        </linearGradient>
        <radialGradient id="glowW" cx="50%" cy="40%" r="60%">
          <stop offset="0" stop-color="#F6A94C" stop-opacity=".2"/><stop offset="1" stop-color="#F6A94C" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="fgW" cx="50%" cy="46%" r="52%">
          <stop offset="0" stop-color="#FFD98A"/><stop offset=".6" stop-color="#F6A94C"/><stop offset="1" stop-color="#E8892E"/>
        </radialGradient>
        <radialGradient id="haloW" cx="50%" cy="46%" r="52%">
          <stop offset="0" stop-color="#FFD98A" stop-opacity=".5"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/>
        </radialGradient>
        <filter id="shadowW" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#5A4184" flood-opacity=".32"/>
        </filter>
        <clipPath id="loadClipW"><rect x="160" y="196" width="120" height="8" rx="4"/></clipPath>
      </defs>

      <ellipse cx="220" cy="310" rx="200" ry="250" fill="url(#glowW)"/>

      <g filter="url(#shadowW)">
        <rect x="106" y="36" width="228" height="560" rx="44" fill="url(#edgeW)"/>
        <rect x="110" y="40" width="220" height="552" rx="40" fill="#241C38"/>
        <rect x="120" y="50" width="200" height="532" rx="32" fill="#FBF7F9"/>
      </g>
      <rect x="195" y="60" width="50" height="7" rx="3.5" fill="#241C38" opacity=".18"/>

      <g class="flame-breathe">
        <circle cx="220" cy="126" r="42" fill="url(#haloW)"/>
        <g transform="translate(190,96)">
          <path d="M30,9.6 C34.2,19.2 40.8,24.6 40.8,33 C40.8,41.4 36,46.2 30,46.2 C24,46.2 19.2,41.4 19.2,33 C19.2,24.6 25.8,19.2 30,9.6 Z" fill="url(#fgW)"/>
          <path d="M30,22.8 C32.4,28.8 36,31.8 36,37.2 C36,42 33.6,45 30,45 C26.4,45 24,42 24,37.2 C24,31.8 27.6,28.8 30,22.8 Z" fill="#FFE7BE"/>
          <path fill="none" stroke="#8C6FBF" stroke-width="2.7" stroke-linecap="round" d="M13.2,34.8 C13.2,51.6 46.8,51.6 46.8,34.8"/>
        </g>
      </g>
      <rect x="160" y="196" width="120" height="8" rx="4" fill="#EEE6F8"/>
      <g clip-path="url(#loadClipW)">
        <rect class="load-run" x="160" y="196" width="52" height="8" rx="4" fill="#F6A94C"/>
      </g>

      <!-- skeleton placeholders -->
      <rect class="skel" x="132" y="228" width="84" height="80" rx="16" fill="#F1E9F7"/>
      <circle class="skel" cx="152" cy="252" r="9" fill="#E3D7EF"/>
      <rect class="skel" x="142" y="284" width="52" height="9" rx="4.5" fill="#E3D7EF"/>
      <rect class="skel d1" x="224" y="228" width="84" height="80" rx="16" fill="#F1E9F7"/>
      <circle class="skel d1" cx="244" cy="252" r="9" fill="#E3D7EF"/>
      <rect class="skel d1" x="234" y="284" width="52" height="9" rx="4.5" fill="#E3D7EF"/>

      <rect class="skel d2" x="132" y="320" width="176" height="76" rx="16" fill="#F1E9F7"/>
      <rect class="skel d2" x="146" y="336" width="122" height="9" rx="4.5" fill="#E3D7EF"/>
      <rect class="skel d2" x="146" y="354" width="88" height="9" rx="4.5" fill="#E3D7EF"/>
      <rect class="skel d2" x="146" y="372" width="140" height="9" rx="4.5" fill="#E3D7EF"/>

      <rect class="skel d3" x="132" y="408" width="84" height="84" rx="16" fill="#F1E9F7"/>
      <rect class="skel d3" x="224" y="408" width="84" height="84" rx="16" fill="#F1E9F7"/>
      <rect class="skel d1" x="132" y="504" width="176" height="60" rx="16" fill="#F1E9F7"/>

      <!-- floating chips: the promises that are already true -->
      <g class="chip-float">
        <rect x="284" y="104" width="150" height="36" rx="18" fill="#FFFFFF" filter="url(#shadowW)"/>
        <rect x="298" y="118" width="12" height="10" rx="2.5" fill="#3FAE8E"/>
        <path d="M300.5 118 v-2.5 a3.5 3.5 0 0 1 7 0 v2.5" stroke="#3FAE8E" stroke-width="2" fill="none"/>
        <text x="316" y="126" font-family="Manrope, Tajawal" font-size="8.5" font-weight="700" fill="#2B2438" data-i18n="phone.encrypted">Encrypted on this device</text>
      </g>
      <g class="chip-float b">
        <rect x="14" y="330" width="118" height="36" rx="18" fill="#FFFFFF" filter="url(#shadowW)"/>
        <circle cx="34" cy="348" r="7" fill="#F6A94C"/>
        <text x="48" y="352" font-family="Manrope, Tajawal" font-size="9.5" font-weight="700" fill="#2B2438" data-i18n="phone.soon">Coming soon</text>
      </g>

      <path d="M96 70 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill="#F6A94C" opacity=".8"/>
      <path d="M356 240 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" fill="#E17D9B" opacity=".7"/>
    </svg>`;
}

document.getElementById("wayDevice").innerHTML = loadingPhoneSVG();
document.getElementById("promiseDevice").innerHTML = loadingPhoneSVG();

/* ---------- motto cycling (language-aware) ---------- */
const MOTTO_LINES = {
    en: [
        { t: "Light you can keep.", hold: 3600 },
        { t: "Private by design.", hold: 2600 },
        { t: "Your whole self, one thread.", hold: 2600 },
        { t: "Nothing to subpoena.", hold: 2600 },
        { t: "Care that sees you.", hold: 2600 },
        { t: "Warmth for the hard nights.", hold: 3600 },
    ],
    ar: [
        { t: "ضوّ بيضلّ إلكِ.", hold: 3600 },
        { t: "الخصوصية من الأساس.", hold: 2600 },
        { t: "كل صحتكِ، بخيط واحد.", hold: 2600 },
        { t: "ولا جهة بتقدر تطلبها.", hold: 2600 },
        { t: "رعاية بتشبهكِ.", hold: 2600 },
        { t: "ونس لليالي الصعبة.", hold: 3600 },
    ],
};
(function () {
    const el = document.getElementById("mottoCycle");
    if (!el) return;
    const lines = () => MOTTO_LINES[document.documentElement.lang] || MOTTO_LINES.en;
    let i = 0;
    // when the language switches, restart from the first line in the new language
    document.addEventListener("luminara:lang", () => { i = 0; el.textContent = lines()[0].t; });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    (function next() {
        setTimeout(() => {
            el.classList.add("out");
            setTimeout(() => {
                const L = lines();
                i = (i + 1) % L.length;
                el.textContent = L[i].t;
                el.classList.remove("out");
                next();
            }, 400);
        }, lines()[i].hold);
    })();
})();

/* ---------- presentation controller ---------- */
class Deck {
    constructor() {
        this.slides = [...document.querySelectorAll(".slide")];
        this.dotsEl = document.getElementById("dots");
        this.progress = document.getElementById("progress");
        this.current = 0;

        this.slides.forEach((s, i) => {
            const b = document.createElement("button");
            b.setAttribute("aria-label", "Go to slide " + (i + 1));
            b.addEventListener("click", () => this.go(i));
            this.dotsEl.appendChild(b);
        });
        this.dots = [...this.dotsEl.children];

        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add("in-view");
                    this.setCurrent(this.slides.indexOf(e.target));
                }
            });
        }, { threshold: 0.55 });
        this.slides.forEach(s => io.observe(s));

        document.addEventListener("keydown", e => {
            if (e.key === "Home") { e.preventDefault(); this.go(0); }
            if (e.key === "End") { e.preventDefault(); this.go(this.slides.length - 1); }
        });

        this.setCurrent(0);
    }
    setCurrent(i) {
        if (i < 0) return;
        this.current = i;
        this.dots.forEach((d, j) => d.classList.toggle("active", j === i));
        this.progress.style.width = ((i + 1) / this.slides.length * 100) + "%";
    }
    go(i) {
        i = Math.max(0, Math.min(this.slides.length - 1, i));
        this.setCurrent(i);
        this.slides[i].scrollIntoView({ behavior: "smooth" });
    }
}
new Deck();
