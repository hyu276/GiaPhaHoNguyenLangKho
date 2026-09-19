import { describe, expect, it } from "vitest";

import {
  createPersonInputSchema,
  updatePersonInputSchema,
} from "@/features/tree/person-input";

const validPerson = {
  displayName: "Nguyễn Văn A",
  description: "  Trưởng chi thứ nhất.  ",
  birthYear: 1940,
  deathYear: 2001,
  visibility: "private" as const,
};

describe("person input validation", () => {
  it("trims text and preserves valid person fields", () => {
    const parsed = createPersonInputSchema.parse(validPerson);

    expect(parsed.displayName).toBe("Nguyễn Văn A");
    expect(parsed.description).toBe("Trưởng chi thứ nhất.");
  });

  it("normalizes a blank description to null", () => {
    const parsed = createPersonInputSchema.parse({
      ...validPerson,
      description: "   ",
    });

    expect(parsed.description).toBeNull();
  });

  it("rejects a birth year after the death year", () => {
    const parsed = createPersonInputSchema.safeParse({
      ...validPerson,
      birthYear: 2005,
      deathYear: 2000,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects out-of-range years and overlong descriptions", () => {
    expect(
      createPersonInputSchema.safeParse({
        ...validPerson,
        birthYear: 0,
      }).success,
    ).toBe(false);

    expect(
      createPersonInputSchema.safeParse({
        ...validPerson,
        description: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("requires a UUID when updating an existing person", () => {
    const parsed = updatePersonInputSchema.safeParse({
      ...validPerson,
      personId: "not-a-uuid",
    });

    expect(parsed.success).toBe(false);
  });
});
