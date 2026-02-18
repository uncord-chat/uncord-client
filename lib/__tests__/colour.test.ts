import { colourFromName } from "@/lib/colour";

describe("colourFromName", () => {
  it("returns a hex colour string", () => {
    const result = colourFromName("Alice");
    expect(result).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("returns deterministic results for the same input", () => {
    const a = colourFromName("Bob");
    const b = colourFromName("Bob");
    expect(a).toBe(b);
  });

  it("returns different colours for different names", () => {
    const names = ["Alice", "Bob", "Charlie", "Diana", "Eve"];
    const colours = names.map(colourFromName);
    const unique = new Set(colours);
    // With 5 names and 8 palette colours, we expect at least 2 distinct values.
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  it("handles empty string without throwing", () => {
    expect(() => colourFromName("")).not.toThrow();
    expect(colourFromName("")).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("handles unicode characters", () => {
    expect(() => colourFromName("\u{1F600} emoji")).not.toThrow();
    expect(colourFromName("\u{1F600} emoji")).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
