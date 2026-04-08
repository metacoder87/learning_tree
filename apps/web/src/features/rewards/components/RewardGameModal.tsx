import { useEffect, useMemo, useRef, useState } from "react";

import { gradeTierFromTitle } from "../../lessons/utils/challenge";


type RewardGameType = "bubble-pop" | "pattern-caterpillar" | "dewdrop-catcher";

interface RewardGameModalProps {
  gradeTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSpeakText: (text: string) => void;
  sessionKey: number;
  subject: string;
  vocabularyWords: string[];
}

interface WordBubble {
  id: number;
  label: string;
  left: number;
  top: number;
  driftSeconds: number;
}

interface FallingDrop {
  id: number;
  x: number;
  y: number;
  value: number;
}

interface PatternChoice {
  id: string;
  label: string;
  value: string;
}

interface PatternRound {
  prompt: string;
  sequence: string[];
  answer: PatternChoice;
  choices: PatternChoice[];
}

const DEFAULT_VOCABULARY = ["sun", "tree", "leaf", "read", "count", "plant", "shape", "story"];
const EXIT_DURATION_MS = 220;
const BUBBLE_SLOTS = [
  { left: 14, top: 18 },
  { left: 35, top: 28 },
  { left: 58, top: 16 },
  { left: 80, top: 26 },
  { left: 20, top: 56 },
  { left: 44, top: 66 },
  { left: 70, top: 58 },
  { left: 84, top: 76 },
];


function poolWords(vocabularyWords: string[]) {
  const cleaned = vocabularyWords.map((word) => word.trim()).filter(Boolean);
  return cleaned.length >= 5 ? cleaned : DEFAULT_VOCABULARY;
}


function normalizeSubject(subject: string) {
  return subject.trim().toLowerCase();
}


function gamePool(subject: string, gradeTitle: string): RewardGameType[] {
  const normalizedSubject = normalizeSubject(subject);
  const tier = gradeTierFromTitle(gradeTitle);

  if (normalizedSubject.includes("math")) {
    return tier === "early" ? ["dewdrop-catcher", "pattern-caterpillar"] : ["dewdrop-catcher", "bubble-pop"];
  }

  if (normalizedSubject.includes("reading") || normalizedSubject.includes("writing")) {
    return tier === "early" ? ["bubble-pop", "pattern-caterpillar"] : ["bubble-pop", "pattern-caterpillar", "dewdrop-catcher"];
  }

  if (normalizedSubject.includes("science")) {
    return tier === "high" ? ["pattern-caterpillar", "bubble-pop"] : ["pattern-caterpillar", "dewdrop-catcher", "bubble-pop"];
  }

  return ["bubble-pop", "pattern-caterpillar", "dewdrop-catcher"];
}


function selectRewardGame(sessionKey: number, subject: string, gradeTitle: string): RewardGameType {
  const availableGames = gamePool(subject, gradeTitle);
  return availableGames[(sessionKey - 1 + availableGames.length) % availableGames.length] ?? "bubble-pop";
}


function buildBubbleVocabulary(vocabularyWords: string[], gradeTitle: string, subject: string) {
  const tier = gradeTierFromTitle(gradeTitle);
  const normalizedSubject = normalizeSubject(subject);
  const baseWords = poolWords(vocabularyWords).slice(0, 8);

  if (tier === "early" && normalizedSubject.includes("reading")) {
    return uniq(["a", "m", "s", "at", "in", "see", ...baseWords.map((word) => word.slice(0, 3))]).slice(0, 8);
  }

  if (tier === "early" && normalizedSubject.includes("math")) {
    return uniq(["1", "2", "3", "4", "5", "ten", ...baseWords]).slice(0, 8);
  }

  if (tier === "middle" || tier === "high") {
    return uniq([...baseWords, ...baseWords.map((word) => word.toUpperCase())]).slice(0, 8);
  }

  return baseWords;
}


function buildBubbleWords(vocabularyWords: string[], seed: number, gradeTitle: string, subject: string): WordBubble[] {
  const words = buildBubbleVocabulary(vocabularyWords, gradeTitle, subject);
  const offset = words.length > 0 ? seed % words.length : 0;
  const rotatedWords = [...words.slice(offset), ...words.slice(0, offset)].slice(0, Math.min(words.length, 7));

  return rotatedWords.map((label, index) => {
    const slot = BUBBLE_SLOTS[(index + seed) % BUBBLE_SLOTS.length] ?? BUBBLE_SLOTS[index];
    return {
      id: index + 1,
      label,
      left: slot.left,
      top: slot.top,
      driftSeconds: 4.6 + ((index + seed) % 4) * 0.45,
    };
  });
}


function uniq(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) {
      continue;
    }
    seen.add(normalized.toLowerCase());
    unique.push(normalized);
  }

  return unique;
}


function bubbleInstruction(subject: string, gradeTitle: string) {
  const tier = gradeTierFromTitle(gradeTitle);
  if (normalizeSubject(subject).includes("reading")) {
    return tier === "early" ? "Pop the word or sound you hear." : "Pop the lesson word you hear.";
  }

  if (normalizeSubject(subject).includes("math")) {
    return "Pop the number or math word you hear.";
  }

  return "Pop the hidden lesson word.";
}


function BubblePopGame({
  gradeTitle,
  seed,
  subject,
  vocabularyWords,
  onSpeakText,
}: {
  gradeTitle: string;
  seed: number;
  subject: string;
  vocabularyWords: string[];
  onSpeakText: (text: string) => void;
}) {
  const bubbles = useMemo(() => buildBubbleWords(vocabularyWords, seed, gradeTitle, subject), [gradeTitle, seed, subject, vocabularyWords]);
  const candidates = useMemo(() => bubbles.map((bubble) => bubble.label), [bubbles]);
  const [targetIndex, setTargetIndex] = useState(candidates.length > 0 ? seed % candidates.length : 0);
  const [poppedIds, setPoppedIds] = useState<number[]>([]);

  useEffect(() => {
    const currentWord = candidates[targetIndex];
    if (currentWord) {
      onSpeakText(`Find ${currentWord}.`);
    }
  }, [candidates, onSpeakText, targetIndex]);

  const targetWord = candidates[targetIndex] ?? "";

  return (
    <div className="warmup-card bubble-pop-game">
      <p className="warmup-title">Leaf Bubble Pop</p>
      <p className="warmup-instruction">
        {bubbleInstruction(subject, gradeTitle)} <strong>{targetWord}</strong>
      </p>
      <div className="bubble-playfield spacious">
        {bubbles.map((bubble) => {
          const isPopped = poppedIds.includes(bubble.id);
          return (
            <button
              key={bubble.id}
              type="button"
              className={isPopped ? "word-bubble popped" : "word-bubble"}
              style={{
                left: `${bubble.left}%`,
                top: `${bubble.top}%`,
                animationDuration: `${bubble.driftSeconds}s`,
                zIndex: bubbles.length - bubble.id,
              }}
              onClick={() => {
                if (bubble.label !== targetWord) {
                  onSpeakText(`Try again. Find ${targetWord}.`);
                  return;
                }

                setPoppedIds((currentIds) => [...currentIds, bubble.id]);
                setTargetIndex((currentIndex) => (currentIndex + 1) % candidates.length);
                onSpeakText(`${bubble.label}. Pop.`);
              }}
            >
              {bubble.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


function patternRoundsFor(subject: string, gradeTitle: string, vocabularyWords: string[]): PatternRound[] {
  const tier = gradeTierFromTitle(gradeTitle);
  const words = poolWords(vocabularyWords);

  if (tier === "early") {
    return [
      {
        prompt: "Finish the color pattern.",
        sequence: ["red", "blue", "red", "?"],
        answer: { id: "blue-answer", label: "Blue leaf", value: "blue" },
        choices: [
          { id: "choice-blue", label: "Blue leaf", value: "blue" },
          { id: "choice-green", label: "Green leaf", value: "green" },
          { id: "choice-red", label: "Red leaf", value: "red" },
        ],
      },
      {
        prompt: "Finish the shape pattern.",
        sequence: ["circle", "circle", "triangle", "triangle", "?"],
        answer: { id: "circle-answer", label: "Circle spot", value: "circle" },
        choices: [
          { id: "shape-circle", label: "Circle spot", value: "circle" },
          { id: "shape-square", label: "Square spot", value: "square" },
          { id: "shape-triangle", label: "Triangle spot", value: "triangle" },
        ],
      },
    ];
  }

  if (normalizeSubject(subject).includes("math")) {
    return [
      {
        prompt: "Finish the counting pattern.",
        sequence: ["2", "4", "6", "?"],
        answer: { id: "math-eight", label: "8", value: "8" },
        choices: [
          { id: "math-8", label: "8", value: "8" },
          { id: "math-7", label: "7", value: "7" },
          { id: "math-10", label: "10", value: "10" },
        ],
      },
      {
        prompt: "Finish the growing pattern.",
        sequence: ["5", "10", "15", "?"],
        answer: { id: "math-twenty", label: "20", value: "20" },
        choices: [
          { id: "math-20", label: "20", value: "20" },
          { id: "math-18", label: "18", value: "18" },
          { id: "math-25", label: "25", value: "25" },
        ],
      },
    ];
  }

  return [
    {
      prompt: "Finish the lesson word pattern.",
      sequence: [words[0] ?? "learn", words[1] ?? "practice", words[0] ?? "learn", "?"],
      answer: { id: "word-pattern-answer", label: words[1] ?? "practice", value: words[1] ?? "practice" },
      choices: uniq([words[1] ?? "practice", words[2] ?? "observe", words[3] ?? "detail"]).map((word) => ({
        id: `choice-${word}`,
        label: word,
        value: word,
      })),
    },
    {
      prompt: "Finish the concept pattern.",
      sequence: [words[2] ?? "detail", words[3] ?? "example", words[2] ?? "detail", "?"],
      answer: { id: "concept-pattern-answer", label: words[3] ?? "example", value: words[3] ?? "example" },
      choices: uniq([words[3] ?? "example", words[0] ?? "idea", words[1] ?? "proof"]).map((word) => ({
        id: `choice-${word}`,
        label: word,
        value: word,
      })),
    },
  ];
}


function PatternCaterpillarGame({
  gradeTitle,
  onSpeakText,
  seed,
  subject,
  vocabularyWords,
}: {
  gradeTitle: string;
  onSpeakText: (text: string) => void;
  seed: number;
  subject: string;
  vocabularyWords: string[];
}) {
  const rounds = useMemo(() => patternRoundsFor(subject, gradeTitle, vocabularyWords), [gradeTitle, subject, vocabularyWords]);
  const [roundIndex, setRoundIndex] = useState(seed % rounds.length);
  const [selectedChoice, setSelectedChoice] = useState<PatternChoice | null>(null);
  const [draggingChoice, setDraggingChoice] = useState<PatternChoice | null>(null);
  const [floatingPosition, setFloatingPosition] = useState<{ x: number; y: number } | null>(null);
  const dropZoneRef = useRef<HTMLButtonElement | null>(null);
  const round = rounds[roundIndex % rounds.length];

  useEffect(() => {
    onSpeakText(round.prompt);
  }, [onSpeakText, round.prompt]);

  useEffect(() => {
    if (!draggingChoice) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setFloatingPosition({ x: event.clientX, y: event.clientY });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dropZone = dropZoneRef.current?.getBoundingClientRect();
      const isInsideDropZone =
        dropZone &&
        event.clientX >= dropZone.left &&
        event.clientX <= dropZone.right &&
        event.clientY >= dropZone.top &&
        event.clientY <= dropZone.bottom;

      const choice = draggingChoice;
      setDraggingChoice(null);
      setFloatingPosition(null);

      if (!choice) {
        return;
      }

      if (!isInsideDropZone) {
        onSpeakText(`Move ${choice.label} into the gap.`);
        return;
      }

      if (choice.value === round.answer.value) {
        onSpeakText("Nice pattern!");
        setSelectedChoice(null);
        setRoundIndex((currentIndex) => currentIndex + 1);
        return;
      }

      onSpeakText("Try a different piece.");
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingChoice, onSpeakText, round.answer.value]);

  const attemptDrop = (choice: PatternChoice | null) => {
    if (!choice) {
      onSpeakText("Pick a piece first.");
      return;
    }

    if (choice.value === round.answer.value) {
      onSpeakText("Nice pattern!");
      setSelectedChoice(null);
      setRoundIndex((currentIndex) => currentIndex + 1);
      return;
    }

    onSpeakText("Try a different piece.");
  };

  return (
    <div className="warmup-card pattern-game">
      <p className="warmup-title">Pattern Caterpillar</p>
      <p className="warmup-instruction">{round.prompt}</p>
      <div className="caterpillar-row">
        {round.sequence.map((item, index) =>
          item === "?" ? (
            <button
              key={`gap-${index}`}
              ref={dropZoneRef}
              type="button"
              className="pattern-gap"
              onClick={() => attemptDrop(selectedChoice)}
            >
              Drop here
            </button>
          ) : (
            <div key={`${item}-${index}`} className={`pattern-piece ${item}`}>
              {item}
            </div>
          ),
        )}
      </div>
      <div className="pattern-choice-row">
        {round.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={selectedChoice?.id === choice.id ? `pattern-choice ${choice.value} active` : `pattern-choice ${choice.value}`}
            onClick={() => setSelectedChoice(choice)}
            onPointerDown={(event) => {
              event.preventDefault();
              setSelectedChoice(choice);
              setDraggingChoice(choice);
              setFloatingPosition({ x: event.clientX, y: event.clientY });
            }}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {draggingChoice && floatingPosition ? (
        <div
          className={`pattern-drag-preview ${draggingChoice.value}`}
          style={{
            left: floatingPosition.x,
            top: floatingPosition.y,
          }}
        >
          {draggingChoice.label}
        </div>
      ) : null}
    </div>
  );
}


function dropStepForGrade(gradeTitle: string) {
  const tier = gradeTierFromTitle(gradeTitle);
  if (tier === "early") {
    return 1;
  }
  if (tier === "elementary") {
    return 2;
  }
  if (tier === "middle") {
    return 5;
  }
  return 10;
}


function DewdropCatcherGame({
  gradeTitle,
  onSpeakText,
  seed,
}: {
  gradeTitle: string;
  onSpeakText: (text: string) => void;
  seed: number;
}) {
  const [drops, setDrops] = useState<FallingDrop[]>([]);
  const [basketX, setBasketX] = useState(36 + (seed % 5) * 10);
  const [count, setCount] = useState(0);
  const nextDropIdRef = useRef(1);
  const step = dropStepForGrade(gradeTitle);

  useEffect(() => {
    onSpeakText(`Catch the drops and count by ${step}.`);
  }, [onSpeakText, step]);

  useEffect(() => {
    const spawnTimer = window.setInterval(() => {
      setDrops((currentDrops) => [
        ...currentDrops,
        {
          id: nextDropIdRef.current++,
          x: 12 + ((nextDropIdRef.current * 19) + seed * 7) % 72,
          y: 0,
          value: (currentDrops.length + 1) * step,
        },
      ]);
    }, 780 + (seed % 4) * 80);

    return () => window.clearInterval(spawnTimer);
  }, [seed, step]);

  useEffect(() => {
    const tickTimer = window.setInterval(() => {
      setDrops((currentDrops) => {
        const nextDrops: FallingDrop[] = [];
        let catches = 0;

        for (const drop of currentDrops) {
          const nextY = drop.y + 8;
          const inBasket = nextY >= 76 && Math.abs(drop.x - basketX) <= 10;

          if (inBasket) {
            catches += 1;
            continue;
          }

          if (nextY < 92) {
            nextDrops.push({ ...drop, y: nextY });
          }
        }

        if (catches > 0) {
          setCount((currentCount) => {
            const nextCount = currentCount + catches * step;
            onSpeakText(String(nextCount));
            return nextCount;
          });
        }

        return nextDrops;
      });
    }, 120);

    return () => window.clearInterval(tickTimer);
  }, [basketX, onSpeakText, step]);

  return (
    <div className="warmup-card dewdrop-game">
      <p className="warmup-title">Dewdrop Catcher</p>
      <p className="warmup-instruction">Move the basket and count by {step} as you catch the drops.</p>
      <div
        className="dewdrop-playfield"
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const relativeX = ((event.clientX - bounds.left) / bounds.width) * 100;
          setBasketX(Math.max(8, Math.min(relativeX, 92)));
        }}
      >
        {drops.map((drop) => (
          <div
            key={drop.id}
            className="dewdrop"
            style={{
              left: `${drop.x}%`,
              top: `${drop.y}%`,
            }}
          >
            {drop.value}
          </div>
        ))}
        <div className="basket" style={{ left: `${basketX}%` }}>
          Basket
        </div>
      </div>
      <p className="warmup-score">Drops counted: {count}</p>
    </div>
  );
}


export function RewardGameModal({
  gradeTitle,
  isOpen,
  onClose,
  onSpeakText,
  sessionKey,
  subject,
  vocabularyWords,
}: RewardGameModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);
  const gameType = useMemo(() => selectRewardGame(sessionKey, subject, gradeTitle), [gradeTitle, sessionKey, subject]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const frameId = window.requestAnimationFrame(() => setIsVisible(true));
      return () => window.cancelAnimationFrame(frameId);
    }

    setIsVisible(false);
    const timeoutId = window.setTimeout(() => setShouldRender(false), EXIT_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={isVisible ? "warmup-modal reward-modal" : "warmup-modal reward-modal closing"} role="dialog" aria-modal="true">
      <div className="warmup-shell">
        <div className="reward-modal-header">
          <div>
            <p className="lesson-kicker">Lesson Reward</p>
            <h2 className="reward-modal-title">You earned a tree game.</h2>
          </div>
          <button className="lesson-reader-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {gameType === "bubble-pop" ? (
          <BubblePopGame
            key={`reward-bubble-${sessionKey}`}
            gradeTitle={gradeTitle}
            seed={sessionKey}
            subject={subject}
            vocabularyWords={vocabularyWords}
            onSpeakText={onSpeakText}
          />
        ) : null}
        {gameType === "pattern-caterpillar" ? (
          <PatternCaterpillarGame
            key={`reward-pattern-${sessionKey}`}
            gradeTitle={gradeTitle}
            onSpeakText={onSpeakText}
            seed={sessionKey}
            subject={subject}
            vocabularyWords={vocabularyWords}
          />
        ) : null}
        {gameType === "dewdrop-catcher" ? (
          <DewdropCatcherGame key={`reward-dew-${sessionKey}`} gradeTitle={gradeTitle} onSpeakText={onSpeakText} seed={sessionKey} />
        ) : null}
      </div>
    </div>
  );
}
