"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiJson } from "@/lib/api";
import { useRouteAccess } from "@/lib/auth-context";
import { SearchableNumPicker } from "@/components/searchable-num-picker";
import {
  ACTION_LABELS,
  MATRIX_ACTIONS,
  buildGroupedPermissionMatrix,
  humanizeExtraAction,
  type PermissionRecord,
} from "@/lib/permission-matrix";

type RoleRow = {
  id: number;
  name: string;
  description: string | null;
};

type RoleListResponse = {
  items: RoleRow[];
  total: number;
};

type RoleDetailResponse = {
  id: number;
  name: string;
  description: string | null;
  permission_ids: number[];
};

export default function PermissionsPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [allPermissions, setAllPermissions] = useState<PermissionRecord[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const [selectedRoleId, setSelectedRoleId] = useState(0);
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());
  const [roleLoading, setRoleLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const { canEdit } = useRouteAccess();

  const groupedMatrix = useMemo(
    () => buildGroupedPermissionMatrix(allPermissions),
    [allPermissions]
  );

  const roleOptions = useMemo(
    () =>
      roles.map((role) => ({
        value: role.id,
        label: role.description?.trim()
          ? `${role.name} — ${role.description}`
          : role.name,
      })),
    [roles]
  );

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  useEffect(() => {
    void apiJson<RoleListResponse>("/roles?page=1&pageSize=200").then((res) => {
      setRolesLoading(false);
      if (res.ok && res.data?.items) setRoles(res.data.items);
    });
  }, []);

  useEffect(() => {
    void apiJson<PermissionRecord[]>("/roles/permissions").then((res) => {
      setPermissionsLoading(false);
      if (res.ok && Array.isArray(res.data)) setAllPermissions(res.data);
    });
  }, []);

  const loadRolePermissions = useCallback(async (roleId: number) => {
    if (roleId <= 0) {
      setAssignedIds(new Set());
      setDirty(false);
      return;
    }

    setRoleLoading(true);
    setError(null);
    setSuccess(null);

    const res = await apiJson<RoleDetailResponse>(`/roles/${roleId}`);
    setRoleLoading(false);

    if (!res.ok || !res.data) {
      setError(res.error ?? "Failed to load role permissions");
      setAssignedIds(new Set());
      return;
    }

    setAssignedIds(new Set(res.data.permission_ids ?? []));
    setDirty(false);
  }, []);

  useEffect(() => {
    void loadRolePermissions(selectedRoleId);
  }, [selectedRoleId, loadRolePermissions]);

  function togglePermission(permId: number, checked: boolean) {
    setAssignedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(permId);
      else next.delete(permId);
      return next;
    });
    setDirty(true);
    setSuccess(null);
  }

  async function savePermissions() {
    if (selectedRoleId <= 0) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const res = await apiJson(`/roles/${selectedRoleId}`, {
      method: "PATCH",
      body: JSON.stringify({
        permission_ids: [...assignedIds],
      }),
    });

    setSaving(false);

    if (!res.ok) {
      setError(res.error ?? "Could not save permissions");
      return;
    }

    setDirty(false);
    setSuccess("Permissions saved.");
  }

  const initialLoading = rolesLoading || permissionsLoading;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Permissions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select a role and assign module access — view, edit, delete, and CSV
            download.
          </p>
        </div>
        {selectedRoleId > 0 && canEdit ? (
          <Button
            type="button"
            disabled={!dirty || saving || roleLoading}
            onClick={() => void savePermissions()}
          >
            {saving ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : null}
            Save permissions
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex max-w-xl flex-col gap-2">
          <Label htmlFor="perm-role">Role</Label>
          <SearchableNumPicker
            id="perm-role"
            options={roleOptions}
            valueId={selectedRoleId}
            onValueChange={setSelectedRoleId}
            loading={rolesLoading}
            placeholder="Search and select a role…"
            emptyListHint="No roles found"
            emptyFilterHint="No matching roles"
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="text-sm text-emerald-700" role="status">
            {success}
          </p>
        ) : null}

        {initialLoading ? (
          <div className="flex h-40 items-center justify-center rounded-md border border-border">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : selectedRoleId <= 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Choose a role to view and edit its permissions.
          </div>
        ) : roleLoading ? (
          <div className="flex h-40 items-center justify-center rounded-md border border-border">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {selectedRole ? (
              <p className="text-sm text-muted-foreground">
                Editing access for{" "}
                <span className="font-medium text-foreground">
                  {selectedRole.name}
                </span>
                {selectedRole.description?.trim()
                  ? ` — ${selectedRole.description}`
                  : null}
              </p>
            ) : null}

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium">Module</th>
                    {MATRIX_ACTIONS.map((action) => (
                      <th
                        key={action}
                        className="px-3 py-3 text-center font-medium whitespace-nowrap"
                      >
                        {ACTION_LABELS[action]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupedMatrix.map((section) => (
                    <Fragment key={section.heading}>
                      <tr className="border-b border-border bg-muted/50">
                        <td
                          colSpan={1 + MATRIX_ACTIONS.length}
                          className="px-4 py-2.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
                        >
                          {section.heading}
                        </td>
                      </tr>
                      {section.rows.map((row) => (
                        <tr
                          key={row.moduleKey}
                          className="border-b border-border last:border-b-0"
                        >
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium">{row.moduleLabel}</div>
                            {row.extras.length > 0 ? (
                              <div className="mt-2 space-y-1.5">
                                {row.extras.map((extra) => (
                                  <label
                                    key={extra.id}
                                    className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                                  >
                                    <Checkbox
                                      checked={assignedIds.has(extra.id)}
                                      disabled={!canEdit}
                                      onCheckedChange={(v) =>
                                        togglePermission(extra.id, v === true)
                                      }
                                    />
                                    <span>{humanizeExtraAction(extra.key)}</span>
                                  </label>
                                ))}
                              </div>
                            ) : null}
                          </td>
                          {MATRIX_ACTIONS.map((action) => {
                            const perm = row.cells[action];
                            return (
                              <td
                                key={action}
                                className="px-3 py-3 text-center align-middle"
                              >
                                {perm ? (
                                  <div className="flex justify-center">
                                    <Checkbox
                                      checked={assignedIds.has(perm.id)}
                                      disabled={!canEdit}
                                      aria-label={`${row.moduleLabel} — ${ACTION_LABELS[action]}`}
                                      onCheckedChange={(v) =>
                                        togglePermission(perm.id, v === true)
                                      }
                                    />
                                  </div>
                                ) : (
                                  <span
                                    className="text-xs text-muted-foreground/50"
                                    aria-hidden
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {dirty ? (
              <p className="text-xs text-muted-foreground">
                You have unsaved changes.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
