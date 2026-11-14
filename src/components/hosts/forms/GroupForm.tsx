import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useTransition } from "react";
import { type FieldErrors, useForm } from "react-hook-form";
import ModalForm from "@/components/common/ModalForm";
import { Button } from "@/components/ui/Button";
import { FormInput } from "@/components/ui/forms/FormInput";
import {
  type GroupFormValues,
  groupFormDefaultValues,
  groupFormSchema,
} from "@/lib/schema/hosts/groupFormSchema";
import {
  type Group as StoredGroup,
  useHostStore,
} from "@/stores/hosts/hostStore";
import { useKeyStore } from "@/stores/keys/keyStore";
import { useSnippetStore } from "@/stores/snippets/snippetStore";
import { useVaultStore } from "@/stores/vault/vaultStore";
import ConnectionOptionsFields from "./ConnectionOptionsFields";
import CredentialsFields from "./CredentialsFields";

interface Group {
  id: string;
  name: string;
  parentId?: string;
  vaultId?: string;
  sortOrder: number;
  createdAt: string;
}

interface GroupFormProps {
  group?: Group;
  defaultParentId?: string;
  onClose: () => void;
}

function valuesFromGroup(g: StoredGroup): GroupFormValues {
  const startup = g.startup;
  return {
    name: g.name,
    username: g.username ?? "",
    authType: g.authType ?? "",
    password: g.password ?? "",
    keyId: g.keyId ?? "",
    keepaliveMode:
      g.keepaliveSecs == null
        ? "default"
        : g.keepaliveSecs === 0
          ? "off"
          : "custom",
    keepaliveSecs: g.keepaliveSecs || undefined,
    forwardAgent:
      g.forwardAgent == null ? "unset" : g.forwardAgent ? "on" : "off",
    env: g.env ?? [],
    startupMode:
      startup && "snippetId" in startup
        ? "snippet"
        : startup && "command" in startup
          ? "command"
          : "none",
    startupSnippetId:
      startup && "snippetId" in startup ? startup.snippetId : "",
    startupCommand: startup && "command" in startup ? startup.command : "",
  };
}

/** Payload for the store; `unset` is null on update (clears the field) and undefined on create (omits it). */
function payloadFromForm(
  d: GroupFormValues,
  unset: null | undefined,
): Partial<StoredGroup> {
  const auth = d.authType || null;
  const usesPassword = auth === "password" || auth === "both";
  const usesKey = auth === "key" || auth === "both";
  const env = d.env.filter((row) => row.name !== "");
  const command = d.startupCommand?.trim();
  return {
    username: d.username?.trim() || unset,
    authType: auth ?? unset,
    password: (usesPassword && d.password) || unset,
    keyId: (usesKey && d.keyId) || unset,
    keepaliveSecs:
      d.keepaliveMode === "off"
        ? 0
        : d.keepaliveMode === "custom"
          ? Number(d.keepaliveSecs)
          : unset,
    forwardAgent:
      d.forwardAgent === "on" ? true : d.forwardAgent === "off" ? false : unset,
    env: env.length || unset === null ? env : undefined,
    startup:
      d.startupMode === "snippet" && d.startupSnippetId
        ? { snippetId: d.startupSnippetId }
        : d.startupMode === "command" && command
          ? { command }
          : unset,
  };
}

export default function GroupForm({
  group,
  defaultParentId,
  onClose,
}: GroupFormProps) {
  const { createGroup, updateGroup } = useHostStore();
  const { currentVaultId } = useVaultStore();
  const [isPending, startTransition] = useTransition();

  const currentVault = currentVaultId ?? undefined;
  const fetchKeys = useKeyStore((s) => s.fetchKeys);
  const fetchSnippets = useSnippetStore((s) => s.fetchSnippets);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { control, handleSubmit, reset } = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      ...groupFormDefaultValues,
      name: group?.name || groupFormDefaultValues.name,
    },
  });

  useEffect(() => {
    fetchKeys(currentVault);
    fetchSnippets(currentVault);
  }, [fetchKeys, fetchSnippets, currentVault]);

  const groupId = group?.id;
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    void useHostStore
      .getState()
      .getDecryptedGroup(groupId)
      .then((g) => {
        if (g && !cancelled) reset(valuesFromGroup(g));
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, reset]);

  // Collapsed sections unmount their fields; reveal them so errors are visible.
  const onInvalid = (errors: FieldErrors<GroupFormValues>) => {
    if (errors.password || errors.keyId) setShowCredentials(true);
    if (errors.keepaliveSecs || errors.startupSnippetId || errors.env)
      setShowAdvanced(true);
  };

  const getButtonText = () => {
    if (isPending) return "Saving...";
    return group ? "Save Changes" : "Create Group";
  };

  const handleGroupSubmit = async (data: GroupFormValues) => {
    const parentId = group?.parentId || defaultParentId || undefined;
    if (group) {
      await updateGroup(group.id, {
        ...payloadFromForm(data, null),
        name: data.name,
        parentId,
      });
    } else {
      await createGroup({
        ...payloadFromForm(data, undefined),
        name: data.name,
        parentId,
        vaultId: currentVaultId || undefined,
      });
    }
    reset();
    onClose();
  };

  const onSubmit = async (data: GroupFormValues) => {
    startTransition(async () => {
      await handleGroupSubmit(data);
    });
  };

  return (
    <ModalForm
      onClose={onClose}
      title={group ? "Edit Group" : "New Group"}
      isPending={isPending}
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      cancelButtonText="Cancel"
      submitButtonText={getButtonText()}
    >
      <FormInput
        name="name"
        label="Group Name"
        control={control}
        placeholder="Group name"
        required
      />

      <Button
        type="button"
        variant="secondary"
        onClick={() => setShowCredentials((v) => !v)}
        aria-expanded={showCredentials}
      >
        {showCredentials ? "Hide credentials" : "Credentials"}
      </Button>
      {showCredentials && (
        <div className="space-y-3">
          <FormInput
            name="username"
            label="Username"
            control={control}
            placeholder="root"
          />
          <CredentialsFields control={control} mode="group" />
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? "Hide advanced" : "Advanced"}
      </Button>
      {showAdvanced && (
        <ConnectionOptionsFields control={control} mode="group" />
      )}
    </ModalForm>
  );
}
