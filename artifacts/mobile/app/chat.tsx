import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { detectPhase } from "@/utils/wellnessAlgorithm";
import { daysBetween, REPRODUCTIVE_PHASE_LABELS, toDateString } from "@/types/health";
import { goBack } from "@/utils/navigation";
import { isBackendConfigured } from "@/utils/apiConfig";
import {
  BackendNotConfiguredError,
  sendChat,
  type ChatContext,
  type ChatTurn,
} from "@/utils/backendClient";

interface UiMessage extends ChatTurn {
  id: string;
  error?: boolean;
}

const GREETING =
  "Hi, I'm Luna 🌙 — a supportive companion here whenever you want to talk about how you're feeling, sleep, your baby, your body, or anything on your mind. I'm not a doctor, and everything here stays anonymous. What's going on today?";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `m${idCounter}`;
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, riskLevel, latestRiskScore } = useApp();
  const { cycleEntries, privacySettings } = useHealth();

  const [messages, setMessages] = useState<UiMessage[]>([
    { id: nextId(), role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const context = useMemo<ChatContext>(() => {
    const phase = detectPhase({ birthDate: profile?.birthDate ?? null, cycleEntries });
    const ctx: ChatContext = {
      wellnessLevel: riskLevel,
      wellnessScore: latestRiskScore,
    };

    // Only send a phase when it's a meaningful, current state — "unknown"
    // carries no signal and just clutters the prompt.
    if (phase !== "unknown") {
      ctx.phase = REPRODUCTIVE_PHASE_LABELS[phase];
    }

    // Weeks-postpartum is only coherent while the user is actually in the
    // postpartum window. detectPhase already leaves "postpartum" once flow
    // resumes (they're cycling again), so gating on it prevents the
    // contradictory "47 weeks postpartum AND follicular phase" context that
    // confused the model — the birthdate alone is not enough to claim it.
    if (phase === "postpartum" && profile?.birthDate) {
      const days = daysBetween(profile.birthDate, toDateString(new Date()));
      if (days >= 0) ctx.weeksPostpartum = Math.floor(days / 7);
    }

    return ctx;
  }, [profile?.birthDate, cycleEntries, riskLevel, latestRiskScore]);

  const configured = isBackendConfigured();

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMsg: UiMessage = { id: nextId(), role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setSending(true);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    try {
      const turns: ChatTurn[] = history
        .filter((m) => !m.error)
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await sendChat({
        messages: turns,
        context,
        participantPseudonym: privacySettings.research.pseudonym,
      });

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: res.reply },
      ]);
    } catch (err) {
      const message =
        err instanceof BackendNotConfiguredError
          ? "I'm not connected to a server right now. Once the Luminara API server is set up (EXPO_PUBLIC_API_URL), we can chat here."
          : (err as Error).message || "Something went wrong reaching the assistant.";
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: message, error: true },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => goBack("/(tabs)/resources")} hitSlop={10}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Luna</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Supportive companion · not a doctor
          </Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      {!configured && (
        <View style={[styles.banner, { backgroundColor: colors.warm + "22" }]}>
          <Text style={[styles.bannerText, { color: colors.foreground }]}>
            Chat runs on the Luminara server (local Ollama). Set EXPO_PUBLIC_API_URL to enable it.
          </Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} colors={colors} />
        ))}
        {sending && (
          <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: colors.card }]}>
            <ActivityIndicator color={colors.mutedForeground} />
          </View>
        )}
      </ScrollView>

      {/* Composer */}
      <View style={[styles.composer, { borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
          placeholder="Share what's on your mind…"
          placeholderTextColor={colors.mutedForeground}
          value={input}
          onChangeText={setInput}
          multiline
          editable={!sending}
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || sending}
          style={[
            styles.sendBtn,
            { backgroundColor: input.trim() && !sending ? colors.primary : colors.muted },
          ]}
        >
          <Feather name="arrow-up" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, colors }: { message: UiMessage; colors: ReturnType<typeof useColors> }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleRow, { justifyContent: isUser ? "flex-end" : "flex-start" }]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.primary }]
            : [styles.assistantBubble, { backgroundColor: message.error ? "#FDECEC" : colors.card }],
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            { color: isUser ? colors.primaryForeground : message.error ? "#9A1010" : colors.foreground },
          ]}
        >
          {renderWithLinks(message.content, isUser ? colors.primaryForeground : colors.primary)}
        </Text>
      </View>
    </View>
  );
}

/** Render 988 and phone numbers as tappable without a markdown dependency. */
function renderWithLinks(text: string, linkColor: string): React.ReactNode {
  const parts = text.split(/(988)/g);
  return parts.map((part, i) =>
    part === "988" ? (
      <Text
        key={i}
        style={{ color: linkColor, fontFamily: "Inter_600SemiBold" }}
        onPress={() => Linking.openURL("tel:988").catch(() => {})}
      >
        988
      </Text>
    ) : (
      <Text key={i}>{part}</Text>
    )
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerCenter: { alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  banner: { paddingHorizontal: 16, paddingVertical: 10 },
  bannerText: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium" },
  bubbleRow: { flexDirection: "row", marginBottom: 10 },
  bubble: { maxWidth: "82%", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  userBubble: { borderBottomRightRadius: 5 },
  assistantBubble: { borderBottomLeftRadius: 5 },
  bubbleText: { fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
