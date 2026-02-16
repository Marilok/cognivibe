import { useState, useEffect, useCallback } from "react";
import { Button } from "@heroui/react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSearch } from "@tanstack/react-router";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import SessionSurvey, { QuestionnaireScores } from "../SessionSurvey";
import { endSessionWithSurvey } from "../../utils/sessionsApi";

const BreakPage = () => {
  const search = useSearch({ strict: false }) as {
    reason?: string;
    minutes?: string;
    sessionId?: string;
    duration?: string;
    screenshot?: string;
    pomodoro?: string;
  };
  const reason = search.reason || "long_session";
  const minutes = parseInt(search.minutes || "90", 10);
  const sessionId = search.sessionId || null;
  const duration = parseInt(search.duration || "120", 10);
  const screenshotPath = search.screenshot || "";
  const isPomodoro = search.pomodoro === "true";

  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [timerDone, setTimerDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  // Convert screenshot file path to asset URL
  useEffect(() => {
    if (screenshotPath) {
      try {
        const assetUrl = convertFileSrc(screenshotPath);
        setScreenshotUrl(assetUrl);
      } catch {
        setScreenshotUrl(null);
      }
    }
  }, [screenshotPath]);

  // Update current time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Break countdown timer
  useEffect(() => {
    if (timerDone) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerDone]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleAddTime = () => {
    invoke("extend_break_session", { extraSecs: 60 }).catch(() => {});
  };

  // Listen for break-extended (from tray or overlay) — single source of truth
  useEffect(() => {
    const unlisten = listen<{ extra_secs: number }>("break-extended", (event) => {
      const extra = event.payload?.extra_secs ?? 60;
      setSecondsLeft((prev) => prev + extra);
      setTimerDone(false);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleSurveySubmit = async (scores: QuestionnaireScores) => {
    if (!sessionId || sessionId.trim() === "") {
      console.error("[BREAK] No sessionId provided, cannot end session");
      // Still close the window even if we can't end the session
      await emit("break-completed", {});
      try {
        await getCurrentWindow().close();
      } catch {}
      return;
    }
    
    setIsSubmitting(true);
    try {
      console.log("[BREAK] Ending session with survey:", { sessionId, scores });
      await endSessionWithSurvey(sessionId, scores, isPomodoro);
      console.log("[BREAK] Session ended successfully");
      await emit("break-completed", {});
      await getCurrentWindow().close();
    } catch (error) {
      console.error("[BREAK] Failed to end session with survey:", error);
      // Still close the window even if ending failed
      await emit("break-completed", {});
      try {
        await getCurrentWindow().close();
      } catch {}
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = useCallback(async () => {
    if (sessionId && sessionId.trim() !== "") {
      try {
        console.log("[BREAK] Ending session on skip:", { sessionId });
        await endSessionWithSurvey(sessionId, undefined, isPomodoro);
        console.log("[BREAK] Session ended successfully on skip");
      } catch (error) {
        console.error("[BREAK] Failed to end session on skip:", error);
        // Continue to close window even if ending failed
      }
    } else {
      console.warn("[BREAK] No sessionId provided, skipping session end");
    }

    await emit("break-skipped", {});
    try {
      await getCurrentWindow().close();
    } catch {}
  }, [sessionId, isPomodoro]);

  // Listen for tray "Skip break" — close gracefully instead of force_destroy
  useEffect(() => {
    const unlisten = listen("tray-skip-break", () => {
      handleSkip();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleSkip]);

  const heading =
    reason === "high_cognitive_load" ? "Give your mind a reset" : "Time to recharge";

  const subtitle = timerDone
    ? "Break complete — submit your assessment to continue"
    : "Step away from the screen for a moment";

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {/* Layer 1: Screenshot background */}
      {screenshotUrl && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${screenshotUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      {/* Layer 2: Blur overlay (glassmorphism) */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: "blur(16px) saturate(0.7) brightness(0.35)",
          WebkitBackdropFilter: "blur(16px) saturate(0.7) brightness(0.35)",
          backgroundColor: screenshotUrl
            ? "rgba(25, 20, 28, 0.45)"
            : "rgba(25, 20, 28, 1)",
        }}
      />

      {/* Layer 3: Purple (bottom-left) to pink (top-right) gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top right, rgba(160, 124, 239, 0.3) 0%, rgba(200, 118, 197, 0.15) 40%, rgba(255, 112, 155, 0.2) 100%)",
        }}
      />

      {/* Layer 4: Content */}
      <div className="relative z-10 h-full w-full flex flex-col items-center justify-center overflow-auto">
        {/* Current time */}
        <p className="text-white/50 text-sm mb-8">{currentTime}</p>

        {/* Heading */}
        <h1 className="text-white text-4xl font-bold mb-2">{heading}</h1>
        <p className="text-white/60 text-base mb-8">{subtitle}</p>

        {/* Timer */}
        <p
          className="text-5xl font-light mb-8"
          style={{
            color: timerDone ? "rgba(255, 255, 255, 0.6)" : "white",
          }}
        >
          {formatTime(secondsLeft)}
        </p>

        {/* Timer controls */}
        <div className="flex items-center gap-3 mb-10">
          <Button
            size="sm"
            variant="bordered"
            className="text-white/70 border-white/20"
            onPress={handleAddTime}
          >
            + 1 min
          </Button>
          <Button
            size="sm"
            variant="bordered"
            className="text-white/70 border-white/20"
            onPress={handleSkip}
            isDisabled={isSubmitting}
          >
            Skip
          </Button>
        </div>

        {/* Survey section */}
        <div
          className="w-full max-w-md px-6 py-5 rounded-2xl border border-white/10"
          style={{
            background: "rgba(34, 29, 40, 0.3)",
            backdropFilter: "blur(24px) saturate(1.2)",
            WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          }}
        >
          <SessionSurvey
            sessionMinutes={minutes}
            onSubmit={handleSurveySubmit}
            isSubmitting={isSubmitting}
            compact
          />
        </div>
      </div>
    </div>
  );
};

export default BreakPage;
