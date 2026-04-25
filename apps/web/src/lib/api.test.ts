import { describe, expect, it } from "vitest";

import { parseSseEvent } from "./api";


describe("parseSseEvent", () => {
  it("parses named JSON events", () => {
    expect(parseSseEvent('event: token\ndata: {"text":"hello"}')).toEqual({
      event: "token",
      data: { text: "hello" },
    });
  });

  it("uses message as the default event name", () => {
    expect(parseSseEvent('data: {"ok":true}')).toEqual({
      event: "message",
      data: { ok: true },
    });
  });
});
