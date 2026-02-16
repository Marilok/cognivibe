import { useState, useEffect, useCallback } from "react";
import { fetchSessions } from "../utils/sessionsApi";

export const STREAK_CACHE_KEY = "cognivibe_pomodoro_streak_cache";

export function clearPomodoroStreakCache(): void {
  try {
    localStorage.removeItem(STREAK_CACHE_KEY);
  } catch {
    // ignore
  }
}

interface StreakCache {
  streak: number;
  lastCheckedDate: string; // YYYY-MM-DD
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDayOfWeek(d: Date): number {
  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return d.getDay();
}

function isWeekday(d: Date): boolean {
  const dow = getDayOfWeek(d);
  return dow >= 1 && dow <= 5; // Mon-Fri
}

export function usePomodoroStreak(refreshTrigger?: unknown): number {
  const [streak, setStreak] = useState<number>(0);

  const computeStreak = useCallback(async (): Promise<number> => {
    try {
      const today = new Date();
      const todayStr = toLocalDateStr(today);

      // Check cache
      const cached = localStorage.getItem(STREAK_CACHE_KEY);
      if (cached) {
        try {
          const parsed: StreakCache = JSON.parse(cached);
          if (parsed.lastCheckedDate === todayStr) {
            return parsed.streak;
          }
        } catch {
          // Invalid cache, continue
        }
      }

      // Fetch sessions for last ~30 days
      const endDate = new Date(today);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 30);

      const startStr = toLocalDateStr(startDate);
      const endStr = toLocalDateStr(endDate);

      const result = await fetchSessions(startStr, endStr);
      if (!result.success || !result.data) return 0;

      const sessions = result.data as Array<{ timestamp_start: string; pomodoro?: boolean }>;
      const pomodoroByDate = new Set<string>();

      for (const s of sessions) {
        if (s.pomodoro) {
          const dateStr = s.timestamp_start.split("T")[0];
          if (dateStr) pomodoroByDate.add(dateStr);
        }
      }

      // Count consecutive weekdays going backwards from yesterday
      // If today has a pomodoro, include today
      let count = 0;
      let checkDate = new Date(today);

      // First, if today has pomodoro, we count from today
      if (pomodoroByDate.has(toLocalDateStr(checkDate)) && isWeekday(checkDate)) {
        count = 1;
        checkDate.setDate(checkDate.getDate() - 1);
      }

      // Then go backwards day by day
      while (isWeekday(checkDate)) {
        const dateStr = toLocalDateStr(checkDate);
        if (pomodoroByDate.has(dateStr)) {
          count++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Cache result
      localStorage.setItem(
        STREAK_CACHE_KEY,
        JSON.stringify({ streak: count, lastCheckedDate: todayStr })
      );

      return count;
    } catch (err) {
      console.error("[POMODORO_STREAK] Failed to compute streak:", err);
      return 0;
    }
  }, []);

  useEffect(() => {
    computeStreak().then(setStreak);
  }, [computeStreak, refreshTrigger]);

  return streak;
}
