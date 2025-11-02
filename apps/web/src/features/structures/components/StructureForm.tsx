// nextjs/src/features/structures/components/StructureForm.tsx
"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StructureAddressInput, StructureEmailInput, StructurePhoneInput } from "@structures/types";

export type StructureAddressFormValue = StructureAddressInput & {
  address_1: string;
  address_2: string;
  zipcode: string;
  city: string;
  country: string;
  label: string;
  is_primary: boolean;
};

type StructureContactFieldSet = {
  value: string;
  label: string;
};

export type StructureFormValues = {
  name: string;
  type: string;
  website: string;
  description: string;
  tags: string[];
  addresses: StructureAddressInput[];
  emails: StructureEmailInput[];
  phones: StructurePhoneInput[];
};

type StructureFormFields = {
  name: string;
  type: string;
  website: string;
  description: string;
  tags: string;
  addresses: StructureAddressFormValue[];
  email: string;
  emailLabel: string;
  phone: string;
  phoneLabel: string;
};

type StructureFormProps = {
  initialValues?: Partial<StructureFormValues>;
  submitLabel: string;
  onSubmit: (values: StructureFormValues) => Promise<void>;
  onCancel?: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

function createEmptyAddress(): StructureAddressFormValue {
  return {
    address_1: "",
    address_2: "",
    zipcode: "",
    city: "",
    country: "",
    label: "",
    is_primary: false,
  };
}

function pickPrimary<T extends { is_primary?: boolean | null }>(list?: T[]) {
  if (!list || list.length === 0) return null;
  return list.find((item) => item.is_primary) ?? list[0];
}

function toInternalValues(values?: Partial<StructureFormValues>): StructureFormFields {
  const primaryEmail = pickPrimary(values?.emails);
  const primaryPhone = pickPrimary(values?.phones);

  return {
    name: values?.name ?? "",
    type: values?.type ?? "",
    website: values?.website ?? "",
    description: values?.description ?? "",
    tags: (values?.tags ?? []).join(", "),
    addresses: values?.addresses?.map((address) => ({
      id: address.id,
      address_1: address.address_1 ?? "",
      address_2: address.address_2 ?? "",
      zipcode: address.zipcode ?? "",
      city: address.city ?? "",
      country: address.country ?? "",
      label: address.label ?? "",
      is_primary: Boolean(address.is_primary),
    })) ?? [],
    email: primaryEmail && "email" in primaryEmail ? (primaryEmail as StructureEmailInput).email ?? "" : "",
    emailLabel: primaryEmail && "label" in primaryEmail ? (primaryEmail as StructureEmailInput).label ?? "" : "",
    phone: primaryPhone && "phone" in primaryPhone ? (primaryPhone as StructurePhoneInput).phone ?? "" : "",
    phoneLabel: primaryPhone && "label" in primaryPhone ? (primaryPhone as StructurePhoneInput).label ?? "" : "",
  };
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function normalizeAddresses(addresses: StructureAddressFormValue[]): StructureAddressInput[] {
  return addresses
    .map((address) => ({
      id: address.id,
      address_1: address.address_1.trim(),
      address_2: address.address_2.trim(),
      zipcode: address.zipcode.trim(),
      city: address.city.trim(),
      country: address.country.trim(),
      label: address.label.trim(),
      is_primary: Boolean(address.is_primary),
    }))
    .filter((address) => address.address_1.length > 0);
}

function normalizeSingleContactField(field: StructureContactFieldSet): { value: string; label: string } | null {
  const value = field.value.trim();
  if (!value) return null;
  return {
    value,
    label: field.label.trim(),
  };
}

export default function StructureForm({ initialValues, submitLabel, onSubmit, onCancel, t }: StructureFormProps) {
  const [submitError, setSubmitError] = useState("");

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StructureFormFields>({
    defaultValues: toInternalValues(initialValues),
  });
  const { fields, append, remove } = useFieldArray({
    name: "addresses",
    control,
  });

  useEffect(() => {
    reset(toInternalValues(initialValues));
    setSubmitError("");
  }, [initialValues, reset]);

  const handleAddAddress = () => append(createEmptyAddress());

  const onSubmitForm = handleSubmit(async (values) => {
    if (!values.name.trim()) {
      setError("name", { type: "manual", message: t("structures.nameRequired") });
      return;
    }

    setSubmitError("");

    try {
      const normalizedEmail = normalizeSingleContactField({ value: values.email, label: values.emailLabel });
      const normalizedPhone = normalizeSingleContactField({ value: values.phone, label: values.phoneLabel });

      await onSubmit({
        name: values.name.trim(),
        type: values.type.trim(),
        website: values.website.trim(),
        description: values.description.trim(),
        tags: parseTags(values.tags),
        addresses: normalizeAddresses(values.addresses ?? []),
        emails: normalizedEmail
          ? [
            {
              email: normalizedEmail.value,
              label: normalizedEmail.label,
              is_primary: true,
            },
          ]
          : [],
        phones: normalizedPhone
          ? [
            {
              phone: normalizedPhone.value,
              label: normalizedPhone.label,
              is_primary: true,
            },
          ]
          : [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("structures.saveFailed");
      setSubmitError(message);
    }
  });

  const fieldError = submitError || errors.name?.message;

  return (
    <form className="space-y-6" onSubmit={onSubmitForm}>
      {fieldError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{fieldError}</div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="structure-name" className="text-sm font-medium text-foreground">
            {t("structures.name")}
          </label>
          <Input
            id="structure-name"
            autoFocus
            placeholder={t("structures.namePlaceholder")}
            {...register("name")}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="structure-type" className="text-sm font-medium text-foreground">
            {t("structures.type")}
          </label>
          <Input id="structure-type" placeholder={t("structures.typePlaceholder")} {...register("type")} />
        </div>

        <div className="space-y-2">
          <label htmlFor="structure-website" className="text-sm font-medium text-foreground">
            {t("structures.website")}
          </label>
          <Input
            id="structure-website"
            placeholder={t("structures.websitePlaceholder")}
            {...register("website")}
          />
        </div>
      </section>

      <div className="space-y-2">
        <label htmlFor="structure-tags" className="text-sm font-medium text-foreground">
          {t("structures.tags")}
        </label>
        <Input id="structure-tags" placeholder={t("structures.tagsPlaceholder")} {...register("tags")} />
      </div>

      <div className="space-y-2">
        <label htmlFor="structure-description" className="text-sm font-medium text-foreground">
          {t("structures.description")}
        </label>
        <Textarea
          id="structure-description"
          rows={4}
          placeholder={t("structures.descriptionPlaceholder")}
          {...register("description")}
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("structures.addresses")}</h3>
            <p className="text-xs text-muted-foreground">{t("structures.addressHelper")}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddAddress}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            {t("structures.addAddress")}
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="rounded border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
            {t("structures.noAddresses")}
          </p>
        ) : (
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-3 rounded-lg border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {t("structures.addressLabelShort", { index: index + 1 })}
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border/70"
                        {...register(`addresses.${index}.is_primary` as const)}
                      />
                      {t("structures.addressPrimary")}
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("structures.removeAddress")}
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>

                <input type="hidden" {...register(`addresses.${index}.id` as const)} />

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("structures.addressLine1")}
                  </label>
                  <Input
                    placeholder={t("structures.addressLine1Placeholder")}
                    {...register(`addresses.${index}.address_1` as const)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("structures.addressLine2")}
                  </label>
                  <Input
                    placeholder={t("structures.addressLine2Placeholder")}
                    {...register(`addresses.${index}.address_2` as const)}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("structures.zipcode")}
                    </label>
                    <Input
                      placeholder={t("structures.zipcodePlaceholder")}
                      {...register(`addresses.${index}.zipcode` as const)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{t("structures.city")}</label>
                    <Input
                      placeholder={t("structures.cityPlaceholder")}
                      {...register(`addresses.${index}.city` as const)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("structures.country")}
                    </label>
                    <Input
                      placeholder={t("structures.countryPlaceholder")}
                      {...register(`addresses.${index}.country` as const)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("structures.addressLabel")}
                  </label>
                  <Input
                    placeholder={t("structures.addressLabelPlaceholder")}
                    {...register(`addresses.${index}.label` as const)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("common.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
// <section className="grid gap-4 md:grid-cols-2">
//   <div className="space-y-2">
//     <label htmlFor="structure-email" className="text-sm font-medium text-foreground">
//       {t("structures.email")}
//     </label>
//     <Input
//       id="structure-email"
//       type="email"
//       placeholder={t("structures.emailPlaceholder")}
//       {...register("email")}
//     />
//   </div>
//   <div className="space-y-2">
//     <label htmlFor="structure-email-label" className="text-sm font-medium text-foreground">
//       {t("structures.emailLabel")}
//     </label>
//     <Input
//       id="structure-email-label"
//       placeholder={t("structures.emailLabelPlaceholder")}
//       {...register("emailLabel")}
//     />
//   </div>
//   <div className="space-y-2">
//     <label htmlFor="structure-phone" className="text-sm font-medium text-foreground">
//       {t("structures.phone")}
//     </label>
//     <Input id="structure-phone" placeholder={t("structures.phonePlaceholder")} {...register("phone")} />
//   </div>
//   <div className="space-y-2">
//     <label htmlFor="structure-phone-label" className="text-sm font-medium text-foreground">
//       {t("structures.phoneLabel")}
//     </label>
//     <Input
//       id="structure-phone-label"
//       placeholder={t("structures.phoneLabelPlaceholder")}
//       {...register("phoneLabel")}
//     />
//   </div>
// </section>
