import { Router, type IRouter } from "express";
import { z } from "zod";

import { logger } from "../lib/logger";
import { getDb } from "../lib/store";
import { chat, isReachable, OllamaError, type ChatMessage } from "../lib/ollama";
import {
  buildSystemPrompt,
  looksLikeCrisis,
  SAFETY_RESOURCES,
  type WellnessContext,
} from "../lib/prompts";

const router: IRouter = Router();

const MAX_HISTORY = 20;

const wellnessContextSchema = z
  .object({
    phase: z.string().max(40).optional(),
    wellnessScore: z.number().min(0).max(100).optional(),
    wellnessLevel: z.enum(["low", "moderate", "high"]).optional(),
    ppdTier: z.enum(["low", "moderate", "high"]).optional(),
    weeksPostpartum: z.number().min(0).max(200).optional(),
    focusAreas: z.array(z.string().max(40)).max(10).optional(),
  })
  .strict()
  .optional();

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const requestSchema = z.object({
  participantPseudonym: z.string().max(128).optional(),
  /** Prior turns (most recent last). The final one must be the new user turn. */
  messages: z.array(turnSchema).min(1).max(MAX_HISTORY),
  context: wellnessContextSchema,
  /** Persist the conversation to the anonymous chat store (requires DB). */
  store: z.boolean().optional(),
  conversationId: z.number().int().positive().optional(),
});

/**
 * POST /api/chat
 * A single conversational turn against the local Ollama model. Stateless by
 * default; pass `store: true` (with a DB provisioned) to persist the exchange.
 */
router.post("/chat", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const { messages, context, store, participantPseudonym } = parsed.data;
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  // Backstop crisis check: even before calling the model, if the newest user
  // message reads as a crisis, prepend an unmissable resource block.
  const crisis = lastUser ? looksLikeCrisis(lastUser.content) : false;

  const system = buildSystemPrompt(context as WellnessContext | undefined);
  const llmMessages: ChatMessage[] = [
    { role: "system", content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
  ];

  let reply: string;
  try {
    reply = await chat(llmMessages);
  } catch (err) {
    const reachable = err instanceof OllamaError ? await isReachable() : true;
    logger.error({ err }, "Chat completion failed");
    return res.status(502).json({
      error:
        err instanceof OllamaError
          ? reachable
            ? "The assistant had trouble responding. Please try again."
            : "The local assistant model isn't running right now. Please try again later."
          : "Unexpected error generating a reply.",
    });
  }

  if (crisis) {
    reply =
      `I'm really glad you told me, and I want to make sure you're safe. ${SAFETY_RESOURCES}\n\n` +
      reply;
  }

  // Best-effort persistence of the exchange.
  let conversationId = parsed.data.conversationId ?? null;
  if (store) {
    const dbmod = await getDb();
    if (dbmod && lastUser) {
      try {
        if (conversationId == null) {
          const [conv] = await dbmod.db
            .insert(dbmod.conversations)
            .values({
              participantPseudonym: participantPseudonym ?? null,
              title: lastUser.content.slice(0, 60),
            })
            .returning({ id: dbmod.conversations.id });
          conversationId = conv?.id ?? null;
        }
        if (conversationId != null) {
          await dbmod.db.insert(dbmod.messages).values([
            { conversationId, role: "user", content: lastUser.content },
            { conversationId, role: "assistant", content: reply },
          ]);
        }
      } catch (err) {
        logger.error({ err }, "Failed to persist chat");
      }
    }
  }

  return res.json({ reply, crisis, conversationId });
});

export default router;
