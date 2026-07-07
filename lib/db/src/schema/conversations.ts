import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Chatbot conversations.
 *
 * Conversations are keyed to an anonymous, client-generated pseudonym (the
 * same stable research pseudonym Luminara already mints on the device) rather
 * than to any identifiable account. The server therefore never learns who a
 * conversation belongs to — only that a given anonymous participant returned.
 */
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  /** Anonymous participant pseudonym (no PII). Nullable for guest chats. */
  participantPseudonym: text("participant_pseudonym"),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
