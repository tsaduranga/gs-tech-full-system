import { tableExists } from "../db/schemaHints.js";
import { catalogModel } from "../models/catalogModel.js";
import { HttpError } from "../utils/httpError.js";

export type ResolvedItemCatalog = {
  categoryText: string | null;
  subcategoryId: number | null;
};

/**
 * Validates catalog picks and derives legacy `items.category` text plus `subcategory_id`.
 */
export async function resolveItemCatalogSelection(
  catalogCategoryId: number | null | undefined,
  subcategoryId: number | null | undefined
): Promise<ResolvedItemCatalog> {
  const catMissing = catalogCategoryId === undefined || catalogCategoryId === null;
  const subMissing = subcategoryId === undefined || subcategoryId === null;

  if (catMissing && subMissing) {
    return { categoryText: null, subcategoryId: null };
  }

  const ready =
    (await tableExists("catalog_categories")) &&
    (await tableExists("catalog_subcategories"));
  if (!ready) {
    throw new HttpError(
      503,
      "Catalog tables are not installed. From the api folder run: yarn migrate"
    );
  }

  if (!subMissing && (typeof subcategoryId !== "number" || subcategoryId < 1)) {
    throw new HttpError(400, "Invalid subcategory id");
  }
  if (!catMissing && (typeof catalogCategoryId !== "number" || catalogCategoryId < 1)) {
    throw new HttpError(400, "Invalid category id");
  }

  if (!subMissing && subcategoryId != null && subcategoryId >= 1) {
    const subRow = await catalogModel.subcategories.get(subcategoryId);
    if (!subRow) throw new HttpError(400, "Subcategory not found");
    const parentId = Number(subRow.category_id);
    if (
      !catMissing &&
      catalogCategoryId != null &&
      catalogCategoryId >= 1 &&
      catalogCategoryId !== parentId
    ) {
      throw new HttpError(400, "Subcategory does not belong to the selected category");
    }
    const catRow = await catalogModel.categories.get(parentId);
    return {
      categoryText: catRow ? String(catRow.name) : null,
      subcategoryId: Number(subRow.id),
    };
  }

  if (!catMissing && catalogCategoryId != null && catalogCategoryId >= 1) {
    const catRow = await catalogModel.categories.get(catalogCategoryId);
    if (!catRow) throw new HttpError(400, "Category not found");
    return {
      categoryText: String(catRow.name),
      subcategoryId: null,
    };
  }

  return { categoryText: null, subcategoryId: null };
}
