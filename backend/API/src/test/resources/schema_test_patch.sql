ALTER TABLE "price_history"
    ADD COLUMN IF NOT EXISTS "product_ref" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "availability" BOOLEAN;

UPDATE "price_history" ph
SET "product_ref" = np."product_ref"
FROM "normalized_products" np
WHERE ph."product_id" = np."id"
  AND ph."product_ref" IS NULL;

UPDATE "price_history"
SET "product_ref" = ''
WHERE "product_ref" IS NULL;

UPDATE "price_history"
SET "availability" = TRUE
WHERE "availability" IS NULL;

ALTER TABLE "price_history"
    ALTER COLUMN "product_ref" SET NOT NULL,
    ALTER COLUMN "availability" SET NOT NULL;
