export type Point = {
  x: number;
  y: number;
};

export type PointType = "straight" | "curve";

export type GradientStop = {
  color: string;
  offset: number;
};

export type FillType = "solid" | "gradient" | "none";

/** Base shape properties shared by all kinds */
interface ShapeBase {
  id: number;
  name: string;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  fillType: FillType;
  gradientStops: GradientStop[];
}

/** Polygon / freeform path shape */
export interface PolyShape extends ShapeBase {
  kind: "poly";
  points: Point[];
  pointTypes: PointType[];
  ctrlPoints: Record<number, Point>;
  /** Original corner points before rounding — for non-destructive radius. */
  basePoints?: Point[];
  /** Per-point corner radius. Key = original point index. */
  cornerRadii?: Record<number, number>;
}

/** True circle shape */
export interface CircleShape extends ShapeBase {
  kind: "circle";
  cx: number;
  cy: number;
  r: number;
}

export type Shape = PolyShape | CircleShape;

export type EditorMode = "edit" | "addpt" | "move" | "scale";
export type RoundMode = "corner";

export type GuideLine = {
  type: "h" | "v";
  x?: number;
  y?: number;
};

export type ViewState = {
  snapToGrid: boolean;
  showGuides: boolean;
  roundMode: RoundMode;
  cornerRadius: number;
  /** Current zoom scale (1 = 100%). */
  zoom: number;
  /** Canvas pan offset in screen pixels. */
  panX: number;
  panY: number;
  /** Layout states */
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  zenMode: boolean;
};
