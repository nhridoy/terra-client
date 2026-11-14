import {
  type Control,
  Controller,
  type FieldValues,
  useWatch,
} from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { FormInput } from "@/components/ui/forms/FormInput";
import { FormSelect } from "@/components/ui/forms/FormSelect";
import type { InheritedDefaults } from "@/lib/hosts/inherited";
import { useKeyStore } from "@/stores/keys/keyStore";

interface Props<T extends FieldValues> {
  control: Control<T>;
  mode: "host" | "group";
  inherited?: InheritedDefaults;
}

const LABELS = {
  inherit: "From group",
  password: "Password",
  key: "SSH Key",
  both: "Both",
  none: "None",
} as const;

/**
 * Auth method, password and key picker. Group mode adds "Not set" (empty value);
 * host mode adds "From group" when the host has a group.
 */
export default function CredentialsFields<T extends FieldValues>({
  control: typedControl,
  mode,
  inherited,
}: Props<T>) {
  // Shared by the host and group forms, whose value types differ.
  const control = typedControl as unknown as Control<FieldValues>;
  const keys = useKeyStore((s) => s.keys);
  const authType = useWatch({ control, name: "authType" });
  const groupId = useWatch({ control, name: "groupId" });
  // A stored "inherit" stays visible without a group so the validation error can explain it.
  const offerInherit = mode === "host" && (!!groupId || authType === "inherit");
  const choices = [
    ...(mode === "group" ? [["", "Not set"] as const] : []),
    ...(offerInherit ? [["inherit", LABELS.inherit] as const] : []),
    ...(["password", "key", "both", "none"] as const).map(
      (t) => [t, LABELS[t]] as const,
    ),
  ];

  return (
    <>
      <fieldset>
        <legend className="block text-dark-300 text-sm mb-2">
          Authentication{" "}
          {mode === "host" && <span className="text-red-400 ml-0.5">*</span>}
        </legend>
        <Controller
          name="authType"
          control={control}
          render={({ field, fieldState }) => (
            <>
              <div
                className={`grid gap-2 ${choices.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}
              >
                {choices.map(([type, label]) => (
                  <Button
                    key={type}
                    type="button"
                    onClick={() => field.onChange(type)}
                    variant={field.value === type ? "default" : "secondary"}
                    className="flex-1"
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {fieldState.error && (
                <p role="alert" className="text-xs text-red-400 mt-1">
                  {fieldState.error.message}
                </p>
              )}
            </>
          )}
        />
      </fieldset>

      {authType === "inherit" && groupId && (
        <p className="text-xs text-dark-400">
          {inherited?.authType
            ? `Using credentials from '${inherited.authFrom}'`
            : "No group sets credentials"}
          {inherited?.keyName && ` (key: ${inherited.keyName})`}
        </p>
      )}

      {(authType === "password" || authType === "both") && (
        <FormInput
          name="password"
          label="Password"
          control={control}
          type="password"
          placeholder="Enter password"
          required
        />
      )}

      {(authType === "key" || authType === "both") && (
        <FormSelect
          name="keyId"
          label="SSH Key"
          control={control}
          options={[
            { value: "", label: "Select a key" },
            ...keys.map((key) => ({ value: key.id, label: key.name })),
          ]}
          required
        />
      )}
    </>
  );
}
