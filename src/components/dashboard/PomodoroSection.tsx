"use client";

import React from "react";
import { Button } from "@heroui/react";
import { IconFlame } from "@tabler/icons-react";
import { usePomodoroStreak } from "../../hooks/usePomodoroStreak";
import { usePomodoro } from "../../contexts/PomodoroContext";

interface PomodoroSectionProps {
  visible: boolean;
  onStartClick: () => void;
}

const PomodoroSection: React.FC<PomodoroSectionProps> = ({
  visible,
  onStartClick,
}) => {
  const streak = usePomodoroStreak();
  const { active } = usePomodoro();

  if (!visible) return null;

  const streakIntensity = Math.min(streak, 5);
  const glowOpacity = 0.2 + streakIntensity * 0.1;

  return (
    <div className="w-full flex flex-row items-end justify-between gap-10 py-4 mb-4">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <h2 className="text-2xl font-medium text-white flex items-center gap-2">
          Your focus streak:{" "}
          <span
            className={`inline-flex items-center gap-1 ${
              streak === 0
                ? "text-white/30"
                : "bg-clip-text text-transparent bg-gradient-to-r from-[#A07CEF] via-[#A07CEF] to-[#FF709B]"
            }`}
            style={
              streak > 0
                ? {
                    filter: `drop-shadow(0 0 ${4 + streak * 2}px rgba(160, 124, 239, ${glowOpacity}))`,
                  }
                : undefined
            }
          >
            <IconFlame
              width={28}
              height={28}
              className={streak === 0 ? "text-white/30" : "text-[#FF709B]"}
              style={
                streak > 0
                  ? {
                      filter: `drop-shadow(0 0 4px rgba(255, 112, 155, ${glowOpacity}))`,
                    }
                  : undefined
              }
            />
            {streak}
          </span>
        </h2>
        <p className="text-sm text-foreground/50">
          The adaptive pomodoro timer helps you find your optimal focus time. Do
          at least one deep focus session per weekday to keep your streak.
        </p>
      </div>
      <div className="shrink-0 self-end pl-6">
        <Button
          color="primary"
          size="md"
          onPress={onStartClick}
          isDisabled={active}
          className="font-medium text-white"
        >
          START
        </Button>
      </div>
    </div>
  );
};

export default PomodoroSection;
