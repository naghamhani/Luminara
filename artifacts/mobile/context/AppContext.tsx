import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface CheckIn {
  id: string;
  date: string;
  mood: number;
  sleep: number;
  anxiety: number;
  appetite: number;
  bonding: number;
  support: number;
  notes: string;
  riskScore: number;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  babyName: string;
  birthDate: string;
  setupComplete: boolean;
}

interface AppContextType {
  profile: UserProfile | null;
  checkIns: CheckIn[];
  isLoading: boolean;
  saveProfile: (profile: UserProfile) => Promise<void>;
  addCheckIn: (data: Omit<CheckIn, "id" | "riskScore" | "createdAt">) => Promise<void>;
  hasCheckedInToday: boolean;
  todayCheckIn: CheckIn | null;
  latestRiskScore: number;
  weeklyRiskTrend: { date: string; score: number }[];
  averageRiskScore: number;
  riskLevel: "low" | "moderate" | "high";
}

export function calculateRiskScore(data: {
  mood: number;
  sleep: number;
  anxiety: number;
  appetite: number;
  bonding: number;
  support: number;
}): number {
  const moodFactor = (5 - data.mood) / 4;
  const anxietyFactor = (data.anxiety - 1) / 4;
  const sleepHours = Math.max(0, Math.min(data.sleep, 12));
  const sleepFactor = sleepHours < 6 ? Math.max(0, (6 - sleepHours) / 6) : 0;
  const appetiteFactor = (5 - data.appetite) / 4;
  const bondingFactor = (5 - data.bonding) / 4;
  const supportFactor = (5 - data.support) / 4;

  const score =
    moodFactor * 0.27 +
    anxietyFactor * 0.25 +
    sleepFactor * 0.15 +
    appetiteFactor * 0.1 +
    bondingFactor * 0.13 +
    supportFactor * 0.1;

  return Math.round(Math.max(0, Math.min(100, score * 100)));
}

export function getRiskLevel(score: number): "low" | "moderate" | "high" {
  if (score <= 35) return "low";
  if (score <= 65) return "moderate";
  return "high";
}

export function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function makeEntry(
  date: string,
  mood: number,
  sleep: number,
  anxiety: number,
  appetite: number,
  bonding: number,
  support: number,
  notes = ""
): CheckIn {
  const riskScore = calculateRiskScore({ mood, sleep, anxiety, appetite, bonding, support });
  return {
    id: date + "_seed",
    date,
    mood,
    sleep,
    anxiety,
    appetite,
    bonding,
    support,
    notes,
    riskScore,
    createdAt: date + "T09:00:00.000Z",
  };
}

const SEED_PROFILE: UserProfile = {
  name: "Nagham",
  babyName: "Laila",
  birthDate: "2025-08-06",
  setupComplete: true,
};

function buildSeedCheckIns(): CheckIn[] {
  return [
    makeEntry(daysAgo(1),  4, 6.5, 2, 4, 5, 4, "Laila smiled at me today 🌸"),
    makeEntry(daysAgo(2),  3, 5.0, 3, 3, 4, 3, "Difficult night, woke up 3 times"),
    makeEntry(daysAgo(3),  4, 7.0, 2, 4, 5, 5),
    makeEntry(daysAgo(4),  3, 6.0, 3, 4, 4, 4),
    makeEntry(daysAgo(5),  4, 6.5, 2, 4, 5, 4),
    makeEntry(daysAgo(6),  5, 7.5, 1, 5, 5, 5, "Best day in weeks"),
    makeEntry(daysAgo(7),  3, 5.0, 4, 3, 4, 3),
    makeEntry(daysAgo(8),  4, 6.5, 2, 4, 5, 4),
    makeEntry(daysAgo(9),  3, 5.5, 3, 3, 4, 3),
    makeEntry(daysAgo(10), 4, 7.0, 2, 5, 5, 4, "Feeling more like myself again"),
    makeEntry(daysAgo(11), 2, 4.0, 4, 3, 4, 2),
    makeEntry(daysAgo(12), 3, 5.5, 3, 4, 4, 3),
    makeEntry(daysAgo(13), 4, 6.0, 2, 4, 5, 4),
    makeEntry(daysAgo(14), 3, 5.0, 3, 3, 4, 3),
    makeEntry(daysAgo(15), 4, 6.5, 2, 4, 4, 4),
    makeEntry(daysAgo(16), 2, 4.5, 4, 2, 3, 2, "Hard day. Cried a lot."),
    makeEntry(daysAgo(17), 3, 5.0, 3, 3, 4, 3),
    makeEntry(daysAgo(18), 4, 6.0, 2, 4, 5, 4),
    makeEntry(daysAgo(19), 3, 5.5, 3, 3, 4, 3),
    makeEntry(daysAgo(20), 2, 4.0, 4, 3, 3, 2),
    makeEntry(daysAgo(21), 3, 5.5, 3, 4, 4, 3),
    makeEntry(daysAgo(22), 4, 6.0, 2, 4, 5, 4),
    makeEntry(daysAgo(23), 3, 5.0, 3, 3, 4, 3, "Support group was helpful today"),
    makeEntry(daysAgo(24), 2, 4.5, 4, 2, 3, 2),
    makeEntry(daysAgo(25), 3, 5.5, 3, 3, 4, 3),
    makeEntry(daysAgo(26), 4, 6.5, 2, 4, 4, 4),
    makeEntry(daysAgo(27), 3, 5.0, 3, 3, 4, 3),
    makeEntry(daysAgo(28), 2, 4.0, 4, 2, 3, 2),
    makeEntry(daysAgo(29), 3, 5.5, 3, 3, 4, 3),
    makeEntry(daysAgo(30), 4, 6.0, 2, 4, 5, 3),
  ];
}

const AppContext = createContext<AppContextType | null>(null);

const PROFILE_KEY = "@bloom_profile";
const CHECKINS_KEY = "@bloom_checkins";
const SEED_VERSION_KEY = "@bloom_seed_version";
const SEED_VERSION = "v3"; // bump this to force a fresh re-seed

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const seedVersion = await AsyncStorage.getItem(SEED_VERSION_KEY);
        const needsReseed = seedVersion !== SEED_VERSION;

        if (needsReseed) {
          // Clear old data and re-seed with fresh relative dates
          const fresh = buildSeedCheckIns();
          await AsyncStorage.multiSet([
            [PROFILE_KEY, JSON.stringify(SEED_PROFILE)],
            [CHECKINS_KEY, JSON.stringify(fresh)],
            [SEED_VERSION_KEY, SEED_VERSION],
          ]);
          setProfile(SEED_PROFILE);
          setCheckIns(fresh);
          return;
        }

        const [profileData, checkInsData] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(CHECKINS_KEY),
        ]);

        if (profileData) {
          setProfile(JSON.parse(profileData));
        } else {
          setProfile(SEED_PROFILE);
          await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(SEED_PROFILE));
        }

        if (checkInsData) {
          setCheckIns(JSON.parse(checkInsData));
        } else {
          const fresh = buildSeedCheckIns();
          setCheckIns(fresh);
          await AsyncStorage.setItem(CHECKINS_KEY, JSON.stringify(fresh));
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const saveProfile = useCallback(async (p: UserProfile) => {
    setProfile(p);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  }, []);

  const addCheckIn = useCallback(
    async (data: Omit<CheckIn, "id" | "riskScore" | "createdAt">) => {
      const riskScore = calculateRiskScore(data);
      const newCheckIn: CheckIn = {
        ...data,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        riskScore,
        createdAt: new Date().toISOString(),
      };
      setCheckIns((prev) => {
        const filtered = prev.filter((c) => c.date !== data.date);
        const updated = [newCheckIn, ...filtered].sort((a, b) =>
          b.date.localeCompare(a.date)
        );
        AsyncStorage.setItem(CHECKINS_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const today = getTodayString();
  const todayCheckIn = checkIns.find((c) => c.date === today) ?? null;
  const hasCheckedInToday = !!todayCheckIn;

  const last7 = checkIns.slice(0, 7);
  const latestRiskScore = checkIns[0]?.riskScore ?? 0;
  const averageRiskScore =
    last7.length > 0
      ? Math.round(last7.reduce((acc, c) => acc + c.riskScore, 0) / last7.length)
      : 0;

  const weeklyRiskTrend = last7
    .map((c) => ({ date: c.date, score: c.riskScore }))
    .reverse();

  const riskLevel = getRiskLevel(averageRiskScore || latestRiskScore);

  return (
    <AppContext.Provider
      value={{
        profile,
        checkIns,
        isLoading,
        saveProfile,
        addCheckIn,
        hasCheckedInToday,
        todayCheckIn,
        latestRiskScore,
        weeklyRiskTrend,
        averageRiskScore,
        riskLevel,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
