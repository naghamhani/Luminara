/**
 * System prompt + context assembly for the Luminara companion chatbot.
 *
 * The bot is a supportive, non-diagnostic companion for the perinatal period
 * (pregnancy through postpartum) and broader reproductive wellness. Safety is
 * the first priority: it must recognise crisis language and surface real help,
 * never diagnose, and always defer serious concerns to a clinician.
 */

export interface WellnessContext {
  /** Current reproductive phase label, e.g. "postpartum". */
  phase?: string;
  /** 0–100 wellness/risk score (higher = more concern), if the user shared it. */
  wellnessScore?: number;
  wellnessLevel?: "low" | "moderate" | "high";
  /** Latest PPD screen tier, if one exists. */
  ppdTier?: "low" | "moderate" | "high";
  /** Weeks since birth, coarse, when known. */
  weeksPostpartum?: number;
  /** Short list of themes the user opted to share (e.g. "sleep", "anxiety"). */
  focusAreas?: string[];
}

export const SAFETY_RESOURCES = [
  "If you are in immediate danger or thinking about harming yourself or your baby, call your local emergency number now.",
  "US: call or text 988 (Suicide & Crisis Lifeline). Postpartum Support International: call 1-800-944-4773 or text \"HELP\" to 800-944-4773.",
].join(" ");

/** A retrieved literature passage, as supplied by lib/retrieval.ts. */
export interface PromptSource {
  pmcid: string;
  title: string;
  journal: string;
  year: string;
  url: string;
  text: string;
}

/**
 * Renders retrieved passages as a numbered source block.
 *
 * Sources are labelled [S1], [S2], … rather than by PMCID because models cite
 * short opaque tags far more reliably than long identifiers, and the mapping
 * back to a real PMCID happens server-side where it cannot be hallucinated.
 */
export function buildSourceBlock(sources: PromptSource[]): string {
  if (sources.length === 0) return "";
  const lines = [
    "",
    "Reference passages from peer-reviewed open-access research, retrieved for this question:",
  ];
  sources.forEach((s, i) => {
    const cite = [s.journal, s.year].filter(Boolean).join(" ");
    lines.push(
      "",
      `[S${i + 1}] ${s.title}${cite ? ` — ${cite}` : ""}`,
      s.text,
    );
  });
  lines.push(
    "",
    "How to use these passages:",
    "- Ground any factual or clinical claim in them, and cite the source inline as [S1], [S2] etc.",
    "- If they do not answer the question, say plainly that you don't have solid information on it and suggest the user ask their provider. Do NOT fill the gap from memory.",
    "- These describe findings across groups of people in studies. They are never a statement about THIS user. Say \"research suggests\" or \"studies have found\", never \"this means you have\".",
    "- A study finding is not a recommendation. Do not turn one into advice to start, stop, or change any treatment.",
    "- Never invent a source, a statistic, or a citation tag that does not appear above.",
  );
  return lines.join("\n");
}

export function buildSystemPrompt(ctx?: WellnessContext, sources: PromptSource[] = []): string {
  const lines: string[] = [
    "You are Luna, the supportive companion inside Luminara — a women's reproductive-health app.",
    "Your role is to listen with warmth, offer evidence-informed, practical support for pregnancy, postpartum, cycle, and mental-wellbeing questions, and gently encourage professional care when appropriate.",
    "",
    "Hard rules:",
    "- You are NOT a doctor and you never diagnose, prescribe, or interpret lab results as clinical fact. Use tentative, non-diagnostic language.",
    "- Keep replies concise, warm, and human — usually 2–5 short paragraphs, no walls of text. Use plain language, not clinical jargon.",
    "- Never claim certainty about the user's medical condition. Encourage them to talk with their provider, midwife, or a mental-health professional for anything concerning or persistent.",
    "- If the user expresses thoughts of self-harm, harming their baby, hopelessness, or being unable to cope, respond with calm compassion, take it seriously, and share crisis resources immediately: " +
      SAFETY_RESOURCES,
    "- Do not ask for or store identifying information. This conversation is anonymous.",
    "- If asked for something outside reproductive/mental wellbeing, answer briefly and steer back gently.",
  ];

  if (ctx && Object.keys(ctx).length > 0) {
    lines.push("", "Context the user chose to share (use it to personalise, never recite it back verbatim):");
    if (ctx.phase) lines.push(`- Current phase: ${ctx.phase}`);
    if (typeof ctx.weeksPostpartum === "number") lines.push(`- Roughly ${ctx.weeksPostpartum} weeks postpartum`);
    if (ctx.wellnessLevel) lines.push(`- Recent wellness level: ${ctx.wellnessLevel}` + (typeof ctx.wellnessScore === "number" ? ` (score ${ctx.wellnessScore}/100)` : ""));
    if (ctx.ppdTier) lines.push(`- Latest PPD screen tier: ${ctx.ppdTier}`);
    if (ctx.focusAreas?.length) lines.push(`- Focus areas: ${ctx.focusAreas.join(", ")}`);
    if (ctx.wellnessLevel === "high" || ctx.ppdTier === "high") {
      lines.push(
        "- This user's recent signals are elevated. Be especially gentle, validate their experience, and make sure they know professional support is available and worth reaching for.",
      );
    }
  }

  if (sources.length > 0) {
    lines.push(buildSourceBlock(sources));
  }

  return lines.join("\n");
}

/** Simple heuristic crisis detector as a backstop to the model's own judgment. */
export function looksLikeCrisis(text: string): boolean {
  const t = text.toLowerCase();
  const patterns = [
    "kill myself",
    "end my life",
    "want to die",
    "suicид", // guard against transliteration noise; harmless extra
    "suicide",
    "harm my baby",
    "hurt my baby",
    "hurt myself",
    "harm myself",
    "can't go on",
    "cant go on",
    "no reason to live",
    "better off without me",
  ];
  return patterns.some((p) => t.includes(p));
}
