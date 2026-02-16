import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow, getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";
import { useAppSettings } from "../hooks";
import { usePomodoroOptional } from "../contexts/PomodoroContext";
import PomodoroNextModal from "./modals/PomodoroNextModal";

/** Check if a window with the given label already exists. */
async function windowExists(label: string): Promise<boolean> {
  try {
    const all = await getAllWebviewWindows();
    return all.some((w) => w.label === label);
  } catch {
    return false;
  }
}

interface BreakNudgePayload {
  trigger_reason: string;
  session_minutes: number;
}

interface FocusNudgePayload {
  switching_count: number;
  window_minutes: number;
}

interface BreakWarningAction {
  action: "start" | "skip";
}

interface FocusAction {
  action: "start" | "dismiss";
}

/**
 * Central coordinator for break and focus nudges.
 * Listens for Tauri events; break/focus nudges are shown in the dashboard NotificationBar.
 * Handles break overlay spawning and focus session start.
 */
interface SpawnBreakOverlayParams {
  duration?: number;
  pomodoro?: boolean;
  sessionMinutes?: number;
  reason?: string;
}

const BreakManager = () => {
  const { settings } = useAppSettings();
  const pomodoro = usePomodoroOptional();
  const breakOverlayRef = useRef<WebviewWindow | null>(null);
  const lastBreakPayload = useRef<BreakNudgePayload | null>(null);
  const spawningOverlayRef = useRef(false);
  const [showPomodoroNextModal, setShowPomodoroNextModal] = useState(false);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      // Store break payload when received (NotificationBar also listens; we need it for overlay)
      const unBreakNudge = await listen<BreakNudgePayload>("break-nudge", (event) => {
        console.log("[BREAK_MANAGER] Received break-nudge:", event.payload);
        lastBreakPayload.current = event.payload;
      });
      unlisteners.push(unBreakNudge);

      // Focus nudges are handled entirely by NotificationBar; no action needed here
      const unFocusNudge = await listen<FocusNudgePayload>("focus-nudge", (event) => {
        console.log("[BREAK_MANAGER] Received focus-nudge:", event.payload);
      });
      unlisteners.push(unFocusNudge);

      // Break warning actions (from dashboard NotificationBar)
      const unBreakAction = await listen<BreakWarningAction>(
        "break-warning-action",
        async (event) => {
          console.log("[BREAK_MANAGER] Break warning action:", event.payload);
          if (event.payload.action === "start") {
            await invoke("focus_main_window").catch(() => {});
            spawnBreakOverlay({});
          }
          // Skip: cooldown is handled by Rust
        }
      );
      unlisteners.push(unBreakAction);

      // Focus actions (from dashboard NotificationBar)
      const unFocusAction = await listen<FocusAction>("focus-action", async (event) => {
        console.log("[BREAK_MANAGER] Focus action:", event.payload);
        if (event.payload.action === "start") {
          startFocusSession();
        }
      });
      unlisteners.push(unFocusAction);

      const unBreakCompleted = await listen("break-completed", async () => {
        console.log("[BREAK_MANAGER] Break completed");
        await invoke("end_break_session").catch(() => {});
        breakOverlayRef.current = null;
        if (pomodoro?.active && pomodoro.currentSession < pomodoro.totalSessions) {
          setShowPomodoroNextModal(true);
        } else if (pomodoro?.active) {
          pomodoro.endPomodoro();
        }
      });
      unlisteners.push(unBreakCompleted);

      const unBreakSkipped = await listen("break-skipped", async () => {
        console.log("[BREAK_MANAGER] Break skipped");
        await invoke("end_break_session").catch(() => {});
        breakOverlayRef.current = null;
        if (pomodoro?.active && pomodoro.currentSession < pomodoro.totalSessions) {
          setShowPomodoroNextModal(true);
        } else if (pomodoro?.active) {
          pomodoro.endPomodoro();
        }
      });
      unlisteners.push(unBreakSkipped);

      const unFocusCancelled = await listen("focus-session-cancelled", () => {
        console.log("[BREAK_MANAGER] Focus session cancelled");
        if (pomodoro?.active) {
          pomodoro.endPomodoro();
        }
      });
      unlisteners.push(unFocusCancelled);

      const unFocusComplete = await listen("focus-session-complete", () => {
        console.log("[BREAK_MANAGER] Focus session complete");
        if (pomodoro?.active) {
          pomodoro.recordFocusComplete();
          spawnBreakOverlay({
            duration: pomodoro.baseBreakMin * 60,
            pomodoro: true,
            sessionMinutes: pomodoro.nextFocusMin,
            reason: "pomodoro",
          });
        }
      });
      unlisteners.push(unFocusComplete);

      const unFocusSkip = await listen("focus-session-skip", () => {
        console.log("[BREAK_MANAGER] Focus session skipped (simulate complete)");
        if (pomodoro?.active) {
          pomodoro.recordFocusComplete();
          spawnBreakOverlay({
            duration: pomodoro.baseBreakMin * 60,
            pomodoro: true,
            sessionMinutes: pomodoro.nextFocusMin,
            reason: "pomodoro",
          });
        }
      });
      unlisteners.push(unFocusSkip);
    };

    setup();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [pomodoro]);

  const nukeWindowByLabel = async (label: string) => {
    try {
      await invoke("force_destroy_window", { label });
    } catch {
      // may fail if window already gone
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      const all = await getAllWebviewWindows();
      const matching = all.filter((w) => w.label === label);
      for (const win of matching) {
        try {
          await win.destroy();
        } catch {}
        try {
          await win.close();
        } catch {}
      }
    } catch {
      // ignore
    }
  };

  const spawnBreakOverlay = async (overrides: SpawnBreakOverlayParams = {}) => {
    // Synchronous guard to prevent double-spawn (e.g. from Strict Mode or countdown+button race)
    if (spawningOverlayRef.current || breakOverlayRef.current) return;
    spawningOverlayRef.current = true;

    try {
      await nukeWindowByLabel("break-overlay");
      if (await windowExists("break-overlay")) return;

      const payload = lastBreakPayload.current;
      const sessionInfo = await getSessionInfo();
      const sessionId = sessionInfo?.session_id || "";
      const sessionMinutes = overrides.sessionMinutes ?? payload?.session_minutes ?? 90;
      const reason = overrides.reason ?? payload?.trigger_reason ?? "long_session";
      const duration = overrides.duration ?? settings?.break_duration_seconds ?? 120;
      const pomodoroParam = overrides.pomodoro ? "&pomodoro=true" : "";

      let screenshotPath = "";
      try {
        screenshotPath = await invoke<string>("capture_screen");
      } catch (e) {
        console.warn("[BREAK_MANAGER] Screenshot capture failed, using gradient fallback:", e);
      }

      const url = `/break?reason=${reason}&minutes=${sessionMinutes}&sessionId=${sessionId}&duration=${duration}&screenshot=${encodeURIComponent(screenshotPath)}${pomodoroParam}`;
      const win = new WebviewWindow("break-overlay", {
        url,
        title: "Break",
        fullscreen: true,
        alwaysOnTop: true,
        decorations: false,
        resizable: false,
      });

      win.once("tauri://error", (e) => {
        console.error("[BREAK_MANAGER] Break overlay error:", e);
        breakOverlayRef.current = null;
        spawningOverlayRef.current = false;
      });
      win.once("tauri://destroyed", () => {
        breakOverlayRef.current = null;
        spawningOverlayRef.current = false;
      });

      breakOverlayRef.current = win;

      await invoke("start_break_session", { durationSecs: duration });
    } finally {
      spawningOverlayRef.current = false;
    }
  };

  const startFocusSession = async () => {
    try {
      await invoke("start_focus_session", { durationSecs: 25 * 60 });
      // Focus session shows in dashboard NotificationBar; no popup window
    } catch (error) {
      console.error("[BREAK_MANAGER] Failed to start focus session:", error);
    }
  };

  return (
    <>
      <PomodoroNextModal
        isOpen={showPomodoroNextModal}
        onOpenChange={setShowPomodoroNextModal}
        onContinue={(durationMin) => {
          setShowPomodoroNextModal(false);
          if (pomodoro) {
            pomodoro.setNextFocusMin(durationMin);
            pomodoro.startNextFocusSession();
            invoke("start_focus_session", {
              durationSecs: durationMin * 60,
            }).catch(console.error);
          }
        }}
        onEndPomodoro={() => {
          setShowPomodoroNextModal(false);
          pomodoro?.endPomodoro();
        }}
      />
    </>
  );
};

async function getSessionInfo(): Promise<{ elapsed_ms: number; session_id: string } | null> {
  try {
    return await invoke<{ elapsed_ms: number; session_id: string } | null>("get_session_info");
  } catch {
    return null;
  }
}

export default BreakManager;
