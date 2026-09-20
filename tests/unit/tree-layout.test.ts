import { describe, expect, it } from "vitest";

import {
  getAutoLayoutPositions,
  getBranchPersonIds,
  getFallbackLayoutPositions,
  getFallbackPosition,
} from "@/features/tree/tree-layout";

const people = [
  { id: "P1", position: { x: 100, y: 100 } },
  { id: "P2", position: { x: 200, y: 200 } },
  { id: "P3", position: { x: 300, y: 300 } },
  { id: "P4", position: { x: 400, y: 400 } },
];

const relationships = [
  {
    kind: "parent_child" as const,
    sourcePersonId: "P1",
    targetPersonId: "P2",
  },
  {
    kind: "parent_child" as const,
    sourcePersonId: "P1",
    targetPersonId: "P3",
  },
  {
    kind: "parent_child" as const,
    sourcePersonId: "P2",
    targetPersonId: "P4",
  },
  {
    kind: "partnership" as const,
    sourcePersonId: "P1",
    targetPersonId: "P3",
  },
];

describe("tree layout", () => {
  it("keeps fallback positions deterministic", () => {
    expect(getFallbackPosition(0)).toEqual({ x: 80, y: 80 });
    expect(getFallbackPosition(4)).toEqual({ x: 80, y: 260 });
  });

  it("collects only the selected root and its descendants", () => {
    expect([...getBranchPersonIds(relationships, "P2")].sort()).toEqual([
      "P2",
      "P4",
    ]);
  });

  it("resets only requested unlocked people to fallback positions", () => {
    const positions = getFallbackLayoutPositions(
      people,
      new Set(["P1", "P2", "P3"]),
      new Set(["P2"]),
    );

    expect(positions).toEqual(
      new Map([
        ["P1", { x: 80, y: 80 }],
        ["P3", { x: 600, y: 80 }],
      ]),
    );
  });

  it("auto-layouts descendants by generation while preserving the root anchor", () => {
    const positions = getAutoLayoutPositions(
      people,
      relationships,
      "P1",
      new Map([
        ["P1", { x: 500, y: 120 }],
        ["P2", { x: 0, y: 0 }],
        ["P3", { x: 0, y: 0 }],
        ["P4", { x: 0, y: 0 }],
      ]),
      new Set(),
    );

    expect(positions.get("P2")).toEqual({ x: 370, y: 300 });
    expect(positions.get("P3")).toEqual({ x: 630, y: 300 });
    expect(positions.get("P4")).toEqual({ x: 500, y: 480 });
    expect(positions.has("P1")).toBe(false);
  });

  it("does not move locked descendants during auto-layout", () => {
    const positions = getAutoLayoutPositions(
      people,
      relationships,
      "P1",
      new Map([["P1", { x: 100, y: 100 }]]),
      new Set(["P3"]),
    );

    expect(positions.has("P3")).toBe(false);
    expect(positions.get("P2")).toEqual({ x: 100, y: 280 });
  });
});
