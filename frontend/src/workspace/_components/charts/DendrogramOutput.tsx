import {
  memo,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { Output } from '../../_model/output';
import { chartHeight } from './chartSizing';
import { getThemeSnapshot, subscribeTheme } from './chartTheme';

type DendrogramPoint = {
  x?: number;
  y?: number;
};

type DendrogramSegment = {
  color_key?: string;
  points?: DendrogramPoint[];
};

type DendrogramLabel = {
  label?: string;
  position?: number;
};

type Props = {
  output: Output;
  collectionMode?: boolean;
};

const BRANCH_COLOR_VARIABLES = [
  '--theme-primary',
  '--theme-success',
  '--theme-warning',
  '--theme-secondary',
  '--theme-danger',
];

function finite(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cssColor(styles: CSSStyleDeclaration, name: string, fallback: string) {
  return styles.getPropertyValue(name).trim() || fallback;
}

function colorIndex(colorKey: string, fallback: number) {
  const parsed = Number(colorKey.replace(/[^0-9]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function drawDendrogram(
  canvas: HTMLCanvasElement,
  output: Output,
  compact: boolean,
) {
  const segments = (output.segments as DendrogramSegment[] | undefined) || [];
  const labels = (output.labels as DendrogramLabel[] | undefined) || [];
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const pixelRatio = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
  const nextWidth = Math.round(width * pixelRatio);
  const nextHeight = Math.round(height * pixelRatio);

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const styles = getComputedStyle(document.documentElement);
  const textColor = cssColor(styles, '--theme-text', 'CanvasText');
  const mutedColor = cssColor(styles, '--theme-text-muted', 'GrayText');
  const gridColor = cssColor(styles, '--theme-divider', 'ButtonBorder');
  const fontFamily = cssColor(styles, '--theme-font-family', 'sans-serif');
  const fontSize = compact ? 9 : 11;
  context.font = `${fontSize}px ${fontFamily}`;

  const maximumLabelWidth = labels.reduce(
    (maximum, item) => Math.max(
      maximum,
      context.measureText(String(item.label || '')).width,
    ),
    0,
  );
  const labelWidth = Math.min(
    compact ? 96 : 180,
    Math.max(compact ? 48 : 62, maximumLabelWidth + 12),
  );
  const plotLeft = labelWidth + (compact ? 8 : 12);
  const plotRight = Math.max(plotLeft + 40, width - (compact ? 10 : 18));
  const plotTop = compact ? 10 : 16;
  const plotBottom = Math.max(plotTop + 40, height - (compact ? 24 : 34));
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;
  const maximumDistance = Math.max(
    1e-12,
    finite(output.maximum_distance, 0),
    ...segments.flatMap((segment) => (
      segment.points || []
    ).map((point) => finite(point.x, 0))),
  );
  const maximumPosition = Math.max(
    10,
    ...labels.map((item) => finite(item.position, 0)),
  ) + 5;
  const mapX = (value: unknown) => (
    plotLeft + (finite(value, 0) / maximumDistance) * plotWidth
  );
  const mapY = (value: unknown) => (
    plotTop + (finite(value, 0) / maximumPosition) * plotHeight
  );

  context.save();
  context.strokeStyle = gridColor;
  context.fillStyle = mutedColor;
  context.lineWidth = 1;
  context.globalAlpha = 0.35;
  context.setLineDash([3, 4]);
  context.textAlign = 'center';
  context.textBaseline = 'top';

  for (let index = 0; index <= 5; index += 1) {
    const ratio = index / 5;
    const x = plotLeft + ratio * plotWidth;
    context.beginPath();
    context.moveTo(x, plotTop);
    context.lineTo(x, plotBottom);
    context.stroke();
    context.globalAlpha = 0.8;
    context.fillText(
      (ratio * maximumDistance).toLocaleString('en-US', {
        maximumFractionDigits: 3,
      }),
      x,
      plotBottom + 6,
    );
    context.globalAlpha = 0.35;
  }
  context.restore();

  const branchColors = BRANCH_COLOR_VARIABLES.map((variable, index) => (
    cssColor(
      styles,
      variable,
      ['Highlight', 'LinkText', 'Mark', 'AccentColor', 'VisitedText'][index],
    )
  ));

  segments.forEach((segment, segmentIndex) => {
    const points = (segment.points || []).filter((point) => (
      Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))
    ));
    if (points.length < 2) return;

    const index = colorIndex(String(segment.color_key || ''), segmentIndex);
    context.beginPath();
    context.moveTo(mapX(points[0].x), mapY(points[0].y));
    for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
      context.lineTo(mapX(points[pointIndex].x), mapY(points[pointIndex].y));
    }
    context.strokeStyle = branchColors[index % branchColors.length];
    context.lineWidth = compact ? 1.25 : 1.6;
    context.globalAlpha = 0.95;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
  });

  context.globalAlpha = 1;
  context.fillStyle = textColor;
  context.font = `${fontSize}px ${fontFamily}`;
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  const minimumLabelGap = compact ? 11 : 14;
  let previousLabelY = Number.NEGATIVE_INFINITY;

  labels.forEach((item) => {
    const y = mapY(item.position);
    if (y - previousLabelY < minimumLabelGap) return;
    previousLabelY = y;
    const label = String(item.label || '');
    context.save();
    context.beginPath();
    context.rect(0, y - minimumLabelGap, labelWidth, minimumLabelGap * 2);
    context.clip();
    context.fillText(label, plotLeft - 5, y);
    context.restore();
  });
}

const DendrogramOutput = memo(function DendrogramOutput({
  output,
  collectionMode = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const themeKey = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeSnapshot,
  );
  const height = chartHeight(output);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    let frame = 0;
    const scheduleDraw = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        drawDendrogram(canvas, output, collectionMode);
      });
    };
    const resizeObserver = new ResizeObserver(scheduleDraw);
    resizeObserver.observe(container);
    scheduleDraw();

    return () => {
      resizeObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      canvas.width = 1;
      canvas.height = 1;
    };
  }, [collectionMode, output, themeKey]);

  return (
    <div
      ref={containerRef}
      className="amchart-wrap dendrogram-canvas-wrap"
      style={{ height }}
      data-chart-kind="dendrogram"
      data-theme-key={themeKey}
    >
      <canvas
        ref={canvasRef}
        className="dendrogram-canvas"
        role="img"
        aria-label={String(output.title || 'Clustering dendrogram')}
      />
    </div>
  );
});

export default DendrogramOutput;
