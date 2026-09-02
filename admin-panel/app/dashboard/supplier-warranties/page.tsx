"use client";

import { WarrantiesManager } from "@/components/warranties-manager";

export default function SupplierWarrantiesPage() {
  return (
    <WarrantiesManager
      warrantyType="supplier"
      title="Supplier Warranties"
      description="Warranty terms from suppliers on purchased goods."
    />
  );
}
