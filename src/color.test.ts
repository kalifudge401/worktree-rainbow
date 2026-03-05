import { describe, it, expect } from "vitest";
import {
  hslToHex,
  hexToRgb,
  darken,
  contrastForeground,
  generateRandomColor,
} from "./color";

describe("hexToRgb", () => {
  it("parses black", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });

  it("parses white", () => {
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
  });

  it("parses arbitrary color", () => {
    expect(hexToRgb("#1a2b3c")).toEqual([0x1a, 0x2b, 0x3c]);
  });
});

describe("hslToHex", () => {
  it("converts red (0, 100, 50)", () => {
    expect(hslToHex(0, 100, 50)).toBe("#ff0000");
  });

  it("converts green (120, 100, 50)", () => {
    expect(hslToHex(120, 100, 50)).toBe("#00ff00");
  });

  it("converts blue (240, 100, 50)", () => {
    expect(hslToHex(240, 100, 50)).toBe("#0000ff");
  });

  it("converts black (0, 0, 0)", () => {
    expect(hslToHex(0, 0, 0)).toBe("#000000");
  });

  it("converts white (0, 0, 100)", () => {
    expect(hslToHex(0, 0, 100)).toBe("#ffffff");
  });

  it("returns 7-character hex string", () => {
    const result = hslToHex(200, 70, 45);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("darken", () => {
  it("darken by 0 returns the same color", () => {
    expect(darken("#ff8800", 0)).toBe("#ff8800");
  });

  it("darken by 1 returns black", () => {
    expect(darken("#ff8800", 1)).toBe("#000000");
  });

  it("darken by 0.5 halves each channel", () => {
    expect(darken("#804020", 0.5)).toBe("#402010");
  });

  it("returns valid hex", () => {
    const result = darken("#123456", 0.3);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("contrastForeground", () => {
  it("returns white for black background", () => {
    expect(contrastForeground("#000000")).toBe("#ffffff");
  });

  it("returns black for white background", () => {
    expect(contrastForeground("#ffffff")).toBe("#000000");
  });

  it("returns white for dark blue", () => {
    expect(contrastForeground("#000080")).toBe("#ffffff");
  });

  it("returns black for yellow", () => {
    expect(contrastForeground("#ffff00")).toBe("#000000");
  });
});

describe("generateRandomColor", () => {
  it("returns valid hex color", () => {
    const color = generateRandomColor();
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns different colors on multiple calls", () => {
    const colors = new Set(Array.from({ length: 20 }, () => generateRandomColor()));
    expect(colors.size).toBeGreaterThan(1);
  });
});
