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

const WORLD_SCALE = 0.0125;
const TRUNK_BASE_Y = -4.4;
const TRUNK_RADIUS = 0.72;
const DEFAULT_TOP_Y = 10;

const gradeLabelStyle: CSSProperties = {
  padding: "0.42rem 0.72rem",
  borderRadius: "999px",
  background: "rgba(52, 77, 33, 0.82)",
  border: "1px solid rgba(255, 252, 228, 0.55)",
  boxShadow: "0 10px 24px rgba(36, 62, 21, 0.22)",
  color: "#fff8d4",
  fontFamily: "\"Trebuchet MS\", Verdana, sans-serif",
  fontSize: "0.8rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  pointerEvents: "none",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const branchLabelButtonStyle: CSSProperties = {
  padding: "0.28rem 0.52rem",
  borderRadius: "999px",
  background: "rgba(246, 253, 226, 0.92)",
  border: "1px solid rgba(74, 112, 42, 0.28)",
  boxShadow: "0 10px 22px rgba(55, 83, 44, 0.16)",
  color: "#29411f",
  cursor: "pointer",
  fontFamily: "\"Trebuchet MS\", Verdana, sans-serif",
  fontSize: "0.68rem",
  fontWeight: 800,
  letterSpacing: "0.01em",
  pointerEvents: "auto",
  whiteSpace: "nowrap",
};

const leafLabelStyle: CSSProperties = {
  padding: "0.42rem 0.7rem",
  borderRadius: "16px",
  background: "rgba(255, 251, 238, 0.96)",
  border: "1px solid rgba(74, 112, 42, 0.26)",
  boxShadow: "0 14px 26px rgba(39, 69, 28, 0.2)",
  color: "#233719",
  fontFamily: "\"Trebuchet MS\", Verdana, sans-serif",
  fontSize: "0.78rem",
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
    <mesh position={[0, TRUNK_BASE_Y - 0.4, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[18, 48]} />
      <meshStandardMaterial color="#d5e8bd" roughness={1} />
    </mesh>
  );
}


function GradeMarker({ grade }: { grade: GradeBand }) {
  const markerY = toWorldY(grade.barkY);

  return (
    <group>
      <mesh position={[0, markerY, 0]} receiveShadow>
        <cylinderGeometry args={[TRUNK_RADIUS + 0.16, TRUNK_RADIUS + 0.2, 0.24, 20]} />
        <meshStandardMaterial color="#8f6139" roughness={0.92} />
      </mesh>

      <Html position={[0, markerY + 0.65, 0.82]} sprite transform distanceFactor={10}>
        <div style={gradeLabelStyle}>{grade.title}</div>
      </Html>
    </group>
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
  }, [branchZ, leaf]);

  const twigMidpoint = useMemo<Point3>(() => {
    const midpointX = (branchAnchor[0] + leafPosition[0]) * 0.5;
    const midpointY = Math.max(branchAnchor[1], leafPosition[1]) + 0.28;
    const midpointZ = (branchAnchor[2] + leafPosition[2]) * 0.5;
    return [midpointX, midpointY, midpointZ];
  }, [branchAnchor, leafPosition]);

  const leafWidth = Math.max(leaf.radius * WORLD_SCALE * 2.2, 0.52);
  const leafHeight = Math.max(leaf.radius * WORLD_SCALE * 1.62, 0.42);
  const hitRadius = Math.max(leaf.hitRadius * WORLD_SCALE * 0.66, 0.7);
  const glowScale = leaf.masteryLevel >= 5 ? 1 : 0;
  const showLabel = hovered || isActive;
  const leafColor = masteryLeafColor(leaf.masteryLevel);
  const windOffset = useMemo(() => hashToken(`${leaf.id}-${leaf.subtopicKey}`) * 0.013, [leaf.id, leaf.subtopicKey]);
  const targetScale = hovered ? 1.2 : isActive ? 1.1 : 1;
  const [{ scale, shadowScale }, springApi] = useSpring(() => ({
    scale: 1,
    shadowScale: 1.04,
    config: {
      mass: 0.78,
      tension: 320,
      friction: 14,
    },
  }));

  useEffect(() => {
    void springApi.start({
      scale: targetScale,
      shadowScale: 1.04 + (targetScale - 1) * 0.35,
      config: {
        mass: 0.8,
        tension: 320,
        friction: 14,
      },
    });
  }, [springApi, targetScale]);

  useFrame((state) => {
    const leafGroup = windRef.current;
    if (!leafGroup) {
      return;
    }

    const elapsed = state.clock.elapsedTime + windOffset;
    leafGroup.position.set(
      leafPosition[0],
      leafPosition[1] + Math.sin(elapsed * 1.25) * 0.04,
      leafPosition[2] + Math.cos(elapsed * 0.68) * 0.02,
    );
    leafGroup.rotation.z = -0.42 + Math.sin(elapsed * 1.3) * 0.08;
    leafGroup.rotation.x = Math.cos(elapsed * 0.9) * 0.05;
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

    const settleScale = hovered ? 1.2 : isActive ? 1.1 : 1;
    await springApi.start({
      scale: 0.86,
      shadowScale: 0.92,
      config: {
        mass: 0.45,
        tension: 560,
        friction: 12,
      },
    });
    await springApi.start({
      scale: settleScale * 1.18,
      shadowScale: 1.1 + (settleScale - 1) * 0.35,
      config: {
        mass: 0.55,
        tension: 420,
        friction: 11,
      },
    });
    await springApi.start({
      scale: settleScale,
      shadowScale: 1.04 + (settleScale - 1) * 0.35,
      config: {
        mass: 0.8,
        tension: 320,
        friction: 14,
      },
    });
  };

  return (
    <group>
      <BranchSegment color="#8e5b33" end={twigMidpoint} radiusBottom={0.05} radiusTop={0.032} start={branchAnchor} />
      <BranchSegment color="#8e5b33" end={leafPosition} radiusBottom={0.032} radiusTop={0.02} start={twigMidpoint} />

      {glowScale > 0 ? (
        <animated.mesh
          position={[leafPosition[0], leafPosition[1], leafPosition[2] - 0.06]}
          scale={shadowScale.to((value) => [leafWidth * 1.5 * value, leafHeight * 1.45 * value, 1])}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#baff9c" opacity={0.2} side={THREE.DoubleSide} transparent />
        </animated.mesh>
      ) : null}

      <group ref={windRef} position={leafPosition}>
        <animated.mesh position={[0.02, -0.02, -0.02]} scale={shadowScale}>
          <planeGeometry args={[leafWidth * 1.04, leafHeight * 1.04]} />
          <meshStandardMaterial color="#274e13" opacity={0.18} side={THREE.DoubleSide} transparent />
        </animated.mesh>

        <animated.mesh rotation={[0.08, 0.12, -0.42]} scale={scale}>
          <planeGeometry args={[leafWidth, leafHeight]} />
          <meshStandardMaterial
            color={leafColor}
            emissive={leaf.masteryLevel >= 5 ? new THREE.Color("#6cff57") : new THREE.Color("#000000")}
            emissiveIntensity={leaf.masteryLevel >= 5 ? 0.22 : 0}
            roughness={0.82}
            side={THREE.DoubleSide}
          />
        </animated.mesh>

        <animated.mesh position={[0.02, -leafHeight * 0.26, -0.03]} rotation={[0.18, -0.18, 0.58]} scale={scale}>
          <cylinderGeometry args={[0.016, 0.022, leafHeight * 0.92, 8]} />
          <meshStandardMaterial color="#214c15" roughness={0.88} />
        </animated.mesh>

        <mesh
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerOut={handlePointerOut}
          onPointerOver={handlePointerOver}
          position={[0, 0, 0.08]}
        >
          <sphereGeometry args={[hitRadius, 16, 16]} />
          <meshBasicMaterial opacity={0} transparent />
        </mesh>

        {showLabel ? (
          <Html position={[0, leafHeight * 0.82, 0.1]} sprite transform distanceFactor={10}>
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
  const trunkPoint = useMemo<Point3>(() => [0, toWorldY(grade.barkY), 0], [grade.barkY]);
  const curvePoint = useMemo<Point3>(
    () => [toWorldX(branch.controlX), toWorldY(branch.controlY), branchZ * 0.48],
    [branch.controlX, branch.controlY, branchZ],
  );
  const anchorPoint = useMemo<Point3>(
    () => [toWorldX(branch.anchorX), toWorldY(branch.anchorY), branchZ],
    [branch.anchorX, branch.anchorY, branchZ],
  );
  const branchTint = branch.colorHex || "#7a4a26";

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
      <BranchSegment color="#7a4a26" end={curvePoint} radiusBottom={0.18} radiusTop={0.14} start={trunkPoint} />
      <BranchSegment color={branchTint} end={anchorPoint} radiusBottom={0.14} radiusTop={0.09} start={curvePoint} />

      <Html position={[anchorPoint[0], anchorPoint[1] + 0.48, anchorPoint[2] + 0.24]} sprite transform distanceFactor={11}>
        <button type="button" style={branchLabelButtonStyle} onClick={handleBranchClick}>
          {branch.title}
        </button>
      </Html>

      {branch.leaves.map((leaf) => (
        <LeafMesh
          key={leaf.id}
          branchAnchor={anchorPoint}
          branchZ={branchZ}
          isActive={selectedLeafId === leaf.id}
          leaf={leaf}
          onLeafAnnounce={onLeafAnnounce}
          onLeafSelect={onLeafSelect}
        />
      ))}
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
  const trunkHeight = topY - TRUNK_BASE_Y + 3.6;
  const trunkCenterY = TRUNK_BASE_Y + trunkHeight * 0.5;

  return (
    <>
      <color attach="background" args={["#dff4ff"]} />
      <fog attach="fog" args={["#dff4ff", 14, 30]} />

      <ambientLight intensity={1.2} />
      <hemisphereLight color="#fff8ce" groundColor="#6f8d58" intensity={0.95} />
      <directionalLight castShadow intensity={1.1} position={[5, 10, 9]} />

      <TreeCameraRig motionRef={motionRef} topY={topY} />
      <GroundPlane />

      <mesh castShadow position={[0, trunkCenterY, 0]} receiveShadow>
        <cylinderGeometry args={[TRUNK_RADIUS, TRUNK_RADIUS * 1.1, trunkHeight, 18]} />
        <meshStandardMaterial color="#6d4324" roughness={0.98} />
      </mesh>

      <mesh position={[0.22, trunkCenterY, 0.18]}>
        <cylinderGeometry args={[TRUNK_RADIUS * 0.22, TRUNK_RADIUS * 0.28, trunkHeight * 0.96, 10]} />
        <meshStandardMaterial color="#9b7146" opacity={0.34} transparent roughness={0.82} />
      </mesh>

      <mesh castShadow position={[0, TRUNK_BASE_Y - 0.25, 0]} receiveShadow>
        <cylinderGeometry args={[1.18, 0.96, 1.3, 16]} />
        <meshStandardMaterial color="#744b2b" roughness={0.95} />
      </mesh>

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
