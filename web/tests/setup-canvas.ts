// Several scene modules pull in palette.ts, whose canvas textures call
// document.createElement at module load time. Vitest runs these suites under
// its plain node environment (no jsdom), so this stub goes on globalThis
// before any such module is imported, via vite.config.ts's test.setupFiles.
// It only replaces `document` when nothing else already provided one, so it
// stays out of the way of a real DOM environment.

function fakeCanvas() {
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    fillRect: () => {},
    clearRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
  };
  return { width: 0, height: 0, getContext: () => context };
}

if (!("document" in globalThis)) {
  (globalThis as unknown as { document: { createElement: () => unknown } }).document = {
    createElement: () => fakeCanvas(),
  };
}
