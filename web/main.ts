import type { ServerMessage, SessionState } from "../server/types.ts";
import { Lot } from "./lot.ts";
import { Park } from "./park.ts";
import { PlotAllocator, plotPosition } from "./plots.ts";
import { createScene } from "./scene.ts";
import { createTooltip } from "./tooltip.ts";
import { ParkTraffic } from "./traffic.ts";

const RECONNECT_MS = 2000;

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const pill = document.querySelector<HTMLElement>("#pill")!;
const hint = document.querySelector<HTMLElement>("#hint")!;

const view = createScene(canvas);
const plots = new PlotAllocator();
const park = new Park(view.scene);
const traffic = new ParkTraffic();
view.scene.add(traffic.group);

const lots = new Map<string, Lot>();
const leaving = new Set<Lot>();
let everReceived = false;
let fitted = false;

function upsert(session: SessionState) {
  let lot = lots.get(session.id);
  if (!lot) {
    lot = new Lot(session);
    const { x, z } = plotPosition(plots.assign(session.id));
    lot.group.position.set(x, 0, z);
    view.scene.add(lot.group);
    lots.set(session.id, lot);
    refocus();
  }
  lot.update(session, performance.now());
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

function handle(message: ServerMessage) {
  everReceived = true;
  if (message.type === "snapshot") {
    const ids = new Set(message.sessions.map((s) => s.id));
    for (const id of [...lots.keys()]) if (!ids.has(id)) remove(id);
    [...message.sessions].sort((a, b) => a.startedAt - b.startedAt).forEach(upsert);
    // Zoom to fit once, after every lot from the first snapshot exists.
    // Later snapshots (reconnects) keep the user's zoom.
    if (!fitted) {
      fitted = true;
      refocus(true);
    }
  } else if (message.type === "session-update") {
    upsert(message.session);
  } else if (message.type === "session-removed") {
    remove(message.id);
  }
  // Machine names on signs and tooltips only once the park mixes machines.
  const machines = new Set([...lots.values()].map((lot) => lot.state.machine));
  document.body.classList.toggle("many-machines", machines.size > 1);
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
  for (const lot of [...lots.values(), ...leaving]) lot.tick(dt, now);
  // Leaving lots send nothing, so their vehicles shrink away.
  traffic.tick(dt, [...lots].map(([id, lot]) => ({ id, index: plots.indexOf(id)!, ...lot.traffic() })));
  tooltip.update();
});

refocus();
setLive(false);
connect();
