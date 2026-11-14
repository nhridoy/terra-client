import { describe, expect, it } from "vitest";
import {
  hostFormDefaultValues,
  hostFormSchema,
  hostFormSchemaFor,
} from "./hostFormSchema";

const base = {
  ...hostFormDefaultValues,
  name: "h",
  address: "a",
  username: "u",
  password: "pw",
};

const issuePaths = (input: object) => {
  const r = hostFormSchema.safeParse({ ...base, ...input });
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("hostFormSchema connection options", () => {
  it("rejects custom keepalive outside 5-600", () => {
    expect(issuePaths({ keepaliveMode: "custom", keepaliveSecs: 3 })).toContain(
      "keepaliveSecs",
    );
    expect(
      issuePaths({ keepaliveMode: "custom", keepaliveSecs: 601 }),
    ).toContain("keepaliveSecs");
    expect(issuePaths({ keepaliveMode: "custom", keepaliveSecs: 5 })).toEqual(
      [],
    );
  });

  it("rejects invalid env names", () => {
    expect(issuePaths({ env: [{ name: "1X", value: "" }] }).length).toBe(1);
    expect(issuePaths({ env: [{ name: "LANG", value: "C" }] })).toEqual([]);
    expect(issuePaths({ env: [{ name: "", value: "" }] })).toEqual([]);
  });

  it("snippet startup needs a snippet", () => {
    expect(issuePaths({ startupMode: "snippet" })).toContain(
      "startupSnippetId",
    );
    expect(
      issuePaths({ startupMode: "snippet", startupSnippetId: "s1" }),
    ).toEqual([]);
  });
});

describe("hostFormSchema group inheritance", () => {
  it("accepts authType inherit with no password or key", () => {
    expect(
      issuePaths({
        authType: "inherit",
        password: "",
        keyId: "",
        groupId: "g1",
      }),
    ).toEqual([]);
  });

  it("inherit needs a group", () => {
    expect(issuePaths({ authType: "inherit", groupId: "" })).toContain(
      "authType",
    );
  });

  it("username is required unless the group provides one", () => {
    expect(issuePaths({ username: " " })).toContain("username");
    expect(
      hostFormSchemaFor(true).safeParse({ ...base, username: "" }).success,
    ).toBe(true);
  });

  it("accepts the tri-state startup and forwarding modes", () => {
    expect(
      issuePaths({ startupMode: "inherit", forwardAgentMode: "inherit" }),
    ).toEqual([]);
  });
});
