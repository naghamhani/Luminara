/**
 * Local LLM client — Ollama.
 * ============================================================================
 *
 * The chatbot is powered by a self-hosted Ollama server rather than a
 * third-party API. This is a deliberate choice for a health app built around
 * anonymity: conversation content never leaves infrastructure the operator
 * controls. Locally that's `http://localhost:11434`; in production point
 * OLLAMA_BASE_URL at the Ollama instance running alongside the API server.
 *
 * Env:
 *   OLLAMA_BASE_URL  (default http://localhost:11434)
 *   OLLAMA_MODEL     (default llama3.1)
 *   OLLAMA_TIMEOUT_MS (default 60000)
 *
 * Install locally:  `ollama pull llama3.1 && ollama serve`
 */

const BASE_URL = (process.env["OLLAMA_BASE_URL"] || "http://localhost:11434").replace(/\/+$/, "");
export const DEFAULT_MODEL = process.env["OLLAMA_MODEL"] || "llama3.1";
const TIMEOUT_MS = Number(process.env["OLLAMA_TIMEOUT_MS"] || 60000);

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class OllamaError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "OllamaError";
    this.status = status;
  }
}

/**
 * Non-streaming chat completion. Returns the assistant's reply text.
 */
export async function chat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: opts.model || DEFAULT_MODEL,
        messages,
        stream: false,
        options: { temperature: opts.temperature ?? 0.6 },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new OllamaError(
        `Ollama request failed (${res.status}): ${text.slice(0, 300)}`,
        res.status,
      );
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const content = data?.message?.content?.trim();
    if (!content) {
      throw new OllamaError("Ollama returned an empty response.");
    }
    return content;
  } catch (err) {
    if (err instanceof OllamaError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new OllamaError(`Ollama request timed out after ${TIMEOUT_MS}ms.`);
    }
    throw new OllamaError(
      `Could not reach Ollama at ${BASE_URL}. Is it running? (${(err as Error).message})`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Best-effort health probe used by the chat route to give a clear error. */
export async function isReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${BASE_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}
