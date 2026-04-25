import { animated, useSpring } from "@react-spring/three";
import { Html } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import * as THREE from "three";

import type { GradeBand, LeafNode, SubjectBranchNode } from "../types/tree";


type Point3 = [number, number, number];

interface LearningTreeCanvasProps {
  grades: GradeBand[];
  onBranchLaunch?: (leaf: LeafNode) => void;
  onLeafSelect?: (leaf: LeafNode) => void;
  onLeafAnnounce?: (text: string) => void;
  selectedLeafId?: number | string | null;
}

interface CameraMotionState {
  progress: number;
  targetProgress: number;
  dragging: boolean;
  dragPointerId: number;
  dragStartY: number;
  dragStartProgress: number;
  lookAt: THREE.Vector3;
}

interface LeafClusterCompanion {
  color: string;
  offset: Point3;
  rotation: Point3;
  scale: number;
}

export interface GradeVisualRules {
  tier: "early" | "elementary" | "middle" | "high";
  branchRadiusScale: number;
  leafScale: number;
  hitRadiusScale: number;
  canopyPuffCount: number;
  canopyScale: number;
  twigSteps: number;
  companionLeafCount: number;
  detailTwigCount: number;
}

export interface MasteryRejuvenationState {
  masteryLevel: number;
  stage:
    | "decayed"
    | "recovering-red"
    | "recovering-orange"
    | "warming-yellow"
    | "living-green"
    | "radiant-green";
  color: string;
  canopyColor: string;
  emissive: string;
  emissiveIntensity: number;
  barkWarmth: number;
  canopyOpacity: number;
  leafScale: number;
  decay: number;
  glow: boolean;
  flower: boolean;
  fruit: boolean;
}

export interface BranchHealthState {
  averageMastery: number;
  healthRatio: number;
  state: "decayed" | "recovering" | "living" | "radiant";
  barkColor: string;
  crackColor: string;
  canopyOpacity: number;
  canopyScale: number;
  restoredPuffCount: number;
  moteColor: string;
}

export interface SubjectVisualTheme {
  subjectKey: string;
  motif: "number-bead" | "letter-petal" | "science-orbit" | "civic-compass" | "learning-spark";
  primary: string;
  accent: string;
  secondary: string;
}

const WORLD_SCALE = 0.0125;
const TRUNK_BASE_Y = -4.4;
const TRUNK_RADIUS = 0.72;
const DEFAULT_TOP_Y = 10;

const gradeLabelStyle: CSSProperties = {
  padding: "0.38rem 0.76rem",
  borderRadius: "20px 20px 20px 8px",
  background:
    "radial-gradient(circle at top, rgba(255, 244, 176, 0.58), transparent 45%), linear-gradient(180deg, rgba(69, 97, 44, 0.94) 0%, rgba(45, 76, 31, 0.96) 100%)",
  border: "1px solid rgba(255, 249, 214, 0.58)",
  boxShadow: "0 14px 28px rgba(35, 60, 24, 0.28)",
  color: "#fff5ca",
  fontFamily: "\"Trebuchet MS\", Verdana, sans-serif",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  pointerEvents: "none",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const leafLabelStyle: CSSProperties = {
  padding: "0.44rem 0.78rem",
  borderRadius: "18px 18px 18px 8px",
  background:
    "radial-gradient(circle at top, rgba(255, 248, 189, 0.74), transparent 42%), linear-gradient(180deg, rgba(255, 252, 240, 0.98) 0%, rgba(243, 255, 225, 0.96) 100%)",
  border: "1px solid rgba(90, 125, 53, 0.26)",
  boxShadow: "0 18px 30px rgba(39, 69, 28, 0.2)",
  color: "#233719",
  fontFamily: "\"Trebuchet MS\", Verdana, sans-serif",
  fontSize: "0.76rem",
  fontWeight: 800,
  maxWidth: "10rem",
  pointerEvents: "none",
  textAlign: "center",
};


export function gradeVisualRules(grade: Pick<GradeBand, "sortOrder" | "title">): GradeVisualRules {
  const sortOrder = grade.sortOrder ?? gradeSortOrderFromTitle(grade.title);
  if (sortOrder <= 2) {
    return {
      tier: "early",
      branchRadiusScale: 1.22,
      leafScale: 1.26,
      hitRadiusScale: 1.22,
      canopyPuffCount: 2,
      canopyScale: 0.92,
      twigSteps: 3,
      companionLeafCount: 1,
      detailTwigCount: 0,
    };
  }

  if (sortOrder <= 6) {
    return {
      tier: "elementary",
      branchRadiusScale: 1.08,
      leafScale: 1.08,
      hitRadiusScale: 1.08,
      canopyPuffCount: 3,
      canopyScale: 1,
      twigSteps: 4,
      companionLeafCount: 2,
      detailTwigCount: 1,
    };
  }

  if (sortOrder <= 9) {
    return {
      tier: "middle",
      branchRadiusScale: 0.96,
      leafScale: 0.96,
      hitRadiusScale: 1,
      canopyPuffCount: 4,
      canopyScale: 1.12,
      twigSteps: 5,
      companionLeafCount: 3,
      detailTwigCount: 2,
    };
  }

  return {
    tier: "high",
    branchRadiusScale: 0.86,
    leafScale: 0.9,
    hitRadiusScale: 0.98,
    canopyPuffCount: 5,
    canopyScale: 1.24,
    twigSteps: 6,
    companionLeafCount: 4,
    detailTwigCount: 3,
  };
}


function gradeSortOrderFromTitle(title: string) {
  const normalized = title.trim().toLowerCase();
  if (normalized === "pre-k") {
    return 0;
  }
  if (normalized === "kindergarten") {
    return 1;
  }
  const match = normalized.match(/grade\s+(\d+)/);
  return match ? Number(match[1]) + 1 : 13;
}


function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}


export function masteryRejuvenationState(masteryLevel: number): MasteryRejuvenationState {
  const level = clamp(Math.floor(masteryLevel), 0, 5);
  const states: Record<number, Omit<MasteryRejuvenationState, "masteryLevel">> = {
    0: {
      stage: "decayed",
      color: "#211711",
      canopyColor: "#2a2119",
      emissive: "#000000",
      emissiveIntensity: 0,
      barkWarmth: 0,
      canopyOpacity: 0.14,
      leafScale: 0.78,
      decay: 1,
      glow: false,
      flower: false,
      fruit: false,
    },
    1: {
      stage: "recovering-red",
      color: "#81241f",
      canopyColor: "#5e2520",
      emissive: "#4a100f",
      emissiveIntensity: 0.04,
      barkWarmth: 0.18,
      canopyOpacity: 0.2,
      leafScale: 0.9,
      decay: 0.76,
      glow: false,
      flower: false,
      fruit: false,
    },
    2: {
      stage: "recovering-orange",
      color: "#c86b23",
      canopyColor: "#9a5425",
      emissive: "#7a300f",
      emissiveIntensity: 0.06,
      barkWarmth: 0.38,
      canopyOpacity: 0.28,
      leafScale: 0.98,
      decay: 0.52,
      glow: false,
      flower: false,
      fruit: false,
    },
    3: {
      stage: "warming-yellow",
      color: "#e4c83f",
      canopyColor: "#b2a742",
      emissive: "#7a6214",
      emissiveIntensity: 0.08,
      barkWarmth: 0.58,
      canopyOpacity: 0.34,
      leafScale: 1.04,
      decay: 0.3,
      glow: false,
      flower: false,
      fruit: false,
    },
    4: {
      stage: "living-green",
      color: "#3f9f42",
      canopyColor: "#4f9d45",
      emissive: "#1e4d1d",
      emissiveIntensity: 0.1,
      barkWarmth: 0.78,
      canopyOpacity: 0.42,
      leafScale: 1.1,
      decay: 0.12,
      glow: false,
      flower: true,
      fruit: false,
    },
    5: {
      stage: "radiant-green",
      color: "#78ff5d",
      canopyColor: "#83ee69",
      emissive: "#b7ff7e",
      emissiveIntensity: 0.46,
      barkWarmth: 1,
      canopyOpacity: 0.5,
      leafScale: 1.18,
      decay: 0,
      glow: true,
      flower: true,
      fruit: true,
    },
  };

  return {
    masteryLevel: level,
    ...states[level],
  };
}


export function branchHealthState(branch: SubjectBranchNode): BranchHealthState {
  const averageMastery =
    branch.leaves.length > 0
      ? branch.leaves.reduce((total, leaf) => total + clamp(leaf.masteryLevel, 0, 5), 0) / branch.leaves.length
      : 0;
  const healthRatio = clamp(averageMastery / 5, 0, 1);

  if (healthRatio >= 0.88) {
    return {
      averageMastery,
      healthRatio,
      state: "radiant",
      barkColor: "#8f6638",
      crackColor: "#5d3a1f",
      canopyOpacity: 0.5,
      canopyScale: 1.22,
      restoredPuffCount: 4,
      moteColor: "#d7ff89",
    };
  }

  if (healthRatio >= 0.58) {
    return {
      averageMastery,
      healthRatio,
      state: "living",
      barkColor: "#7e5731",
      crackColor: "#52331e",
      canopyOpacity: 0.42,
      canopyScale: 1.1,
      restoredPuffCount: 3,
      moteColor: "#abdf69",
    };
  }

  if (healthRatio >= 0.22) {
    return {
      averageMastery,
      healthRatio,
      state: "recovering",
      barkColor: "#684229",
      crackColor: "#3d2519",
      canopyOpacity: 0.28,
      canopyScale: 0.96,
      restoredPuffCount: 1,
      moteColor: "#e38a3b",
    };
  }

  return {
    averageMastery,
    healthRatio,
    state: "decayed",
    barkColor: "#3f2b20",
    crackColor: "#17110d",
    canopyOpacity: 0.16,
    canopyScale: 0.78,
    restoredPuffCount: 0,
    moteColor: "#3b2a22",
  };
}


export function subjectVisualTheme(subjectKey: string): SubjectVisualTheme {
  const normalized = subjectKey.trim().toLowerCase();
  if (normalized.includes("math")) {
    return {
      subjectKey: normalized || "math",
      motif: "number-bead",
      primary: "#ffd765",
      accent: "#54b8ff",
      secondary: "#ff8f3d",
    };
  }
  if (normalized.includes("reading") || normalized.includes("writing") || normalized.includes("language")) {
    return {
      subjectKey: normalized || "reading",
      motif: "letter-petal",
      primary: "#f7d7ff",
      accent: "#8a61ff",
      secondary: "#ffd36b",
    };
  }
  if (normalized.includes("science")) {
    return {
      subjectKey: normalized || "science",
      motif: "science-orbit",
      primary: "#9cecff",
      accent: "#46c889",
      secondary: "#ffe16e",
    };
  }
  if (normalized.includes("social") || normalized.includes("history") || normalized.includes("civic")) {
    return {
      subjectKey: normalized || "social-studies",
      motif: "civic-compass",
      primary: "#b7d2ff",
      accent: "#f0b35b",
      secondary: "#8ad3a4",
    };
  }
  return {
    subjectKey: normalized || "learning",
    motif: "learning-spark",
    primary: "#d7ff79",
    accent: "#74c9ff",
    secondary: "#ffd36b",
  };
}


function hashToken(token: string) {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash << 5) - hash + token.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}


function shiftHexColor(hex: string, lightness = 0, saturation = 0, hue = 0) {
  const color = new THREE.Color(hex);
  color.offsetHSL(hue, saturation, lightness);
  return `#${color.getHexString()}`;
}


function toWorldX(value: number) {
  return value * WORLD_SCALE;
}


function toWorldY(value: number) {
  return -value * WORLD_SCALE;
}


function branchDepth(branch: SubjectBranchNode) {
  const hashed = hashToken(branch.subjectKey || String(branch.id));
  const offset = (hashed % 7) - 3;
  const sideBias = branch.anchorX >= 0 ? 0.35 : -0.35;
  return offset * 0.22 + sideBias;
}


function leafDepth(leaf: LeafNode, branchZ: number) {
  const hashed = hashToken(leaf.subtopicKey || String(leaf.id));
  return branchZ + ((hashed % 5) - 2) * 0.18;
}


function sceneTopY(grades: GradeBand[]) {
  const worldHeights = grades.flatMap((grade) => [
    toWorldY(grade.barkY),
    ...grade.branches.flatMap((branch) => [
      toWorldY(branch.anchorY),
      ...branch.leaves.map((leaf) => toWorldY(leaf.y)),
    ]),
  ]);

  return worldHeights.length > 0 ? Math.max(...worldHeights) + 2.8 : DEFAULT_TOP_Y;
}


function overallTreeHealth(grades: GradeBand[]) {
  const leaves = grades.flatMap((grade) => grade.branches).flatMap((branch) => branch.leaves);
  if (leaves.length === 0) {
    return 0;
  }

  return clamp(leaves.reduce((total, leaf) => total + clamp(leaf.masteryLevel, 0, 5), 0) / (leaves.length * 5), 0, 1);
}


function mixPoint(start: Point3, end: Point3, t: number): Point3 {
  return [
    THREE.MathUtils.lerp(start[0], end[0], t),
    THREE.MathUtils.lerp(start[1], end[1], t),
    THREE.MathUtils.lerp(start[2], end[2], t),
  ];
}


function quadraticBezierPoint(start: Point3, control: Point3, end: Point3, t: number): Point3 {
  const invT = 1 - t;
  return [
    invT * invT * start[0] + 2 * invT * t * control[0] + t * t * end[0],
    invT * invT * start[1] + 2 * invT * t * control[1] + t * t * end[1],
    invT * invT * start[2] + 2 * invT * t * control[2] + t * t * end[2],
  ];
}


function segmentTransform(start: Point3, end: Point3) {
  const startVector = new THREE.Vector3(...start);
  const endVector = new THREE.Vector3(...end);
  const direction = endVector.clone().sub(startVector);
  const length = direction.length();
  const midpoint = startVector.clone().add(endVector).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );

  return {
    midpoint: midpoint.toArray() as Point3,
    quaternion,
    length,
  };
}


function branchPlaqueButtonStyle(accentColor: string): CSSProperties {
  return {
    minWidth: "6.8rem",
    padding: "0.16rem 0.5rem",
    borderRadius: "16px",
    background: `linear-gradient(180deg, ${shiftHexColor(accentColor, 0.12, 0.05)} 0%, ${shiftHexColor(accentColor, -0.08, -0.02)} 100%)`,
    border: `1px solid ${shiftHexColor(accentColor, -0.2, -0.04)}`,
    boxShadow: "0 8px 18px rgba(61, 35, 17, 0.2)",
    color: "#fff8e2",
    cursor: "pointer",
    fontFamily: "\"Trebuchet MS\", Verdana, sans-serif",
    fontSize: "0.64rem",
    fontWeight: 800,
    letterSpacing: "0.05em",
    pointerEvents: "auto",
    textShadow: "0 1px 0 rgba(66, 37, 18, 0.34)",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
}


function buildLeafGeometry(width: number, height: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, height * 0.6);
  shape.bezierCurveTo(width * 0.44, height * 0.42, width * 0.62, -height * 0.1, 0, -height * 0.64);
  shape.bezierCurveTo(-width * 0.62, -height * 0.1, -width * 0.44, height * 0.42, 0, height * 0.6);
  return new THREE.ShapeGeometry(shape, 22);
}


function pickRandomLeaf(branch: SubjectBranchNode) {
  if (branch.leaves.length === 0) {
    return null;
  }

  return branch.leaves[Math.floor(Math.random() * branch.leaves.length)] ?? null;
}


function BranchSegment({
  color,
  end,
  radiusBottom,
  radiusTop,
  start,
}: {
  color: string;
  end: Point3;
  radiusBottom: number;
  radiusTop: number;
  start: Point3;
}) {
  const { length, midpoint, quaternion } = useMemo(
    () => segmentTransform(start, end),
    [end[0], end[1], end[2], start[0], start[1], start[2]],
  );

  return (
    <mesh castShadow position={midpoint} quaternion={quaternion} receiveShadow>
      <cylinderGeometry args={[radiusTop, radiusBottom, Math.max(length, 0.01), 12]} />
      <meshStandardMaterial color={color} roughness={0.94} />
    </mesh>
  );
}


function CurvedBranch({
  color,
  control,
  end,
  radiusBottom,
  radiusTop,
  start,
  steps = 6,
}: {
  color: string;
  control: Point3;
  end: Point3;
  radiusBottom: number;
  radiusTop: number;
  start: Point3;
  steps?: number;
}) {
  const segments = useMemo(
    () =>
      Array.from({ length: steps }, (_, index) => {
        const startT = index / steps;
        const endT = (index + 1) / steps;
        return {
          key: `${index}-${start.join(",")}-${end.join(",")}`,
          start: quadraticBezierPoint(start, control, end, startT),
          end: quadraticBezierPoint(start, control, end, endT),
          radiusBottom: THREE.MathUtils.lerp(radiusBottom, radiusTop, startT),
          radiusTop: THREE.MathUtils.lerp(radiusBottom, radiusTop, endT),
        };
      }),
    [
      control[0],
      control[1],
      control[2],
      end[0],
      end[1],
      end[2],
      radiusBottom,
      radiusTop,
      start[0],
      start[1],
      start[2],
      steps,
    ],
  );

  return (
    <group>
      {segments.map((segment) => (
        <BranchSegment
          key={segment.key}
          color={color}
          end={segment.end}
          radiusBottom={segment.radiusBottom}
          radiusTop={segment.radiusTop}
          start={segment.start}
        />
      ))}
    </group>
  );
}


function TreeCameraRig({
  motionRef,
  topY,
}: {
  motionRef: MutableRefObject<CameraMotionState>;
  topY: number;
}) {
  const { camera } = useThree();
  const desiredPosition = useRef(new THREE.Vector3(0, 2.4, 12.5));
  const desiredLookAt = useRef(new THREE.Vector3(0, 0.5, 0));

  useFrame((_, delta) => {
    const motion = motionRef.current;
    motion.progress = THREE.MathUtils.damp(motion.progress, motion.targetProgress, 4.8, delta);

    const rise = THREE.MathUtils.lerp(0, topY, motion.progress);
    const canopyDrift = THREE.MathUtils.lerp(0, 1.8, motion.progress);
    const zoomOut = THREE.MathUtils.lerp(12.5, 20.5, motion.progress);

    desiredPosition.current.set(canopyDrift, rise + 2.5, zoomOut);
    desiredLookAt.current.set(0, rise + 0.9, 0);

    camera.position.lerp(desiredPosition.current, 1 - Math.exp(-delta * 4.4));
    motion.lookAt.lerp(desiredLookAt.current, 1 - Math.exp(-delta * 5.1));
    camera.lookAt(motion.lookAt);
  });

  return null;
}


function WorldBackdrop({ healthRatio, topY }: { healthRatio: number; topY: number }) {
  const worldMidY = (TRUNK_BASE_Y + topY) / 2;
  const worldHeight = topY - TRUNK_BASE_Y + 8;
  const skyColor = healthRatio > 0.55 ? "#bfe9ff" : "#9db4c5";
  const glowColor = healthRatio > 0.55 ? "#fff1a3" : "#6c6255";
  const hillColor = healthRatio > 0.55 ? "#7aa35d" : "#48533c";
  const forestColor = healthRatio > 0.55 ? "#476b3e" : "#242820";
  const cloudOpacity = 0.18 + healthRatio * 0.18;
  const moteOpacity = 0.16 + healthRatio * 0.32;
  const clouds = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        position: [
          -9.4 + (index % 4) * 6.2 + (index % 2) * 0.7,
          TRUNK_BASE_Y + 2.2 + index * Math.max(worldHeight / 13, 0.8),
          -9.4 - (index % 3) * 0.28,
        ] as Point3,
        scale: [1.9 + (index % 3) * 0.48, 0.46 + (index % 2) * 0.18, 0.22] as Point3,
      })),
    [worldHeight],
  );
  const motes = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => ({
        position: [
          -5.8 + ((index * 37) % 116) / 10,
          TRUNK_BASE_Y + 0.8 + ((index * 53) % Math.max(Math.floor(worldHeight * 12), 1)) / 12,
          -3.2 - (index % 4) * 0.36,
        ] as Point3,
        radius: 0.018 + (index % 4) * 0.008,
      })),
    [worldHeight],
  );
  const forestBands = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => ({
        position: [
          -8.8 + index * 1.18,
          TRUNK_BASE_Y + 0.28 + Math.sin(index * 0.84) * 0.24,
          -7.1 - (index % 2) * 0.16,
        ] as Point3,
        scale: [0.5 + (index % 3) * 0.12, 1.1 + (index % 4) * 0.24, 0.18] as Point3,
      })),
    [],
  );

  return (
    <group>
      <mesh position={[0, worldMidY, -11.2]}>
        <planeGeometry args={[28, worldHeight]} />
        <meshBasicMaterial color={skyColor} opacity={0.32} transparent />
      </mesh>

      <mesh position={[2.8, topY + 1.8, -10.7]}>
        <circleGeometry args={[3.8, 36]} />
        <meshBasicMaterial color={glowColor} opacity={0.16 + healthRatio * 0.18} transparent />
      </mesh>

      <mesh position={[-4.9, TRUNK_BASE_Y + 1.1, -8.6]} scale={[7.8, 1.42, 0.18]}>
        <sphereGeometry args={[1, 18, 10]} />
        <meshBasicMaterial color={hillColor} opacity={0.42} transparent />
      </mesh>
      <mesh position={[4.2, TRUNK_BASE_Y + 0.72, -8.8]} scale={[8.8, 1.18, 0.18]}>
        <sphereGeometry args={[1, 18, 10]} />
        <meshBasicMaterial color={shiftHexColor(hillColor, -0.08, -0.05)} opacity={0.38} transparent />
      </mesh>

      {forestBands.map((band, index) => (
        <mesh key={`forest-band-${index}`} position={band.position} scale={band.scale}>
          <coneGeometry args={[0.74, 1.9, 5]} />
          <meshBasicMaterial color={forestColor} opacity={0.34} transparent />
        </mesh>
      ))}

      {clouds.map((cloud, index) => (
        <mesh key={`soft-cloud-${index}`} position={cloud.position} scale={cloud.scale}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshBasicMaterial color="#fff9df" opacity={cloudOpacity} transparent />
        </mesh>
      ))}

      {motes.map((mote, index) => (
        <mesh key={`world-mote-${index}`} position={mote.position}>
          <sphereGeometry args={[mote.radius, 8, 8]} />
          <meshBasicMaterial color={healthRatio > 0.5 ? "#f8ffac" : "#8d765f"} opacity={moteOpacity} transparent />
        </mesh>
      ))}
    </group>
  );
}


function GroundPlane() {
  const grassTufts = useMemo(
    () =>
      Array.from({ length: 22 }, (_, index) => {
        const angle = index * 0.77;
        const distance = 1.4 + (index % 8) * 0.42;
        return {
          position: [Math.cos(angle) * distance, TRUNK_BASE_Y - 0.34, Math.sin(angle) * distance] as Point3,
          rotation: [0, angle, (index % 2 === 0 ? 1 : -1) * 0.18] as Point3,
          color: index % 3 === 0 ? "#6f854b" : "#83925c",
        };
      }),
    [],
  );

  return (
    <group>
      <mesh position={[0, TRUNK_BASE_Y - 0.48, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[20, 56]} />
        <meshStandardMaterial color="#9faf82" roughness={1} />
      </mesh>

      <mesh position={[0, TRUNK_BASE_Y - 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[11.5, 42]} />
        <meshStandardMaterial color="#d5dfaa" opacity={0.88} roughness={1} transparent />
      </mesh>

      <mesh position={[0, TRUNK_BASE_Y - 0.43, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8.2, 10.6, 42]} />
        <meshStandardMaterial color="#a6c872" opacity={0.34} roughness={1} transparent />
      </mesh>

      {grassTufts.map((tuft, index) => (
        <group key={`ground-foliage-${index}`} position={tuft.position} rotation={tuft.rotation}>
          <mesh position={[0, 0.16, 0]} rotation={[0, 0, 0.2]}>
            <coneGeometry args={[0.045, 0.34, 5]} />
            <meshStandardMaterial color={tuft.color} roughness={0.94} />
          </mesh>
          <mesh position={[0.08, 0.12, 0.04]} rotation={[0.18, 0, -0.28]}>
            <coneGeometry args={[0.038, 0.28, 5]} />
            <meshStandardMaterial color="#53613d" roughness={0.94} />
          </mesh>
        </group>
      ))}
    </group>
  );
}


function StorybookTrunk({ topY }: { topY: number }) {
  const trunkHeight = topY - TRUNK_BASE_Y + 3.4;
  const midPoint = useMemo<Point3>(() => [0.06, TRUNK_BASE_Y + trunkHeight * 0.46, 0.04], [trunkHeight]);
  const lowerControl = useMemo<Point3>(() => [-0.1, TRUNK_BASE_Y + trunkHeight * 0.18, -0.06], [trunkHeight]);
  const upperControl = useMemo<Point3>(() => [0.14, TRUNK_BASE_Y + trunkHeight * 0.78, 0.06], [trunkHeight]);
  const trunkTop = useMemo<Point3>(() => [-0.05, topY + 2.1, -0.03], [topY]);
  const basePoint = useMemo<Point3>(() => [0, TRUNK_BASE_Y - 0.38, 0], []);
  const barkRidges = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const side = index % 2 === 0 ? 1 : -1;
        const startY = TRUNK_BASE_Y + trunkHeight * (0.06 + index * 0.045);
        const endY = TRUNK_BASE_Y + trunkHeight * (0.48 + index * 0.052);
        const xOffset = side * (0.2 + (index % 3) * 0.075);
        const zOffset = side * 0.08 + (index % 2) * 0.08;
        return {
          start: [xOffset, startY, zOffset] as Point3,
          control: [xOffset + side * 0.14, (startY + endY) / 2, zOffset + 0.04] as Point3,
          end: [xOffset * 0.62, endY, zOffset - 0.03] as Point3,
          color: index % 3 === 0 ? "#3a2618" : "#8a5d35",
          radiusBottom: index % 3 === 0 ? 0.028 : 0.05,
          radiusTop: index % 3 === 0 ? 0.012 : 0.022,
        };
      }),
    [trunkHeight],
  );
  const scars = useMemo(
    () => [
      { position: [0.34, TRUNK_BASE_Y + trunkHeight * 0.34, 0.28] as Point3, scale: [0.18, 0.05, 0.018] as Point3 },
      { position: [-0.32, TRUNK_BASE_Y + trunkHeight * 0.55, -0.26] as Point3, scale: [0.14, 0.045, 0.018] as Point3 },
      { position: [0.22, TRUNK_BASE_Y + trunkHeight * 0.73, 0.23] as Point3, scale: [0.12, 0.038, 0.016] as Point3 },
    ],
    [trunkHeight],
  );

  return (
    <group>
      <CurvedBranch color="#6d4324" control={lowerControl} end={midPoint} radiusBottom={1.02} radiusTop={0.8} start={basePoint} steps={8} />
      <CurvedBranch color="#6d4324" control={upperControl} end={trunkTop} radiusBottom={0.82} radiusTop={0.54} start={midPoint} steps={8} />

      <CurvedBranch
        color="#835733"
        control={[0.18, TRUNK_BASE_Y + trunkHeight * 0.2, 0.14]}
        end={[0.2, topY + 1.9, 0.18]}
        radiusBottom={0.12}
        radiusTop={0.04}
        start={[0.16, TRUNK_BASE_Y - 0.18, 0.14]}
        steps={5}
      />
      <CurvedBranch
        color="#835733"
        control={[-0.16, TRUNK_BASE_Y + trunkHeight * 0.24, -0.14]}
        end={[-0.18, topY + 1.74, -0.16]}
        radiusBottom={0.1}
        radiusTop={0.035}
        start={[-0.14, TRUNK_BASE_Y - 0.14, -0.1]}
        steps={5}
      />

      {barkRidges.map((ridge, index) => (
        <CurvedBranch
          key={`trunk-ridge-${index}`}
          color={ridge.color}
          control={ridge.control}
          end={ridge.end}
          radiusBottom={ridge.radiusBottom}
          radiusTop={ridge.radiusTop}
          start={ridge.start}
          steps={4}
        />
      ))}

      <mesh castShadow position={[0.12, TRUNK_BASE_Y + trunkHeight * 0.24, 0.2]} receiveShadow>
        <sphereGeometry args={[0.18, 18, 18]} />
        <meshStandardMaterial color="#8b5a35" roughness={0.94} />
      </mesh>
      <mesh castShadow position={[-0.15, TRUNK_BASE_Y + trunkHeight * 0.62, -0.17]} receiveShadow>
        <sphereGeometry args={[0.14, 18, 18]} />
        <meshStandardMaterial color="#8b5a35" roughness={0.94} />
      </mesh>
      {scars.map((scar, index) => (
        <mesh key={`trunk-scar-${index}`} position={scar.position} rotation={[0.16, index % 2 === 0 ? -0.42 : 0.38, 0.24]} scale={scar.scale}>
          <sphereGeometry args={[1, 18, 8]} />
          <meshStandardMaterial color="#24160f" opacity={0.64} roughness={0.98} transparent />
        </mesh>
      ))}

      <CurvedBranch
        color="#7b532f"
        control={[-0.6, TRUNK_BASE_Y - 0.14, 0.42]}
        end={[-1.18, TRUNK_BASE_Y - 0.3, 0.78]}
        radiusBottom={0.18}
        radiusTop={0.06}
        start={[-0.12, TRUNK_BASE_Y - 0.22, 0.18]}
        steps={4}
      />
      <CurvedBranch
        color="#7b532f"
        control={[0.72, TRUNK_BASE_Y - 0.08, 0.12]}
        end={[1.3, TRUNK_BASE_Y - 0.3, 0.58]}
        radiusBottom={0.18}
        radiusTop={0.06}
        start={[0.18, TRUNK_BASE_Y - 0.22, 0.02]}
        steps={4}
      />
      <CurvedBranch
        color="#7b532f"
        control={[0.24, TRUNK_BASE_Y - 0.08, -0.64]}
        end={[0.54, TRUNK_BASE_Y - 0.3, -1.18]}
        radiusBottom={0.16}
        radiusTop={0.05}
        start={[0.04, TRUNK_BASE_Y - 0.22, -0.18]}
        steps={4}
      />
    </group>
  );
}


function FutureGrowthCrown({ topY }: { topY: number }) {
  const crownY = topY + 2.25;
  const puffs = useMemo(
    () => [
      { position: [0, crownY, 0] as Point3, scale: [1.52, 1.08, 1.1] as Point3, color: "#9edc73" },
      { position: [-0.86, crownY - 0.14, 0.24] as Point3, scale: [0.92, 0.72, 0.76] as Point3, color: "#7fc35f" },
      { position: [0.84, crownY - 0.1, -0.16] as Point3, scale: [0.98, 0.72, 0.74] as Point3, color: "#b5e76b" },
      { position: [-0.28, crownY + 0.46, -0.22] as Point3, scale: [0.76, 0.58, 0.6] as Point3, color: "#d5ef79" },
      { position: [0.42, crownY + 0.34, 0.22] as Point3, scale: [0.7, 0.54, 0.58] as Point3, color: "#91d56d" },
    ],
    [crownY],
  );

  return (
    <group>
      {puffs.map((puff, index) => (
        <CanopyPuff key={`future-crown-${index}`} color={puff.color} opacity={0.4} position={puff.position} scale={puff.scale} />
      ))}

      {[-0.72, -0.24, 0.28, 0.76].map((xOffset, index) => (
        <mesh key={`future-bud-${index}`} castShadow position={[xOffset, crownY + 0.2 + (index % 2) * 0.24, 0.34 - index * 0.16]} receiveShadow>
          <sphereGeometry args={[0.11 + index * 0.012, 16, 16]} />
          <meshStandardMaterial color={index % 2 === 0 ? "#ffe56a" : "#c8ff83"} emissive={new THREE.Color("#d7ff73")} emissiveIntensity={0.08} roughness={0.66} />
        </mesh>
      ))}

      <Html position={[0, crownY + 0.78, 0.42]} center sprite transform distanceFactor={12}>
        <div style={gradeLabelStyle}>Future Growth</div>
      </Html>
    </group>
  );
}


function GradeMarker({ grade }: { grade: GradeBand }) {
  const markerY = toWorldY(grade.barkY);

  return (
    <group>
      <mesh position={[0, markerY, 0]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TRUNK_RADIUS + 0.18, 0.08, 10, 28]} />
        <meshStandardMaterial color="#8f6139" roughness={0.92} />
      </mesh>

      <Html position={[0, markerY + 0.65, 0.82]} sprite transform distanceFactor={10}>
        <div style={gradeLabelStyle}>{grade.title}</div>
      </Html>
    </group>
  );
}


function BranchPlaque({
  accentColor,
  label,
  onClick,
  position,
  sign,
}: {
  accentColor: string;
  label: string;
  onClick: (event: { stopPropagation: () => void }) => void;
  position: Point3;
  sign: number;
}) {
  const buttonStyle = useMemo(() => branchPlaqueButtonStyle(accentColor), [accentColor]);
  const stripeColor = useMemo(() => shiftHexColor(accentColor, 0.12, 0.04), [accentColor]);

  return (
    <group position={position} rotation={[0.08, sign > 0 ? -0.22 : 0.22, sign * -0.14]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.76, 0.58, 0.12]} />
        <meshStandardMaterial color="#9b693c" roughness={0.95} />
      </mesh>

      <mesh position={[0, 0, 0.065]}>
        <boxGeometry args={[1.46, 0.18, 0.03]} />
        <meshStandardMaterial color={stripeColor} roughness={0.88} />
      </mesh>

      <mesh castShadow position={[0, -0.36, -0.05]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.26, 10]} />
        <meshStandardMaterial color="#82532d" roughness={0.96} />
      </mesh>

      <Html position={[0, 0, 0.08]} center sprite transform distanceFactor={11}>
        <button type="button" style={buttonStyle} onClick={onClick}>
          {label}
        </button>
      </Html>
    </group>
  );
}


function CanopyPuff({
  color,
  opacity = 0.24,
  position,
  scale,
}: {
  color: string;
  opacity?: number;
  position: Point3;
  scale: Point3;
}) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[0.7, 18, 18]} />
      <meshStandardMaterial color={color} opacity={opacity} roughness={1} transparent />
    </mesh>
  );
}


function LeafMesh({
  branchAnchor,
  branchZ,
  isActive,
  leaf,
  onLeafAnnounce,
  onLeafSelect,
  visualRules,
}: {
  branchAnchor: Point3;
  branchZ: number;
  isActive: boolean;
  leaf: LeafNode;
  onLeafAnnounce?: (text: string) => void;
  onLeafSelect?: (leaf: LeafNode) => void;
  visualRules: GradeVisualRules;
}) {
  const [hovered, setHovered] = useState(false);
  const windRef = useRef<THREE.Group | null>(null);

  const leafPosition = useMemo<Point3>(() => {
    const z = leafDepth(leaf, branchZ);
    return [toWorldX(leaf.x), toWorldY(leaf.y), z];
  }, [branchZ, leaf.id, leaf.subtopicKey, leaf.x, leaf.y]);

  const twigMidpoint = useMemo<Point3>(() => {
    const midpointX = THREE.MathUtils.lerp(branchAnchor[0], leafPosition[0], 0.56);
    const midpointY = Math.max(branchAnchor[1], leafPosition[1]) + 0.22;
    const midpointZ = THREE.MathUtils.lerp(branchAnchor[2], leafPosition[2], 0.48);
    return [midpointX, midpointY, midpointZ];
  }, [branchAnchor, leafPosition]);

  const rejuvenation = masteryRejuvenationState(leaf.masteryLevel);
  const leafWidth = Math.max(leaf.radius * WORLD_SCALE * 1.92 * visualRules.leafScale * rejuvenation.leafScale, 0.42);
  const leafHeight = Math.max(leaf.radius * WORLD_SCALE * 1.46 * visualRules.leafScale * rejuvenation.leafScale, 0.36);
  const hitRadius = Math.max(leaf.hitRadius * WORLD_SCALE * 0.66 * visualRules.hitRadiusScale, 0.72);
  const showLabel = hovered || isActive;
  const leafColor = rejuvenation.color;
  const twigColor = leaf.masteryLevel <= 0 ? "#38241a" : leaf.masteryLevel <= 2 ? "#643928" : "#7b522e";
  const windOffset = useMemo(() => hashToken(`${leaf.id}-${leaf.subtopicKey}`) * 0.013, [leaf.id, leaf.subtopicKey]);
  const targetScale = hovered ? 1.14 : isActive ? 1.07 : 1;
  const leafGeometry = useMemo(() => buildLeafGeometry(leafWidth, leafHeight), [leafHeight, leafWidth]);
  const companionLeaves = useMemo<LeafClusterCompanion[]>(() => {
    const seed = hashToken(`${leaf.id}-${leaf.title}`);
    const sign = seed % 2 === 0 ? 1 : -1;
    const companions: LeafClusterCompanion[] = [
      {
        color: shiftHexColor(leafColor, -0.08, -0.04),
        offset: [sign * leafWidth * 0.46, leafHeight * 0.18, -0.08],
        rotation: [0.06, 0.14, -0.64 * sign],
        scale: 0.78,
      },
      {
        color: shiftHexColor(leafColor, 0.06, 0.02),
        offset: [-sign * leafWidth * 0.34, leafHeight * 0.36, -0.12],
        rotation: [0.08, -0.12, 0.36 * sign],
        scale: 0.72,
      },
      {
        color: shiftHexColor(leafColor, -0.15, -0.08),
        offset: [sign * leafWidth * 0.12, -leafHeight * 0.18, -0.16],
        rotation: [0.16, 0.18, -0.12],
        scale: 0.64,
      },
      {
        color: shiftHexColor(leafColor, 0.12, 0.05),
        offset: [-sign * leafWidth * 0.6, -leafHeight * 0.04, -0.18],
        rotation: [0.2, -0.22, 0.82 * sign],
        scale: 0.52,
      },
    ];
    const companionLimit = Math.min(visualRules.companionLeafCount, Math.max(0, leaf.masteryLevel));
    return companions.slice(0, companionLimit);
  }, [leaf.id, leaf.masteryLevel, leaf.title, leafColor, leafHeight, leafWidth, visualRules.companionLeafCount]);
  const glowScale = rejuvenation.glow ? 1 : 0;
  const [{ scale, shadowScale }, springApi] = useSpring(() => ({
    scale: 1,
    shadowScale: 1.02,
    config: {
      mass: 0.78,
      tension: 320,
      friction: 14,
    },
  }));

  useEffect(() => {
    void springApi.start({
      scale: targetScale,
      shadowScale: 1.02 + (targetScale - 1) * 0.45,
      config: {
        mass: 0.8,
        tension: 320,
        friction: 14,
      },
    });
  }, [springApi, targetScale]);

  useEffect(
    () => () => {
      leafGeometry.dispose();
    },
    [leafGeometry],
  );

  useFrame((state) => {
    const leafGroup = windRef.current;
    if (!leafGroup) {
      return;
    }

    const elapsed = state.clock.elapsedTime + windOffset;
    leafGroup.position.set(
      leafPosition[0],
      leafPosition[1] + Math.sin(elapsed * 1.1) * 0.05,
      leafPosition[2] + Math.cos(elapsed * 0.62) * 0.03,
    );
    leafGroup.rotation.z = -0.18 + Math.sin(elapsed * 1.18) * 0.09;
    leafGroup.rotation.x = Math.cos(elapsed * 0.82) * 0.05;
  });

  const announceLeaf = () => {
    onLeafAnnounce?.(leaf.title);
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    announceLeaf();
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(false);
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    announceLeaf();
  };

  const handleClick = async (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onLeafSelect?.(leaf);
    announceLeaf();

    const settleScale = hovered ? 1.14 : isActive ? 1.07 : 1;
    await springApi.start({
      scale: 0.84,
      shadowScale: 0.9,
      config: {
        mass: 0.45,
        tension: 560,
        friction: 12,
      },
    });
    await springApi.start({
      scale: settleScale * 1.14,
      shadowScale: 1.12 + (settleScale - 1) * 0.38,
      config: {
        mass: 0.55,
        tension: 420,
        friction: 11,
      },
    });
    await springApi.start({
      scale: settleScale,
      shadowScale: 1.02 + (settleScale - 1) * 0.45,
      config: {
        mass: 0.8,
        tension: 320,
        friction: 14,
      },
    });
  };

  return (
    <group>
      <CurvedBranch
        color={twigColor}
        control={mixPoint(branchAnchor, leafPosition, 0.38)}
        end={twigMidpoint}
        radiusBottom={0.05 * visualRules.branchRadiusScale}
        radiusTop={0.032 * visualRules.branchRadiusScale}
        start={branchAnchor}
        steps={visualRules.twigSteps}
      />
      <CurvedBranch
        color={twigColor}
        control={mixPoint(twigMidpoint, leafPosition, 0.5)}
        end={leafPosition}
        radiusBottom={0.032 * visualRules.branchRadiusScale}
        radiusTop={0.018 * visualRules.branchRadiusScale}
        start={twigMidpoint}
        steps={visualRules.twigSteps}
      />

      {glowScale > 0 ? (
        <animated.mesh
          geometry={leafGeometry}
          position={[leafPosition[0], leafPosition[1], leafPosition[2] - 0.12]}
          rotation={[0.14, 0, -0.22]}
          scale={shadowScale.to((value) => [value * 1.45, value * 1.45, 1])}
        >
          <meshBasicMaterial color={rejuvenation.emissive} opacity={0.2} side={THREE.DoubleSide} transparent />
        </animated.mesh>
      ) : null}

      <group ref={windRef} position={leafPosition}>
        {leaf.masteryLevel === 0 ? (
          <group position={[0, leafHeight * 0.08, 0.05]}>
            <mesh scale={[0.66, 0.9, 0.72]}>
              <sphereGeometry args={[leafWidth * 0.22, 14, 14]} />
              <meshStandardMaterial color="#1d140f" roughness={0.94} />
            </mesh>
            <mesh position={[0, leafHeight * 0.14, 0.02]} rotation={[0, 0, 0.24]}>
              <coneGeometry args={[leafWidth * 0.12, leafHeight * 0.32, 6]} />
              <meshStandardMaterial color="#342116" roughness={0.96} />
            </mesh>
          </group>
        ) : null}

        {companionLeaves.map((companionLeaf, index) => (
          <mesh
            key={`${leaf.id}-companion-${index}`}
            geometry={leafGeometry}
            position={companionLeaf.offset}
            rotation={companionLeaf.rotation}
            scale={companionLeaf.scale}
          >
            <meshStandardMaterial color={companionLeaf.color} roughness={0.82} side={THREE.DoubleSide} />
          </mesh>
        ))}

        <animated.mesh
          geometry={leafGeometry}
          position={[0.05, -0.04, -0.04]}
          rotation={[0.1, 0.16, -0.44]}
          scale={shadowScale.to((value) => [value * 1.04, value * 1.04, 1])}
        >
          <meshStandardMaterial color={rejuvenation.decay > 0.45 ? "#1a130e" : "#264915"} opacity={0.18} roughness={0.88} side={THREE.DoubleSide} transparent />
        </animated.mesh>

        <animated.mesh geometry={leafGeometry} rotation={[0.08, 0.14, -0.34]} scale={scale.to((value) => [value, value, 1])}>
          <meshStandardMaterial
            color={leafColor}
            emissive={new THREE.Color(rejuvenation.emissive)}
            emissiveIntensity={rejuvenation.emissiveIntensity}
            roughness={0.72 + rejuvenation.decay * 0.18}
            side={THREE.DoubleSide}
          />
        </animated.mesh>

        {leaf.masteryLevel <= 2 ? (
          <mesh position={[-leafWidth * 0.02, leafHeight * 0.06, 0.06]} rotation={[0.08, 0.02, 0.42]}>
            <cylinderGeometry args={[0.012, 0.018, leafHeight * 0.7, 6]} />
            <meshStandardMaterial color="#140d09" opacity={0.46 + rejuvenation.decay * 0.22} roughness={0.92} transparent />
          </mesh>
        ) : null}

        {rejuvenation.flower ? (
          <mesh position={[leafWidth * 0.2, leafHeight * 0.28, 0.08]} scale={rejuvenation.fruit ? 1.18 : 0.92}>
            <sphereGeometry args={[leafWidth * 0.14, 16, 16]} />
            <meshStandardMaterial
              color={rejuvenation.fruit ? "#ffcf45" : "#fff0a8"}
              emissive={rejuvenation.fruit ? new THREE.Color("#ffd35a") : new THREE.Color("#000000")}
              emissiveIntensity={rejuvenation.fruit ? 0.24 : 0}
              roughness={0.58}
            />
          </mesh>
        ) : null}

        {rejuvenation.glow
          ? [-0.32, 0.08, 0.4].map((sparkOffset, index) => (
              <mesh key={`${leaf.id}-spark-${index}`} position={[leafWidth * sparkOffset, leafHeight * (0.42 + index * 0.11), 0.2 + index * 0.04]}>
                <sphereGeometry args={[leafWidth * 0.035, 8, 8]} />
                <meshBasicMaterial color="#e6ff9b" opacity={0.72} transparent />
              </mesh>
            ))
          : null}

        <animated.mesh position={[0.01, -leafHeight * 0.05, 0.01]} rotation={[0.2, -0.08, 0.56]} scale={scale.to((value) => [value, value, 1])}>
          <cylinderGeometry args={[0.014, 0.02, leafHeight * 1.06, 8]} />
          <meshStandardMaterial color={leaf.masteryLevel <= 2 ? "#20130c" : "#214c15"} roughness={0.88} />
        </animated.mesh>

        <mesh
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerOut={handlePointerOut}
          onPointerOver={handlePointerOver}
          position={[0, 0.02, 0.12]}
        >
          <sphereGeometry args={[hitRadius, 16, 16]} />
          <meshBasicMaterial opacity={0} transparent />
        </mesh>

        {showLabel ? (
          <Html position={[0.12, leafHeight * 0.98, 0.16]} sprite transform distanceFactor={10}>
            <div style={leafLabelStyle}>{leaf.title}</div>
          </Html>
        ) : null}
      </group>
    </group>
  );
}


function SubjectMotifCluster({
  anchorPoint,
  branchSign,
  health,
  theme,
}: {
  anchorPoint: Point3;
  branchSign: number;
  health: BranchHealthState;
  theme: SubjectVisualTheme;
}) {
  const opacity = 0.18 + health.healthRatio * 0.38;
  const motifPosition: Point3 = [anchorPoint[0] + branchSign * 1.08, anchorPoint[1] + 0.88, anchorPoint[2] + 0.42];
  const scale = 0.78 + health.healthRatio * 0.42;

  if (theme.motif === "number-bead") {
    return (
      <group position={motifPosition} scale={scale}>
        {[0, 1, 2, 3].map((index) => (
          <mesh key={`math-bead-${index}`} position={[branchSign * (index * 0.18 - 0.28), Math.sin(index * 0.9) * 0.08, 0]}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial color={index % 2 === 0 ? theme.primary : theme.accent} opacity={opacity} roughness={0.7} transparent />
          </mesh>
        ))}
        <mesh rotation={[0, 0, branchSign * 0.42]}>
          <torusGeometry args={[0.34, 0.008, 6, 24]} />
          <meshBasicMaterial color={theme.accent} opacity={opacity * 0.7} transparent />
        </mesh>
      </group>
    );
  }

  if (theme.motif === "letter-petal") {
    return (
      <group position={motifPosition} scale={scale}>
        {[0, 1, 2, 3, 4].map((index) => (
          <mesh key={`letter-petal-${index}`} position={[Math.cos(index * 1.25) * 0.2, Math.sin(index * 1.25) * 0.16, 0]} rotation={[0.12, 0, index * 0.5]}>
            <sphereGeometry args={[0.075, 10, 8]} />
            <meshStandardMaterial color={index % 2 === 0 ? theme.primary : theme.secondary} opacity={opacity} roughness={0.76} transparent />
          </mesh>
        ))}
        <CurvedBranch
          color={theme.accent}
          control={[branchSign * 0.04, 0.16, 0.02]}
          end={[branchSign * 0.42, 0.08, 0]}
          radiusBottom={0.012}
          radiusTop={0.006}
          start={[branchSign * -0.32, -0.08, 0]}
          steps={3}
        />
      </group>
    );
  }

  if (theme.motif === "science-orbit") {
    return (
      <group position={motifPosition} scale={scale}>
        <mesh rotation={[0.7, 0.18, branchSign * 0.4]}>
          <torusGeometry args={[0.28, 0.008, 6, 28]} />
          <meshBasicMaterial color={theme.primary} opacity={opacity} transparent />
        </mesh>
        <mesh rotation={[1.1, 0.46, branchSign * -0.2]}>
          <torusGeometry args={[0.2, 0.006, 6, 28]} />
          <meshBasicMaterial color={theme.accent} opacity={opacity * 0.86} transparent />
        </mesh>
        {[0, 1, 2].map((index) => (
          <mesh key={`science-particle-${index}`} position={[Math.cos(index * 2.1) * 0.25, Math.sin(index * 2.1) * 0.16, 0.04]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color={index === 0 ? theme.secondary : theme.accent} emissive={new THREE.Color(theme.accent)} emissiveIntensity={0.08} opacity={opacity} transparent />
          </mesh>
        ))}
      </group>
    );
  }

  if (theme.motif === "civic-compass") {
    return (
      <group position={motifPosition} scale={scale}>
        <mesh>
          <torusGeometry args={[0.24, 0.008, 6, 28]} />
          <meshBasicMaterial color={theme.primary} opacity={opacity} transparent />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.5, 0.018, 0.018]} />
          <meshStandardMaterial color={theme.accent} opacity={opacity} transparent />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.5, 0.018, 0.018]} />
          <meshStandardMaterial color={theme.secondary} opacity={opacity} transparent />
        </mesh>
      </group>
    );
  }

  return (
    <group position={motifPosition} scale={scale}>
      {[0, 1, 2].map((index) => (
        <mesh key={`learning-spark-${index}`} position={[Math.cos(index * 2.2) * 0.18, Math.sin(index * 2.2) * 0.18, 0]}>
          <sphereGeometry args={[0.042, 8, 8]} />
          <meshBasicMaterial color={theme.primary} opacity={opacity} transparent />
        </mesh>
      ))}
    </group>
  );
}


function BranchMesh({
  branch,
  grade,
  onBranchLaunch,
  onLeafAnnounce,
  onLeafSelect,
  selectedLeafId,
}: {
  branch: SubjectBranchNode;
  grade: GradeBand;
  onBranchLaunch?: (leaf: LeafNode) => void;
  onLeafAnnounce?: (text: string) => void;
  onLeafSelect?: (leaf: LeafNode) => void;
  selectedLeafId: number | string | null;
}) {
  const visualRules = useMemo(() => gradeVisualRules(grade), [grade.sortOrder, grade.title]);
  const health = useMemo(() => branchHealthState(branch), [branch]);
  const theme = useMemo(() => subjectVisualTheme(branch.subjectKey || branch.title), [branch.subjectKey, branch.title]);
  const branchZ = useMemo(() => branchDepth(branch), [branch]);
  const branchSign = branch.anchorX >= 0 ? 1 : -1;
  const trunkPoint = useMemo<Point3>(() => [0, toWorldY(grade.barkY), 0], [grade.barkY]);
  const curvePoint = useMemo<Point3>(
    () => [toWorldX(branch.controlX), toWorldY(branch.controlY), branchZ * 0.54],
    [branch.controlX, branch.controlY, branchZ],
  );
  const anchorPoint = useMemo<Point3>(
    () => [toWorldX(branch.anchorX), toWorldY(branch.anchorY), branchZ],
    [branch.anchorX, branch.anchorY, branchZ],
  );
  const branchWood = useMemo(() => shiftHexColor(health.barkColor, branchSign * 0.005, 0.01), [branchSign, health.barkColor]);
  const canopyColor = useMemo(() => {
    const roundedMastery = Math.round(health.averageMastery);
    const restorationColor = masteryRejuvenationState(roundedMastery).canopyColor;
    return health.state === "radiant" ? shiftHexColor(restorationColor, 0.08, 0.08) : restorationColor;
  }, [health.averageMastery, health.state]);
  const plaquePoint = useMemo<Point3>(
    () => [anchorPoint[0] - branchSign * 0.3, anchorPoint[1] + 0.38, anchorPoint[2] + 0.3],
    [anchorPoint, branchSign],
  );
  const leafOrigins = useMemo<Point3[]>(
    () =>
      branch.leaves.map((leaf, index) => {
        const count = Math.max(branch.leaves.length, 1);
        const spread = count === 1 ? 0.5 : index / (count - 1);
        const arcLift = Math.sin(spread * Math.PI) * 0.34;
        const localSwing = ((hashToken(`${leaf.id}-${leaf.subtopicKey}`) % 7) - 3) * 0.04;
        return [
          anchorPoint[0] + branchSign * THREE.MathUtils.lerp(0.16, 0.92, spread),
          anchorPoint[1] + THREE.MathUtils.lerp(-0.1, 0.62, spread) + arcLift,
          anchorPoint[2] + localSwing,
        ];
      }),
    [anchorPoint, branch.leaves, branchSign],
  );
  const canopyPuffs = useMemo(() => {
    const scaleMultiplier = visualRules.canopyScale * health.canopyScale;
    const basePuffs = [
      {
        color: shiftHexColor(canopyColor, 0.04, 0.02),
        position: [anchorPoint[0] + branchSign * 0.44, anchorPoint[1] + 0.74, anchorPoint[2] - 0.42] as Point3,
        scale: [1.66 * scaleMultiplier, 1.18 * scaleMultiplier, 0.9] as Point3,
        opacity: health.canopyOpacity * 0.72,
      },
      {
        color: shiftHexColor(canopyColor, -0.08, -0.02),
        position: [anchorPoint[0] + branchSign * 0.94, anchorPoint[1] + 0.62, anchorPoint[2] - 0.12] as Point3,
        scale: [1.28 * scaleMultiplier, 0.98 * scaleMultiplier, 0.76] as Point3,
        opacity: health.canopyOpacity,
      },
      {
        color: shiftHexColor(canopyColor, 0.1, 0.04),
        position: [anchorPoint[0] + branchSign * 0.52, anchorPoint[1] + 0.16, anchorPoint[2] + 0.26] as Point3,
        scale: [0.92 * scaleMultiplier, 0.74 * scaleMultiplier, 0.68] as Point3,
        opacity: health.canopyOpacity,
      },
      {
        color: shiftHexColor(canopyColor, -0.02, 0.06),
        position: [anchorPoint[0] + branchSign * 1.22, anchorPoint[1] + 0.2, anchorPoint[2] - 0.08] as Point3,
        scale: [0.72 * scaleMultiplier, 0.58 * scaleMultiplier, 0.58] as Point3,
        opacity: health.canopyOpacity,
      },
      {
        color: shiftHexColor(canopyColor, 0.16, 0.08),
        position: [anchorPoint[0] + branchSign * 0.08, anchorPoint[1] + 0.46, anchorPoint[2] + 0.34] as Point3,
        scale: [0.62 * scaleMultiplier, 0.54 * scaleMultiplier, 0.52] as Point3,
        opacity: health.canopyOpacity,
      },
      {
        color: shiftHexColor(canopyColor, 0.2, 0.1),
        position: [anchorPoint[0] + branchSign * 1.42, anchorPoint[1] + 0.88, anchorPoint[2] - 0.28] as Point3,
        scale: [0.82 * scaleMultiplier, 0.62 * scaleMultiplier, 0.54] as Point3,
        opacity: health.canopyOpacity * 0.9,
      },
      {
        color: shiftHexColor(canopyColor, 0.06, 0.08),
        position: [anchorPoint[0] - branchSign * 0.14, anchorPoint[1] + 0.84, anchorPoint[2] - 0.34] as Point3,
        scale: [0.74 * scaleMultiplier, 0.6 * scaleMultiplier, 0.5] as Point3,
        opacity: health.canopyOpacity * 0.86,
      },
    ];
    return basePuffs.slice(0, visualRules.canopyPuffCount + health.restoredPuffCount);
  }, [
    anchorPoint,
    branchSign,
    canopyColor,
    health.canopyOpacity,
    health.canopyScale,
    health.restoredPuffCount,
    visualRules.canopyPuffCount,
    visualRules.canopyScale,
  ]);

  const handleBranchClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    const randomLeaf = pickRandomLeaf(branch);
    if (!randomLeaf) {
      return;
    }

    onLeafAnnounce?.(randomLeaf.title);
    if (onBranchLaunch) {
      onBranchLaunch(randomLeaf);
      return;
    }

    onLeafSelect?.(randomLeaf);
  };

  return (
    <group>
      <CurvedBranch color={shiftHexColor(branchWood, -0.08, -0.02)} control={mixPoint(trunkPoint, curvePoint, 0.5)} end={curvePoint} radiusBottom={0.2 * visualRules.branchRadiusScale} radiusTop={0.15 * visualRules.branchRadiusScale} start={trunkPoint} steps={visualRules.twigSteps} />
      <CurvedBranch color={branchWood} control={mixPoint(curvePoint, anchorPoint, 0.46)} end={anchorPoint} radiusBottom={0.15 * visualRules.branchRadiusScale} radiusTop={0.1 * visualRules.branchRadiusScale} start={curvePoint} steps={visualRules.twigSteps} />

      {health.state === "decayed" || health.state === "recovering" ? (
        <CurvedBranch
          color={health.crackColor}
          control={mixPoint(curvePoint, anchorPoint, 0.32)}
          end={mixPoint(curvePoint, anchorPoint, 0.78)}
          radiusBottom={0.018 * visualRules.branchRadiusScale}
          radiusTop={0.006 * visualRules.branchRadiusScale}
          start={mixPoint(curvePoint, anchorPoint, 0.18)}
          steps={4}
        />
      ) : null}

      {Array.from({ length: visualRules.detailTwigCount }, (_, index) => {
        const lift = 0.24 + index * 0.18;
        const twigStart = mixPoint(curvePoint, anchorPoint, 0.42 + index * 0.12);
        const twigEnd: Point3 = [
          twigStart[0] + branchSign * (0.34 + index * 0.12),
          twigStart[1] + lift,
          twigStart[2] + (index % 2 === 0 ? 0.22 : -0.22),
        ];
        return (
          <CurvedBranch
            key={`${branch.id}-detail-twig-${index}`}
            color={shiftHexColor(branchWood, 0.03, 0.03)}
            control={mixPoint(twigStart, twigEnd, 0.4)}
            end={twigEnd}
            radiusBottom={0.034 * visualRules.branchRadiusScale}
            radiusTop={0.014 * visualRules.branchRadiusScale}
            start={twigStart}
            steps={3}
          />
        );
      })}

      {canopyPuffs.map((puff, index) => (
        <CanopyPuff key={`${branch.id}-canopy-${index}`} color={puff.color} opacity={puff.opacity} position={puff.position} scale={puff.scale} />
      ))}

      <SubjectMotifCluster anchorPoint={anchorPoint} branchSign={branchSign} health={health} theme={theme} />

      {health.state === "radiant"
        ? [0, 1, 2].map((index) => (
            <mesh key={`${branch.id}-radiant-mote-${index}`} position={[anchorPoint[0] + branchSign * (0.34 + index * 0.36), anchorPoint[1] + 0.98 + index * 0.16, anchorPoint[2] + 0.34]}>
              <sphereGeometry args={[0.036, 8, 8]} />
              <meshBasicMaterial color={health.moteColor} opacity={0.72} transparent />
            </mesh>
          ))
        : null}

      <BranchPlaque accentColor={branch.colorHex} label={branch.title} onClick={handleBranchClick} position={plaquePoint} sign={branchSign} />

      {branch.leaves.map((leaf, index) => {
        const subBranchAnchor = leafOrigins[index];
        const subBranchControl = mixPoint(anchorPoint, subBranchAnchor, 0.48);

        return (
          <group key={leaf.id}>
            <CurvedBranch color={branchWood} control={subBranchControl} end={subBranchAnchor} radiusBottom={0.066 * visualRules.branchRadiusScale} radiusTop={0.038 * visualRules.branchRadiusScale} start={anchorPoint} steps={visualRules.twigSteps} />
            <LeafMesh
              branchAnchor={subBranchAnchor}
              branchZ={branchZ}
              isActive={selectedLeafId === leaf.id}
              leaf={leaf}
              onLeafAnnounce={onLeafAnnounce}
              onLeafSelect={onLeafSelect}
              visualRules={visualRules}
            />
          </group>
        );
      })}
    </group>
  );
}


function TreeScene({
  grades,
  motionRef,
  onBranchLaunch,
  onLeafAnnounce,
  onLeafSelect,
  selectedLeafId,
}: {
  grades: GradeBand[];
  motionRef: MutableRefObject<CameraMotionState>;
  onBranchLaunch?: (leaf: LeafNode) => void;
  onLeafAnnounce?: (text: string) => void;
  onLeafSelect?: (leaf: LeafNode) => void;
  selectedLeafId: number | string | null;
}) {
  const topY = useMemo(() => sceneTopY(grades), [grades]);
  const healthRatio = useMemo(() => overallTreeHealth(grades), [grades]);
  const sceneSky = healthRatio > 0.48 ? "#d6efff" : "#aebbc2";
  const fogFar = healthRatio > 0.48 ? 34 : 28;

  return (
    <>
      <color attach="background" args={[sceneSky]} />
      <fog attach="fog" args={[sceneSky, 13, fogFar]} />

      <ambientLight intensity={1.15} />
      <hemisphereLight color="#fff4c5" groundColor="#5f8252" intensity={1.05} />
      <directionalLight castShadow intensity={1.18} position={[5, 10, 8]} shadow-mapSize-height={2048} shadow-mapSize-width={2048} />
      <directionalLight intensity={0.35} position={[-6, 5, -3]} />

      <TreeCameraRig motionRef={motionRef} topY={topY} />
      <WorldBackdrop healthRatio={healthRatio} topY={topY} />
      <GroundPlane />
      <StorybookTrunk topY={topY} />
      <FutureGrowthCrown topY={topY} />

      {grades.map((grade) => (
        <group key={grade.id}>
          <GradeMarker grade={grade} />
          {grade.branches.map((branch) => (
            <BranchMesh
              key={branch.id}
              branch={branch}
              grade={grade}
              onBranchLaunch={onBranchLaunch}
              onLeafAnnounce={onLeafAnnounce}
              onLeafSelect={onLeafSelect}
              selectedLeafId={selectedLeafId}
            />
          ))}
        </group>
      ))}
    </>
  );
}


export function LearningTreeCanvas({
  grades,
  onBranchLaunch,
  onLeafSelect,
  onLeafAnnounce,
  selectedLeafId = null,
}: LearningTreeCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cameraMotionRef = useRef<CameraMotionState>({
    progress: 0,
    targetProgress: 0,
    dragging: false,
    dragPointerId: -1,
    dragStartY: 0,
    dragStartProgress: 0,
    lookAt: new THREE.Vector3(0, 0.5, 0),
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const motion = cameraMotionRef.current;

    const updateProgress = (nextProgress: number) => {
      motion.targetProgress = clamp(nextProgress, 0, 1);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      updateProgress(motion.targetProgress - event.deltaY * 0.00075);
    };

    const onPointerDown = (event: PointerEvent) => {
      motion.dragging = true;
      motion.dragPointerId = event.pointerId;
      motion.dragStartY = event.clientY;
      motion.dragStartProgress = motion.targetProgress;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!motion.dragging || motion.dragPointerId !== event.pointerId) {
        return;
      }

      const deltaY = event.clientY - motion.dragStartY;
      if (Math.abs(deltaY) < 3) {
        return;
      }

      updateProgress(motion.dragStartProgress - deltaY * 0.0016);
    };

    const stopDragging = (event: PointerEvent) => {
      if (motion.dragPointerId !== event.pointerId) {
        return;
      }

      motion.dragging = false;
      motion.dragPointerId = -1;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        updateProgress(motion.targetProgress + 0.08);
      }

      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        updateProgress(motion.targetProgress - 0.08);
      }

      if (event.key === "Home") {
        event.preventDefault();
        updateProgress(0);
      }

      if (event.key === "End") {
        event.preventDefault();
        updateProgress(1);
      }
    };

    host.addEventListener("wheel", onWheel, { passive: false });
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", stopDragging);
    host.addEventListener("pointercancel", stopDragging);
    host.addEventListener("pointerleave", stopDragging);
    host.addEventListener("keydown", onKeyDown);

    return () => {
      host.removeEventListener("wheel", onWheel);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", stopDragging);
      host.removeEventListener("pointercancel", stopDragging);
      host.removeEventListener("pointerleave", stopDragging);
      host.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-label="Interactive 3D Learning Tree map. Scroll, drag, or use arrow keys to climb the tree."
      className="tree-canvas-shell"
      role="img"
      tabIndex={0}
    >
      <Canvas camera={{ far: 60, fov: 42, near: 0.1, position: [0, 2.5, 12.5] }} dpr={[1, 1.8]} shadows>
        <TreeScene
          grades={grades}
          motionRef={cameraMotionRef}
          onBranchLaunch={onBranchLaunch}
          onLeafAnnounce={onLeafAnnounce}
          onLeafSelect={onLeafSelect}
          selectedLeafId={selectedLeafId}
        />
      </Canvas>
    </div>
  );
}
