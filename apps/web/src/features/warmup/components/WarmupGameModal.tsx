import { useEffect, useMemo, useRef, useState } from "react";


type WarmupGameType = "bubble-pop" | "pattern-caterpillar" | "dewdrop-catcher";

interface WarmupGameModalProps {
  isOpen: boolean;
  sessionKey: number;
  subject: string;
  vocabularyWords: string[];
  onSpeakText: (text: string) => void;
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
const GAME_SEQUENCE: WarmupGameType[] = ["bubble-pop", "pattern-caterpillar", "dewdrop-catcher"];
const EXIT_DURATION_MS = 220;
const PATTERN_ROUNDS: PatternRound[] = [
  {
    prompt: "Finish the caterpillar color pattern.",
    sequence: ["red", "blue", "red", "?"],
    answer: { id: "red-blue-red-blue", label: "Blue leaf", value: "blue" },
    choices: [
      { id: "choice-blue", label: "Blue leaf", value: "blue" },
      { id: "choice-green", label: "Green leaf", value: "green" },
      { id: "choice-red", label: "Red leaf", value: "red" },
    ],
  },
  {
    prompt: "Finish the caterpillar shape pattern.",
    sequence: ["circle", "circle", "triangle", "triangle", "?"],
    answer: { id: "circle-answer", label: "Circle spot", value: "circle" },
    choices: [
      { id: "shape-circle", label: "Circle spot", value: "circle" },
      { id: "shape-square", label: "Square spot", value: "square" },
      { id: "shape-triangle", label: "Triangle spot", value: "triangle" },
    ],
  },
];


function poolWords(vocabularyWords: string[]) {
  const cleaned = vocabularyWords.map((word) => word.trim()).filter(Boolean);
  return cleaned.length >= 5 ? cleaned : DEFAULT_VOCABULARY;
}


function normalizeSubject(subject: string) {
  return subject.trim().toLowerCase();
}


function buildBubbleWords(vocabularyWords: string[], seed: number): WordBubble[] {
  const words = poolWords(vocabularyWords);
  const offset = words.length > 0 ? seed % words.length : 0;
  const rotatedWords = [...words.slice(offset), ...words.slice(0, offset)];
  const expandedWords = [...rotatedWords, ...rotatedWords.slice(0, 3)];

  return expandedWords.map((label, index) => ({
    id: index + 1,
    label,
    left: 8 + ((index * 11) + seed * 3) % 72,
    top: 10 + ((index * 17) + seed * 5) % 58,
    driftSeconds: 4.2 + ((index + seed) % 4) * 0.5,
  }));
}


function selectGame(sessionKey: number, subject: string): WarmupGameType {
  switch (normalizeSubject(subject)) {
    case "math":
    case "number":
    case "numbers":
      return "dewdrop-catcher";
    case "reading":
    case "spelling":
    case "rhyming":
      return "bubble-pop";
    default:
      return GAME_SEQUENCE[(sessionKey - 1 + GAME_SEQUENCE.length) % GAME_SEQUENCE.length];
  }
}


function BubblePopGame({
  seed,
  vocabularyWords,
  onSpeakText,
}: {
  seed: number;
  vocabularyWords: string[];
  onSpeakText: (text: string) => void;
}) {
  const bubbles = useMemo(() => buildBubbleWords(vocabularyWords, seed), [seed, vocabularyWords]);
  const candidates = useMemo(() => bubbles.map((bubble) => bubble.label), [bubbles]);
  const [targetIndex, setTargetIndex] = useState(candidates.length > 0 ? seed % candidates.length : 0);
  const [poppedIds, setPoppedIds] = useState<number[]>([]);

  useEffect(() => {
    onSpeakText(`Pop the word ${candidates[targetIndex]}.`);
  }, [candidates, onSpeakText, targetIndex]);

  const targetWord = candidates[targetIndex];

  return (
    <div className="warmup-card bubble-pop-game">
      <p className="warmup-title">Sight Word Bubble Pop</p>
      <p className="warmup-instruction">Tap the bubble that says <strong>{targetWord}</strong>.</p>
      <div className="bubble-playfield">
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


function PatternCaterpillarGame({ onSpeakText, seed }: { onSpeakText: (text: string) => void; seed: number }) {
  const [roundIndex, setRoundIndex] = useState(seed % PATTERN_ROUNDS.length);
  const [draggingChoice, setDraggingChoice] = useState<PatternChoice | null>(null);
  const [floatingPosition, setFloatingPosition] = useState<{ x: number; y: number } | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const round = PATTERN_ROUNDS[roundIndex % PATTERN_ROUNDS.length];

  useEffect(() => {
    onSpeakText(round.prompt);
  }, [onSpeakText, round.prompt]);

  return (
    <div className="warmup-card pattern-game">
      <p className="warmup-title">Pattern Caterpillar</p>
      <p className="warmup-instruction">{round.prompt}</p>
      <div className="caterpillar-row">
        {round.sequence.map((item, index) =>
          item === "?" ? (
            <div key={`gap-${index}`} ref={dropZoneRef} className="pattern-gap">
              Drop here
            </div>
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
            className={`pattern-choice ${choice.value}`}
            onPointerDown={(event) => {
              setDraggingChoice(choice);
              setFloatingPosition({ x: event.clientX, y: event.clientY });
            }}
            onPointerMove={(event) => {
              if (!draggingChoice || draggingChoice.id !== choice.id) {
                return;
              }
              setFloatingPosition({ x: event.clientX, y: event.clientY });
            }}
            onPointerUp={(event) => {
              const dropZone = dropZoneRef.current?.getBoundingClientRect();
              const isInsideDropZone =
                dropZone &&
                event.clientX >= dropZone.left &&
                event.clientX <= dropZone.right &&
                event.clientY >= dropZone.top &&
                event.clientY <= dropZone.bottom;

              setDraggingChoice(null);
              setFloatingPosition(null);

              if (!isInsideDropZone) {
                onSpeakText(`Drag ${choice.label} into the gap.`);
                return;
              }

              if (choice.value === round.answer.value) {
                onSpeakText("Nice pattern!");
                setRoundIndex((currentIndex) => currentIndex + 1);
                return;
              }

              onSpeakText("Try a different pattern piece.");
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


function DewdropCatcherGame({ onSpeakText, seed }: { onSpeakText: (text: string) => void; seed: number }) {
  const [drops, setDrops] = useState<FallingDrop[]>([]);
  const [basketX, setBasketX] = useState(36 + (seed % 5) * 10);
  const [count, setCount] = useState(0);
  const nextDropIdRef = useRef(1);

  useEffect(() => {
    onSpeakText("Catch the dewdrops and count with me.");
  }, [onSpeakText]);

  useEffect(() => {
    const spawnTimer = window.setInterval(() => {
      setDrops((currentDrops) => [
        ...currentDrops,
        {
          id: nextDropIdRef.current++,
          x: 10 + ((nextDropIdRef.current * 17) + seed * 13) % 76,
          y: 0,
          value: currentDrops.length + 1,
        },
      ]);
    }, 760 + (seed % 4) * 90);

    return () => window.clearInterval(spawnTimer);
  }, [seed]);

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
            const nextCount = currentCount + catches;
            onSpeakText(String(nextCount));
            return nextCount;
          });
        }

        return nextDrops;
      });
    }, 120);

    return () => window.clearInterval(tickTimer);
  }, [basketX, onSpeakText]);

  return (
    <div className="warmup-card dewdrop-game">
      <p className="warmup-title">Dewdrop Catcher</p>
      <p className="warmup-instruction">Move the basket and catch the falling drops. Count out loud.</p>
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
      <p className="warmup-score">Drops caught: {count}</p>
    </div>
  );
}


export function WarmupGameModal({
  isOpen,
  sessionKey,
  subject,
  vocabularyWords,
  onSpeakText,
}: WarmupGameModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);
  const gameType = useMemo(() => selectGame(sessionKey, subject), [sessionKey, subject]);

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
    <div className={isVisible ? "warmup-modal" : "warmup-modal closing"} role="dialog" aria-modal="true">
      <div className="warmup-shell">
        {gameType === "bubble-pop" ? (
          <BubblePopGame key={`bubble-${sessionKey}`} seed={sessionKey} vocabularyWords={vocabularyWords} onSpeakText={onSpeakText} />
        ) : null}
        {gameType === "pattern-caterpillar" ? (
          <PatternCaterpillarGame key={`pattern-${sessionKey}`} seed={sessionKey} onSpeakText={onSpeakText} />
        ) : null}
        {gameType === "dewdrop-catcher" ? (
          <DewdropCatcherGame key={`dew-${sessionKey}`} seed={sessionKey} onSpeakText={onSpeakText} />
        ) : null}
      </div>
    </div>
  );
}
