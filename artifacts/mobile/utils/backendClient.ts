/**
 * Typed client for the Luminara API server.
 *
 * Thin fetch wrappers — no generated code — so the app can talk to the backend
 * (PPD risk model, chatbot, anonymized research ingestion) without coupling to
 * the OpenAPI codegen pipeline. Every call is a no-op-friendly async that
 * throws BackendNotConfiguredError when EXPO_PUBLIC_API_URL is unset, so
 * screens can render a graceful "connect a server" state.
 */

import type { AnonymizedBundle } from "@/types/health";
import { API_BASE_URL, isBackendConfigured } from "@/utils/apiConfig";

export class BackendNotConfiguredError extends Error {
  constructor() {
    super("No backend is configured (EXPO_PUBLIC_API_URL is unset).");
    this.name = "BackendNotConfiguredError";
  }
}

export class BackendError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "BackendError";
    this.status = status;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!isBackendConfigured()) throw new BackendNotConfiguredError();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && (data.error as string)) || `Request failed (${res.status}).`;
    throw new BackendError(message, res.status);
  }
  return data as T;
}

async function get<T>(path: string): Promise<T> {
  if (!isBackendConfigured()) throw new BackendNotConfiguredError();
  const res = await fetch(`${API_BASE_URL}${path}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new BackendError(`Request failed (${res.status}).`, res.status);
  return data as T;
}

// ---------------------------------------------------------------------------
// PPD risk
// ---------------------------------------------------------------------------

export interface PpdFeatures {
  epdsScore?: number;
  epdsResponses?: number[];
  epdsIsPrenatal?: boolean;
  historyOfDepression?: boolean;
  historyOfAnxiety?: boolean;
  priorPostpartumDepression?: boolean;
  historyOfBipolar?: boolean;
  currentlyOnPsychiatricMedication?: boolean;
  ageYears?: number;
  firstPregnancy?: boolean;
  unintendedPregnancy?: boolean;
  lowSocialSupport?: boolean;
  financialStrain?: boolean;
  intimatePartnerViolence?: boolean;
  recentStressfulLifeEvent?: boolean;
  pregnancyComplications?: boolean;
  cesareanDelivery?: boolean;
  pretermBirth?: boolean;
  multiplePregnancy?: boolean;
  nicuAdmission?: boolean;
  infantHealthProblems?: boolean;
  breastfeedingDifficulty?: boolean;
  severeSleepDeprivation?: boolean;
}

export interface RiskContribution {
  key: string;
  label: string;
  share: number;
  logOdds: number;
}

export interface PpdRiskResult {
  modelVersion: string;
  probability: number;
  riskScore: number;
  tier: "low" | "moderate" | "high";
  baselineProbability: number;
  relativeRisk: number;
  topContributors: RiskContribution[];
  interpretation: string;
  disclaimer: string;
  epdsScore: number | null;
  selfHarmFlag: boolean;
  stored: boolean;
}

export function scorePpdRisk(args: {
  features: PpdFeatures;
  participantPseudonym?: string;
  store?: boolean;
}): Promise<PpdRiskResult> {
  return post<PpdRiskResult>("/api/ppd-risk", args);
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  phase?: string;
  wellnessScore?: number;
  wellnessLevel?: "low" | "moderate" | "high";
  ppdTier?: "low" | "moderate" | "high";
  weeksPostpartum?: number;
  focusAreas?: string[];
}

export interface ChatResponse {
  reply: string;
  crisis: boolean;
  conversationId: number | null;
}

export function sendChat(args: {
  messages: ChatTurn[];
  context?: ChatContext;
  participantPseudonym?: string;
  store?: boolean;
  conversationId?: number | null;
}): Promise<ChatResponse> {
  return post<ChatResponse>("/api/chat", {
    ...args,
    conversationId: args.conversationId ?? undefined,
  });
}

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

export interface ResearchStats {
  configured: boolean;
  participants: number;
  submissions: number;
  assessments: number;
}

export function submitResearchBundle(bundle: AnonymizedBundle): Promise<{
  ok: boolean;
  submissionId?: number;
  receivedAt?: string;
}> {
  return post("/api/research/submissions", bundle);
}

export function getResearchStats(): Promise<ResearchStats> {
  return get<ResearchStats>("/api/research/stats");
}
