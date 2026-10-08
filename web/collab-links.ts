// Pipelines between the plots of users who work in the same project: one
// pipe on poles per link, in the project's accent color, with small blocks
// sliding along it while either end is busy. Three instanced meshes, so three
// draw calls however many links there are.

import * as THREE from "three";
import type { SessionState } from "../server/types.ts";
import { instancedMesh } from "./instancing.ts";
import { accentFor, standard } from "./palette.ts";

export type CollabLink = { project: string; from: string; to: string };

const DEFAULT_MAX_LINKS = 8;
// Above the tallest hall (a Fable roof at 19.2) and its stacks, since a link
// runs from lot centre to lot centre, right over the halls.
const PIPE_HEIGHT = 22;
const PIPE_RADIUS = 0.18;
const POLES_PER_LINK = 3;
const BLOCKS_PER_LINK = 4;
const FLOW_SPEED = 0.2; // fraction of the pipe per second

function oldestFirst(a: SessionState, b: SessionState) {
  return a.startedAt - b.startedAt || a.id.localeCompare(b.id);
}

// Per project with at least two users: each user's oldest session, users
// sorted by name and chained (a-b, b-c). Deterministic for any input order.
export function collabLinks(sessions: readonly SessionState[], maxLinks = DEFAULT_MAX_LINKS): CollabLink[] {
  const byProject = new Map<string, Map<string, SessionState>>();
  for (const session of sessions) {
    const users = byProject.get(session.project) ?? new Map<string, SessionState>();
    byProject.set(session.project, users);
    const current = users.get(session.user);
    if (!current || oldestFirst(session, current) < 0) users.set(session.user, session);
  }
  const links: CollabLink[] = [];
  for (const project of [...byProject.keys()].sort()) {
    const chain = [...(byProject.get(project) as Map<string, SessionState>)]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, session]) => session);
    for (let i = 1; i < chain.length && links.length < maxLinks; i++) {
      links.push({ project, from: chain[i - 1].id, to: chain[i].id });
    }
  }
  return links;
}

export class CollabLinks {
  readonly group = new THREE.Group();
  private readonly pipes: THREE.InstancedMesh;
  private readonly poles: THREE.InstancedMesh;
  private readonly flow: THREE.InstancedMesh;
  // Per drawn link: endpoints and whether it flows. Fixed capacity, no allocation after construction.
  private readonly ends = new Float32Array(DEFAULT_MAX_LINKS * 4);
  private readonly busy = new Uint8Array(DEFAULT_MAX_LINKS);
  private linkCount = 0;
  private time = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly color = new THREE.Color();

  constructor() {
    const pipeGeometry = new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, 1, 6);
    const poleGeometry = new THREE.BoxGeometry(0.3, PIPE_HEIGHT, 0.3);
    poleGeometry.translate(0, PIPE_HEIGHT / 2, 0);
    const blockGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    this.pipes = instancedMesh("collab-pipes", pipeGeometry, standard("#ffffff"), DEFAULT_MAX_LINKS);
    this.poles = instancedMesh("collab-poles", poleGeometry, standard("#6f6a60"), DEFAULT_MAX_LINKS * POLES_PER_LINK);
    this.flow = instancedMesh(
      "collab-flow",
      blockGeometry,
      new THREE.MeshBasicMaterial({ color: "#fff6c8" }),
      DEFAULT_MAX_LINKS * BLOCKS_PER_LINK,
      false,
      false,
    );
    this.group.add(this.pipes, this.poles, this.flow);
    this.group.visible = false;
  }

  update(sessions: readonly SessionState[], positionOf: (id: string) => { x: number; z: number } | null) {
    const byId = new Map(sessions.map((session) => [session.id, session]));
    this.linkCount = 0;
    let poleCount = 0;
    for (const link of collabLinks(sessions, DEFAULT_MAX_LINKS)) {
      const a = positionOf(link.from);
      const b = positionOf(link.to);
      if (!a || !b) continue;
      const i = this.linkCount++;
      this.ends.set([a.x, a.z, b.x, b.z], i * 4);
      this.busy[i] = byId.get(link.from)?.status === "busy" || byId.get(link.to)?.status === "busy" ? 1 : 0;

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dz) || 0.001;
      this.direction.set(dx / length, 0, dz / length);
      this.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, this.direction);
      this.matrix.compose(
        this.position.set((a.x + b.x) / 2, PIPE_HEIGHT, (a.z + b.z) / 2),
        this.quaternion,
        this.scale.set(1, length, 1),
      );
      this.pipes.setMatrixAt(i, this.matrix);
      this.pipes.setColorAt(i, this.color.copy(accentFor(link.project)));

      this.quaternion.identity();
      this.scale.set(1, 1, 1);
      for (let p = 0; p < POLES_PER_LINK; p++) {
        const t = p / (POLES_PER_LINK - 1);
        this.matrix.compose(this.position.set(a.x + dx * t, 0, a.z + dz * t), this.quaternion, this.scale);
        this.poles.setMatrixAt(poleCount++, this.matrix);
      }
    }
    this.pipes.count = this.linkCount;
    this.poles.count = poleCount;
    this.pipes.instanceMatrix.needsUpdate = true;
    this.poles.instanceMatrix.needsUpdate = true;
    if (this.pipes.instanceColor) this.pipes.instanceColor.needsUpdate = true;
    this.group.visible = this.linkCount > 0;
    this.writeFlow();
  }

  tick(dt: number) {
    if (this.linkCount === 0) return;
    this.time += dt * FLOW_SPEED;
    this.writeFlow();
  }

  private writeFlow() {
    let n = 0;
    this.quaternion.identity();
    this.scale.set(1, 1, 1);
    for (let i = 0; i < this.linkCount; i++) {
      if (!this.busy[i]) continue;
      const o = i * 4;
      for (let k = 0; k < BLOCKS_PER_LINK; k++) {
        const t = (this.time + k / BLOCKS_PER_LINK) % 1;
        this.matrix.compose(
          this.position.set(
            this.ends[o] + (this.ends[o + 2] - this.ends[o]) * t,
            PIPE_HEIGHT,
            this.ends[o + 1] + (this.ends[o + 3] - this.ends[o + 1]) * t,
          ),
          this.quaternion,
          this.scale,
        );
        this.flow.setMatrixAt(n++, this.matrix);
      }
    }
    this.flow.count = n;
    this.flow.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const mesh of [this.pipes, this.poles, this.flow]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
    this.group.clear();
  }
}
