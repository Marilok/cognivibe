import { Button, Slider } from "@heroui/react";
import { useState, useEffect, useMemo } from "react";
import { IconSend } from "@tabler/icons-react";

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
    return { layout: "single_oa", questions: ["oa"] };
  } else if (rand < 0.8) {
    const selectedQuestions: QuestionId[] = QUESTION_PAIRS.map((pair) => {
      return pair[Math.random() < 0.5 ? 0 : 1];
    });
    return { layout: "three_questions", questions: selectedQuestions };
  } else {
    const randomIndex = Math.floor(Math.random() * NON_OA_QUESTIONS.length);
    return { layout: "single_random", questions: [NON_OA_QUESTIONS[randomIndex]] };
  }
}

export interface QuestionnaireScores {
  oa?: number;
  ft1?: number;
  ft2?: number;
  wom?: number;
  wot?: number;
  fo1?: number;
  fo2?: number;
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
  const questionText = question.text.replace("X", String(sessionMinutes));

  const handleChange = (val: number | number[]) => {
    const newValue = Array.isArray(val) ? val[0] : val;
    onChange(newValue);
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
          onChangeEnd={onTouch}
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

interface SessionSurveyProps {
  sessionMinutes: number;
  onSubmit: (scores: QuestionnaireScores) => Promise<void>;
  isSubmitting?: boolean;
  compact?: boolean;
}

/**
 * Reusable session survey component that can be embedded in modals or pages.
 * Randomly selects a question layout and handles score computation with reverse scoring.
 */
const SessionSurvey = ({
  sessionMinutes,
  onSubmit,
  isSubmitting = false,
  compact = false,
}: SessionSurveyProps) => {
  const [layoutInfo, setLayoutInfo] = useState<{
    layout: LayoutType;
    questions: QuestionId[];
  } | null>(null);

  const [values, setValues] = useState<Record<QuestionId, number>>({
    oa: 50, ft1: 50, ft2: 50, wom: 50, wot: 50, fo1: 50, fo2: 50,
  });

  const [touchedQuestions, setTouchedQuestions] = useState<Set<QuestionId>>(new Set());

  useEffect(() => {
    const newLayout = selectRandomLayout();
    setLayoutInfo(newLayout);
    setValues({ oa: 50, ft1: 50, ft2: 50, wom: 50, wot: 50, fo1: 50, fo2: 50 });
    setTouchedQuestions(new Set());
  }, []);

  const allQuestionsAnswered = useMemo(() => {
    if (!layoutInfo) return false;
    return layoutInfo.questions.every((qId) => touchedQuestions.has(qId));
  }, [layoutInfo, touchedQuestions]);

  const handleSubmit = async () => {
    if (!layoutInfo) return;

    const scores: QuestionnaireScores = {};
    layoutInfo.questions.forEach((qId) => {
      if (touchedQuestions.has(qId)) {
        const question = QUESTIONS[qId];
        const rawValue = values[qId];
        scores[qId] = question.isReverse ? 100 - rawValue : rawValue;
      }
    });

    await onSubmit(scores);
  };

  if (!layoutInfo) return null;

  return (
    <div className={`w-full ${compact ? "space-y-3" : "space-y-4"}`}>
      <p className={`${compact ? "text-xs" : "text-sm"} text-default-600`}>
        While you wait — how was your session?
      </p>

      {layoutInfo.questions.map((questionId) => (
        <QuestionSlider
          key={questionId}
          question={QUESTIONS[questionId]}
          sessionMinutes={sessionMinutes}
          value={values[questionId]}
          hasBeenTouched={touchedQuestions.has(questionId)}
          onChange={(val) => setValues((prev) => ({ ...prev, [questionId]: val }))}
          onTouch={() => setTouchedQuestions((prev) => new Set(prev).add(questionId))}
        />
      ))}

      <Button
        color="primary"
        className="w-full text-white"
        onPress={handleSubmit}
        isDisabled={!allQuestionsAnswered || isSubmitting}
        isLoading={isSubmitting}
        startContent={!isSubmitting ? <IconSend className="h-4 w-4" /> : undefined}
        size={compact ? "sm" : "md"}
      >
        {isSubmitting ? "Submitting..." : "Submit"}
      </Button>
    </div>
  );
};

export default SessionSurvey;
