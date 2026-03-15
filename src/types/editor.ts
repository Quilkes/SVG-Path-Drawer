export type Point = {
  x: number;
  y: number;
};

export type PointType = 'straight' | 'curve';

export type GradientStop = {
  color: string;
  offset: number;
};

export type FillType = 'solid' | 'gradient' | 'none';

export type Shape = {
  id: number;
  name: string;
  kind: 'poly';
  points: Point[];
  pointTypes: PointType[];
  ctrlPoints: Record<number, Point>;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  fillType: FillType;
  gradientStops: GradientStop[];
  /** Original corner points before rounding is applied. Used so radius can be changed non-destructively. */
  basePoints?: Point[];
  /** Per-point corner radius. Key = original point index, value = radius applied. */
  cornerRadii?: Record<number, number>;
};

export type EditorMode = 'edit' | 'addpt' | 'move' | 'scale';
export type RoundMode = 'corner' | 'edge';

export type GuideLine = {
  type: 'h' | 'v';
  x?: number;
  y?: number;
};

export type ViewState = {
  snapToGrid: boolean;
  showGuides: boolean;
  roundMode: RoundMode;
  cornerRadius: number;
  edgeBulge: number;
  edgeBulgeSign: number;
};
