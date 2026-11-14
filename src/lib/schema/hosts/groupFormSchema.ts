import { z } from "zod";
import { envRowsSchema } from "./hostFormSchema";

// Every field except the name is optional: empty means "this group doesn't set it".
export const groupFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Group name is required" })
      .max(255, { error: "Group name must be at most 255 characters" }),
    username: z
      .string()
      .trim()
      .max(255, { error: "Username must be at most 255 characters" })
      .optional(),
    authType: z.enum(["", "password", "key", "both", "none"]),
    password: z.string().max(4096).optional(),
    keyId: z.string().optional(),
    keepaliveMode: z.enum(["default", "off", "custom"]),
    keepaliveSecs: z.coerce.number().optional(),
    forwardAgent: z.enum(["unset", "on", "off"]),
    env: envRowsSchema,
    startupMode: z.enum(["none", "snippet", "command"]),
    startupSnippetId: z.string().optional(),
    startupCommand: z.string().optional(),
  })
  .refine(
    (d) =>
      !(d.authType === "password" || d.authType === "both") || !!d.password,
    { error: "Password is required", path: ["password"] },
  )
  .refine(
    (d) => !(d.authType === "key" || d.authType === "both") || !!d.keyId,
    {
      error: "Please select an SSH key",
      path: ["keyId"],
    },
  )
  .refine(
    (d) =>
      d.keepaliveMode !== "custom" ||
      (Number.isInteger(d.keepaliveSecs) &&
        (d.keepaliveSecs as number) >= 5 &&
        (d.keepaliveSecs as number) <= 600),
    { error: "Keepalive must be 5-600 seconds", path: ["keepaliveSecs"] },
  )
  .refine((d) => d.startupMode !== "snippet" || !!d.startupSnippetId, {
    error: "Select a snippet",
    path: ["startupSnippetId"],
  });

export type GroupFormSchema = z.infer<typeof groupFormSchema>;
export type GroupFormValues = z.input<typeof groupFormSchema>;

export const groupFormDefaultValues: GroupFormValues = {
  name: "",
  username: "",
  authType: "",
  password: "",
  keyId: "",
  keepaliveMode: "default",
  keepaliveSecs: undefined,
  forwardAgent: "unset",
  env: [],
  startupMode: "none",
  startupSnippetId: "",
  startupCommand: "",
};
