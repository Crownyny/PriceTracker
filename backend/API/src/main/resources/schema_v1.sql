CREATE TABLE IF NOT EXISTS "user"(
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "image_profile" VARCHAR(255) NOT NULL DEFAULT '',
    "role" VARCHAR(255) CHECK ("role" IN('registered', 'premium')) NOT NULL DEFAULT 'registered',
    "create_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delete_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT "user_pkey" PRIMARY KEY("id"),
    CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "suscripcion"(
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan" VARCHAR(255) CHECK ("plan" IN('free', 'premium')) NOT NULL DEFAULT 'free',
    "status" VARCHAR(255) CHECK ("status" IN('active', 'cancelled', 'expired')) NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
    "expires_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT "suscripcion_pkey" PRIMARY KEY("id"),
    CONSTRAINT "suscripcion_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "user"("id")
);

CREATE TABLE IF NOT EXISTS "normalized_products"(
    "id" VARCHAR(36) NOT NULL,
    "product_ref" VARCHAR(255) NOT NULL,
    "source_name" VARCHAR(255) NOT NULL,
    "source_url" VARCHAR(1024) NOT NULL,
    "canonical_name" VARCHAR(255) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "category" VARCHAR(255) NOT NULL,
    "availability" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
    "last_scraped_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL,
    "next_scrape_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "volatility_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alert_priority" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(0) WITHOUT TIME ZONE NULL,
    "image_url" TEXT NULL,
    "description" TEXT NULL,
    "extra" JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT "normalized_products_pkey" PRIMARY KEY("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_product_source_url"
    ON "normalized_products" ("source_url");

ALTER TABLE "normalized_products"
    ADD COLUMN IF NOT EXISTS "last_scraped_at" TIMESTAMP(0) WITHOUT TIME ZONE,
    ADD COLUMN IF NOT EXISTS "next_scrape_at" TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "volatility_score" DOUBLE PRECISION DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "alert_priority" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(0) WITHOUT TIME ZONE;

CREATE INDEX IF NOT EXISTS "idx_producto_queue"
    ON "normalized_products" ("alert_priority" DESC, "volatility_score" DESC, "next_scrape_at" ASC)
    WHERE "locked_until" IS NULL;

CREATE INDEX IF NOT EXISTS "ix_normalized_products_locked_until"
    ON "normalized_products" ("locked_until");

CREATE TABLE IF NOT EXISTS "price_history"(
    "id" SERIAL NOT NULL,
    "product_id" VARCHAR(36) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "recorded_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
    "job_id" VARCHAR(255) NOT NULL,
    CONSTRAINT "price_history_pkey" PRIMARY KEY("id"),
    CONSTRAINT "price_history_product_id_foreign" FOREIGN KEY("product_id") REFERENCES "normalized_products"("id")
);

CREATE INDEX IF NOT EXISTS "ix_price_history_product_id"
    ON "price_history" ("product_id");

CREATE INDEX IF NOT EXISTS "ix_price_history_recorded_at"
    ON "price_history" ("recorded_at" DESC);

CREATE TABLE IF NOT EXISTS "search_tracking"(
    "search_id" VARCHAR(255) NOT NULL,
    "product_ref" VARCHAR(255) NOT NULL,
    "expected_jobs" INTEGER NULL,
    "completed_jobs" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT "search_tracking_pkey" PRIMARY KEY("search_id")
);

CREATE TABLE IF NOT EXISTS "alert"(
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" VARCHAR(36) NOT NULL,
    "target_price" DECIMAL(8, 2) NOT NULL,
    "condition" VARCHAR(255) CHECK ("condition" IN('below', 'above', 'any_change')) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "frequency" VARCHAR(255) CHECK ("frequency" IN('instant', 'daily', 'weekly')) NOT NULL,
    "create_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alert_pkey" PRIMARY KEY("id"),
    CONSTRAINT "alert_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "user"("id"),
    CONSTRAINT "alert_product_id_foreign" FOREIGN KEY("product_id") REFERENCES "normalized_products"("id")
);

CREATE TABLE IF NOT EXISTS "notification"(
    "id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "listing_id" VARCHAR(36) NOT NULL,
    "triggered_price" DECIMAL(8, 2) NOT NULL,
    "sent_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "was_read" BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT "notification_pkey" PRIMARY KEY("id"),
    CONSTRAINT "notification_alert_id_foreign" FOREIGN KEY("alert_id") REFERENCES "alert"("id"),
    CONSTRAINT "notification_listing_id_foreign" FOREIGN KEY("listing_id") REFERENCES "normalized_products"("id")
);