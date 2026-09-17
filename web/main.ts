import * as THREE from "three";
import type { PlainMessage, ServerMessage, SessionState } from "../server/types.ts";
import { createFilterPanel, EMPTY_FILTER, jumpTarget, matchesFilter, optionsFrom, type Filter } from "./filter.ts";
import { InstancedLots, type FarLot } from "./instanced-lots.ts";
import { detailCapFrom, REDISTRIBUTE_INTERVAL_MS, selectDetailed, shouldRedistribute } from "./lod.ts";
import { Lot } from "./lot.ts";
import { flattenBatch } from "./message-logic.ts";
import { tierFor } from "./model-tier.ts";
import { accentFor, WALL_TINTS } from "./palette.ts";
import { Park } from "./park.ts";
import { movingCarCount, wallTintIndexFor } from "./park-layout.ts";
import { PlotAllocator, plotPosition } from "./plots.ts";
import { createScene } from "./scene.ts";
import { createStatsOverlay, interceptNextRenderer, statsRequested } from "./stats.ts";
import { createTooltip } from "./tooltip.ts";
import { ParkTraffic } from "./traffic.ts";

const RECONNECT_MS = 2000;

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const pill = document.querySelector<HTMLElement>("#pill")!;
const hint = document.querySelector<HTMLElement>("#hint")!;

// Grab the renderer scene.ts is about to build, only when asked, so a normal
// visit never touches this path.
const rendererCapture = statsRequested(location.search) ? interceptNextRenderer(THREE.WebGLRenderer) : undefined;
const view = createScene(canvas);
const plots = new PlotAllocator();
const park = new Park(view.scene);
const traffic = new ParkTraffic();
view.scene.add(traffic.group);

// Every session on the park, whether it is drawn in full or as an instance.
const sessions = new Map<string, SessionState>();
// Where each session stands, refilled by syncPlaces() every time the set
// changes, because the packed layout can move a session that did not change.
const places = new Map<string, { x: number; z: number }>();
// Only the nearest few sessions get a full Lot. Everything else comes out of
// the shared instanced meshes, so 150 lots cost the same per frame as 20.
const lots = new Map<string, Lot>();
const leaving = new Set<Lot>();
// Rebuilt only when the detailed set changes, not once per frame: the
// tooltip only needs a fresh list right before it raycasts against it.
let pickablesCache: THREE.Object3D[] | null = null;
function pickables(): THREE.Object3D[] {
  if (!pickablesCache) pickablesCache = [...lots.values()].flatMap((lot) => lot.pickables());
  return pickablesCache;
}
// Sessions that arrived since the last redistribute, so a brand new lot still
// rises out of the ground while one that only swapped level does not.
const arriving = new Set<string>();
const far = new InstancedLots();
view.scene.add(far.group);
const DETAIL_CAP = detailCapFrom(location.search);

let everReceived = false;
// Set while a batch adds or removes sessions, so the park, the camera and the
// detail set are all rebuilt once per batch instead of once per lot.
let changed = false;
const stats = rendererCapture
  ? createStatsOverlay(rendererCapture.get()!, () => ({ detailed: lots.size, total: sessions.size }))
  : undefined;
let fitted = false;

function upsert(session: SessionState) {
  if (!sessions.has(session.id)) {
    changed = true;
    arriving.add(session.id);
    plots.assign(session.id, session.user); // syncPlaces() fills in where, once the batch is in
  }
  sessions.set(session.id, session);
  lots.get(session.id)?.update(session, performance.now());
}

// A detailed lot sinks first; its cell is freed once it is gone. A lot that is
// only an instance has nothing to animate, so its cell is free right away.
function remove(id: string) {
  if (!sessions.delete(id)) return;
  places.delete(id);
  arriving.delete(id);
  changed = true;
  const lot = lots.get(id);
  if (!lot) {
    plots.release(id);
    return;
  }
  lots.delete(id);
  pickablesCache = null;
  leaving.add(lot);
  lot.remove(() => {
    leaving.delete(lot);
    view.scene.remove(lot.group);
    lot.dispose();
    plots.release(id);
    refocus();
  });
}

// A batch holds every message from one server tick, and a lone message counts
// as a batch of one. Lots are applied first, then the park (roads, kerbs,
// lamps, trees) is rebuilt at most once for the whole batch: rebuilding it per
// lot costs 150 full rebuilds on a 150 session snapshot.
function handle(message: ServerMessage) {
  everReceived = true;
  let fitNow = false;
  changed = false;

  for (const plain of flattenBatch(message)) {
    applyPlain(plain);
    if (plain.type === "snapshot" && !fitted) {
      fitted = true;
      fitNow = true;
    }
  }

  if (fitNow)
    refocus(true); // zoom to fit once, after the first snapshot's lots all exist
  else if (changed) refocus();

  // Only the set changing can move a lot between the two detail levels; a
  // plain status change just rides along in the instance data.
  if (changed) redistribute();
  else syncFar();
  applyDetailVisibility();
  const { users, projects } = optionsFrom([...sessions.values()]);
  filterPanel.setOptions(users, projects);
}

function applyPlain(message: PlainMessage) {
  if (message.type === "snapshot") {
    const ids = new Set(message.sessions.map((s) => s.id));
    for (const id of [...sessions.keys()]) if (!ids.has(id)) remove(id);
    for (const session of [...message.sessions].sort((a, b) => a.startedAt - b.startedAt)) upsert(session);
    return;
  }
  if (message.type === "session-update") upsert(message.session);
  else remove(message.id);
}

// The layout is packed, so a session arriving or leaving can change the index
// of the ones after it. A session that keeps the place it was given on arrival
// ends up on a cell the park no longer draws a road to, and two of them can
// land on the same cell. Every place is therefore read from the allocator
// again whenever the set changes, which is exactly when this runs. Both the
// detailed lots and the instanced ones read from this map.
function syncPlaces() {
  for (const id of sessions.keys()) {
    const index = plots.indexOf(id);
    if (index === undefined) continue;
    const place = plotPosition(index);
    places.set(id, place);
    lots.get(id)?.group.position.set(place.x, 0, place.z);
  }
}

function refocus(fit = false) {
  syncPlaces();
  park.update(plots.indexes());
  traffic.setRoads(plots.indexes());
  const { x, z, half } = park.extent();
  view.focus(x, z, half, fit);
}

// ---------- Level of detail ----------

const wallColors = new Map<string, THREE.Color>();

function wallColor(user: string): THREE.Color {
  const cached = wallColors.get(user);
  if (cached) return cached;
  const color = new THREE.Color(WALL_TINTS[wallTintIndexFor(user)]);
  wallColors.set(user, color);
  return color;
}

// The point on the ground the camera looks at. scene.ts keeps the orbit target
// on y 0, so the view ray meets the ground exactly where the park is centered
// on screen, whatever the zoom or the orbit angle.
const forward = new THREE.Vector3();
const center = { x: 0, z: 0 };
const decidedAt = { x: Number.NaN, z: Number.NaN };
let decidedAtMs = 0;

function groundCenter(): { x: number; z: number } {
  const camera = view.camera;
  camera.getWorldDirection(forward);
  const along = forward.y === 0 ? 0 : -camera.position.y / forward.y;
  center.x = camera.position.x + forward.x * along;
  center.z = camera.position.z + forward.z * along;
  return center;
}

// Hands the detail to the nearest lots and rebuilds the instanced set. Called
// when the park changes and when the camera has moved a plot or so, never per
// frame: promoting a lot builds its whole structure.
function redistribute() {
  const view0 = groundCenter();
  decidedAt.x = view0.x;
  decidedAt.z = view0.z;
  decidedAtMs = performance.now();

  const points = [...places].map(([id, place]) => ({ id, ...place }));
  const wanted = new Set(selectDetailed(view0, points, DETAIL_CAP, new Set(lots.keys())));

  for (const [id, lot] of [...lots]) {
    if (wanted.has(id)) continue;
    lots.delete(id);
    view.scene.remove(lot.group);
    lot.dispose();
  }
  for (const id of wanted) {
    if (lots.has(id)) continue;
    const session = sessions.get(id);
    const place = places.get(id);
    if (!session || !place) continue;
    // Settled unless it just arrived: a lot that was already standing as an
    // instance must not replay its rise every time the camera drifts past.
    const lot = new Lot(session, !arriving.has(id));
    lot.group.position.set(place.x, 0, place.z);
    view.scene.add(lot.group);
    lots.set(id, lot);
  }
  arriving.clear();
  pickablesCache = null;
  syncFar();
}

// Everything that is not a detailed lot, as instance data.
function syncFar() {
  const entries: FarLot[] = [];
  for (const [id, session] of sessions) {
    if (lots.has(id)) continue;
    if (!matchesFilter(session, filter)) continue; // hidden by the filter panel
    const place = places.get(id);
    if (!place) continue;
    entries.push({
      id,
      tier: tierFor(session.model),
      x: place.x,
      z: place.z,
      wall: wallColor(session.user),
      accent: accentFor(session.project),
      busy: session.status === "busy",
    });
  }
  far.sync(entries, performance.now());
}

// ---------- Filter panel ----------

let filter: Filter = EMPTY_FILTER;

// A hidden lot is simply not drawn: simpler than a dimmed material variant,
// and just as clear at a glance which sessions match.
function applyDetailVisibility() {
  for (const lot of lots.values()) lot.group.visible = matchesFilter(lot.state, filter);
}

const filterPanel = createFilterPanel(
  (next) => {
    filter = next;
    applyDetailVisibility();
    syncFar();
  },
  (user) => {
    const points = [...places]
      .map(([id, place]) => ({ user: sessions.get(id)?.user, ...place }))
      .filter((p): p is { user: string; x: number; z: number } => p.user !== undefined);
    const target = jumpTarget(user, points);
    if (target) view.panTo(target.x, target.z);
  },
);

// ---------- Connection ----------

function setLive(live: boolean) {
  pill.classList.toggle("live", live);
  pill.textContent = live ? "live" : "reconnecting...";
  hint.hidden = live || everReceived;
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${location.host}/ws`);
  socket.onopen = () => setLive(true);
  socket.onmessage = (event) => handle(JSON.parse(event.data));
  socket.onclose = () => {
    setLive(false);
    setTimeout(connect, RECONNECT_MS);
  };
}

// ---------- Frame loop ----------

const tooltip = createTooltip(canvas, view.camera, document.querySelector<HTMLElement>("#tooltip")!, pickables);

view.onFrame((dt, now) => {
  stats?.recordFrame(dt * 1000);
  for (const lot of [...lots.values(), ...leaving]) lot.tick(dt, now);
  far.tick(dt, now);
  if (now - decidedAtMs >= REDISTRIBUTE_INTERVAL_MS && shouldRedistribute(decidedAt, groundCenter())) redistribute();
  // Leaving lots send nothing, so their vehicles shrink away.
  traffic.tick(
    dt,
    [...sessions].map(([id, session]) => ({
      id,
      index: plots.indexOf(id)!,
      cars: movingCarCount(session.status === "busy", session.subagents),
      truck: session.status === "busy",
    })),
  );
  tooltip.update();
});

refocus();
setLive(false);
connect();
