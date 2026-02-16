"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { clearPomodoroStreakCache } from "../hooks/usePomodoroStreak";

export interface PomodoroSessionRecord {
  focusStartedAt: string; // ISO timestamp
  focusEndedAt: string; // ISO timestamp
  durationMin: number;
}

export interface PomodoroState {
  active: boolean;
  currentSession: number;
  totalSessions: number;
  baseFocusMin: number;
  baseBreakMin: number;
  nextFocusMin: number; // May be adapted
  focusStartedAt: string | null; // ISO timestamp of current focus block
  sessionHistory: PomodoroSessionRecord[];
}

const initialState: PomodoroState = {
  active: false,
  currentSession: 0,
  totalSessions: 4,
  baseFocusMin: 25,
  baseBreakMin: 5,
  nextFocusMin: 25,
  focusStartedAt: null,
  sessionHistory: [],
};

interface PomodoroContextValue extends PomodoroState {
  startPomodoro: (params: {
    focusMin: number;
    breakMin: number;
    sessions: number;
  }) => void;
  startNextFocusSession: () => void;
  recordFocusComplete: () => void;
  endPomodoro: () => void;
  extendFocus: () => void;
  setNextFocusMin: (min: number) => void;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PomodoroState>(initialState);

  const startPomodoro = useCallback(
    (params: { focusMin: number; breakMin: number; sessions: number }) => {
      setState({
        active: true,
        currentSession: 1,
        totalSessions: params.sessions,
        baseFocusMin: params.focusMin,
        baseBreakMin: params.breakMin,
        nextFocusMin: params.focusMin,
        focusStartedAt: new Date().toISOString(),
        sessionHistory: [],
      });
    },
    []
  );

  const startNextFocusSession = useCallback(() => {
    setState((prev) => {
      if (!prev.active) return prev;
      return {
        ...prev,
        currentSession: prev.currentSession + 1,
        nextFocusMin: prev.nextFocusMin,
        focusStartedAt: new Date().toISOString(),
      };
    });
  }, []);

  const recordFocusComplete = useCallback(() => {
    setState((prev) => {
      if (!prev.active || !prev.focusStartedAt) return prev;
      const focusEndedAt = new Date().toISOString();
      const record: PomodoroSessionRecord = {
        focusStartedAt: prev.focusStartedAt,
        focusEndedAt,
        durationMin: prev.nextFocusMin,
      };
      return {
        ...prev,
        focusStartedAt: null,
        sessionHistory: [...prev.sessionHistory, record],
      };
    });
  }, []);

  const endPomodoro = useCallback(() => {
    setState(initialState);
    clearPomodoroStreakCache();
  }, []);

  const extendFocus = useCallback(() => {
    // Extend is handled by Tauri; we don't need to update state here
    // The focus timer runs in Rust. We just invoke the command.
  }, []);

  const setNextFocusMin = useCallback((min: number) => {
    setState((prev) => ({ ...prev, nextFocusMin: min }));
  }, []);

  const value = useMemo<PomodoroContextValue>(
    () => ({
      ...state,
      startPomodoro,
      startNextFocusSession,
      recordFocusComplete,
      endPomodoro,
      extendFocus,
      setNextFocusMin,
    }),
    [
      state,
      startPomodoro,
      startNextFocusSession,
      recordFocusComplete,
      endPomodoro,
      extendFocus,
      setNextFocusMin,
    ]
  );

  return (
    <PomodoroContext.Provider value={value}>
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoro(): PomodoroContextValue {
  const ctx = useContext(PomodoroContext);
  if (!ctx) {
    throw new Error("usePomodoro must be used within PomodoroProvider");
  }
  return ctx;
}

export function usePomodoroOptional(): PomodoroContextValue | null {
  return useContext(PomodoroContext);
}
