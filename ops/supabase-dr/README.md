# Bootstrap Supabase de reprise

Ce répertoire permet de recréer le socle PostgreSQL Supabase sans dépendre des fichiers
montés par une instance Coolify. Il ne contient aucune valeur secrète et ne doit jamais
en recevoir.

## Provenance et périmètre

- image validée :
  `public.ecr.aws/supabase/postgres:15.8.1.085@sha256:af083ef64d0408c8f098ee6f5c364a59b26f36fbc0f3a334a62c5c1d57362e9b` ;
- observation de la source Coolify : 11 août 2026 ;
- `_supabase.sql`, `logs.sql`, `pooler.sql`, `realtime.sql` et `webhooks.sql` sont des
  copies bit à bit. Leurs empreintes d’origine sont figées dans
  `coolify-source-checksums.sha256` ;
- `roles.sql.template` et `jwt.sql.template` reproduisent les mutations utiles sans
  reprendre de valeur. Ils lisent uniquement l’environnement, contrôlent les valeurs
  requises et quittent avec un code non nul avant leur mutation si un contrôle échoue ;
- `bootstrap-order.txt` reproduit les deux phases et l’ordre lexical de l’image :
  `init-scripts` avec le rôle `postgres`, puis `migrations` avec
  `supabase_admin`.

`Dockerfile.bootstrap` incorpore ces sept fichiers aux emplacements attendus. Ainsi le
démarrage ne dépend d’aucun bind mount Coolify ou chemin propre à l’hôte.

Les scripts intégrés à l’image avant ces sept montages restent fournis par l’image
épinglée. Changer de digest exige un nouvel exercice complet, une comparaison des
scripts intégrés et une mise à jour volontaire des manifestes.

## Vérification hors ligne

Depuis la racine du dépôt :

```sh
bash scripts/supabase-dr-bootstrap.sh verify
pnpm test:database
```

La première commande recalcule toutes les empreintes du bootstrap, du correctif ACL de
reprise et de son oracle. Les tests statiques contrôlent en plus l’ordre, les copies
d’origine, les paramètres fail-closed, le digest de l’image et l’absence de secret
littéral.

## Initialisation recommandée d’un volume neuf

Créer hors du dépôt un fichier de secrets en mode `0600`, alimenté depuis le coffre, qui
définit `POSTGRES_PASSWORD`, `JWT_SECRET` et `JWT_EXP`. Ne jamais afficher le rendu Compose
ni utiliser une option de trace shell : ces deux opérations exposeraient les valeurs
interpolées. `POSTGRES_PASSWORD` doit contenir au moins 16 caractères et `JWT_SECRET` au
moins 32 octets.

Choisir ensuite un identifiant unique pour le ticket ou l’exercice. Le même identifiant
est obligatoire dans `COMPOSE_PROJECT_NAME` et `DR_PGDATA_VOLUME`. Il doit commencer par
`corsica-supabase-dr-`, ne doit jamais être un nom de production et ne doit jamais avoir
déjà servi. Le runner inventorie les conteneurs, réseaux et volumes portant le label du
projet, refuse tout objet existant, crée un volume neuf avec un claim unique puis relit
ce claim pour détecter une création concurrente. Le volume réserve ainsi atomiquement
l’identité commune ; le runner ne supprime jamais de volume.

```sh
export COMPOSE_PROJECT_NAME='corsica-supabase-dr-incident-20260811t230000z'
export DR_PGDATA_VOLUME="$COMPOSE_PROJECT_NAME"
bash scripts/supabase-dr-bootstrap.sh volume-preflight

docker compose \
  --env-file "$DR_SECRETS_FILE" \
  --file ops/supabase-dr/docker-compose.bootstrap.yml \
  config --quiet

docker compose \
  --env-file "$DR_SECRETS_FILE" \
  --file ops/supabase-dr/docker-compose.bootstrap.yml \
  up --build --detach --wait
```

Le volume Compose est déclaré `external` avec le nom obligatoire
`DR_PGDATA_VOLUME`. La composition n’a volontairement aucun `name:` fixe et Compose lit
le `COMPOSE_PROJECT_NAME` obligatoire exporté ci-dessus. Omettre le préflight fait donc
échouer le démarrage au lieu de créer ou réutiliser silencieusement un volume. La
composition n’expose aucun port, utilise un réseau interne, le volume fraîchement réservé
et le digest testé. Si l’initialisation échoue, conserver les journaux expurgés et le
volume en quarantaine pour le ticket, puis recommencer avec un autre nom neuf après
décision opérateur ; ni le runner ni cette procédure ne suppriment automatiquement un
volume.

## Application sur une image de base déjà initialisée

Le runner `apply` sert uniquement lorsque l’image épinglée a déjà exécuté ses scripts
intégrés, mais que les sept montages ne pouvaient pas être fournis au premier démarrage.
Il exige une cible explicitement nommée et compare son socle vierge à l’image qualifiée :
rôles et schémas exacts, aucune autre base, aucun objet métier `public`, aucun ledger
`supabase_migrations`, aucune donnée Auth/Storage et exactement les sept migrations Auth
de base. Un seul écart arrête l’opération avant l’élévation.

Configurer `PGHOST` et `PGPORT` sans URL contenant des identifiants, puis fournir
`POSTGRES_DB=postgres`, `POSTGRES_USER=supabase_admin`, les trois secrets précédents et
`DR_ACKNOWLEDGE_EMPTY_TARGET=YES-I-CONFIRM-EMPTY-TARGET`. Ensuite :

```sh
bash scripts/supabase-dr-bootstrap.sh apply
```

Le runner n’insère aucun secret dans ses arguments `psql`, force l’arrêt sur erreur et
vérifie les propriétaires, schémas et réglages JWT sans lire leur valeur. Pour reproduire
la phase `init-scripts` de l’image, il arme d’abord la compensation, rend temporairement
le rôle `postgres` superuser, relit l’état, puis le remet `NOSUPERUSER` avant la première
entrée `migrations` et relit encore l’état. Un trap effectue aussi ce retrait en cas
d’erreur, y compris si l’accusé de réception de l’élévation est perdu. Cette élévation
justifie à elle seule l’exigence d’une cible isolée et vide. Le runner n’est pas un outil
de migration et ne doit jamais viser une base existante.

Un `SIGKILL`, une perte de l’hôte ou une panne du moteur Docker ne peut pas déclencher le
trap. Dans ce cas, maintenir la cible en quarantaine, interdire toute bascule et se
reconnecter avec `supabase_admin`. Vérifier `pg_roles.rolsuper` puis exécuter explicitement
`alter role postgres nosuperuser;` avant toute autre action ; la reprise ne continue
qu’après relecture de `not rolsuper` et revue croisée dans le ticket.

## ACL après restauration du schéma système

Une initialisation fraîche de l’image peut accorder `anon` et `authenticated` sur les
futurs objets `public` créés par `supabase_admin`. La production durcie ne possède pas
ces droits. Après la passe schema-only et avant les migrations métier, exécuter, avec
`session_user=supabase_admin` :

```sh
psql --no-psqlrc --no-password --set ON_ERROR_STOP=1 \
  --file ops/supabase-dr/recovery-acl.sql
```

Le script exige une base possédée par `postgres`, restaure les ACL de base avec le bon
grantor, reconstruit exactement 27 default ACL et refuse explicitement tout default
`anon/authenticated` sur `supabase_admin.public`. Il est transactionnel et idempotent.
`recovery-acl.expected.txt` est l’oracle textuel à comparer au résultat trié de
`pg_default_acl` pendant la qualification.

Après chaque `supabase db reset`, `pnpm db:reset` lance automatiquement
`pnpm db:harden`. Ce chemin local/CI utilise `local-public-acl-hardening.sql` : il
contrôle seulement les six defaults `public` de `postgres` et `supabase_admin`, sans
imposer l’oracle système PG15 à l’image locale PG17. Il accepte ainsi le privilège
`MAINTAIN` ajouté par PostgreSQL 17 tout en refusant toujours `PUBLIC`, `anon` et
`authenticated` sur le schéma métier.

La restauration métier canonique et ses contrôles de bascule sont décrits dans
[`docs/EXPLOITATION.md`](../../docs/EXPLOITATION.md#sauvegarde-et-restauration).

## Limites explicites

- une archive `pg_dump` ne transporte ni rôles globaux, ni configuration GoTrue/Kong,
  ni objets Storage ; ceux-ci ont leurs propres sauvegardes et secrets opérateur ;
- les valeurs JWT doivent être reprises du coffre si les sessions doivent survivre. Une
  rotation volontaire invalide les sessions et demande un plan de reconnexion ;
- le bootstrap ne décide ni DNS, ni certificats, ni bascule réseau ;
- la restauration avec triggers désactivés est réservée à une instance sans trafic ;
- une nouvelle version majeure PostgreSQL/Supabase ou un nouveau digest invalide la
  qualification actuelle jusqu’à un exercice clean-room complet.
