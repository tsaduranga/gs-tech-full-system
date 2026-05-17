"use client";

import { SearchableNumPicker } from "@/components/searchable-num-picker";

export function CatalogIdCombobox(props: {
  id: string;
  items: { id: number; name: string }[];
  valueId: number;
  onValueChange: (id: number) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder: string;
  emptyFilterHint?: string;
  emptyListHint?: string;
  invalid?: boolean;
  variant?: "default" | "underline";
}) {
  const { items, ...rest } = props;
  const options = items.map((i) => ({ value: i.id, label: i.name }));
  return <SearchableNumPicker {...rest} options={options} />;
}
