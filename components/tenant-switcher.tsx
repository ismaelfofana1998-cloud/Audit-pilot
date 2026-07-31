"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TenantSwitcher({
  activeTenantId,
  tenants,
}: {
  activeTenantId: string;
  tenants: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <select
      aria-label="Changer de cabinet"
      className="tenant-select"
      disabled={busy}
      onChange={async (event) => {
        setBusy(true);
        const response = await fetch("/api/session/tenant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tenantId: event.target.value }),
        });
        if (response.ok) {
          router.push("/");
          router.refresh();
        } else {
          setBusy(false);
        }
      }}
      value={activeTenantId}
    >
      {tenants.map((tenant) => (
        <option key={tenant.id} value={tenant.id}>
          {tenant.name}
        </option>
      ))}
    </select>
  );
}
