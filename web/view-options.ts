export type ViewOptions = {
  autoFit: boolean;
  fitScale: number;
};

const MIN_FIT_SCALE = 0.5;
const MAX_FIT_SCALE = 1.35;

/** URL-controlled camera behavior for wall displays and overview links. */
export function viewOptionsFrom(search: string): ViewOptions {
  const params = new URLSearchParams(search);
  const requestedScale = Number(params.get("zoom"));
  const fitScale =
    Number.isFinite(requestedScale) && requestedScale > 0
      ? Math.min(MAX_FIT_SCALE, Math.max(MIN_FIT_SCALE, requestedScale))
      : 1;

  return {
    autoFit: params.get("view") === "all",
    fitScale,
  };
}
