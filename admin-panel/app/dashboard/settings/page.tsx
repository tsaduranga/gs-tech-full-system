"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { Loader2Icon, SaveIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiJson } from "@/lib/api";
import { useRouteAccess } from "@/lib/auth-context";
import { useSetDashboardFooter } from "@/lib/dashboard-footer-context";
import { DashboardFooterBar } from "@/components/dashboard-footer-bar";

type SettingsResponse = {
  sscl_rate: number;
  vat_rate: number;
  sscl_percent: number;
  vat_percent: number;
  updated_at: string | null;
};

const settingsFormSchema = z.object({
  sscl_percent: z.coerce
    .number()
    .finite("SSCL must be a number")
    .min(0, "SSCL cannot be negative")
    .max(100, "SSCL cannot exceed 100%"),
  vat_percent: z.coerce
    .number()
    .finite("VAT must be a number")
    .min(0, "VAT cannot be negative")
    .max(100, "VAT cannot exceed 100%"),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

function fieldErrorCls() {
  return "text-xs text-destructive";
}

export default function SettingsPage() {
  const { canEdit } = useRouteAccess();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema) as Resolver<SettingsFormValues>,
    defaultValues: { sscl_percent: 1.25, vat_percent: 18 },
    mode: "onTouched",
  });

  const { register, handleSubmit, reset, formState } = form;

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await apiJson<SettingsResponse>("/settings");
    if (!res.ok || !res.data) {
      setLoadError(res.error ?? "Could not load settings");
      setLoading(false);
      return;
    }
    reset({
      sscl_percent: res.data.sscl_percent,
      vat_percent: res.data.vat_percent,
    });
    setUpdatedAt(res.data.updated_at);
    setLoading(false);
  }, [reset]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const onSubmit: SubmitHandler<SettingsFormValues> = async (data) => {
    form.clearErrors("root");
    setSaving(true);
    const res = await apiJson<SettingsResponse>("/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (!res.ok || !res.data) {
      form.setError("root", {
        type: "server",
        message: res.error ?? "Could not save settings",
      });
      return;
    }
    reset({
      sscl_percent: res.data.sscl_percent,
      vat_percent: res.data.vat_percent,
    });
    setUpdatedAt(res.data.updated_at);
  };

  useSetDashboardFooter(
    canEdit && !loading && !loadError ? (
      <DashboardFooterBar
        left={
          <span>{formState.isDirty ? "Unsaved changes" : "All changes saved"}</span>
        }
        right={
          <Button
            type="submit"
            form="dashboard-settings-form"
            disabled={saving || !formState.isDirty}
          >
            {saving ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <SaveIcon className="mr-2 size-4" aria-hidden />
            )}
            Save changes
          </Button>
        }
      />
    ) : null,
    [canEdit, loading, loadError, formState.isDirty, saving]
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SettingsIcon className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure tax rates used when calculating item unit prices from actual cost.
          </p>
        </div>
      </div>

      <form id="dashboard-settings-form" onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>Tax rates</CardTitle>
              <CardDescription>
                SSCL is applied to actual cost first, then VAT is applied to cost plus SSCL.
                These rates are used on the Items form when auto-calculating unit price.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                  Loading settings…
                </div>
              ) : loadError ? (
                <div className="space-y-3 py-4">
                  <p className="text-sm text-destructive" role="alert">
                    {loadError}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadSettings()}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="sscl-percent">
                        SSCL<span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="sscl-percent"
                          type="number"
                          step="any"
                          min={0}
                          max={100}
                          disabled={!canEdit}
                          aria-invalid={Boolean(formState.errors.sscl_percent)}
                          className={cn(
                            "pr-8 tabular-nums",
                            formState.errors.sscl_percent && "border-destructive"
                          )}
                          {...register("sscl_percent")}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                          %
                        </span>
                      </div>
                      {formState.errors.sscl_percent?.message ? (
                        <p className={fieldErrorCls()} role="alert">
                          {String(formState.errors.sscl_percent.message)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Social Security Contribution Levy on actual cost
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="vat-percent">
                        VAT<span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="vat-percent"
                          type="number"
                          step="any"
                          min={0}
                          max={100}
                          disabled={!canEdit}
                          aria-invalid={Boolean(formState.errors.vat_percent)}
                          className={cn(
                            "pr-8 tabular-nums",
                            formState.errors.vat_percent && "border-destructive"
                          )}
                          {...register("vat_percent")}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                          %
                        </span>
                      </div>
                      {formState.errors.vat_percent?.message ? (
                        <p className={fieldErrorCls()} role="alert">
                          {String(formState.errors.vat_percent.message)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Value-added tax on cost plus SSCL
                        </p>
                      )}
                    </div>
                  </div>

                  {updatedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(updatedAt).toLocaleString()}
                    </p>
                  ) : null}

                  {formState.errors.root?.message ? (
                    <p className={fieldErrorCls()} role="alert">
                      {String(formState.errors.root.message)}
                    </p>
                  ) : null}

                  {!canEdit ? (
                    <p className="text-xs text-muted-foreground">
                      You have view-only access to settings.
                    </p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
      </form>
    </div>
  );
}
