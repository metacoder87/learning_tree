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


function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}


function masteryLeafColor(masteryLevel: number) {
  if (masteryLevel >= 5) {
    return "#6cff57";
  }
  if (masteryLevel === 4) {
    return "#2fa84f";
  }
  if (masteryLevel === 3) {
    return "#ffdf4d";
  }
  if (masteryLevel === 2) {
    return "#ffa62b";
  }
  if (masteryLevel === 1) {
    return "#e14b4b";
  }
  return "#8a5b31";
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


function GroundPlane() {
  return (
    <group>
      <mesh position={[0, TRUNK_BASE_Y - 0.48, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[20, 56]} />
        <meshStandardMaterial color="#bed89d" roughness={1} />
      </mesh>

      <mesh position={[0, TRUNK_BASE_Y - 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[11.5, 42]} />
        <meshStandardMaterial color="#dff0ba" opacity={0.88} roughness={1} transparent />
      </mesh>

      <mesh position={[0, TRUNK_BASE_Y - 0.43, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8.2, 10.6, 42]} />
        <meshStandardMaterial color="#a6c872" opacity={0.34} roughness={1} transparent />
      </mesh>
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

      <mesh castShadow position={[0.12, TRUNK_BASE_Y + trunkHeight * 0.24, 0.2]} receiveShadow>
        <sphereGeometry args={[0.18, 18, 18]} />
        <meshStandardMaterial color="#8b5a35" roughness={0.94} />
      </mesh>
      <mesh castShadow position={[-0.15, TRUNK_BASE_Y + trunkHeight * 0.62, -0.17]} receiveShadow>
        <sphereGeometry args={[0.14, 18, 18]} />
        <meshStandardMaterial color="#8b5a35" roughness={0.94} />
      </mesh>

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
  position,
  scale,
}: {
  color: string;
  position: Point3;
  scale: Point3;
}) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[0.7, 18, 18]} />
      <meshStandardMaterial color={color} opacity={0.24} roughness={1} transparent />
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
}: {
  branchAnchor: Point3;
  branchZ: number;
  isActive: boolean;
  leaf: LeafNode;
  onLeafAnnounce?: (text: string) => void;
  onLeafSelect?: (leaf: LeafNode) => void;
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

  const leafWidth = Math.max(leaf.radius * WORLD_SCALE * 1.92, 0.5);
  const leafHeight = Math.max(leaf.radius * WORLD_SCALE * 1.46, 0.42);
  const hitRadius = Math.max(leaf.hitRadius * WORLD_SCALE * 0.66, 0.72);
  const showLabel = hovered || isActive;
  const leafColor = masteryLeafColor(leaf.masteryLevel);
  const windOffset = useMemo(() => hashToken(`${leaf.id}-${leaf.subtopicKey}`) * 0.013, [leaf.id, leaf.subtopicKey]);
  const targetScale = hovered ? 1.14 : isActive ? 1.07 : 1;
  const leafGeometry = useMemo(() => buildLeafGeometry(leafWidth, leafHeight), [leafHeight, leafWidth]);
  const companionLeaves = useMemo<LeafClusterCompanion[]>(() => {
    const seed = hashToken(`${leaf.id}-${leaf.title}`);
    const sign = seed % 2 === 0 ? 1 : -1;
    return [
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
    ];
  }, [leaf.id, leaf.title, leafColor, leafHeight, leafWidth]);
  const glowScale = leaf.masteryLevel >= 5 ? 1 : 0;
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
      <CurvedBranch color="#7b522e" control={mixPoint(branchAnchor, leafPosition, 0.38)} end={twigMidpoint} radiusBottom={0.05} radiusTop={0.032} start={branchAnchor} steps={4} />
      <CurvedBranch color="#7b522e" control={mixPoint(twigMidpoint, leafPosition, 0.5)} end={leafPosition} radiusBottom={0.032} radiusTop={0.018} start={twigMidpoint} steps={4} />

      {glowScale > 0 ? (
        <animated.mesh
          geometry={leafGeometry}
          position={[leafPosition[0], leafPosition[1], leafPosition[2] - 0.12]}
          rotation={[0.14, 0, -0.22]}
          scale={shadowScale.to((value) => [value * 1.45, value * 1.45, 1])}
        >
          <meshBasicMaterial color="#c8ff85" opacity={0.16} side={THREE.DoubleSide} transparent />
        </animated.mesh>
      ) : null}

      <group ref={windRef} position={leafPosition}>
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
          <meshStandardMaterial color="#264915" opacity={0.18} roughness={0.88} side={THREE.DoubleSide} transparent />
        </animated.mesh>

        <animated.mesh geometry={leafGeometry} rotation={[0.08, 0.14, -0.34]} scale={scale.to((value) => [value, value, 1])}>
          <meshStandardMaterial
            color={leafColor}
            emissive={leaf.masteryLevel >= 5 ? new THREE.Color("#6cff57") : new THREE.Color("#000000")}
            emissiveIntensity={leaf.masteryLevel >= 5 ? 0.2 : 0}
            roughness={0.76}
            side={THREE.DoubleSide}
          />
        </animated.mesh>

        <animated.mesh position={[0.01, -leafHeight * 0.05, 0.01]} rotation={[0.2, -0.08, 0.56]} scale={scale.to((value) => [value, value, 1])}>
          <cylinderGeometry args={[0.014, 0.02, leafHeight * 1.06, 8]} />
          <meshStandardMaterial color="#214c15" roughness={0.88} />
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
  const branchWood = useMemo(() => shiftHexColor("#7a4a26", branchSign * 0.005, 0.01), [branchSign]);
  const canopyColor = useMemo(() => shiftHexColor(branch.colorHex || "#8ccb5e", 0.12, 0.02), [branch.colorHex]);
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
  const canopyPuffs = useMemo(
    () => [
      {
        color: shiftHexColor(canopyColor, 0.04, 0.02),
        position: [anchorPoint[0] + branchSign * 0.44, anchorPoint[1] + 0.74, anchorPoint[2] - 0.14] as Point3,
        scale: [1.46, 1.08, 0.96] as Point3,
      },
      {
        color: shiftHexColor(canopyColor, -0.08, -0.02),
        position: [anchorPoint[0] + branchSign * 0.94, anchorPoint[1] + 0.62, anchorPoint[2] + 0.18] as Point3,
        scale: [1.18, 0.92, 0.82] as Point3,
      },
      {
        color: shiftHexColor(canopyColor, 0.1, 0.04),
        position: [anchorPoint[0] + branchSign * 0.52, anchorPoint[1] + 0.16, anchorPoint[2] + 0.26] as Point3,
        scale: [0.92, 0.74, 0.68] as Point3,
      },
    ],
    [anchorPoint, branchSign, canopyColor],
  );

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
      <CurvedBranch color="#714423" control={mixPoint(trunkPoint, curvePoint, 0.5)} end={curvePoint} radiusBottom={0.2} radiusTop={0.15} start={trunkPoint} steps={5} />
      <CurvedBranch color={branchWood} control={mixPoint(curvePoint, anchorPoint, 0.46)} end={anchorPoint} radiusBottom={0.15} radiusTop={0.1} start={curvePoint} steps={5} />

      {canopyPuffs.map((puff, index) => (
        <CanopyPuff key={`${branch.id}-canopy-${index}`} color={puff.color} position={puff.position} scale={puff.scale} />
      ))}

      <BranchPlaque accentColor={branch.colorHex} label={branch.title} onClick={handleBranchClick} position={plaquePoint} sign={branchSign} />

      {branch.leaves.map((leaf, index) => {
        const subBranchAnchor = leafOrigins[index];
        const subBranchControl = mixPoint(anchorPoint, subBranchAnchor, 0.48);

        return (
          <group key={leaf.id}>
            <CurvedBranch color="#7a4e29" control={subBranchControl} end={subBranchAnchor} radiusBottom={0.066} radiusTop={0.038} start={anchorPoint} steps={4} />
            <LeafMesh
              branchAnchor={subBranchAnchor}
              branchZ={branchZ}
              isActive={selectedLeafId === leaf.id}
              leaf={leaf}
              onLeafAnnounce={onLeafAnnounce}
              onLeafSelect={onLeafSelect}
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

  return (
    <>
      <color attach="background" args={["#d6efff"]} />
      <fog attach="fog" args={["#d6efff", 13, 34]} />

      <ambientLight intensity={1.15} />
      <hemisphereLight color="#fff4c5" groundColor="#5f8252" intensity={1.05} />
      <directionalLight castShadow intensity={1.18} position={[5, 10, 8]} shadow-mapSize-height={2048} shadow-mapSize-width={2048} />
      <directionalLight intensity={0.35} position={[-6, 5, -3]} />

      <TreeCameraRig motionRef={motionRef} topY={topY} />
      <GroundPlane />
      <StorybookTrunk topY={topY} />

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
