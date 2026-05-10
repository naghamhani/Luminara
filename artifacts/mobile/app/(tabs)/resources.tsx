import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
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
import { useColors } from "@/hooks/useColors";

const KNOWLEDGE = [
  {
    emoji: "🧠",
    title: "Understanding Postpartum Changes",
    sub: "Navigating the complex emotional and physical landscape after birth requires patience and the right...",
    time: "5 min read",
    tag: "Education",
    tagColor: "#5168B4",
  },
  {
    emoji: "👶",
    title: "The Baby Blues: What They Are and What's Normal",
    sub: "Many new mothers experience emotional swings in the first two weeks after birth...",
    time: "4 min read",
    tag: "Wellbeing",
    tagColor: "#3AAFA9",
  },
  {
    emoji: "🌙",
    title: "Sleep Strategies for New Moms",
    sub: "Evidence-based approaches to getting more rest even when your baby wakes frequently...",
    time: "6 min read",
    tag: "Sleep",
    tagColor: "#7C5CBF",
  },
  {
    emoji: "💬",
    title: "Talking to Your Partner About PPD",
    sub: "How to communicate your needs and share the emotional load during the postpartum period...",
    time: "5 min read",
    tag: "Relationships",
    tagColor: "#F2A65A",
  },
  {
    emoji: "🍽️",
    title: "Nutrition for Postpartum Recovery",
    sub: "Your body is healing. These foods support mood, energy, and milk production...",
    time: "4 min read",
    tag: "Health",
    tagColor: "#3DAD7A",
  },
];

const TOPICS = [
  { emoji: "😰", label: "Anxiety" },
  { emoji: "💧", label: "Baby Blues" },
  { emoji: "👶", label: "Baby Care" },
  { emoji: "😤", label: "Stress" },
  { emoji: "👩", label: "Self-Care" },
  { emoji: "🍼", label: "Feeding" },
  { emoji: "😴", label: "Sleep" },
  { emoji: "❤️", label: "Bonding" },
  { emoji: "💪", label: "Recovery" },
  { emoji: "👨‍👩‍👧", label: "Family" },
  { emoji: "🧘", label: "Mindfulness" },
  { emoji: "🩺", label: "Therapy" },
];

export default function ResourcesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const filtered = KNOWLEDGE.filter(
    (a) =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.tag.toLowerCase().includes(search.toLowerCase())
  );

  const callCrisisLine = () => {
    Linking.openURL("tel:988").catch(() =>
      Alert.alert("Call 988", "Please dial 988 for immediate mental health support.")
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>
        Resources & Support
      </Text>
      <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>
        Find the guidance and care you need, wherever you are in your journey.
      </Text>

      <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search articles, specialists, or guides..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      <View style={[styles.urgentCard, { backgroundColor: "#FDECEC" }]}>
        <View style={styles.urgentHeader}>
          <View style={[styles.urgentDot, { backgroundColor: colors.riskHigh }]} />
          <Text style={[styles.urgentTitle, { color: "#9A1010" }]}>Immediate Support</Text>
        </View>
        <Text style={[styles.urgentDesc, { color: "#C03030" }]}>
          If you are experiencing a mental health emergency or need someone to talk to, please reach out immediately.
        </Text>
        <Pressable
          onPress={callCrisisLine}
          style={[styles.crisisBtn, { backgroundColor: colors.riskHigh }]}
        >
          <Feather name="phone" size={15} color="#fff" />
          <Text style={styles.crisisBtnText}>Call 988 Crisis Line</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            Linking.openURL("sms:741741").catch(() =>
              Alert.alert("Text a Counselor", "Text HELLO to 741741 (Crisis Text Line).")
            )
          }
          style={[styles.textCounselorBtn, { borderColor: colors.riskHigh }]}
        >
          <Feather name="message-square" size={15} color={colors.riskHigh} />
          <Text style={[styles.textCounselorText, { color: colors.riskHigh }]}>
            Text a Counselor
          </Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Find a Specialist</Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              Connect with postpartum mental health specialists.
            </Text>
          </View>
          <Feather name="shield" size={24} color={colors.primary} />
        </View>
        <Pressable
          style={[styles.directoryBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={() =>
            Linking.openURL("https://www.postpartum.net/get-help/find-a-psi-member/").catch(() => {})
          }
        >
          <Text style={[styles.directoryBtnText, { color: colors.primary }]}>
            Browse Directory →
          </Text>
        </Pressable>
        <View style={[styles.psiBadge, { backgroundColor: colors.lavender }]}>
          <Feather name="check-circle" size={12} color={colors.primary} />
          <Text style={[styles.psiBadgeText, { color: colors.primary }]}>
            PSI Certified Providers
          </Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Knowledge Library
          </Text>
          <Text style={[styles.viewAll, { color: colors.primary }]}>View All</Text>
        </View>
        {filtered.map((article, i) => (
          <Pressable
            key={i}
            style={[styles.articleCard, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <View style={[styles.articleEmoji, { backgroundColor: colors.muted }]}>
              <Text style={{ fontSize: 22 }}>{article.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.tagRow}>
                <View style={[styles.tag, { backgroundColor: article.tagColor + "18" }]}>
                  <Text style={[styles.tagText, { color: article.tagColor }]}>
                    {article.tag}
                  </Text>
                </View>
                <Text style={[styles.articleTime, { color: colors.mutedForeground }]}>
                  {article.time}
                </Text>
              </View>
              <Text style={[styles.articleTitle, { color: colors.foreground }]} numberOfLines={2}>
                {article.title}
              </Text>
              <Text style={[styles.articleSub, { color: colors.mutedForeground }]} numberOfLines={2}>
                {article.sub}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Explore Topics</Text>
        <View style={styles.topicsGrid}>
          {TOPICS.map((topic, i) => (
            <Pressable
              key={i}
              style={[styles.topicChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {}}
            >
              <Text style={{ fontSize: 20 }}>{topic.emoji}</Text>
              <Text style={[styles.topicLabel, { color: colors.text }]}>{topic.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.weeklyCard, { backgroundColor: colors.primary }]}>
        <View style={styles.weeklyHeader}>
          <View>
            <Text style={styles.weeklyTitle}>Join our Weekly Circle</Text>
            <Text style={styles.weeklySub}>
              Expert insights and community stories delivered safely to your inbox every Sunday morning.
            </Text>
          </View>
          <Text style={{ fontSize: 28 }}>💌</Text>
        </View>
        {subscribed ? (
          <View style={[styles.subscribedBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Feather name="check" size={14} color="#fff" />
            <Text style={styles.subscribedText}>You're subscribed!</Text>
          </View>
        ) : (
          <View style={styles.emailRow}>
            <TextInput
              style={[styles.emailInput, { backgroundColor: "rgba(255,255,255,0.15)" }]}
              placeholder="your@email.com"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderText="rgba(255,255,255,0.5)"
            />
            <Pressable
              style={[styles.subscribeBtn, { backgroundColor: "rgba(255,255,255,0.25)" }]}
              onPress={() => {
                if (email.includes("@")) setSubscribed(true);
              }}
            >
              <Text style={styles.subscribeBtnText}>Subscribe</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 20 },
  pageTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  pageSub: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: -12 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  urgentCard: { borderRadius: 20, padding: 18, gap: 12 },
  urgentHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  urgentDot: { width: 10, height: 10, borderRadius: 5 },
  urgentTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  urgentDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  crisisBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  crisisBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  textCounselorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  textCounselorText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 20, padding: 18, gap: 12 },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, maxWidth: 220 },
  directoryBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  directoryBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  psiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  psiBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  viewAll: { fontSize: 13, fontFamily: "Inter_500Medium" },
  articleCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    padding: 14,
  },
  articleEmoji: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  articleTime: { fontSize: 10, fontFamily: "Inter_400Regular" },
  articleTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  articleSub: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  topicsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  topicChip: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  topicLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  weeklyCard: { borderRadius: 20, padding: 20, gap: 16 },
  weeklyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  weeklyTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 6 },
  weeklySub: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    maxWidth: 240,
  },
  emailRow: { flexDirection: "row", gap: 8 },
  emailInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  subscribeBtn: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  subscribedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  subscribedText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" },
});
