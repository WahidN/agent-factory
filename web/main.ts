import * as THREE from "three";
import type { PlainMessage, ServerMessage, SessionState } from "../server/types.ts";
import { Lot } from "./lot.ts";
import { flattenBatch } from "./message-logic.ts";
import { Park } from "./park.ts";
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

const lots = new Map<string, Lot>();
const leaving = new Set<Lot>();
let everReceived = false;
const stats = rendererCapture ? createStatsOverlay(rendererCapture.get()!, () => lots.size) : undefined;
let fitted = false;

// Returns whether a new lot was created, so the caller can refocus once after
// a whole message (or a whole batch) is processed, instead of once per lot.
function upsert(session: SessionState): boolean {
  let lot = lots.get(session.id);
  let added = false;
  if (!lot) {
    lot = new Lot(session);
    const { x, z } = plotPosition(plots.assign(session.id, session.user));
    lot.group.position.set(x, 0, z);
    view.scene.add(lot.group);
    lots.set(session.id, lot);
    added = true;
  }
  lot.update(session, performance.now());
  return added;
}

// The lot sinks first; its cell is freed once it is gone.
function remove(id: string) {
  const lot = lots.get(id);
  if (!lot) return;
  lots.delete(id);
  leaving.add(lot);
  lot.remove(() => {
    leaving.delete(lot);
    view.scene.remove(lot.group);
    lot.dispose();
    plots.release(id);
    refocus();
  });
}

// A batch is every message from one server tick; a lone message is treated as
// a batch of one, so it behaves exactly as before. Either way, lots are
// applied first and the park (roads, kerbs, lamps, trees) is rebuilt at most
// once, not once per lot: a snapshot of 150 sessions used to call refocus 150
// times.
function handle(message: ServerMessage) {
  everReceived = true;
  let added = false;
  let fitNow = false;

  for (const plain of flattenBatch(message)) {
    if (applyPlain(plain)) added = true;
    if (plain.type === "snapshot" && !fitted) {
      fitted = true;
      fitNow = true;
    }
  }

  if (fitNow)
    refocus(true); // zoom to fit once, after the first snapshot's lots all exist
  else if (added) refocus();
}

// Applies one message and reports whether a lot was added (the only case
// that needs the park rebuilt).
function applyPlain(message: PlainMessage): boolean {
  if (message.type === "snapshot") {
    const ids = new Set(message.sessions.map((s) => s.id));
    for (const id of [...lots.keys()]) if (!ids.has(id)) remove(id);
    let added = false;
    for (const session of [...message.sessions].sort((a, b) => a.startedAt - b.startedAt)) {
      if (upsert(session)) added = true;
    }
    return added;
  }
  if (message.type === "session-update") return upsert(message.session);
  remove(message.id);
  return false;
}

// Roads, trees, and traffic follow the used lots; the camera and shadows follow the park.
function refocus(fit = false) {
  park.update(plots.indexes());
  traffic.setRoads(plots.indexes());
  const { x, z, half } = park.extent();
  view.focus(x, z, half, fit);
}

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

const tooltip = createTooltip(canvas, view.camera, document.querySelector<HTMLElement>("#tooltip")!, () =>
  [...lots.values()].flatMap((lot) => lot.pickables()),
);

view.onFrame((dt, now) => {
  stats?.recordFrame(dt * 1000);
  for (const lot of [...lots.values(), ...leaving]) lot.tick(dt, now);
  // Leaving lots send nothing, so their vehicles shrink away.
  traffic.tick(
    dt,
    [...lots].map(([id, lot]) => ({ id, index: plots.indexOf(id)!, ...lot.traffic() })),
  );
  tooltip.update();
});

refocus();
setLive(false);
connect();
