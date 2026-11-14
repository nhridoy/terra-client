// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    entries: async () => [],
    set: async () => {},
    save: async () => {},
  }),
}));
vi.mock("@/lib/db/db");
vi.mock("@/lib/crypto/crypto");
vi.mock("@/stores/auth/authStore", () => ({
  useAuthStore: { getState: () => ({ user: { id: "u1" } }) },
}));

import { useHostStore } from "@/stores/hosts/hostStore";
import { useSettingsStore } from "@/stores/settings/settingsStore";
import { useVaultStore } from "@/stores/vault/vaultStore";
import GroupForm from "./GroupForm";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => useSettingsStore.getState().initSettings());

const roots: Root[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) act(() => r.unmount());
  document.body.innerHTML = "";
});

const click = (el: Element | undefined) => {
  if (!el) throw new Error("element not found");
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};
const byText = (sel: string, text: string) =>
  [...document.querySelectorAll(sel)].find((e) =>
    e.textContent?.includes(text),
  );
const changeInput = (el: Element | null, value: string) =>
  act(() => {
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    set?.call(el, value);
    el?.dispatchEvent(new Event("input", { bubbles: true }));
  });
const submit = async () => {
  await act(async () => {
    document
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
};

async function mount(group?: { id: string; name: string }, decrypted = {}) {
  const createGroup = vi.fn();
  const updateGroup = vi.fn();
  const getDecryptedGroup = vi.fn(async () => ({ ...group, ...decrypted }));
  useHostStore.setState({
    createGroup,
    updateGroup,
    getDecryptedGroup,
    hosts: [],
    groups: [],
  } as never);
  useVaultStore.setState({ currentVaultId: "v1" });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      <GroupForm
        group={group && { ...group, sortOrder: 0, createdAt: "" }}
        onClose={() => {}}
      />,
    );
  });
  return { createGroup, updateGroup };
}

const fillName = (v: string) =>
  changeInput(document.querySelector('input[id$="name"]'), v);

describe("GroupForm", () => {
  it("shows collapsed Credentials and Advanced sections", async () => {
    await mount();
    expect(byText("button", "Credentials")).toBeTruthy();
    expect(byText("button", "Advanced")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Authentication");
    expect(document.body.textContent).not.toContain("On connect");
  });

  it("creates a group with username and password credentials", async () => {
    const { createGroup } = await mount();
    fillName("Prod");
    click(byText("button", "Credentials"));
    changeInput(document.querySelector('input[id$="username"]'), "deploy");
    click(byText("button", "Password"));
    changeInput(document.querySelector('input[type="password"]'), "pw");
    await submit();
    expect(createGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Prod",
        username: "deploy",
        authType: "password",
        password: "pw",
      }),
    );
    const arg = createGroup.mock.calls[0][0];
    expect(arg.keyId).toBeUndefined();
    expect(arg.startup).toBeUndefined();
  });

  it("offers Not set but never From group as an auth method", async () => {
    await mount();
    click(byText("button", "Credentials"));
    expect(byText("button", "Not set")).toBeTruthy();
    expect(document.body.textContent).not.toContain("From group");
  });

  it("requires a password for password auth", async () => {
    const { createGroup } = await mount();
    fillName("Prod");
    click(byText("button", "Credentials"));
    click(byText("button", "Password"));
    await submit();
    expect(document.body.textContent).toContain("Password is required");
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("requires a key for key auth", async () => {
    const { createGroup } = await mount();
    fillName("Prod");
    click(byText("button", "Credentials"));
    click(byText("button", "SSH Key"));
    await submit();
    expect(document.body.textContent).toContain("Please select an SSH key");
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("shows the same env name error as hosts", async () => {
    await mount();
    fillName("Prod");
    click(byText("button", "Advanced"));
    click(byText("button", "Add variable"));
    changeInput(document.querySelector('input[placeholder="LANG"]'), "1X");
    await submit();
    expect(document.body.textContent).toContain("no leading digit");
  });

  it("loads decrypted values when editing and keeps them on save", async () => {
    const { updateGroup } = await mount(
      { id: "g1", name: "Prod" },
      {
        username: "deploy",
        authType: "password",
        password: "pw",
        keepaliveSecs: 30,
        env: [{ name: "LANG", value: "C" }],
        startup: { command: "ls" },
        forwardAgent: true,
      },
    );
    await submit();
    expect(updateGroup).toHaveBeenCalledWith(
      "g1",
      expect.objectContaining({
        name: "Prod",
        username: "deploy",
        authType: "password",
        password: "pw",
        keyId: null,
        keepaliveSecs: 30,
        env: [{ name: "LANG", value: "C" }],
        startup: { command: "ls" },
        forwardAgent: true,
      }),
    );
  });

  it("clears credentials with null when set back to Not set", async () => {
    const { updateGroup } = await mount(
      { id: "g1", name: "Prod" },
      { username: "deploy", authType: "password", password: "pw" },
    );
    click(byText("button", "Credentials"));
    click(byText("button", "Not set"));
    await submit();
    expect(updateGroup).toHaveBeenCalledWith(
      "g1",
      expect.objectContaining({ authType: null, password: null, keyId: null }),
    );
  });
});
