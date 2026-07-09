-- Ajoute username (auto-dérivé du préfixe de l'email, éditable ensuite via /auth/me).
-- Migration non destructive : les lignes existantes sont backfillées.

-- 1) Colonne nullable le temps du backfill
ALTER TABLE "users" ADD COLUMN "username" VARCHAR(30);

-- 2) Backfill depuis le préfixe de l'email (minuscule)
UPDATE "users" SET "username" = lower(split_part("email", '@', 1));

-- 3) Garantir longueur mini (>= 3) et unicité : suffixe court basé sur l'id
UPDATE "users"
SET "username" = left("username" || substr(replace("id"::text, '-', ''), 1, 6), 30)
WHERE length("username") < 3
   OR "username" IN (
     SELECT "username" FROM "users" GROUP BY "username" HAVING count(*) > 1
   );

-- 4) Contraintes finales
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
