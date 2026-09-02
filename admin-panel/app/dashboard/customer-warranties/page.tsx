"use client";

import { WarrantiesManager } from "@/components/warranties-manager";

export default function CustomerWarrantiesPage() {
  return (
    <WarrantiesManager
      warrantyType="customer"
      title="Customer Warranties"
      description="Warranty plans offered to customers on sold items. Assign them from the Items screen."
    />
  );
}
