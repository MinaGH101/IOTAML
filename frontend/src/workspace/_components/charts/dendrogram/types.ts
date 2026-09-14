import type { Output } from '../../../_model/output';
export type DendrogramPoint = {
    x?: number;
    y?: number;
};
export type DendrogramSegment = {
    color_key?: string;
    points?: DendrogramPoint[];
};
export type DendrogramLabel = {
    label?: string;
    position?: number;
};
export type DendrogramOutputData = Output & {
    segments?: DendrogramSegment[];
    labels?: DendrogramLabel[];
};
export type DendrogramGeometry = {
    compact: boolean;
    width: number;
    height: number;
    labelWidth: number;
    plotLeft: number;
    plotRight: number;
    plotTop: number;
    plotBottom: number;
    plotWidth: number;
    plotHeight: number;
    maximumDistance: number;
    maximumPosition: number;
    mapX: (value: unknown) => number;
    mapY: (value: unknown) => number;
};
