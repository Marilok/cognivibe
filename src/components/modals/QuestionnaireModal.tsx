import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Slider,
  addToast,
} from "@heroui/react";
import { useState, useEffect, useMemo } from "react";
import { IconClipboardCheck, IconSend } from "@tabler/icons-react";

// Question type definitions
export type QuestionId = "oa" | "ft1" | "ft2" | "wom" | "wot" | "fo1" | "fo2";

interface QuestionDefinition {
  id: QuestionId;
  text: string;
  leftLabel: string;
  rightLabel: string;
  isReverse: boolean;
}

// Question definitions with X placeholder for session length
const QUESTIONS: Record<QuestionId, QuestionDefinition> = {
  oa: {
    id: "oa",
    text: "How manageable was your work in the last X minutes?",
    leftLabel: "Not manageable at all",
    rightLabel: "Completely manageable",
    isReverse: true,
  },
  ft1: {
    id: "ft1",
    text: "How tense or stressed did you feel in the last X minutes?",
    leftLabel: "Not at all",
    rightLabel: "Extremely",
    isReverse: false,
  },
  ft2: {
    id: "ft2",
    text: "How calm and relaxed did you feel in the last X minutes?",
    leftLabel: "Not at all",
    rightLabel: "Extremely",
    isReverse: true,
  },
  wom: {
    id: "wom",
    text: "How mentally demanding was your work in the last X minutes?",
    leftLabel: "Not at all",
    rightLabel: "Extremely",
    isReverse: false,
  },
  wot: {
    id: "wot",
    text: "How rushed or time-pressured did you feel in the last X minutes?",
    leftLabel: "Not at all",
    rightLabel: "Extremely",
    isReverse: false,
  },
  fo1: {
    id: "fo1",
    text: "How much effort did you have to put in to stay focused in the last X minutes?",
    leftLabel: "No effort",
    rightLabel: "Extreme effort",
    isReverse: false,
  },
  fo2: {
    id: "fo2",
    text: "How often did you get distracted in the last X minutes?",
    leftLabel: "Not at all",
    rightLabel: "Constantly",
    isReverse: true,
  },
};

// Question pairs for 3-question layout
const QUESTION_PAIRS: [QuestionId, QuestionId][] = [
  ["ft1", "ft2"],
  ["wom", "wot"],
  ["fo1", "fo2"],
];

// Non-oa questions for single random selection
const NON_OA_QUESTIONS: QuestionId[] = ["ft1", "ft2", "wom", "wot", "fo1", "fo2"];

export type LayoutType = "single_oa" | "three_questions" | "single_random";

/**
 * Selects a random layout based on the probability distribution:
 * - 40% chance: Single question (oa only)
 * - 40% chance: Three questions (one from each pair)
 * - 20% chance: One random question (excluding oa)
 */
function selectRandomLayout(): { layout: LayoutType; questions: QuestionId[] } {
  const rand = Math.random();

  if (rand < 0.4) {
    // 40% - Single oa question
    return { layout: "single_oa", questions: ["oa"] };
  } else if (rand < 0.8) {
    // 40% - Three questions (one from each pair)
    const selectedQuestions: QuestionId[] = QUESTION_PAIRS.map((pair) => {
      return pair[Math.random() < 0.5 ? 0 : 1];
    });
    return { layout: "three_questions", questions: selectedQuestions };
  } else {
    // 20% - One random non-oa question
    const randomIndex = Math.floor(Math.random() * NON_OA_QUESTIONS.length);
    return { layout: "single_random", questions: [NON_OA_QUESTIONS[randomIndex]] };
  }
}

interface QuestionSliderProps {
  question: QuestionDefinition;
  sessionMinutes: number;
  value: number;
  hasBeenTouched: boolean;
  onChange: (value: number) => void;
  onTouch: () => void;
}

const QuestionSlider = ({
  question,
  sessionMinutes,
  value,
  hasBeenTouched,
  onChange,
  onTouch,
}: QuestionSliderProps) => {
  // Replace X with actual session minutes
  const questionText = question.text.replace("X", String(sessionMinutes));

  const handleChange = (val: number | number[]) => {
    const newValue = Array.isArray(val) ? val[0] : val;
    onChange(newValue);
    // Always call onTouch when slider changes - Set.add is idempotent
    onTouch();
  };

  const handleChangeEnd = () => {
    // Backup handler to ensure touch is registered
    onTouch();
  };

  return (
    <div className="w-full space-y-2">
      <p className="text-sm font-medium text-foreground">{questionText}</p>
      <div className="px-2">
        <Slider
          aria-label={question.text}
          step={1}
          maxValue={100}
          minValue={0}
          value={value}
          onChange={handleChange}
          onChangeEnd={handleChangeEnd}
          className="w-full"
          size="md"
          color={hasBeenTouched ? "primary" : "foreground"}
          showTooltip
          tooltipProps={{
            content: String(value),
          }}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-default-700">{question.leftLabel}</span>
          <span className="text-xs font-semibold text-primary">
            {hasBeenTouched ? value : "—"}
          </span>
          <span className="text-xs text-default-700">{question.rightLabel}</span>
        </div>
      </div>
    </div>
  );
};

export interface QuestionnaireScores {
  oa?: number;
  ft1?: number;
  ft2?: number;
  wom?: number;
  wot?: number;
  fo1?: number;
  fo2?: number;
}

interface QuestionnaireModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  sessionMinutes: number;
  sessionId: string | null;
  onSubmit: (scores: QuestionnaireScores) => Promise<void>;
}

const QuestionnaireModal = ({
  isOpen,
  onOpenChange,
  sessionMinutes,
  sessionId,
  onSubmit,
}: QuestionnaireModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Select layout when modal opens
  const [layoutInfo, setLayoutInfo] = useState<{
    layout: LayoutType;
    questions: QuestionId[];
  } | null>(null);

  // Track values and touched state for each question
  const [values, setValues] = useState<Record<QuestionId, number>>({
    oa: 50,
    ft1: 50,
    ft2: 50,
    wom: 50,
    wot: 50,
    fo1: 50,
    fo2: 50,
  });

  const [touchedQuestions, setTouchedQuestions] = useState<Set<QuestionId>>(
    new Set()
  );

  // Select random layout when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log("[QUESTIONNAIRE] Modal opened, selecting layout:", {
        sessionId,
        sessionMinutes,
      });
      const newLayout = selectRandomLayout();
      console.log("[QUESTIONNAIRE] Selected layout:", {
        layout: newLayout.layout,
        questions: newLayout.questions,
      });
      setLayoutInfo(newLayout);
      // Reset state
      setValues({
        oa: 50,
        ft1: 50,
        ft2: 50,
        wom: 50,
        wot: 50,
        fo1: 50,
        fo2: 50,
      });
      setTouchedQuestions(new Set());
      console.log("[QUESTIONNAIRE] Modal state reset");
    } else {
      console.log("[QUESTIONNAIRE] Modal closed");
    }
  }, [isOpen, sessionId, sessionMinutes]);

  // Check if all displayed questions have been answered
  const allQuestionsAnswered = useMemo(() => {
    if (!layoutInfo) return false;
    return layoutInfo.questions.every((qId) => touchedQuestions.has(qId));
  }, [layoutInfo, touchedQuestions]);

  const handleValueChange = (questionId: QuestionId, value: number) => {
    setValues((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleQuestionTouch = (questionId: QuestionId) => {
    setTouchedQuestions((prev) => new Set(prev).add(questionId));
  };

  const handleSubmit = async () => {
    console.log("[QUESTIONNAIRE] Submit button clicked");
    
    if (!layoutInfo || !sessionId) {
      console.warn("[QUESTIONNAIRE] ⚠️ Cannot submit - missing layoutInfo or sessionId:", {
        hasLayoutInfo: !!layoutInfo,
        hasSessionId: !!sessionId,
        sessionId,
      });
      return;
    }

    console.log("[QUESTIONNAIRE] Starting submission process:", {
      sessionId,
      layout: layoutInfo.layout,
      questions: layoutInfo.questions,
      touchedQuestions: Array.from(touchedQuestions),
    });

    setIsSubmitting(true);
    try {
      // Build scores object with only answered questions
      // Apply reverse calculation for reverse questions
      const scores: QuestionnaireScores = {};

      layoutInfo.questions.forEach((qId) => {
        if (touchedQuestions.has(qId)) {
          const question = QUESTIONS[qId];
          const rawValue = values[qId];
          // Apply reverse if needed: reverse questions should be 100 - score
          const finalValue = question.isReverse ? 100 - rawValue : rawValue;
          scores[qId] = finalValue;
          console.log("[QUESTIONNAIRE] Processed question:", {
            questionId: qId,
            rawValue,
            isReverse: question.isReverse,
            finalValue,
          });
        }
      });

      console.log("[QUESTIONNAIRE] Final scores object:", scores);
      console.log("[QUESTIONNAIRE] Calling onSubmit callback...");

      // Add timeout to prevent stuck loading state if submission hangs
      const SUBMIT_TIMEOUT_MS = 30000; // 30 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("SUBMISSION_TIMEOUT"));
        }, SUBMIT_TIMEOUT_MS);
      });

      try {
        await Promise.race([onSubmit(scores), timeoutPromise]);
        
        console.log("[QUESTIONNAIRE] ✅ Submission successful");

        addToast({
          title: "Assessment submitted",
          description: "Thank you for completing the assessment!",
          color: "success",
          timeout: 5000,
          variant: "flat",
        });

        onOpenChange(false);
      } catch (raceError) {
        // Check if this was a timeout
        if (raceError instanceof Error && raceError.message === "SUBMISSION_TIMEOUT") {
          console.warn("[QUESTIONNAIRE] ⚠️ Submission timed out after 30s - closing modal anyway");
          addToast({
            title: "Submission taking longer than expected",
            description: "Your assessment may still be processing. You can close this window.",
            color: "warning",
            timeout: 8000,
            variant: "flat",
          });
          // Close the modal even on timeout - the backend might still process the request
          onOpenChange(false);
        } else {
          // Re-throw other errors to be handled by outer catch
          throw raceError;
        }
      }
    } catch (error) {
      console.error("[QUESTIONNAIRE] ❌ Error submitting questionnaire:", error);
      if (error instanceof Error) {
        console.error("[QUESTIONNAIRE] Error details:", {
          message: error.message,
          stack: error.stack,
        });
      }
      addToast({
        title: "Error submitting assessment",
        description: "Please try again later.",
        color: "danger",
        timeout: 5000,
        variant: "flat",
      });
    } finally {
      setIsSubmitting(false);
      console.log("[QUESTIONNAIRE] Submission process completed");
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  if (!layoutInfo) return null;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={handleClose}
      placement="center"
      backdrop="blur"
      size="lg"
      isDismissable={!isSubmitting}
      isKeyboardDismissDisabled={isSubmitting}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <IconClipboardCheck className="h-6 w-6 text-primary" />
              <span>Quick Assessment</span>
            </ModalHeader>
            <ModalBody className="gap-6 py-4">
              <p className="text-sm text-default-500">
                Please rate the following based on your experience during the
                last {sessionMinutes} minutes.
              </p>

              {layoutInfo.questions.map((questionId) => (
                <QuestionSlider
                  key={questionId}
                  question={QUESTIONS[questionId]}
                  sessionMinutes={sessionMinutes}
                  value={values[questionId]}
                  hasBeenTouched={touchedQuestions.has(questionId)}
                  onChange={(val) => handleValueChange(questionId, val)}
                  onTouch={() => handleQuestionTouch(questionId)}
                />
              ))}
            </ModalBody>
            <ModalFooter className="justify-between">
              <Button
                color="default"
                variant="light"
                onPress={handleClose}
                isDisabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSubmit}
                isDisabled={!allQuestionsAnswered || isSubmitting || !sessionId}
                isLoading={isSubmitting}
                startContent={
                  !isSubmitting ? <IconSend className="h-4 w-4" /> : undefined
                }
                style={{
                  opacity: allQuestionsAnswered && sessionId ? 1 : 0.5,
                }}
              >
                {isSubmitting ? "Sending..." : "Send"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default QuestionnaireModal;
