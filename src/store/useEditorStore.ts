import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Shape, Point, EditorMode, ViewState } from "../types/editor";
import {
  getBasePointTypes,
  getRenderToBaseMap,
  rebuildPolyFromBase,
} from "../utils/shapeOps";

interface EditorState {
  shapes: Shape[];
  activeId: number | null;
  selectedPointIndices: Set<number>;
  mode: EditorMode;
  isDragging: boolean;
  isBoxSelecting: boolean;
  grabMode: boolean;
  shapeCounter: number;

  viewState: ViewState;

  history: { shapes: Shape[]; activeId: number | null }[];
  historyIdx: number;

  clipboard: {
    points: Point[];
    types: import("../types/editor").PointType[];
  } | null;

  // Actions
  setMode: (mode: EditorMode) => void;
  setViewState: (updates: Partial<ViewState>) => void;
  setDragging: (isDragging: boolean) => void;
  setBoxSelecting: (isSelecting: boolean) => void;
  setGrabMode: (isGrab: boolean) => void;

  addShape: (shape: Shape) => void;
  removeShape: (id: number) => void;
  updateShape: (id: number, updates: Partial<Shape>) => void;
  setActiveShape: (id: number | null) => void;

  selectPoint: (index: number, multiSelect?: boolean) => void;
  selectAllPoints: () => void;
  deselectAllPoints: () => void;
  removeSelectedPoints: () => void;
  setSelectedPoints: (indices: Set<number>) => void;

  setClipboard: (clip: EditorState["clipboard"]) => void;

  snapshot: () => void;
  undo: () => void;
  redo: () => void;
  clearAll: () => void;
}

const HISTORY_LIMIT = 80;

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      shapes: [],
      activeId: null,
      selectedPointIndices: new Set(),
      mode: "edit",
      isDragging: false,
      isBoxSelecting: false,
      grabMode: false,
      shapeCounter: 0,

      viewState: {
        snapToGrid: false,
        showGuides: true,
        roundMode: "corner",
        cornerRadius: 0,
        zoom: 1,
        panX: 0,
        panY: 0,
        leftSidebarOpen: true,
        rightSidebarOpen: true,
      },

      history: [],
      historyIdx: -1,

      clipboard: null,

      setMode: (mode) =>
        set({ mode, grabMode: false, selectedPointIndices: new Set() }),

      setViewState: (updates) =>
        set((state) => ({
          viewState: { ...state.viewState, ...updates },
        })),

      setDragging: (isDragging) => set({ isDragging }),
      setBoxSelecting: (isBoxSelecting) => set({ isBoxSelecting }),
      setGrabMode: (grabMode) => set({ grabMode }),

      addShape: (shape) =>
        set((state) => {
          const newShapes = [...state.shapes, shape];
          return { shapes: newShapes, shapeCounter: state.shapeCounter + 1 };
        }),

      removeShape: (id) =>
        set((state) => {
          const newShapes = state.shapes.filter((s) => s.id !== id);
          const newActiveId =
            state.activeId === id
              ? newShapes.length
                ? newShapes[newShapes.length - 1].id
                : null
              : state.activeId;
          return {
            shapes: newShapes,
            activeId: newActiveId,
            selectedPointIndices: new Set(),
          };
        }),

      updateShape: (id, updates) =>
        set((state) => ({
          shapes: state.shapes.map((s) =>
            s.id === id ? ({ ...s, ...updates } as Shape) : s,
          ),
        })),

      setActiveShape: (id) =>
        set({ activeId: id, selectedPointIndices: new Set() }),

      selectPoint: (index, multiSelect = false) =>
        set((state) => {
          const newSet = new Set(state.selectedPointIndices);
          if (multiSelect) {
            if (newSet.has(index)) newSet.delete(index);
            else newSet.add(index);
          } else {
            newSet.clear();
            newSet.add(index);
          }
          return { selectedPointIndices: newSet };
        }),

      selectAllPoints: () =>
        set((state) => {
          const activeShape = state.shapes.find((s) => s.id === state.activeId);
          if (!activeShape || activeShape.kind !== "poly") return state;
          const newSet = new Set<number>();
          activeShape.points.forEach((_, i) => newSet.add(i));
          return { selectedPointIndices: newSet };
        }),

      deselectAllPoints: () => set({ selectedPointIndices: new Set() }),

      removeSelectedPoints: () =>
        set((state) => {
          if (state.selectedPointIndices.size === 0) return state;
          const s = state.shapes.find((s) => s.id === state.activeId);
          if (!s || s.kind !== "poly") return state;

          if (s.basePoints && s.cornerRadii) {
            const basePoints = [...s.basePoints];
            const baseTypes = getBasePointTypes(s);
            let cornerRadii: Record<number, number> = { ...s.cornerRadii };
            const renderToBase = getRenderToBaseMap(s);

            const baseIndicesToDelete = new Set<number>();
            state.selectedPointIndices.forEach((idx) => {
              const bi = renderToBase.get(idx);
              if (bi !== undefined) baseIndicesToDelete.add(bi);
            });

            const sortedBase = Array.from(baseIndicesToDelete).sort(
              (a, b) => b - a,
            );
            sortedBase.forEach((bIdx) => {
              basePoints.splice(bIdx, 1);
              baseTypes.splice(bIdx, 1);
              const shifted: Record<number, number> = {};
              Object.entries(cornerRadii).forEach(([k, v]) => {
                const ki = parseInt(k, 10);
                if (ki < bIdx) shifted[ki] = v;
                else if (ki > bIdx) shifted[ki - 1] = v;
              });
              cornerRadii = shifted;
            });

            const nextShape = rebuildPolyFromBase(
              s,
              basePoints,
              baseTypes,
              cornerRadii,
            );

            return {
              shapes: state.shapes.map((shape) =>
                shape.id === s.id ? nextShape : shape,
              ),
              selectedPointIndices: new Set(),
            };
          }

          const newPoints = [...s.points];
          const newTypes = [...s.pointTypes];
          const newCtrl = { ...s.ctrlPoints };
          const sorted = Array.from(state.selectedPointIndices).sort(
            (a, b) => b - a,
          );
          sorted.forEach((idx) => {
            newPoints.splice(idx, 1);
            newTypes.splice(idx, 1);
            delete newCtrl[idx];

            // Re-index remaining ctrl points
            const tempCtrl: Record<number, Point> = {};
            Object.entries(newCtrl).forEach(([k, v]) => {
              const ki = parseInt(k, 10);
              if (ki < idx) tempCtrl[ki] = v;
              else if (ki > idx) tempCtrl[ki - 1] = v;
            });
            Object.keys(newCtrl).forEach(
              (k) => delete newCtrl[parseInt(k, 10)],
            );
            Object.assign(newCtrl, tempCtrl);
          });

          return {
            shapes: state.shapes.map((shape) =>
              shape.id === s.id
                ? ({
                    ...shape,
                    points: newPoints,
                    pointTypes: newTypes,
                    ctrlPoints: newCtrl,
                  } as Shape)
                : shape,
            ),
            selectedPointIndices: new Set(),
          };
        }),

      setSelectedPoints: (indices) =>
        set({ selectedPointIndices: new Set(indices) }),

      setClipboard: (clipboard) => set({ clipboard }),

      snapshot: () =>
        set((state) => {
          // Deep clone shapes to avoid reference mutations in history
          const snap = JSON.parse(
            JSON.stringify({ shapes: state.shapes, activeId: state.activeId }),
          );
          const newHistory = state.history.slice(0, state.historyIdx + 1);
          newHistory.push(snap);
          if (newHistory.length > HISTORY_LIMIT) newHistory.shift();

          return {
            history: newHistory,
            historyIdx: newHistory.length - 1,
          };
        }),

      undo: () =>
        set((state) => {
          if (state.historyIdx <= 0) return state;
          const newIdx = state.historyIdx - 1;
          const snap = state.history[newIdx];
          return {
            shapes: JSON.parse(JSON.stringify(snap.shapes)),
            activeId: snap.activeId,
            selectedPointIndices: new Set(),
            historyIdx: newIdx,
          };
        }),

      redo: () =>
        set((state) => {
          if (state.historyIdx >= state.history.length - 1) return state;
          const newIdx = state.historyIdx + 1;
          const snap = state.history[newIdx];
          return {
            shapes: JSON.parse(JSON.stringify(snap.shapes)),
            activeId: snap.activeId,
            selectedPointIndices: new Set(),
            historyIdx: newIdx,
          };
        }),

      clearAll: () => {
        if (
          window.confirm("Clear the workspace? All unsaved work will be lost.")
        ) {
          set({
            shapes: [],
            activeId: null,
            selectedPointIndices: new Set(),
            history: [],
            historyIdx: -1,
            clipboard: null,
            shapeCounter: 0,
          });
          localStorage.removeItem("svg-path-drawer-storage");
        }
      },
    }),
    {
      name: "svg-path-drawer-storage",
      partialize: (state) => ({
        shapes: state.shapes,
        viewState: state.viewState,
        activeId: state.activeId,
        shapeCounter: state.shapeCounter,
      }),
    },
  ),
);

export const getActiveShape = (state: EditorState) =>
  state.shapes.find((s) => s.id === state.activeId) || null;

export const getActivePolyShape = (state: EditorState) => {
  const s = state.shapes.find((sh) => sh.id === state.activeId);
  return s && s.kind === "poly" ? s : null;
};
