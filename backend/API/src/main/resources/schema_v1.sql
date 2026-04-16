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