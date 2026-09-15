/**
 * CLASSNAME_UTILITIES_TEST
 *
 * Purpose: Verifies shared class merging remains deterministic for shadcn presentation primitives.
 * Connections: Vitest and the shared class-name utility module.
 * Risk: Low because this test covers presentation-only utility behavior.
 */
import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conditional values and resolves conflicting Tailwind utilities", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
  });
});
