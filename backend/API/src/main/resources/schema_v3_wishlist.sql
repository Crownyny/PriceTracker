CREATE TABLE IF NOT EXISTS "wishlist_item"(
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wishlist_item_pkey" PRIMARY KEY("id"),
    CONSTRAINT "wishlist_item_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "user"("id"),
    CONSTRAINT "wishlist_item_product_id_foreign" FOREIGN KEY("product_id") REFERENCES "normalized_products"("id"),
    CONSTRAINT "wishlist_item_user_product_unique" UNIQUE("user_id", "product_id")
);
