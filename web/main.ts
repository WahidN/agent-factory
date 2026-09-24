import * as THREE from "three";
import type { PlainMessage, ServerMessage, SessionState } from "../server/types.ts";
import { cityActivity, eventModeForTime } from "./city-activity.ts";
import { claimedUpTo } from "./city-plan.ts";
import { CityEvents } from "./city-events.ts";
import {
  createFilterPanel,
  EMPTY_FILTER,
  jumpTarget,
  matchesFilter,
  optionsFrom,
  pruneFilter,
  type Filter,
} from "./filter.ts";
import { InstancedLots, type FarLot } from "./instanced-lots.ts";
import { createLadderDialog, type UserTotal } from "./ladder-dialog.ts";
import { INK_STYLE_ENABLED } from "./ink-style.ts";
import { LandmarkLabels } from "./landmark-labels.ts";
import { detailCapFrom, REDISTRIBUTE_INTERVAL_MS, selectDetailed, shouldRedistribute } from "./lod.ts";
import { Lot } from "./lot.ts";
import { flattenBatch } from "./message-logic.ts";
import { tierFor } from "./model-tier.ts";
import { accentFor, WALL_TINTS } from "./palette.ts";
import { Park } from "./park.ts";
import { movingCarCount, parkBounds, wallTintIndexFor } from "./park-layout.ts";
import { PlotAllocator, plotPosition } from "./plots.ts";
import { RiverBoats } from "./river-boats.ts";
import { createScene } from "./scene.ts";
import { showcaseRequested, showcaseSessions } from "./showcase.ts";
import { createStatsOverlay, interceptNextRenderer, statsRequested } from "./stats.ts";
import { StreetLife } from "./street-life.ts";
import { createTooltip } from "./tooltip.ts";
import { ParkTraffic } from "./traffic.ts";
import { UrbanMobility } from "./urban-mobility.ts";
import { viewOptionsFrom } from "./view-options.ts";

const RECONNECT_MS = 2000;
const ACTIVITY_CLOCK_CHECK_MS = 30_000;

// The city's activity follows the hour where the park actually stands, not
// the browser's own time zone or UTC.
const hourFormatter = new Intl.DateTimeFormat("nl-NL", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: "Europe/Amsterdam",
});
function amsterdamHour(date: Date): number {
  return Number(hourFormatter.format(date));
}

if (INK_STYLE_ENABLED) document.body.dataset.style = "ink";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const pill = document.querySelector<HTMLElement>("#pill")!;
const hint = document.querySelector<HTMLElement>("#hint")!;
const showcase = showcaseRequested(location.search);
const ladder = createLadderDialog(
  document.querySelector<HTMLElement>("#ladder-button")!,
  document.querySelector<HTMLDialogElement>("#ladder")!,
  document.querySelector<HTMLElement>("#ladder-body")!,
);

// Grab the renderer scene.ts is about to build, only when asked, so a normal
// visit never touches this path.
const rendererCapture = statsRequested(location.search) ? interceptNextRenderer(THREE.WebGLRenderer) : undefined;
const view = createScene(canvas, viewOptionsFrom(location.search));
const plots = new PlotAllocator();
const park = new Park(view.scene);
const traffic = new ParkTraffic();
const boats = new RiverBoats();
const mobility = new UrbanMobility();
const cityEvents = new CityEvents();
const streetLife = new StreetLife();
const labels = new LandmarkLabels(canvas, view.camera);
view.scene.add(traffic.group, boats.group, mobility.group, cityEvents.group, streetLife.group);

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
  if (!pickablesCache) {
    pickablesCache = [...lots.values()]
      .filter((lot) => lot.group.visible) // a filter-hidden lot is not under the pointer
      .flatMap((lot) => lot.pickables());
  }
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
// Set while a batch moves a session in or out of the filter (a status change
// under a status filter), which changes who may hold detail.
let matchChanged = false;
const stats = rendererCapture
  ? createStatsOverlay(rendererCapture.get()!, () => ({ detailed: lots.size, total: sessions.size }))
  : undefined;
let fitted = false;

function upsert(session: SessionState) {
  const previous = sessions.get(session.id);
  if (!previous) {
    changed = true;
    arriving.add(session.id);
    plots.assign(session.id, session.user); // syncPlaces() fills in where, once the batch is in
  } else if (matchesFilter(previous, filter) !== matchesFilter(session, filter)) {
    matchChanged = true;
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
    // The sink takes about a second, and a session can come back inside it: a
    // reporter that reconnects makes the hub drop its sessions and then send
    // them again. Releasing here regardless would take the plot away from the
    // session that is standing on it, leaving it without a road and on the
    // same cell as whoever the repacking moved into its place.
    if (!sessions.has(id)) plots.release(id);
    refocus();
    // The far level was still drawing this lot on its old cell: redistribute()
    // re-selects the detailed set and covers syncFar() for the rest.
    redistribute();
    syncTraffic();
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
  matchChanged = false;

  for (const plain of flattenBatch(message)) {
    applyPlain(plain);
    if (plain.type === "snapshot" && !fitted) {
      fitted = true;
      fitNow = true;
    }
  }
  // The ladder reads from `sessions`, not from `lots`: past the detail cap a
  // session has no Lot, and its user would drop out of the dialog.
  ladder.setTotals(userTotals(sessions.values()));

  if (fitNow)
    refocus(true); // zoom to fit once, after the first snapshot's lots all exist
  else if (changed) refocus();

  // A user or project leaves the dropdown with the last session that named it.
  // The filter lets go of it before anything is drawn against it, or the park
  // stays empty while the panel reads "all".
  const { users, projects } = optionsFrom([...sessions.values()]);
  const pruned = pruneFilter(filter, users, projects);
  const filterChanged = pruned !== filter;
  filter = pruned;
  filterPanel.setOptions(users, projects);

  // Only the set or the filter changing can move a lot between the two detail
  // levels; a plain status change just rides along in the instance data.
  if (changed || filterChanged || matchChanged) redistribute();
  else {
    syncFar();
    refreshActivity();
  }
  if (filterChanged) view.invalidateShadows();
  applyDetailVisibility();
  syncTraffic();
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
  const rankCount = plots.indexes().length;
  for (const id of sessions.keys()) {
    const index = plots.indexOf(id);
    if (index === undefined) continue;
    const place = plotPosition(index);
    places.set(id, place);
    const lot = lots.get(id);
    lot?.relocate(place.x, place.z);
    lot?.setPlot(index, rankCount);
  }
}

function refocus(fit = false) {
  syncPlaces();
  const indexes = plots.indexes();
  const rankCount = indexes.length;
  const claims = claimedUpTo(rankCount);
  const activity = currentActivity();
  park.update(indexes);
  const river = park.riverBounds();
  boats.setRiver(river);
  labels.setCity(rankCount, river);
  traffic.setRoads(indexes);
  mobility.setCity({
    seed: 1944,
    cyclists: Math.min(24, Math.max(0, Math.ceil(rankCount / 3))),
    buses: rankCount >= 50 ? 3 : rankCount >= 18 ? 2 : rankCount > 0 ? 1 : 0,
    train: river !== null,
  });
  mobility.setRoads(indexes);
  cityEvents.setCity(claims, parkBounds(indexes, true), activity);
  streetLife.setCity(claims, activity);
  const { x, z, half } = park.extent();
  view.focus(x, z, half, fit);
}

function currentActivity() {
  const now = new Date();
  return cityActivity(sessions.values(), amsterdamHour(now), eventModeForTime(now));
}

function refreshActivity() {
  const activity = currentActivity();
  cityEvents.setActivity(activity);
  streetLife.setActivity(activity);
  view.invalidateShadows(); // the redrawn tables and market stalls still cast a shadow
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

  // Only sessions the filter keeps can win detail. Ranking the hidden ones too
  // spends the cap on lots nobody sees and leaves the matching ones as
  // instances.
  const points = [...places]
    .filter(([id]) => {
      const session = sessions.get(id);
      return session !== undefined && matchesFilter(session, filter);
    })
    .map(([id, place]) => ({ id, ...place }));
  const wanted = new Set(selectDetailed(view0, points, DETAIL_CAP, new Set(lots.keys())));

  for (const [id, lot] of [...lots]) {
    if (wanted.has(id)) continue;
    lots.delete(id);
    view.scene.remove(lot.group);
    lot.dispose();
  }
  const rankCount = plots.indexes().length;
  for (const id of wanted) {
    if (lots.has(id)) continue;
    const session = sessions.get(id);
    const place = places.get(id);
    if (!session || !place) continue;
    // Settled unless it just arrived: a lot that was already standing as an
    // instance must not replay its rise every time the camera drifts past.
    const rank = plots.indexOf(id) ?? 0;
    const lot = new Lot(session, rank, rankCount, !arriving.has(id));
    lot.group.position.set(place.x, 0, place.z);
    view.scene.add(lot.group);
    lots.set(id, lot);
  }
  arriving.clear();
  pickablesCache = null;
  // A lot promoted here is brand new and therefore visible. The camera can
  // promote one on any frame, long after the filter was set, so the filter has
  // to be applied on this path too and not only in handle() below.
  applyDetailVisibility();
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
  // A relayout moves or resizes far halls, which the shadow map baked before
  // the move; nothing else here changes a shadow caster.
  if (far.sync(entries, performance.now())) view.invalidateShadows();
}

// What each session sends onto the park roads. Rebuilt whenever the session
// set or a session's own state changes (handle(), and once more after a
// lot's sink finishes in remove()'s callback, since ranks can shift then);
// the frame loop just replays this array instead of rebuilding it every tick.
type TrafficInput = { id: string; index: number; cars: number; truck: boolean };
let trafficInputs: TrafficInput[] = [];

// A session the filter hides sends nothing either, so its vehicles shrink away
// instead of driving around an empty plot.
function syncTraffic() {
  trafficInputs = [...sessions]
    .filter(([, session]) => matchesFilter(session, filter))
    .map(([id, session]) => ({
      id,
      index: plots.indexOf(id)!,
      cars: movingCarCount(session.status === "busy", session.subagents),
      truck: session.status === "busy",
    }));
}

// ---------- Token milestones ----------

// One entry per user: the total is the machine's, and every session that user
// runs on it carries the same number. Two machines under one name keep the
// higher total, so a machine still on protocol 2, which sends nothing, does
// not reset the row to 0 on every update it sends.
function userTotals(sessions: Iterable<SessionState>): UserTotal[] {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    totals.set(session.user, Math.max(totals.get(session.user) ?? 0, session.machineTokens ?? 0));
  }
  return [...totals].map(([user, tokens]) => ({ user, tokens })).sort((a, b) => a.user.localeCompare(b.user));
}

// ---------- Filter panel ----------

let filter: Filter = EMPTY_FILTER;

// A hidden lot is simply not drawn: simpler than a dimmed material variant,
// and just as clear at a glance which sessions match.
function applyDetailVisibility() {
  let anyFlipped = false;
  for (const lot of lots.values()) {
    const visible = matchesFilter(lot.state, filter);
    if (lot.group.visible !== visible) {
      lot.group.visible = visible;
      anyFlipped = true;
    }
  }
  if (anyFlipped) {
    pickablesCache = null; // a lot's visibility just changed what the pointer can hit
    view.invalidateShadows(); // and switched a shadow caster on or off
  }
}

const filterPanel = createFilterPanel(
  (next) => {
    filter = next;
    redistribute(); // also applies visibility and ends in syncFar()
    syncTraffic();
    view.invalidateShadows(); // a hidden or revealed lot is a shadow caster switching on or off
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

const tooltip = createTooltip(
  canvas,
  view.camera,
  document.querySelector<HTMLElement>("#tooltip")!,
  pickables,
  view.onCameraChange,
);
let activityClockCheckedAt = 0;
let activeClockHour = amsterdamHour(new Date());

view.onFrame((dt, now) => {
  stats?.recordFrame(now);
  for (const lot of [...lots.values(), ...leaving]) {
    lot.tick(dt, now);
    if (lot.consumeShadowDirty()) view.invalidateShadows();
    if (lot.consumePickablesDirty()) pickablesCache = null;
  }
  far.tick(dt, now);
  if (now - decidedAtMs >= REDISTRIBUTE_INTERVAL_MS && shouldRedistribute(decidedAt, groundCenter())) redistribute();
  // Leaving lots send nothing, so their vehicles shrink away.
  traffic.tick(dt, trafficInputs);
  boats.tick(dt);
  mobility.tick(dt);
  if (now - activityClockCheckedAt >= ACTIVITY_CLOCK_CHECK_MS) {
    activityClockCheckedAt = now;
    const clockHour = amsterdamHour(new Date());
    if (clockHour !== activeClockHour) {
      activeClockHour = clockHour;
      refreshActivity();
    }
  }
  labels.update();
  tooltip.update();
});

if (showcase) {
  handle({ type: "snapshot", sessions: showcaseSessions() });
  pill.classList.add("live");
  pill.textContent = "showcase";
  hint.hidden = true;
} else {
  refocus();
  setLive(false);
  connect();
}
