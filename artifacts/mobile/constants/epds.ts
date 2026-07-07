/**
 * Edinburgh Postnatal Depression Scale (EPDS).
 *
 * The EPDS is a validated 10-item self-report screen (Cox, Holden & Sagovsky,
 * 1987). Each item scores 0–3 for a 0–30 total. Items are worded in mixed
 * directions, so each option carries an explicit score rather than relying on
 * position. Item 10 asks about self-harm — any non-zero answer should prompt
 * immediate support regardless of the total.
 *
 * Common interpretive bands (guidance, not diagnosis):
 *   0–9   lower likelihood of depression
 *   10–12 possible depression — monitor, consider re-screening
 *   13+   probable depression — clinical follow-up recommended
 */

export interface EpdsOption {
  label: string;
  score: 0 | 1 | 2 | 3;
}

export interface EpdsItem {
  /** Reflective prompt ("In the past 7 days…"). */
  prompt: string;
  options: EpdsOption[];
  /** Marks the self-harm item (item 10). */
  selfHarm?: boolean;
}

export const EPDS_INTRO =
  "In the past 7 days — not just today — how have you been feeling? Choose the answer that comes closest.";

export const EPDS_ITEMS: EpdsItem[] = [
  {
    prompt: "I have been able to laugh and see the funny side of things",
    options: [
      { label: "As much as I always could", score: 0 },
      { label: "Not quite so much now", score: 1 },
      { label: "Definitely not so much now", score: 2 },
      { label: "Not at all", score: 3 },
    ],
  },
  {
    prompt: "I have looked forward with enjoyment to things",
    options: [
      { label: "As much as I ever did", score: 0 },
      { label: "Rather less than I used to", score: 1 },
      { label: "Definitely less than I used to", score: 2 },
      { label: "Hardly at all", score: 3 },
    ],
  },
  {
    prompt: "I have blamed myself unnecessarily when things went wrong",
    options: [
      { label: "Yes, most of the time", score: 3 },
      { label: "Yes, some of the time", score: 2 },
      { label: "Not very often", score: 1 },
      { label: "No, never", score: 0 },
    ],
  },
  {
    prompt: "I have been anxious or worried for no good reason",
    options: [
      { label: "No, not at all", score: 0 },
      { label: "Hardly ever", score: 1 },
      { label: "Yes, sometimes", score: 2 },
      { label: "Yes, very often", score: 3 },
    ],
  },
  {
    prompt: "I have felt scared or panicky for no very good reason",
    options: [
      { label: "Yes, quite a lot", score: 3 },
      { label: "Yes, sometimes", score: 2 },
      { label: "No, not much", score: 1 },
      { label: "No, not at all", score: 0 },
    ],
  },
  {
    prompt: "Things have been getting on top of me",
    options: [
      { label: "Yes, most of the time I haven't been coping at all", score: 3 },
      { label: "Yes, sometimes I haven't been coping as well as usual", score: 2 },
      { label: "No, most of the time I have coped quite well", score: 1 },
      { label: "No, I have been coping as well as ever", score: 0 },
    ],
  },
  {
    prompt: "I have been so unhappy that I have had difficulty sleeping",
    options: [
      { label: "Yes, most of the time", score: 3 },
      { label: "Yes, sometimes", score: 2 },
      { label: "Not very often", score: 1 },
      { label: "No, not at all", score: 0 },
    ],
  },
  {
    prompt: "I have felt sad or miserable",
    options: [
      { label: "Yes, most of the time", score: 3 },
      { label: "Yes, quite often", score: 2 },
      { label: "Not very often", score: 1 },
      { label: "No, not at all", score: 0 },
    ],
  },
  {
    prompt: "I have been so unhappy that I have been crying",
    options: [
      { label: "Yes, most of the time", score: 3 },
      { label: "Yes, quite often", score: 2 },
      { label: "Only occasionally", score: 1 },
      { label: "No, never", score: 0 },
    ],
  },
  {
    prompt: "The thought of harming myself has occurred to me",
    selfHarm: true,
    options: [
      { label: "Yes, quite often", score: 3 },
      { label: "Sometimes", score: 2 },
      { label: "Hardly ever", score: 1 },
      { label: "Never", score: 0 },
    ],
  },
];

export function interpretEpds(total: number): {
  band: "lower" | "possible" | "probable";
  label: string;
} {
  if (total >= 13) return { band: "probable", label: "Probable depression — follow-up recommended" };
  if (total >= 10) return { band: "possible", label: "Possible depression — worth monitoring" };
  return { band: "lower", label: "Lower likelihood of depression" };
}
