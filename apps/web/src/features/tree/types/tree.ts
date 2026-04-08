export interface LeafNode {
  id: number | string;
  title: string;
  subtopicKey: string;
  gradeCode?: string;
  gradeTitle?: string;
  subjectKey?: string;
  subjectTitle?: string;
  x: number;
  y: number;
  radius: number;
  hitRadius: number;
  masteryLevel: number;
  previewText: string;
}

export interface SubjectBranchNode {
  id: number | string;
  title: string;
  subjectKey: string;
  colorHex: string;
  anchorX: number;
  anchorY: number;
  controlX: number;
  controlY: number;
  leaves: LeafNode[];
}

export interface GradeBand {
  id: number | string;
  gradeCode?: string;
  title: string;
  barkY: number;
  sortOrder?: number;
  branches: SubjectBranchNode[];
}
