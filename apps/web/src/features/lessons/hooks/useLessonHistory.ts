import { useCallback, useEffect, useState } from "react";

import { fetchJson } from "../../../lib/api";
import type { LessonHistoryItem } from "../types/lesson";


interface LessonHistoryResponse {
  profile_id: number;
  lessons: LessonHistoryItem[];
}

interface UseLessonHistoryResult {
  lessons: LessonHistoryItem[];
  isLoading: boolean;
  error: string | null;
  refreshLessons: () => Promise<void>;
}


export function useLessonHistory(profileId: number | null): UseLessonHistoryResult {
  const [lessons, setLessons] = useState<LessonHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshLessons = useCallback(async () => {
    if (profileId === null) {
      setLessons([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchJson<LessonHistoryResponse>(`/api/profiles/${profileId}/lessons`);
      setLessons(response.lessons);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to load saved lessons.";
      setLessons([]);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void refreshLessons();
  }, [refreshLessons]);

  return {
    lessons,
    isLoading,
    error,
    refreshLessons,
  };
}
