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
        if (profileData) setProfile(JSON.parse(profileData));
        if (checkInsData) setCheckIns(JSON.parse(checkInsData));
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
