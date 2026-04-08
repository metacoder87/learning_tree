import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ParentMenuDrawer } from "./features/layout/components/ParentMenuDrawer";
import { LessonReader } from "./features/lessons/components/LessonReader";
import { useLessonHistory } from "./features/lessons/hooks/useLessonHistory";
import type { ActiveLessonView, LessonHistoryItem } from "./features/lessons/types/lesson";
import { ProfileSelector } from "./features/profiles/components/ProfileSelector";
import { ProfileSwitcher } from "./features/profiles/components/ProfileSwitcher";
import { useProfiles } from "./features/profiles/hooks/useProfiles";
import { AccessibleLeafNavigator } from "./features/tree/components/AccessibleLeafNavigator";
import { CurrentLeafOverlay } from "./features/tree/components/CurrentLeafOverlay";
import { LearningTreeCanvas } from "./features/tree/components/LearningTreeCanvas";
import { useLeafSpeech } from "./features/tree/hooks/useLeafSpeech";
import { useTreeData } from "./features/tree/hooks/useTreeData";
import type { LeafNode } from "./features/tree/types/tree";
import { WarmupGameModal } from "./features/warmup/components/WarmupGameModal";
import { fetchJson, streamSse, type SseMessage } from "./lib/api";
import { useAiHealth } from "./lib/useAiHealth";


function findLeafById(grades: ReturnType<typeof useTreeData>["grades"], leafId: number | string | null) {
  if (leafId === null) {
    return null;
  }

  return (
    grades
      .flatMap((grade) => grade.branches)
      .flatMap((branch) => branch.leaves)
      .find((leaf) => leaf.id === leafId) ?? null
  );
}


interface LeafGenerationResponse {
  grade: string;
  subject: string;
  generated_count: number;
  leaves: Array<{
    id: number;
    title: string;
  }>;
}

interface LessonStreamStartEvent {
  profile_id: number;
  leaf_id: number;
  title: string;
  grade_title: string;
  subject_title: string;
}

interface LessonStreamTokenEvent {
  text: string;
}

interface LessonStreamReplaceEvent {
  title: string;
  content: string;
  vocabulary_words: string[];
  message?: string;
}

interface LessonStreamCompleteEvent {
  lesson: LessonHistoryItem;
  recovered: boolean;
  model: string;
  detail?: string | null;
}

interface LessonStreamErrorEvent {
  message: string;
}

const WARMUP_APPEAR_DELAY_MS = 700;


function createProvisionalLesson(leaf: LeafNode): ActiveLessonView {
  return {
    id: -Date.now(),
    leaf_id: Number(leaf.id),
    leaf_title: leaf.title,
    subject_title: leaf.subjectTitle ?? "Subject",
    grade_title: leaf.gradeTitle ?? "Grade",
    title: leaf.title,
    content: "",
    vocabulary_words: [],
    created_at: new Date().toISOString(),
    stream_state: "waiting",
    stream_model: null,
    recovered: false,
  };
}


function formatAiStatus(
  aiHealth: ReturnType<typeof useAiHealth>,
  isLoadingTree: boolean,
  isLoadingLessons: boolean,
  profilesLoading: boolean,
  speechSupported: boolean,
) {
  return [
    profilesLoading ? "Loading profiles" : "Profiles ready",
    isLoadingTree ? "Loading tree" : "Tree ready",
    isLoadingLessons ? "Loading history" : "History ready",
    speechSupported ? "Speech ready" : "Speech unavailable",
    aiHealth === null
      ? "Checking AI"
      : aiHealth.status === "ok"
      ? `AI ready: ${aiHealth.model}`
      : `AI offline${aiHealth.detail ? ` (${aiHealth.detail})` : ""}`,
  ];
}


export default function App() {
  const { speakText, speechSupported, stopSpeaking } = useLeafSpeech();
  const aiHealth = useAiHealth();
  const {
    profiles,
    selectedProfileId,
    isLoading: profilesLoading,
    error: profilesError,
    selectProfile,
    createProfile,
  } = useProfiles();
  const { grades, isLoading, error, refreshTree } = useTreeData(selectedProfileId);
  const {
    lessons: lessonHistory,
    isLoading: lessonsLoading,
    error: lessonsError,
    refreshLessons,
  } = useLessonHistory(selectedProfileId);
  const [hasEnteredTree, setHasEnteredTree] = useState(false);
  const [isParentMenuOpen, setIsParentMenuOpen] = useState(false);
  const [selectedLeafId, setSelectedLeafId] = useState<number | string | null>(null);
  const [activeLesson, setActiveLesson] = useState<ActiveLessonView | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const [warmupSession, setWarmupSession] = useState(0);
  const [showWarmupGame, setShowWarmupGame] = useState(false);
  const [isLessonReaderOpen, setIsLessonReaderOpen] = useState(false);
  const [isGrowingBranch, setIsGrowingBranch] = useState(false);
  const [branchGrowthMessage, setBranchGrowthMessage] = useState<string | null>(null);
  const [branchGrowthError, setBranchGrowthError] = useState<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const selectedLeaf = useMemo(() => findLeafById(grades, selectedLeafId), [grades, selectedLeafId]);
  const latestLessonForSelectedLeaf = useMemo(
    () =>
      selectedLeaf
        ? lessonHistory.find((lesson) => lesson.leaf_id === Number(selectedLeaf.id)) ?? null
        : null,
    [lessonHistory, selectedLeaf],
  );
  const displayedLesson =
    activeLesson && selectedLeaf && activeLesson.leaf_id === Number(selectedLeaf.id)
      ? activeLesson
      : latestLessonForSelectedLeaf;
  const vocabularyPool = useMemo(() => {
    const recentWords = lessonHistory.flatMap((lesson) => lesson.vocabulary_words);
    return recentWords.length > 0 ? recentWords : ["sun", "tree", "leaf", "read", "count"];
  }, [lessonHistory]);
  const completedCount = useMemo(
    () =>
      grades
        .flatMap((grade) => grade.branches)
        .flatMap((branch) => branch.leaves)
        .filter((leaf) => leaf.masteryLevel > 0).length,
    [grades],
  );
  const aiStatusLines = useMemo(
    () => formatAiStatus(aiHealth, isLoading, lessonsLoading, profilesLoading, speechSupported),
    [aiHealth, isLoading, lessonsLoading, profilesLoading, speechSupported],
  );
  const selectedProfileName = profiles.find((profile) => profile.id === selectedProfileId)?.display_name ?? "Explorer";
  const showProfileGate = !hasEnteredTree || selectedProfileId === null;

  useEffect(() => {
    setSelectedLeafId(null);
    setActiveLesson(null);
    setLessonError(null);
    setBranchGrowthMessage(null);
    setBranchGrowthError(null);
    setIsLessonReaderOpen(false);
    setIsParentMenuOpen(false);
    setIsGeneratingLesson(false);
    setIsWaitingForFirstToken(false);
    setShowWarmupGame(false);
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
  }, [selectedProfileId]);

  useEffect(() => {
    if (selectedLeafId !== null && selectedLeaf === null) {
      setSelectedLeafId(null);
    }
  }, [selectedLeaf, selectedLeafId]);

  useEffect(() => {
    if (!(isGeneratingLesson && isWaitingForFirstToken)) {
      setShowWarmupGame(false);
      return;
    }

    const timeoutId = window.setTimeout(() => setShowWarmupGame(true), WARMUP_APPEAR_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isGeneratingLesson, isWaitingForFirstToken]);

  const abortCurrentStream = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
  }, []);

  const handleGateProfileEnter = useCallback(
    (profileId: number) => {
      selectProfile(profileId);
      setHasEnteredTree(true);
      setSelectedLeafId(null);
      setActiveLesson(null);
      setIsParentMenuOpen(false);
    },
    [selectProfile],
  );

  const handleCreateProfileAndEnter = useCallback(
    async (displayName: string) => {
      const createdProfileId = await createProfile(displayName);
      if (createdProfileId === null) {
        return;
      }

      setHasEnteredTree(true);
      setSelectedLeafId(null);
      setActiveLesson(null);
      setIsParentMenuOpen(false);
    },
    [createProfile],
  );

  const handleDrawerProfileSelect = useCallback(
    (profileId: number) => {
      abortCurrentStream();
      selectProfile(profileId);
      setSelectedLeafId(null);
      setActiveLesson(null);
      setIsParentMenuOpen(false);
    },
    [abortCurrentStream, selectProfile],
  );

  const handleDrawerCreateProfile = useCallback(
    async (displayName: string) => {
      await createProfile(displayName);
    },
    [createProfile],
  );

  const handleLeafSelect = useCallback((leaf: LeafNode) => {
    setSelectedLeafId(leaf.id);
    setLessonError(null);
  }, []);

  const handleReadToMe = useCallback(() => {
    if (displayedLesson?.content.trim()) {
      speakText(`${displayedLesson.title}. ${displayedLesson.content}`);
      return;
    }

    if (selectedLeaf) {
      speakText(`${selectedLeaf.title}. ${selectedLeaf.previewText}`);
    }
  }, [displayedLesson, selectedLeaf, speakText]);

  const applyStreamMessage = useCallback(
    (message: SseMessage) => {
      if (message.event === "start") {
        const payload = message.data as LessonStreamStartEvent;
        setActiveLesson((currentLesson) =>
          currentLesson
            ? {
                ...currentLesson,
                title: payload.title,
                grade_title: payload.grade_title,
                subject_title: payload.subject_title,
              }
            : currentLesson,
        );
        return;
      }

      if (message.event === "token") {
        const payload = message.data as LessonStreamTokenEvent;
        setIsWaitingForFirstToken(false);
        setShowWarmupGame(false);
        setActiveLesson((currentLesson) =>
          currentLesson
            ? {
                ...currentLesson,
                content: `${currentLesson.content}${payload.text}`,
                stream_state: "streaming",
              }
            : currentLesson,
        );
        return;
      }

      if (message.event === "replace") {
        const payload = message.data as LessonStreamReplaceEvent;
        setIsWaitingForFirstToken(false);
        setShowWarmupGame(false);
        setLessonError(payload.message ?? null);
        setActiveLesson((currentLesson) =>
          currentLesson
            ? {
                ...currentLesson,
                title: payload.title,
                content: payload.content,
                vocabulary_words: payload.vocabulary_words,
                recovered: true,
                stream_state: "streaming",
              }
            : currentLesson,
        );
        return;
      }

      if (message.event === "complete") {
        const payload = message.data as LessonStreamCompleteEvent;
        setLessonError(payload.recovered ? null : payload.detail ?? null);
        setActiveLesson({
          ...payload.lesson,
          stream_state: "complete",
          stream_model: payload.model,
          recovered: payload.recovered,
        });
        void refreshTree();
        void refreshLessons();
        return;
      }

      if (message.event === "error") {
        const payload = message.data as LessonStreamErrorEvent;
        setLessonError(payload.message);
      }
    },
    [refreshLessons, refreshTree],
  );

  const startLessonForLeaf = useCallback(
    async (leaf: LeafNode) => {
      if (selectedProfileId === null || isGeneratingLesson) {
        return;
      }

      abortCurrentStream();

      const abortController = new AbortController();
      streamAbortRef.current = abortController;
      setLessonError(null);
      setSelectedLeafId(leaf.id);
      setActiveLesson(createProvisionalLesson(leaf));
      setIsGeneratingLesson(true);
      setIsWaitingForFirstToken(true);
      setWarmupSession((currentValue) => currentValue + 1);
      setIsLessonReaderOpen(true);

      try {
        await streamSse(
          "/api/generate-lesson/stream",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              profile_id: selectedProfileId,
              leaf_id: Number(leaf.id),
            }),
            signal: abortController.signal,
          },
          applyStreamMessage,
        );
      } catch (caughtError) {
        if (abortController.signal.aborted) {
          return;
        }

        const message = caughtError instanceof Error ? caughtError.message : "Unable to stream the lesson.";
        setLessonError(message);
      } finally {
        if (streamAbortRef.current === abortController) {
          streamAbortRef.current = null;
        }
        setIsGeneratingLesson(false);
        setIsWaitingForFirstToken(false);
        setShowWarmupGame(false);
      }
    },
    [abortCurrentStream, applyStreamMessage, isGeneratingLesson, selectedProfileId],
  );

  const handleStartLesson = useCallback(() => {
    if (!selectedLeaf) {
      return;
    }

    void startLessonForLeaf(selectedLeaf);
  }, [selectedLeaf, startLessonForLeaf]);

  const handleBranchLaunch = useCallback(
    (leaf: LeafNode) => {
      setActiveLesson(null);
      setLessonError(null);
      setSelectedLeafId(leaf.id);
      void startLessonForLeaf(leaf);
    },
    [startLessonForLeaf],
  );

  const handleGrowBranch = useCallback(async () => {
    if (!selectedLeaf || isGrowingBranch) {
      return;
    }

    setBranchGrowthError(null);
    setBranchGrowthMessage(null);
    setIsGrowingBranch(true);

    try {
      const response = await fetchJson<LeafGenerationResponse>("/api/branches/generate-leaves", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grade: selectedLeaf.gradeCode ?? "",
          subject: selectedLeaf.subjectKey ?? "",
          count: 3,
        }),
      });

      await refreshTree();
      if (response.leaves[0]) {
        setSelectedLeafId(response.leaves[0].id);
        speakText(`New leaves grew on the ${response.subject} branch.`);
      }
      setBranchGrowthMessage(
        response.generated_count > 0
          ? `${response.generated_count} new leaves grew in ${response.subject}.`
          : `No new leaves were added for ${response.subject}.`,
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to grow new leaves.";
      setBranchGrowthError(message);
    } finally {
      setIsGrowingBranch(false);
    }
  }, [isGrowingBranch, refreshTree, selectedLeaf, speakText]);

  const handleHistoryLessonOpen = useCallback((lesson: LessonHistoryItem) => {
    setActiveLesson({
      ...lesson,
      stream_state: "complete",
      stream_model: null,
      recovered: false,
    });
    setSelectedLeafId(lesson.leaf_id);
    setIsLessonReaderOpen(true);
    setIsParentMenuOpen(false);
  }, []);

  const handleNavigatorLeafSelect = useCallback(
    (leaf: LeafNode) => {
      handleLeafSelect(leaf);
      setIsParentMenuOpen(false);
    },
    [handleLeafSelect],
  );

  const closeLessonReader = useCallback(() => {
    if (isGeneratingLesson) {
      abortCurrentStream();
      setIsGeneratingLesson(false);
      setIsWaitingForFirstToken(false);
      setShowWarmupGame(false);
    }
    setIsLessonReaderOpen(false);
  }, [abortCurrentStream, isGeneratingLesson]);

  const handleCloseCurrentLeaf = useCallback(() => {
    abortCurrentStream();
    setSelectedLeafId(null);
    setLessonError(null);
    setIsGeneratingLesson(false);
    setIsWaitingForFirstToken(false);
    setShowWarmupGame(false);
    setIsLessonReaderOpen(false);
    stopSpeaking();
  }, [abortCurrentStream, stopSpeaking]);

  const handleReturnToProfileGate = useCallback(() => {
    abortCurrentStream();
    setHasEnteredTree(false);
    setSelectedLeafId(null);
    setActiveLesson(null);
    setIsLessonReaderOpen(false);
    setIsParentMenuOpen(false);
    setIsGeneratingLesson(false);
    setIsWaitingForFirstToken(false);
    setShowWarmupGame(false);
    stopSpeaking();
  }, [abortCurrentStream, stopSpeaking]);

  return (
    <>
      <WarmupGameModal
        isOpen={showWarmupGame}
        sessionKey={warmupSession}
        subject={selectedLeaf?.subjectTitle ?? selectedLeaf?.subjectKey ?? ""}
        vocabularyWords={vocabularyPool}
        onSpeakText={speakText}
      />

      <LessonReader
        lesson={displayedLesson}
        isOpen={isLessonReaderOpen}
        isWaitingForFirstToken={isWaitingForFirstToken}
        onClose={closeLessonReader}
        onSpeakText={speakText}
      />

      {showProfileGate ? (
        <main className="app-shell">
          <ProfileSelector
            error={profilesError}
            isLoading={profilesLoading}
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            onChooseProfile={handleGateProfileEnter}
            onCreateProfile={handleCreateProfileAndEnter}
          />
        </main>
      ) : (
        <main className="immersive-app">
          <section className="immersive-stage">
            <LearningTreeCanvas
              grades={grades}
              selectedLeafId={selectedLeafId}
              onBranchLaunch={handleBranchLaunch}
              onLeafSelect={handleLeafSelect}
              onLeafAnnounce={speakText}
            />
          </section>

          <button
            className="parent-menu-toggle"
            type="button"
            aria-expanded={isParentMenuOpen}
            aria-label="Open parent menu"
            onClick={() => setIsParentMenuOpen((currentValue) => !currentValue)}
          >
            <span />
            <span />
            <span />
          </button>

          <ParentMenuDrawer isOpen={isParentMenuOpen} onClose={() => setIsParentMenuOpen(false)}>
            <section className="drawer-panel">
              <div className="drawer-panel-header">
                <div>
                  <p className="lesson-kicker">Current Child</p>
                  <strong>{selectedProfileName}</strong>
                </div>
                <span className="profile-count">{completedCount}</span>
              </div>
              <p className="drawer-panel-copy">Leaves started</p>
              <button className="drawer-gate-button" type="button" onClick={handleReturnToProfileGate}>
                Back to Child Profiles
              </button>
            </section>

            <section className="drawer-panel">
              <p className="lesson-kicker">System Status</p>
              <div className="drawer-status-list">
                {aiStatusLines.map((line) => (
                  <p key={line} className="drawer-status-line">
                    {line}
                  </p>
                ))}
              </div>
            </section>

            {selectedLeaf ? (
              <section className="drawer-panel">
                <p className="lesson-kicker">Branch Tools</p>
                <strong>{selectedLeaf.title}</strong>
                <p className="drawer-panel-copy">
                  {selectedLeaf.gradeTitle ?? "Grade"} | {selectedLeaf.subjectTitle ?? "Subject"}
                </p>
                <button
                  className="grow-button secondary"
                  type="button"
                  onClick={handleGrowBranch}
                  disabled={isGrowingBranch}
                >
                  {isGrowingBranch ? "Growing Leaves..." : "Grow New Leaves"}
                </button>
                {branchGrowthMessage ? <p className="drawer-status-line success">{branchGrowthMessage}</p> : null}
                {branchGrowthError ? <p className="drawer-status-line error">{branchGrowthError}</p> : null}
              </section>
            ) : null}

            <ProfileSwitcher
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              isLoading={profilesLoading}
              onSelectProfile={handleDrawerProfileSelect}
              onCreateProfile={handleDrawerCreateProfile}
            />

            <section className="history-panel drawer-panel">
              <div className="history-header">
                <p className="lesson-kicker">Recent Lessons</p>
                <span className="profile-count">{lessonHistory.length}</span>
              </div>
              <div className="history-list">
                {lessonHistory.map((lesson) => (
                  <button
                    key={lesson.id}
                    className={activeLesson?.id === lesson.id ? "history-card active" : "history-card"}
                    type="button"
                    onClick={() => handleHistoryLessonOpen(lesson)}
                  >
                    <strong>{lesson.title}</strong>
                    <span>{lesson.grade_title} | {lesson.subject_title} | {lesson.leaf_title}</span>
                  </button>
                ))}
                {lessonHistory.length === 0 && !lessonsLoading ? (
                  <div className="history-empty">Generated lessons will appear here for the selected profile.</div>
                ) : null}
              </div>
            </section>

            <AccessibleLeafNavigator
              grades={grades}
              selectedLeafId={selectedLeaf?.id ?? null}
              onSelectLeaf={handleNavigatorLeafSelect}
              onSpeakLeaf={speakText}
            />
          </ParentMenuDrawer>

          {!selectedLeaf && !isLoading && !error ? (
            <div className="tree-stage-message">Tap a leaf to begin.</div>
          ) : null}
          {isLoading ? <div className="tree-stage-message">Growing your tree...</div> : null}
          {profilesError || error || lessonsError ? (
            <div className="tree-stage-message error">{profilesError || error || lessonsError}</div>
          ) : null}

          <CurrentLeafOverlay
            errorMessage={lessonError}
            isGeneratingLesson={isGeneratingLesson}
            lesson={displayedLesson}
            leaf={selectedLeaf}
            onClose={handleCloseCurrentLeaf}
            onOpenLesson={() => setIsLessonReaderOpen(true)}
            onReadToMe={handleReadToMe}
            onSpeakText={speakText}
            onStartLesson={handleStartLesson}
          />
        </main>
      )}
    </>
  );
}
