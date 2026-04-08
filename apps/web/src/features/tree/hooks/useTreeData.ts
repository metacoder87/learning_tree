import { useCallback, useEffect, useState } from "react";

import { fetchJson } from "../../../lib/api";
import type { GradeBand } from "../types/tree";


const GRADE_SPACING = 720;

interface ApiLeafNode {
  id: number;
  title: string;
  subtopic_key: string;
  description: string | null;
  leaf_x: number;
  leaf_y: number;
  render_radius: number;
  hit_radius: number;
  mastery_level: number;
}

interface ApiBranch {
  id: number;
  subject_key: string;
  title: string;
  color_hex: string;
  anchor_x: number;
  anchor_y: number;
  canopy_width: number;
  canopy_height: number;
  leaves: ApiLeafNode[];
}

interface ApiGrade {
  id: number;
  grade_code: string;
  title: string;
  sort_order: number;
  branches: ApiBranch[];
}

interface ApiTreeSnapshot {
  profile_id: number | null;
  grades: ApiGrade[];
}

interface UseTreeDataResult {
  grades: GradeBand[];
  isLoading: boolean;
  error: string | null;
  refreshTree: () => Promise<void>;
}


async function fetchTreeSnapshot(profileId: number): Promise<ApiTreeSnapshot> {
  return fetchJson<ApiTreeSnapshot>(`/api/tree?profile_id=${profileId}`);
}


function toControlPoint(anchorX: number, barkY: number) {
  return {
    controlX: anchorX * 0.45,
    controlY: barkY - 120 - Math.abs(anchorX) * 0.08,
  };
}


function mapTreeSnapshot(snapshot: ApiTreeSnapshot): GradeBand[] {
  return [...snapshot.grades].sort((left, right) => left.sort_order - right.sort_order).map((grade) => {
    const barkY = -grade.sort_order * GRADE_SPACING;

    return {
      id: grade.id,
      gradeCode: grade.grade_code,
      title: grade.title,
      barkY,
      sortOrder: grade.sort_order,
      branches: grade.branches.map((branch) => {
        const controlPoint = toControlPoint(branch.anchor_x, barkY);
        return {
          id: branch.id,
          title: branch.title,
          subjectKey: branch.subject_key,
          colorHex: branch.color_hex,
          anchorX: branch.anchor_x,
          anchorY: branch.anchor_y,
          controlX: controlPoint.controlX,
          controlY: controlPoint.controlY,
          leaves: branch.leaves.map((leaf) => ({
            id: leaf.id,
            title: leaf.title,
            subtopicKey: leaf.subtopic_key,
            gradeCode: grade.grade_code,
            gradeTitle: grade.title,
            subjectKey: branch.subject_key,
            subjectTitle: branch.title,
            x: leaf.leaf_x,
            y: leaf.leaf_y,
            radius: leaf.render_radius,
            hitRadius: leaf.hit_radius,
            masteryLevel: leaf.mastery_level,
            previewText: leaf.description ?? `Learn ${leaf.title} in ${branch.title}.`,
          })),
        };
      }),
    };
  });
}


export function useTreeData(profileId: number | null): UseTreeDataResult {
  const [grades, setGrades] = useState<GradeBand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTree = useCallback(async () => {
    if (profileId === null) {
      setGrades([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await fetchTreeSnapshot(profileId);
      setGrades(mapTreeSnapshot(snapshot));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unknown tree loading error.";
      setGrades([]);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  return {
    grades,
    isLoading,
    error,
    refreshTree,
  };
}
