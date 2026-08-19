import { describe, expect, it } from "vitest";
import {
  MIN_INDEXABLE,
  robotsFor,
  segmentIndexability,
} from "@/lib/indexability";

describe("segmentIndexability", () => {
  it("indexes a segment page at or above the threshold", () => {
    expect(segmentIndexability(MIN_INDEXABLE).state).toBe("index");
    expect(segmentIndexability(MIN_INDEXABLE + 10).state).toBe("index");
  });

  it("noindexes a thin segment page below the threshold", () => {
    expect(segmentIndexability(MIN_INDEXABLE - 1).state).toBe("noindex");
    expect(segmentIndexability(0).state).toBe("noindex");
  });
});

describe("robotsFor", () => {
  it("always follows, even when noindexing — link equity still flows", () => {
    expect(robotsFor({ state: "noindex" })).toEqual({ index: false, follow: true });
    expect(robotsFor({ state: "index" })).toEqual({ index: true, follow: true });
  });
});
