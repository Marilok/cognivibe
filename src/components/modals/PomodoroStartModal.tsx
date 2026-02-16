"use client";

import React, { useState } from "react";
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
import { invoke } from "@tauri-apps/api/core";

interface PomodoroStartModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const FOCUS_MIN = 15;
const FOCUS_MAX = 45;
const FOCUS_DEFAULT = 25;
const BREAK_MIN = 3;
const BREAK_MAX = 15;
const BREAK_DEFAULT = 5;
const SESSIONS_MIN = 2;
const SESSIONS_MAX = 8;
const SESSIONS_DEFAULT = 4;

const PomodoroStartModal: React.FC<PomodoroStartModalProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const [focusMin, setFocusMin] = useState(FOCUS_DEFAULT);
  const [breakMin, setBreakMin] = useState(BREAK_DEFAULT);
  const [sessions, setSessions] = useState(SESSIONS_DEFAULT);

  const { startPomodoro } = usePomodoro();

  const handleConfirm = async () => {
    startPomodoro({
      focusMin,
      breakMin,
      sessions,
    });
    onOpenChange(false);

    try {
      await invoke("start_focus_session", {
        durationSecs: focusMin * 60,
      });
    } catch (err) {
      console.error("[POMODORO_START] Failed to start focus session:", err);
    }
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
              Start Pomodoro
            </ModalHeader>
            <ModalBody className="gap-6 py-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Focus duration: {focusMin} min
                </label>
                <Slider
                  size="sm"
                  step={5}
                  minValue={FOCUS_MIN}
                  maxValue={FOCUS_MAX}
                  value={focusMin}
                  onChange={(v) => setFocusMin(Number(v))}
                  className="max-w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Break duration: {breakMin} min
                </label>
                <Slider
                  size="sm"
                  step={1}
                  minValue={BREAK_MIN}
                  maxValue={BREAK_MAX}
                  value={breakMin}
                  onChange={(v) => setBreakMin(Number(v))}
                  className="max-w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Number of sessions: {sessions}
                </label>
                <Slider
                  size="sm"
                  step={1}
                  minValue={SESSIONS_MIN}
                  maxValue={SESSIONS_MAX}
                  value={sessions}
                  onChange={(v) => setSessions(Number(v))}
                  className="max-w-full"
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button color="primary" className="text-white" onPress={handleConfirm}>
                Start
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default PomodoroStartModal;
