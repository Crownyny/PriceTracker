ALTER TABLE "normalized_products"
    ADD COLUMN IF NOT EXISTS "last_scraped_at" TIMESTAMP(0) WITHOUT TIME ZONE,
    ADD COLUMN IF NOT EXISTS "next_scrape_at" TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "volatility_score" DOUBLE PRECISION DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "alert_priority" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(0) WITHOUT TIME ZONE;

UPDATE "normalized_products"
SET
    "next_scrape_at" = COALESCE("next_scrape_at", CURRENT_TIMESTAMP),
    "volatility_score" = COALESCE("volatility_score", 0),
    "alert_priority" = COALESCE("alert_priority", 0)
WHERE
    "next_scrape_at" IS NULL
    OR "volatility_score" IS NULL
    OR "alert_priority" IS NULL;

ALTER TABLE "normalized_products"
    ALTER COLUMN "next_scrape_at" SET NOT NULL,
    ALTER COLUMN "volatility_score" SET NOT NULL,
    ALTER COLUMN "alert_priority" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_producto_queue"
    ON "normalized_products" ("alert_priority" DESC, "volatility_score" DESC, "next_scrape_at" ASC)
    WHERE "locked_until" IS NULL;

CREATE INDEX IF NOT EXISTS "ix_normalized_products_locked_until"
    ON "normalized_products" ("locked_until");

CREATE OR REPLACE FUNCTION sync_product_alert_priority(target_product_id VARCHAR)
RETURNS VOID
LANGUAGE plpgsql
AS '
BEGIN
    UPDATE "normalized_products" p
    SET "alert_priority" = COALESCE(
        (
            SELECT MAX(
                CASE a."frequency"
                    WHEN ''instant'' THEN 3
                    WHEN ''daily'' THEN 2
                    WHEN ''weekly'' THEN 1
                    ELSE 0
                END
            )
            FROM "alert" a
            WHERE a."product_id" = target_product_id
              AND a."is_active" = TRUE
        ),
        0
    )
    WHERE p."id" = target_product_id;
END;
';

CREATE OR REPLACE FUNCTION trg_sync_product_alert_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
AS '
DECLARE
    affected_product_id VARCHAR(36);
BEGIN
    affected_product_id := COALESCE(NEW."product_id", OLD."product_id");
    PERFORM sync_product_alert_priority(affected_product_id);
    RETURN COALESCE(NEW, OLD);
END;
';

DROP TRIGGER IF EXISTS alert_sync_product_priority_tg ON "alert";

CREATE TRIGGER alert_sync_product_priority_tg
AFTER INSERT OR DELETE OR UPDATE OF "is_active", "frequency", "product_id"
ON "alert"
FOR EACH ROW
EXECUTE FUNCTION trg_sync_product_alert_priority();

UPDATE "normalized_products" p
SET "alert_priority" = COALESCE(
    (
        SELECT MAX(
            CASE a."frequency"
                WHEN 'instant' THEN 3
                WHEN 'daily' THEN 2
                WHEN 'weekly' THEN 1
                ELSE 0
            END
        )
        FROM "alert" a
        WHERE a."product_id" = p."id"
          AND a."is_active" = TRUE
    ),
    0
);
