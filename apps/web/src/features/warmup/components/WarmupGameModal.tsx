import { useEffect, useMemo, useState } from "react";

import { gradeTierFromTitle, type LessonChallengeTier } from "../../lessons/utils/challenge";
import type { LeafNode } from "../../tree/types/tree";


interface WarmupGameModalProps {
  isOpen: boolean;
  leaf: LeafNode | null;
  lessonTargets?: string[];
  onSpeakText: (text: string) => void;
}

type FidgetType = "number-trails" | "letter-drift" | "particle-swirl" | "timeline-beads";

const SCIENCE_PARTICLES = ["charge", "energy", "cell", "orbit", "force", "cycle", "matter", "light"];
const TIMELINE_BEADS = ["past", "cause", "event", "effect", "change", "today"];


function normalizeSubject(subject: string) {
  return subject.trim().toLowerCase();
}


function selectFidget(leaf: LeafNode | null): FidgetType {
  const subject = normalizeSubject(leaf?.subjectTitle ?? leaf?.subjectKey ?? "");
  if (subject.includes("math")) {
    return "number-trails";
  }
  if (subject.includes("reading") || subject.includes("writing")) {
    return "letter-drift";
  }
  if (subject.includes("science")) {
    return "particle-swirl";
  }
  return "timeline-beads";
}


function fidgetGoal(tier: LessonChallengeTier) {
  if (tier === "early") {
    return 3;
  }
  if (tier === "elementary") {
    return 4;
  }
  return 5;
}


function targetTokens(targets: string[] | undefined, limit: number) {
  const cleaned = targets?.map((target) => target.trim()).filter(Boolean) ?? [];
  return Array.from(new Set(cleaned)).slice(0, limit);
}


function letterTokens(leaf: LeafNode | null, tier: LessonChallengeTier, targets?: string[]) {
  const targetWords = targetTokens(targets, 7);
  if (targetWords.length > 0) {
    return tier === "early"
      ? Array.from(new Set(targetWords.join("").toLowerCase().split("").filter((letter) => /[a-z]/.test(letter)))).slice(0, 7)
      : targetWords;
  }

  const source = `${leaf?.title ?? "lesson"} ${leaf?.subjectTitle ?? ""}`;
  const words = source.match(/[A-Za-z][A-Za-z'-]{1,}/g) ?? ["learn", "tree"];
  if (tier === "early") {
    return Array.from(new Set(words.join("").toLowerCase().split("").filter((letter) => /[a-z]/.test(letter)))).slice(0, 7);
  }
  return Array.from(new Set(words.map((word) => word.toLowerCase()))).slice(0, 7);
}


function mathTokens(tier: LessonChallengeTier, targets?: string[]) {
  const targetNumbers = targetTokens(targets, 6);
  if (targetNumbers.length > 0) {
    return targetNumbers;
  }

  if (tier === "early") {
    return ["1", "2", "3", "4", "5"];
  }
  if (tier === "elementary") {
    return ["2", "4", "6", "8", "10"];
  }
  if (tier === "middle") {
    return ["1:2", "2:4", "3:6", "4:8", "5:10"];
  }
  return ["0", "1", "x", "2x", "2x+3"];
}


export function WarmupGameModal({ isOpen, leaf, lessonTargets = [], onSpeakText }: WarmupGameModalProps) {
  const tier = gradeTierFromTitle(leaf?.gradeTitle ?? "Grade 1");
  const fidgetType = selectFidget(leaf);
  const goal = fidgetGoal(tier);
  const [progress, setProgress] = useState(0);
  const [lastTouched, setLastTouched] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setLastTouched(null);
      return;
    }

    onSpeakText(warmupPrompt(fidgetType, leaf));
  }, [fidgetType, isOpen, leaf, onSpeakText]);

  if (!isOpen) {
    return null;
  }

  const isComplete = progress >= goal;
  const meterPercent = Math.min(100, Math.round((progress / goal) * 100));
  const markTouch = (label: string) => {
    const nextProgress = Math.min(goal, progress + 1);
    setLastTouched(label);
    setProgress(nextProgress);
    onSpeakText(nextProgress >= goal ? "Fidget complete." : label);
  };

  return (
    <div className="warmup-modal waiting-warmup-modal" role="dialog" aria-modal="true" aria-label="Lesson warmup game">
      <div className={`warmup-shell fidget-shell ${fidgetType}`}>
        <div className="reward-modal-header">
          <div>
            <p className="lesson-kicker">Waiting Fidget</p>
            <h2 className="reward-modal-title">{fidgetTitle(fidgetType, tier)}</h2>
          </div>
          <div className="fidget-meter" aria-label={`Fidget progress ${meterPercent} percent`}>
            <span style={{ width: `${meterPercent}%` }} />
          </div>
        </div>

        {fidgetType === "number-trails" ? (
          <NumberTrailFidget targets={lessonTargets} tier={tier} onTouch={markTouch} />
        ) : null}
        {fidgetType === "letter-drift" ? (
          <LetterDriftFidget leaf={leaf} targets={lessonTargets} tier={tier} onTouch={markTouch} />
        ) : null}
        {fidgetType === "particle-swirl" ? (
          <ParticleSwirlFidget targets={lessonTargets} tier={tier} onTouch={markTouch} />
        ) : null}
        {fidgetType === "timeline-beads" ? (
          <TimelineBeadFidget targets={lessonTargets} tier={tier} onTouch={markTouch} />
        ) : null}

        <div className={isComplete ? "fidget-status complete" : "fidget-status"} role="status">
          {isComplete ? "Fidget complete. Your lesson will open when it is ready." : lastTouched ? `${lastTouched} added to the color meter.` : "Move, tap, or drag while the lesson gets ready."}
        </div>
      </div>
    </div>
  );
}


function NumberTrailFidget({ targets, tier, onTouch }: { targets: string[]; tier: LessonChallengeTier; onTouch: (label: string) => void }) {
  const tokens = mathTokens(tier, targets);
  return (
    <div className="fidget-playfield number-trail-field">
      {tokens.map((token, index) => (
        <button
          key={token}
          type="button"
          className="number-trail-node"
          style={{
            left: `${12 + index * 18}%`,
            top: `${28 + Math.sin(index) * 18}%`,
          }}
          onPointerEnter={() => onTouch(token)}
          onClick={() => onTouch(token)}
        >
          {token}
        </button>
      ))}
    </div>
  );
}


function LetterDriftFidget({
  leaf,
  targets,
  tier,
  onTouch,
}: {
  leaf: LeafNode | null;
  targets: string[];
  tier: LessonChallengeTier;
  onTouch: (label: string) => void;
}) {
  const tokens = useMemo(() => letterTokens(leaf, tier, targets), [leaf, targets, tier]);
  return (
    <div className="fidget-playfield letter-drift-field">
      {tokens.map((token, index) => (
        <button
          key={token}
          type="button"
          className="letter-drift-token"
          style={{
            left: `${14 + ((index * 17) % 72)}%`,
            top: `${20 + ((index * 23) % 58)}%`,
            animationDuration: `${4.6 + index * 0.28}s`,
          }}
          onClick={() => onTouch(token)}
        >
          {token}
        </button>
      ))}
    </div>
  );
}


function ParticleSwirlFidget({ targets, tier, onTouch }: { targets: string[]; tier: LessonChallengeTier; onTouch: (label: string) => void }) {
  const particles = targetTokens(targets, tier === "high" ? 8 : 6);
  const visibleParticles = particles.length > 0 ? particles : tier === "high" ? SCIENCE_PARTICLES : SCIENCE_PARTICLES.slice(0, 6);
  return (
    <div className="fidget-playfield particle-field">
      {visibleParticles.map((particle, index) => (
        <button
          key={particle}
          type="button"
          className="particle-dot"
          style={{
            left: `${50 + Math.cos(index * 0.9) * (18 + index * 2)}%`,
            top: `${48 + Math.sin(index * 0.9) * (18 + index * 2)}%`,
            animationDelay: `${index * 0.14}s`,
          }}
          onClick={() => onTouch(particle)}
        >
          {particle}
        </button>
      ))}
    </div>
  );
}


function TimelineBeadFidget({ targets, tier, onTouch }: { targets: string[]; tier: LessonChallengeTier; onTouch: (label: string) => void }) {
  const targetBeads = targetTokens(targets, tier === "early" ? 4 : 6);
  const beads = targetBeads.length > 0 ? targetBeads : tier === "early" ? TIMELINE_BEADS.slice(0, 4) : TIMELINE_BEADS;
  return (
    <div className="fidget-playfield timeline-field">
      <div className="timeline-line" aria-hidden="true" />
      {beads.map((bead, index) => (
        <button
          key={bead}
          type="button"
          className="timeline-bead"
          style={{
            left: `${12 + index * (76 / Math.max(beads.length - 1, 1))}%`,
            top: `${48 + (index % 2 === 0 ? -8 : 8)}%`,
          }}
          onClick={() => onTouch(bead)}
        >
          {bead}
        </button>
      ))}
    </div>
  );
}


function warmupPrompt(fidgetType: FidgetType, leaf: LeafNode | null) {
  const topic = leaf?.title ? ` for ${leaf.title}` : "";
  if (fidgetType === "number-trails") {
    return `Trace the math colors${topic}.`;
  }
  if (fidgetType === "letter-drift") {
    return `Paint the drifting words${topic}.`;
  }
  if (fidgetType === "particle-swirl") {
    return `Find the glowing science particles${topic}.`;
  }
  return `Tap the timeline beads${topic}.`;
}


function fidgetTitle(fidgetType: FidgetType, tier: LessonChallengeTier) {
  if (fidgetType === "number-trails") {
    return tier === "high" ? "Coordinate Sparkle Grid" : "Color Number Trail";
  }
  if (fidgetType === "letter-drift") {
    return tier === "early" ? "Drifting Letters" : "Word Shape Painting";
  }
  if (fidgetType === "particle-swirl") {
    return tier === "high" ? "Orbit Drag" : "Particle Swirl";
  }
  return tier === "high" ? "Compass Sweep" : "Timeline Beads";
}
