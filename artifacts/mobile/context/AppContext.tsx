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

const SEED_CHECKINS: CheckIn[] = [
  makeEntry("2026-05-10", 4, 6.5, 2, 4, 5, 4, "Laila smiled at me today 🌸"),
  makeEntry("2026-05-09", 3, 5.0, 3, 3, 4, 3, "Difficult night, woke up 3 times"),
  makeEntry("2026-05-08", 4, 7.0, 2, 4, 5, 5),
  makeEntry("2026-05-07", 3, 6.0, 3, 4, 4, 4),
  makeEntry("2026-05-06", 4, 6.5, 2, 4, 5, 4),
  makeEntry("2026-05-05", 5, 7.5, 1, 5, 5, 5, "Best day in weeks"),
  makeEntry("2026-05-04", 3, 5.0, 4, 3, 4, 3),
  makeEntry("2026-05-03", 4, 6.5, 2, 4, 5, 4),
  makeEntry("2026-05-02", 3, 5.5, 3, 3, 4, 3),
  makeEntry("2026-05-01", 4, 7.0, 2, 5, 5, 4, "Feeling more like myself again"),
  makeEntry("2026-04-30", 2, 4.0, 4, 3, 4, 2),
  makeEntry("2026-04-29", 3, 5.5, 3, 4, 4, 3),
  makeEntry("2026-04-28", 4, 6.0, 2, 4, 5, 4),
  makeEntry("2026-04-27", 3, 5.0, 3, 3, 4, 3),
  makeEntry("2026-04-26", 4, 6.5, 2, 4, 4, 4),
  makeEntry("2026-04-25", 2, 4.5, 4, 2, 3, 2, "Hard day. Cried a lot."),
  makeEntry("2026-04-24", 3, 5.0, 3, 3, 4, 3),
  makeEntry("2026-04-23", 4, 6.0, 2, 4, 5, 4),
  makeEntry("2026-04-22", 3, 5.5, 3, 3, 4, 3),
  makeEntry("2026-04-21", 2, 4.0, 4, 3, 3, 2),
  makeEntry("2026-04-20", 3, 5.5, 3, 4, 4, 3),
  makeEntry("2026-04-19", 4, 6.0, 2, 4, 5, 4),
  makeEntry("2026-04-18", 3, 5.0, 3, 3, 4, 3, "Support group was helpful today"),
  makeEntry("2026-04-17", 2, 4.5, 4, 2, 3, 2),
  makeEntry("2026-04-16", 3, 5.5, 3, 3, 4, 3),
  makeEntry("2026-04-15", 4, 6.5, 2, 4, 4, 4),
  makeEntry("2026-04-14", 3, 5.0, 3, 3, 4, 3),
  makeEntry("2026-04-13", 2, 4.0, 4, 2, 3, 2),
  makeEntry("2026-04-12", 3, 5.5, 3, 3, 4, 3),
  makeEntry("2026-04-11", 4, 6.0, 2, 4, 5, 3),
];

const AppContext = createContext<AppContextType | null>(null);

const PROFILE_KEY = "@bloom_profile";
const CHECKINS_KEY = "@bloom_checkins";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
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
          setCheckIns(SEED_CHECKINS);
          await AsyncStorage.setItem(CHECKINS_KEY, JSON.stringify(SEED_CHECKINS));
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
