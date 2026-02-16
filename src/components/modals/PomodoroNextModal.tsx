"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Slider,
} from "@heroui/react";
import { usePomodoro } from "../../contexts/PomodoroContext";
import { suggestNextSessionLength } from "../../utils/pomodoroAdaptive";
import { fetchBatchScores } from "../../utils/batchScoresApi";

interface PomodoroNextModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (durationMin: number) => void;
  onEndPomodoro: () => void;
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const PomodoroNextModal: React.FC<PomodoroNextModalProps> = ({
  isOpen,
  onOpenChange,
  onContinue,
  onEndPomodoro,
}) => {
  const {
    currentSession,
    totalSessions,
    baseFocusMin,
    sessionHistory,
    setNextFocusMin,
  } = usePomodoro();

  const [recommendedMin, setRecommendedMin] = useState(baseFocusMin);
  const [adjustedMin, setAdjustedMin] = useState(baseFocusMin);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || sessionHistory.length === 0) {
      setRecommendedMin(baseFocusMin);
      setAdjustedMin(baseFocusMin);
      setLoading(false);
      return;
    }

    const lastRecord = sessionHistory[sessionHistory.length - 1];
    const focusStart = new Date(lastRecord.focusStartedAt).getTime();
    const focusEnd = new Date(lastRecord.focusEndedAt).getTime();

    const fetchAndRecommend = async () => {
      setLoading(true);
      try {
        const today = toLocalDateStr(new Date());
        const result = await fetchBatchScores(today, today);
        if (result.success && Array.isArray(result.data)) {
          const displayScores: number[] = [];
          for (const item of result.data as Array<{
            timestamp_iso?: string;
            timestamp?: string;
            display_score?: number;
            score_total?: number;
          }>) {
            const ts = item.timestamp_iso ?? item.timestamp;
            if (!ts) continue;
            const t = new Date(ts).getTime();
            if (t >= focusStart && t <= focusEnd) {
              const load = Number(item.display_score ?? item.score_total ?? 50);
              displayScores.push(load);
            }
          }
          const recommended = suggestNextSessionLength(
            baseFocusMin,
            displayScores
          );
          setRecommendedMin(recommended);
          setAdjustedMin(recommended);
          setNextFocusMin(recommended);
        } else {
          setRecommendedMin(baseFocusMin);
          setAdjustedMin(baseFocusMin);
          setNextFocusMin(baseFocusMin);
        }
      } catch (err) {
        console.error("[POMODORO_NEXT] Failed to fetch scores:", err);
        setRecommendedMin(baseFocusMin);
        setAdjustedMin(baseFocusMin);
        setNextFocusMin(baseFocusMin);
      } finally {
        setLoading(false);
      }
    };

    fetchAndRecommend();
  }, [
    isOpen,
    sessionHistory,
    baseFocusMin,
    setNextFocusMin,
  ]);

  const handleContinue = () => {
    setNextFocusMin(adjustedMin);
    onContinue(adjustedMin);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="center"
      backdrop="blur"
      size="md"
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Session {currentSession} of {totalSessions} complete
            </ModalHeader>
            <ModalBody className="gap-4 py-4">
              {loading ? (
                <p className="text-foreground/70">Calculating recommendation...</p>
              ) : (
                <>
                  <p className="text-foreground/90">
                    Based on your focus and stress levels, we recommend your
                    next focus session to be{" "}
                    <strong>{recommendedMin} minutes</strong>.
                  </p>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Adjust duration: {adjustedMin} min
                    </label>
                    <Slider
                      size="sm"
                      step={5}
                      minValue={15}
                      maxValue={45}
                      value={adjustedMin}
                      onChange={(v) => {
                        const n = Number(v);
                        setAdjustedMin(n);
                        setNextFocusMin(n);
                      }}
                      className="max-w-full"
                    />
                  </div>
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onEndPomodoro}>
                End Pomodoro
              </Button>
              <Button
                color="primary"
                className="text-white"
                onPress={handleContinue}
                isDisabled={loading}
              >
                Continue
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default PomodoroNextModal;
