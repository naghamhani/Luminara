import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { showAlert } from "@/utils/dialog";

const KNOWLEDGE = [
  {
    emoji: "🧠",
    title: "Understanding Postpartum Changes",
    sub: "Navigating the complex emotional and physical landscape after birth requires patience and the right support.",
    time: "5 min read",
    tag: "Education",
    tagColor: "#5168B4",
    topics: ["Anxiety", "Baby Blues"],
    content: `After giving birth, your body and mind go through profound changes. Hormones like estrogen and progesterone drop sharply, which can trigger mood shifts, tearfulness, and anxiety.\n\n**What's normal:**\nMild "baby blues" lasting 1–2 weeks, feeling overwhelmed, difficulty sleeping, emotional sensitivity.\n\n**When to seek help:**\nIf low mood, numbness, or anxiety persists beyond 2 weeks — or feels severe at any point — please speak with your OB, midwife, or a mental health professional.\n\n**Remember:** Postpartum depression affects 1 in 5 new mothers. You are not alone, and with support, recovery is possible.\n\nThis app is here to help you track how you're feeling day by day. Small patterns matter — that's the power of daily check-ins.`,
  },
  {
    emoji: "👶",
    title: "The Baby Blues: What They Are and What's Normal",
    sub: "Many new mothers experience emotional swings in the first two weeks after birth.",
    time: "4 min read",
    tag: "Wellbeing",
    tagColor: "#3AAFA9",
    topics: ["Baby Blues", "Anxiety"],
    content: `Baby blues is a common, temporary condition that affects up to 80% of new mothers. It typically starts 2–3 days after delivery and resolves on its own within two weeks.\n\n**Signs of baby blues:**\n• Crying for no clear reason\n• Mood swings\n• Irritability\n• Trouble sleeping\n• Feeling overwhelmed\n\n**What helps:**\n• Accept help from others\n• Rest when the baby rests\n• Stay hydrated and nourished\n• Talk about your feelings\n• Gentle outdoor walks\n\n**Important distinction:**\nBaby blues vs. postpartum depression differs primarily in duration and severity. If symptoms persist beyond 2 weeks or feel unmanageable, please reach out to a healthcare provider. This is not weakness — it's wisdom.`,
  },
  {
    emoji: "🌙",
    title: "Sleep Strategies for New Moms",
    sub: "Evidence-based approaches to getting more rest even when your baby wakes frequently.",
    time: "6 min read",
    tag: "Sleep",
    tagColor: "#7C5CBF",
    topics: ["Sleep", "Self-Care"],
    content: `Sleep deprivation is one of the hardest parts of new motherhood — and it directly impacts your mood, resilience, and risk of PPD.\n\n**Evidence-based strategies:**\n\n🌙 **Sleep when the baby sleeps**\nEven 20-minute naps accumulate into meaningful rest.\n\n🤝 **Share night duties**\nIf you have a partner, alternate nighttime wake-ups so each of you gets a longer stretch.\n\n📵 **Limit screens before sleep**\nBlue light delays melatonin. Wind down with dim lighting and calm activity.\n\n🛁 **Establish a short wind-down routine**\nEven 10 minutes of a calming ritual signals your nervous system to prepare for sleep.\n\n☕ **Limit caffeine after noon**\nCaffeine has a half-life of 5–7 hours and can disrupt sleep quality even if you fall asleep.\n\n**Track it:**\nYour daily sleep check-in in Luminara helps us identify patterns. Consistent low sleep is an early signal worth attention.`,
  },
  {
    emoji: "💬",
    title: "Talking to Your Partner About PPD",
    sub: "How to communicate your needs and share the emotional load during the postpartum period.",
    time: "5 min read",
    tag: "Relationships",
    tagColor: "#F2A65A",
    topics: ["Family", "Stress"],
    content: `Postpartum depression doesn't just affect the mother — it affects the whole family. Communicating openly with your partner is one of the most powerful protective factors.\n\n**Starting the conversation:**\nChoose a calm moment (not during a conflict or feeding). Start with "I" statements: "I've been feeling…" rather than "You never…"\n\n**What partners can do:**\n• Take the baby for 1–2 hours so you can sleep\n• Handle a specific task (cooking, laundry, groceries)\n• Simply listen without offering solutions unless asked\n• Attend a doctor's appointment with you\n\n**What to say if you're struggling:**\n*"I'm not feeling like myself, and I need support. I'm not asking you to fix it — I just need you to know."*\n\n**Remember:** Asking for help is strength. No one should navigate the postpartum period alone.`,
  },
  {
    emoji: "🍽️",
    title: "Nutrition for Postpartum Recovery",
    sub: "Your body is healing. These foods support mood, energy, and milk production.",
    time: "4 min read",
    tag: "Health",
    tagColor: "#3DAD7A",
    topics: ["Recovery", "Self-Care", "Feeding"],
    content: `Your body has just done something extraordinary. Nutrition plays a direct role in hormone regulation, energy, mood stability, and if you're breastfeeding, milk quality.\n\n**Key nutrients for new moms:**\n\n🐟 **Omega-3 fatty acids** (salmon, sardines, walnuts)\nLinked to reduced PPD risk. Support brain health and mood regulation.\n\n🌿 **Iron** (lean red meat, spinach, lentils)\nPostpartum blood loss can deplete iron, causing fatigue and low mood.\n\n☀️ **Vitamin D** (sunlight, fortified foods, supplements)\nDeficiency is common and associated with depressive symptoms.\n\n🥚 **Protein** (eggs, chicken, legumes)\nStabilizes blood sugar and energy levels throughout the day.\n\n💧 **Hydration**\nAim for 8–10 glasses daily, especially if breastfeeding.\n\n**Simple tip:** Keep easy-to-grab snacks visible — nuts, fruit, boiled eggs. When you're running on low sleep, accessible nutrition matters more than perfection.`,
  },
  {
    emoji: "🧘",
    title: "Mindfulness for Postpartum Anxiety",
    sub: "Simple grounding techniques that take under 5 minutes and genuinely help calm the nervous system.",
    time: "4 min read",
    tag: "Mindfulness",
    tagColor: "#7C5CBF",
    topics: ["Anxiety", "Mindfulness", "Self-Care"],
    content: `You don't need meditation experience. These techniques work for anxious moments right now.\n\n**5-4-3-2-1 Grounding:**\nName 5 things you see → 4 you can touch → 3 you hear → 2 you smell → 1 you taste.\nThis anchors your nervous system in the present moment.\n\n**Box Breathing (4 counts each):**\nInhale for 4 → Hold for 4 → Exhale for 4 → Hold for 4.\nRepeat 4 times. Activates the parasympathetic nervous system.\n\n**Body Scan:**\nStart at your feet and slowly move awareness up through your body. Notice sensations without judgment.\n\n**One-minute reset:**\nPlace both hands on your heart. Feel it beating. Take 3 slow breaths. Remind yourself: *"I am doing enough. I am enough."*\n\nThese tools are not replacements for therapy when anxiety is severe. If anxiety is persistent or disrupting your daily function, please speak with a healthcare provider.`,
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

const TOPIC_DESCRIPTIONS: Record<string, string> = {
  "Baby Care": "Feeding schedules, sleep training, colic, and developmental milestones — all the basics for caring for your newborn.",
  Bonding: "Skin-to-skin contact, eye contact, and responsive caregiving build your bond. It's okay if it takes time — this is normal.",
  Stress: "New parenthood is inherently stressful. Identifying your stress triggers and building micro-recovery moments can make a meaningful difference.",
  Therapy: "Cognitive Behavioural Therapy (CBT) and Interpersonal Therapy (IPT) have strong evidence for PPD. Ask your GP for a referral.",
  Family: "Involving family members in your support network — and clearly communicating your needs — is one of the most effective protective factors.",
};

type Article = (typeof KNOWLEDGE)[0];

function ArticleModal({
  article,
  onClose,
}: {
  article: Article;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const paragraphs = article.content.split("\n\n");

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={[
            articleModalStyles.header,
            { paddingTop: insets.top + 16, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={articleModalStyles.closeBtn}>
            <Feather name="x" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={[articleModalStyles.tagPill, { backgroundColor: article.tagColor + "18" }]}>
            <Text style={[articleModalStyles.tagPillText, { color: article.tagColor }]}>
              {article.tag}
            </Text>
          </View>
          <Text style={[articleModalStyles.readTime, { color: colors.mutedForeground }]}>
            {article.time}
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={[
            articleModalStyles.scroll,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontSize: 28 }}>{article.emoji}</Text>
          <Text style={[articleModalStyles.title, { color: colors.foreground }]}>
            {article.title}
          </Text>
          {paragraphs.map((para, i) => {
            const isBold = para.startsWith("**") && para.includes(":**");
            const cleanPara = para.replace(/\*\*(.*?)\*\*/g, "$1");
            return (
              <Text
                key={i}
                style={[
                  articleModalStyles.body,
                  { color: isBold ? colors.foreground : colors.text },
                  isBold && { fontFamily: "Inter_600SemiBold", marginTop: 8 },
                ]}
              >
                {cleanPara}
              </Text>
            );
          })}
          <View
            style={[
              articleModalStyles.disclaimer,
              { backgroundColor: colors.lavender, borderRadius: 12 },
            ]}
          >
            <Text style={[articleModalStyles.disclaimerText, { color: colors.primary }]}>
              🔒 This content is for informational purposes only and does not replace professional medical advice.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const articleModalStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  tagPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  readTime: { fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: "auto" },
  scroll: { paddingHorizontal: 24, paddingTop: 24, gap: 14 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 30 },
  body: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24 },
  disclaimer: { padding: 14, marginTop: 8 },
  disclaimerText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});

export default function ResourcesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const filtered = KNOWLEDGE.filter((a) => {
    const matchesSearch =
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.tag.toLowerCase().includes(search.toLowerCase());
    const matchesTopic = !activeTopic || a.topics.includes(activeTopic);
    return matchesSearch && matchesTopic;
  });

  const callCrisisLine = () => {
    if (Platform.OS === "web") {
      showAlert("Call 988", "Please dial 988 on your phone for immediate mental health support.");
      return;
    }
    Linking.openURL("tel:988").catch(() =>
      showAlert("Call 988", "Please dial 988 for immediate mental health support.")
    );
  };

  const textCrisisLine = () => {
    if (Platform.OS === "web") {
      showAlert("Text a Counselor", "Please text HELLO to 741741 from your phone for free, 24/7 crisis support via text.");
      return;
    }
    Linking.openURL("sms:741741?body=HELLO").catch(() =>
      showAlert("Text a Counselor", "Text HELLO to 741741 for free, 24/7 crisis support via text.")
    );
  };

  const handleTopicPress = (label: string) => {
    if (TOPIC_DESCRIPTIONS[label]) {
      showAlert(label, TOPIC_DESCRIPTIONS[label], [
        {
          text: `Show ${label} articles`,
          onPress: () => setActiveTopic(label === activeTopic ? null : label),
        },
        { text: "Close", style: "cancel" },
      ]);
    } else {
      setActiveTopic(label === activeTopic ? null : label);
    }
  };

  return (
    <>
      {selectedArticle && (
        <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}
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
            onChangeText={(t) => { setSearch(t); setActiveTopic(null); }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* Companion chatbot + PPD risk check */}
        <Pressable
          onPress={() => router.push("/chat" as never)}
          style={[styles.featureCard, { backgroundColor: colors.primary }]}
        >
          <View style={[styles.featureIcon, { backgroundColor: "#ffffff33" }]}>
            <Feather name="message-circle" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>Talk to Luna</Text>
            <Text style={styles.featureSub}>
              A private, anonymous companion for how you&apos;re feeling — anytime.
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ffffffcc" />
        </Pressable>

        <Pressable
          onPress={() => router.push("/ppd-risk" as never)}
          style={[styles.featureCard, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
        >
          <View style={[styles.featureIcon, { backgroundColor: colors.primary + "1A" }]}>
            <Feather name="activity" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.featureTitle, { color: colors.foreground }]}>Postpartum risk check</Text>
            <Text style={[styles.featureSub, { color: colors.mutedForeground }]}>
              A research-informed mood screen (EPDS) with a personalized, non-diagnostic risk estimate.
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </Pressable>

        {/* Crisis Support */}
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
            onPress={textCrisisLine}
            style={[styles.textCounselorBtn, { borderColor: colors.riskHigh }]}
          >
            <Feather name="message-square" size={15} color={colors.riskHigh} />
            <Text style={[styles.textCounselorText, { color: colors.riskHigh }]}>
              Text a Counselor (741741)
            </Text>
          </Pressable>
          <Text style={[styles.urgentNumbers, { color: "#9A1010" }]}>
            Call 988 · Text HELLO to 741741{"\n"}Available 24/7, free and confidential.
          </Text>
        </View>

        {/* Find a Specialist */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Find a Specialist</Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                Connect with postpartum mental health specialists near you.
              </Text>
            </View>
            <Feather name="shield" size={24} color={colors.primary} />
          </View>
          <Pressable
            style={[styles.directoryBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() =>
              Linking.openURL("https://www.postpartum.net/get-help/find-a-psi-member/").catch(() =>
                showAlert("PSI Directory", "Visit postpartum.net/get-help to find certified specialists.")
              )
            }
          >
            <Feather name="external-link" size={14} color={colors.primary} />
            <Text style={[styles.directoryBtnText, { color: colors.primary }]}>
              Browse PSI Directory
            </Text>
          </Pressable>
          <Pressable
            style={[styles.directoryBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() =>
              Linking.openURL("https://www.psychologytoday.com/us/therapists/postpartum-depression").catch(() =>
                showAlert("Psychology Today", "Visit psychologytoday.com to search for therapists by location and specialty.")
              )
            }
          >
            <Feather name="external-link" size={14} color={colors.primary} />
            <Text style={[styles.directoryBtnText, { color: colors.primary }]}>
              Search Psychology Today
            </Text>
          </Pressable>
          <View style={[styles.psiBadge, { backgroundColor: colors.lavender }]}>
            <Feather name="check-circle" size={12} color={colors.primary} />
            <Text style={[styles.psiBadgeText, { color: colors.primary }]}>
              PSI directory · Telehealth options available
            </Text>
          </View>
        </View>

        {/* Knowledge Library */}
        <View style={{ gap: 12 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Knowledge Library
            </Text>
            {activeTopic ? (
              <Pressable onPress={() => setActiveTopic(null)}>
                <Text style={[styles.viewAll, { color: colors.riskHigh }]}>Clear filter ✕</Text>
              </Pressable>
            ) : (
              <Text style={[styles.viewAll, { color: colors.mutedForeground }]}>
                {KNOWLEDGE.length} articles
              </Text>
            )}
          </View>
          {filtered.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <Text style={{ fontSize: 32 }}>🔍</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No articles match "{activeTopic ?? search}"
              </Text>
              <Pressable onPress={() => { setSearch(""); setActiveTopic(null); }}>
                <Text style={[styles.viewAll, { color: colors.primary }]}>Clear filter</Text>
              </Pressable>
            </View>
          ) : (
            filtered.map((article, i) => (
              <Pressable
                key={i}
                style={[styles.articleCard, { backgroundColor: colors.card }]}
                onPress={() => setSelectedArticle(article)}
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
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ alignSelf: "center" }} />
              </Pressable>
            ))
          )}
        </View>

        {/* Explore Topics */}
        <View style={{ gap: 12 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Explore Topics</Text>
          <View style={styles.topicsGrid}>
            {TOPICS.map((topic, i) => {
              const active = activeTopic === topic.label;
              return (
                <Pressable
                  key={i}
                  style={[
                    styles.topicChip,
                    {
                      backgroundColor: active ? colors.primary + "18" : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleTopicPress(topic.label)}
                >
                  <Text style={{ fontSize: 20 }}>{topic.emoji}</Text>
                  <Text
                    style={[
                      styles.topicLabel,
                      { color: active ? colors.primary : colors.text },
                    ]}
                  >
                    {topic.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {activeTopic && (
            <View style={[styles.topicBanner, { backgroundColor: colors.lavender }]}>
              <Text style={[styles.topicBannerText, { color: colors.primary }]}>
                Showing articles tagged "{activeTopic}"
              </Text>
            </View>
          )}
        </View>

        {/* Weekly Circle */}
        <View style={[styles.weeklyCard, { backgroundColor: colors.primary }]}>
          <View style={styles.weeklyHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.weeklyTitle}>Weekly Circle</Text>
              <Text style={styles.weeklySub}>
                Expert insights and community stories, delivered to your inbox. Coming soon.
              </Text>
            </View>
            <Text style={{ fontSize: 28 }}>💌</Text>
          </View>
          <View style={[styles.comingSoonBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Feather name="clock" size={14} color="#fff" />
            <Text style={styles.comingSoonText}>Not available yet</Text>
          </View>
        </View>
      </ScrollView>
    </>
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
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  urgentCard: { borderRadius: 20, padding: 18, gap: 10 },
  urgentHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  urgentDot: { width: 10, height: 10, borderRadius: 5 },
  urgentTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  urgentDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  urgentNumbers: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17, textAlign: "center" },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  featureSub: { color: "#ffffffdd", fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular" },
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
    flexDirection: "row",
    gap: 8,
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
    alignItems: "flex-start",
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
  emptyState: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  topicsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  topicChip: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  topicLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  topicBanner: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topicBannerText: { fontSize: 13, fontFamily: "Inter_500Medium" },
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
  },
  comingSoonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  comingSoonText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" },
});
