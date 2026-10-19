import { describe, expect, it } from "vitest";
import { inviteUrl, pathFromAppLink } from "@/src/lib/invite";

describe("pathFromAppLink", () => {
  it("maps web invite links to the join screen", () => {
    expect(pathFromAppLink(inviteUrl("AB12CD"))).toBe("/join?code=AB12CD");
  });

  it("maps the custom scheme", () => {
    expect(pathFromAppLink("chorequest://join?code=AB12CD")).toBe("/join?code=AB12CD");
  });

  it("ignores other sites and junk", () => {
    expect(pathFromAppLink("https://example.com/join?code=X")).toBeNull();
    expect(pathFromAppLink("not a url")).toBeNull();
  });
});
