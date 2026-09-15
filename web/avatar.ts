// One shared avatar loader for every place that draws a face: the yard sign
// and the hall's light box. Photos live in web/public/avatars/<slug>.png.

// Loads a machine's photo, or null when there is none. Results are cached per
// slug, so 8 lots of the same machine make one request. A 404 is cached too,
// so a photo added later needs a page reload. An empty slug never fetches.
const avatarCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadAvatar(slug: string): Promise<HTMLImageElement | null> {
  if (slug === "") return Promise.resolve(null);
  const cached = avatarCache.get(slug);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `/avatars/${slug}.png`;
  });
  avatarCache.set(slug, promise);
  return promise;
}

// Draws a circular avatar at (cx, cy) with radius r. With an image it is
// cover-fitted and clipped to the circle; without one it is a filled circle in
// `accent` with `initials` centered in white.
export function drawAvatarCircle(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  cx: number,
  cy: number,
  r: number,
  accent: string,
  initials: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  if (image) {
    const size = Math.min(image.width, image.height);
    const sx = (image.width - size) / 2;
    const sy = (image.height - size) / 2;
    ctx.drawImage(image, sx, sy, size, size, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = accent;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${Math.round(r * 0.64)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, cx, cy);
  }

  ctx.restore();
}
