/** Max. velikost ZIP importu – sladit s next.config `proxyClientMaxBodySize`. */
export const IML_PRODUCT_IMPORT_MAX_BYTES = 500 * 1024 * 1024;

export const IML_PRODUCT_IMPORT_MAX_MB = IML_PRODUCT_IMPORT_MAX_BYTES / 1024 / 1024;

/** Max. velikost jedné dávky při postupném nahrávání složky. */
export const IML_PRODUCT_IMPORT_BATCH_MAX_BYTES = 100 * 1024 * 1024;

export const IML_PRODUCT_IMPORT_BATCH_MAX_MB =
  IML_PRODUCT_IMPORT_BATCH_MAX_BYTES / 1024 / 1024;

/** ZIP nad tuto velikost doporučujeme složku (bez re-zipování). */
export const IML_PRODUCT_IMPORT_ZIP_SOFT_MAX_BYTES = 100 * 1024 * 1024;
