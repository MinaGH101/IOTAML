export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function setBoardInteractionActive(active: boolean) {
  document.documentElement.classList.toggle('analysis-board-interacting', active);
}
