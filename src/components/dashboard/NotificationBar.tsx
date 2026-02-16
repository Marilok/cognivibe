"use client";

import { Card, CardBody, Button, useDisclosure } from "@heroui/react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAuth, useUserData, useExtremeZScoreAlert } from "../../hooks";
import { ZScoreSurveyModal } from "../modals";
import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { isPermissionGranted } from "@tauri-apps/plugin-notification";

interface BreakNudgePayload {
  trigger_reason: string;
  session_minutes: number;
}

interface FocusNudgePayload {
  switching_count: number;
  window_minutes: number;
}

interface NotificationBarProps {
  onStartClick?: () => void;
  onEmpty?: (isEmpty: boolean) => void;
}

const CARD_STYLE = {
  boxShadow: `
    0 0 12px rgba(160, 124, 239, 0.2),
    0 0 20px rgba(160, 124, 239, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.3)
  `,
};

const NotificationBar = ({ onStartClick, onEmpty }: NotificationBarProps) => {
  const { session } = useAuth();
  const { userData, loading, refetch } = useUserData(session?.user?.id);
  const { alert: extremeZScoreAlert, clearAlert } = useExtremeZScoreAlert();
  const {
    isOpen: isSurveyOpen,
    onOpen: onSurveyOpen,
    onOpenChange: onSurveyOpenChange,
  } = useDisclosure();

  // Focus session tracking
  const [focusRemaining, setFocusRemaining] = useState<number | null>(null);

  // Break nudge state (from break-nudge event)
  const [breakNudge, setBreakNudge] = useState<BreakNudgePayload | null>(null);
  const [breakCountdownSecs, setBreakCountdownSecs] = useState(120);
  const breakStartEmittedRef = useRef(false);

  // Focus nudge state (from focus-nudge event)
  const [focusNudge, setFocusNudge] = useState<FocusNudgePayload | null>(null);

  // Notification permission (for "enable notifications" nudge)
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const granted = await isPermissionGranted();
        setNotificationsEnabled(granted);
      } catch {
        setNotificationsEnabled(true);
      }
    };
    check();
    const id = setInterval(check, 60000);
    const onVisible = () => check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Listen for break-nudge and focus-nudge events
  useEffect(() => {
    let unBreak: (() => void) | undefined;
    let unFocus: (() => void) | undefined;

    const setup = async () => {
      unBreak = await listen<BreakNudgePayload>("break-nudge", (event) => {
        breakStartEmittedRef.current = false;
        setBreakNudge(event.payload);
        setBreakCountdownSecs(120);
      });
      unFocus = await listen<FocusNudgePayload>("focus-nudge", (event) => {
        setFocusNudge(event.payload);
      });
    };
    setup();

    return () => {
      unBreak?.();
      unFocus?.();
    };
  }, []);

  // Break countdown timer
  useEffect(() => {
    if (!breakNudge) return;

    const id = setInterval(() => {
      setBreakCountdownSecs((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          if (!breakStartEmittedRef.current) {
            breakStartEmittedRef.current = true;
            invoke("focus_main_window").catch(() => {});
            emit("break-warning-action", { action: "start" });
          }
          setBreakNudge(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [breakNudge]);

  // Focus session polling and events
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const pollFocus = async () => {
      try {
        const state = await invoke<{ remaining_secs: number; total_secs: number } | null>(
          "get_focus_session_state"
        );
        if (state && state.remaining_secs > 0) {
          setFocusRemaining(state.remaining_secs);
        } else {
          setFocusRemaining(null);
        }
      } catch {
        setFocusRemaining(null);
      }
    };

    pollFocus();
    interval = setInterval(pollFocus, 2000);

    const unlistenComplete = listen("focus-session-complete", () => setFocusRemaining(null));
    const unlistenCancelled = listen("focus-session-cancelled", () => setFocusRemaining(null));

    return () => {
      if (interval) clearInterval(interval);
      unlistenComplete.then((fn) => fn());
      unlistenCancelled.then((fn) => fn());
    };
  }, []);

  const handleCancelFocus = async () => {
    try {
      await invoke("stop_focus_session");
      await emit("focus-session-cancelled", {});
      setFocusRemaining(null);
    } catch {
      // ignore
    }
  };

  const handleSkipFocus = async () => {
    try {
      await invoke("stop_focus_session");
      setFocusRemaining(null);
      await emit("focus-session-skip", {});
    } catch {
      // ignore
    }
  };

  const handleExtendFocus = async () => {
    try {
      await invoke("extend_focus_session", { extra_secs: 5 * 60 });
    } catch {
      // ignore
    }
  };

  const handleBreakStartNow = useCallback(() => {
    if (!breakStartEmittedRef.current) {
      breakStartEmittedRef.current = true;
      invoke("dismiss_break_nudge").catch(() => {});
      invoke("focus_main_window").catch(() => {});
      emit("break-warning-action", { action: "start" });
    }
    setBreakNudge(null);
  }, []);

  const handleBreakSkip = useCallback(() => {
    invoke("dismiss_break_nudge").catch(() => {});
    setBreakNudge(null);
    emit("break-warning-action", { action: "skip" });
  }, []);

  const handleBreakAddTime = useCallback(() => {
    setBreakCountdownSecs((prev) => prev + 120);
    invoke("extend_break_nudge", { extraSecs: 120 }).catch(() => {});
  }, []);

  const handleFocusStart = useCallback(() => {
    invoke("dismiss_focus_nudge").catch(() => {});
    setFocusNudge(null);
    emit("focus-action", { action: "start" });
  }, []);

  const handleFocusDismiss = useCallback(() => {
    invoke("dismiss_focus_nudge").catch(() => {});
    setFocusNudge(null);
    emit("focus-action", { action: "dismiss" });
  }, []);

  const handleTourStartClick = async () => {
    if (onStartClick) onStartClick();
    const tourWindow = new WebviewWindow("tour", {
      url: "/tour",
      title: "Welcome to Cognivibe",
      width: 900,
      height: 700,
      center: true,
      resizable: false,
      decorations: true,
      transparent: false,
      focus: true,
    });
    tourWindow.once("tauri://error", (e) => {
      console.error("[NOTIFICATION_BAR] Failed to create tour window:", e);
    });
    tourWindow.once("tauri://destroyed", () => refetch());
  };

  const handleSurveyStartClick = () => onSurveyOpen();
  const handleSurveySuccess = async () => await clearAlert();

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Priority: Tour > Break nudge > Focus nudge > Focus session > Z-score
  const showTourCard = !loading && userData && !userData.opened_tutorial;
  const showBreakNudgeCard = !showTourCard && breakNudge !== null;
  const showFocusNudgeCard = !showTourCard && !showBreakNudgeCard && focusNudge !== null;
  const showFocusCard = !showTourCard && !showBreakNudgeCard && !showFocusNudgeCard && focusRemaining !== null;
  const showZScoreCard = !showTourCard && !showBreakNudgeCard && !showFocusNudgeCard && !showFocusCard && extremeZScoreAlert !== null;

  const isEmpty = !showTourCard && !showBreakNudgeCard && !showFocusNudgeCard && !showFocusCard && !showZScoreCard;

  useEffect(() => {
    onEmpty?.(isEmpty);
  }, [isEmpty, onEmpty]);

  if (isEmpty) {
    return null;
  }

  const showEnableNotificationsHint =
    (showBreakNudgeCard || showFocusNudgeCard) && notificationsEnabled === false;

  const EnableNotificationsHint = () =>
    showEnableNotificationsHint ? (
      <button
        type="button"
        onClick={() => invoke("open_notification_settings").catch(() => {})}
        className="w-full mb-1.5 text-left text-xs text-foreground/50 hover:text-foreground/70 transition-colors cursor-pointer"
      >
        Enable notifications to get the best experience
      </button>
    ) : null;

  // Break nudge card
  if (showBreakNudgeCard && breakNudge) {
    const subtitle =
      breakNudge.trigger_reason === "high_cognitive_load"
        ? "Your cognitive load has been elevated"
        : `You've been working for ${breakNudge.session_minutes} minutes`;

    return (
      <div className="w-full mb-4">
        <EnableNotificationsHint />
        <Card
          className="w-full relative overflow-hidden border border-white/10"
          style={CARD_STYLE}
        >
        <div className="absolute inset-0 bg-cv-accent-gradient opacity-100" />
        <CardBody className="relative z-10 flex flex-row items-center justify-between py-4 px-6">
          <div className="flex flex-col gap-0 leading-tight">
            <span className="text-lg font-bold text-white">
              Break in {formatTime(breakCountdownSecs)}
            </span>
            <span className="text-sm text-white/90">{subtitle}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button
              size="sm"
              className="bg-white text-[#ff709b]"
              onPress={handleBreakStartNow}
            >
              Start now
            </Button>
            <Button
              size="sm"
              variant="bordered"
              className="btn-plain text-white/70 border-white/20"
              onPress={handleBreakAddTime}
            >
              + 2 min
            </Button>
            <Button
              size="sm"
              variant="bordered"
              className="btn-plain text-white/70 border-white/20"
              onPress={handleBreakSkip}
            >
              Skip
            </Button>
          </div>
        </CardBody>
      </Card>
      </div>
    );
  }

  // Focus nudge card
  if (showFocusNudgeCard && focusNudge) {
    return (
      <div className="w-full mb-4">
        <EnableNotificationsHint />
        <Card
          className="w-full relative overflow-hidden border border-white/10"
          style={CARD_STYLE}
        >
        <div className="absolute inset-0 bg-cv-accent-gradient opacity-100" />
        <CardBody className="relative z-10 flex flex-row items-center justify-between py-4 px-6">
          <div className="flex flex-col gap-0 leading-tight">
            <span className="text-lg font-bold text-white">
              Lots of context switching detected
            </span>
            <span className="text-sm text-white/90">Start a focus session?</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button
              size="sm"
              className="bg-white text-[#ff709b]"
              onPress={handleFocusStart}
            >
              Start Focus
            </Button>
            <Button
              size="sm"
              variant="bordered"
              className="btn-plain text-white/70 border-white/20"
              onPress={handleFocusDismiss}
            >
              Dismiss
            </Button>
          </div>
        </CardBody>
      </Card>
      </div>
    );
  }

  // Focus session card
  if (showFocusCard && focusRemaining !== null) {
    const timeStr = formatTime(focusRemaining);
    return (
      <Card
        className="w-full mb-4 relative overflow-hidden border border-white/10"
        style={CARD_STYLE}
      >
        <div className="absolute inset-0 bg-cv-accent-gradient opacity-100" />
        <CardBody className="relative z-10 flex flex-row items-center justify-between py-4 px-6">
          <div className="flex flex-col gap-0 leading-tight">
            <span className="text-lg font-bold text-white">
              Focus Session — {timeStr}
            </span>
            <span className="text-sm text-white/90">
              Stay focused. You've got this.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button
              size="sm"
              variant="bordered"
              className="btn-plain text-white/70 border-white/20"
              onPress={handleExtendFocus}
            >
              + 5 min
            </Button>
            <Button
              size="sm"
              variant="bordered"
              className="btn-plain text-white/70 border-white/20"
              onPress={handleSkipFocus}
            >
              Skip
            </Button>
            <Button
              className="bg-white text-[#ff709b]"
              size="sm"
              onPress={handleCancelFocus}
            >
              Cancel
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Tour card
  if (showTourCard) {
    return (
      <Card
        className="w-full mb-4 relative overflow-hidden border border-white/10"
        style={CARD_STYLE}
      >
        <div className="absolute inset-0 bg-cv-accent-gradient opacity-100" />
        <CardBody className="relative z-10 flex flex-row items-center justify-between py-4 px-6">
          <div className="flex flex-col gap-0 leading-tight">
            <span className="text-lg font-bold text-white">
              Welcome to Cognivibe!
            </span>
            <span className="text-sm text-white/90">
              Let's get started with a short tour.
            </span>
          </div>
          <Button
            className="bg-white text-[#ff709b] text-lg shrink-0 ml-4"
            size="lg"
            onPress={handleTourStartClick}
          >
            START
          </Button>
        </CardBody>
      </Card>
    );
  }

  // Z-score card
  if (showZScoreCard && extremeZScoreAlert) {
    return (
      <>
        <Card
          className="w-full mb-4 relative overflow-hidden border border-white/10"
          style={CARD_STYLE}
        >
          <div className="absolute inset-0 bg-cv-accent-gradient opacity-100" />
          <CardBody className="relative z-10 flex flex-row items-center justify-between py-4 px-6">
            <div className="flex flex-col gap-0 leading-tight">
              <span className="text-lg font-bold text-white">
                Your {extremeZScoreAlert.metric_name} is {extremeZScoreAlert.direction}.
              </span>
              <span className="text-sm text-white/90">
                What happened? Help us improve the accuracy of Cognivibe.
              </span>
            </div>
            <Button
              className="bg-white text-[#ff709b] text-lg shrink-0 ml-4"
              size="lg"
              onPress={handleSurveyStartClick}
            >
              START
            </Button>
          </CardBody>
        </Card>
        <ZScoreSurveyModal
          isOpen={isSurveyOpen}
          onOpenChange={onSurveyOpenChange}
          cognitiveScoreId={extremeZScoreAlert.cognitive_score_id}
          onSubmitSuccess={handleSurveySuccess}
        />
      </>
    );
  }

  return null;
};

export default NotificationBar;
