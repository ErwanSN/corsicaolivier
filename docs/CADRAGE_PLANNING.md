# Cadrage produit et architecture - Tools Panel / Planning

Statut : document de découverte, à valider avec les équipes métier, RH, DSI et DPO.

## 1. Vision

Tools Panel doit devenir le point d'entrée sécurisé des outils internes Corsica Linea.
Le premier outil, Planning, doit transformer les programmes d'escales et les prévisions
de charge en besoins opérationnels, puis aider les planificateurs à affecter les agents
dans le respect des contraintes légales, contractuelles, opérationnelles et humaines.

L'objectif n'est pas de reproduire Excel dans un navigateur. Il faut séparer :

1. les référentiels : agents, groupes, postes, sites, navires et compétences ;
2. les événements opérationnels : escales, arrivées, départs et prévisions de charge ;
3. les besoins : nombre d'agents et fenêtres de couverture par poste ;
4. les shifts : temps de présence travaillé d'un agent ;
5. les affectations : poste occupé pendant tout ou partie d'un shift ;
6. les compteurs : heures prévues, réalisées, supplémentaires et écarts ;
7. les versions publiées et leur historique d'évolution.

Cette séparation est essentielle : un agent peut occuper plusieurs postes pendant un
même shift sans que ses heures soient comptées plusieurs fois.

## 2. Ce que montre le corpus

### 2.1 Sources analysées

- `corpus/feuillesviergesdepostes/CA Janet.xls` ;
- `corpus/feuillesviergesdepostes/Maquette CA + fret.xls` ;
- trois semaines remplies du 4 au 24 mai 2026 ;
- un état de prévisions passagers et véhicules par port ;
- un programme hebdomadaire des navires.

### 2.2 Organisation actuelle

- Le planning est organisé par semaine, du lundi au dimanche.
- Deux familles opérationnelles apparaissent : Centre Autos et Fret.
- Au moins deux contextes de site sont visibles : Janet et Joliette.
- Les arrivées et départs comportent un navire, une rotation ou un code PAQ, un port,
  une heure et parfois une charge prévue.
- Les journées comportent des chefs de navire, des agents référents, des postes et des
  horaires saisis sous forme de texte libre.
- La feuille Janet comporte un catalogue caché dans la grille : 83 noms d'agents,
  13 codes navire, 16 codes PAQ et 101 modèles de plages horaires.
- La maquette Joliette distingue notamment : guichets, toises, contrôles, contrôles
  Aladdin, gare maritime, débarquement, convois, Chanterac, portes 3A/3B, stockages,
  TRC, Cofrapex, PIF, T0, portique, suiveurs et PC Pinède.
- Les trois maquettes remplies représentent des semaines consécutives, pas des versions
  successives d'une même semaine.
- Aucun classeur ne contient de formule. Tous les calculs et contrôles sont manuels.
- La mise en page repose sur plusieurs milliers de cellules fusionnées, ce qui rend
  l'audit, la comparaison et l'automatisation fragiles.

### 2.3 Entrées opérationnelles identifiées

Le moteur devra au minimum ingérer deux flux distincts :

- programme d'escales : navire, ports, date et heures planifiées ;
- prévisions de charge : passagers réservés, piétons et véhicules.

Le système source de ces documents et l'existence éventuelle d'une API restent à
identifier. L'import Excel/PDF ne doit être qu'un mécanisme transitoire ou de secours.

## 3. Périmètre fonctionnel de la plateforme

Tools Panel doit fournir une fondation commune à tous les futurs outils :

- authentification d'entreprise ;
- catalogue des outils autorisés pour l'utilisateur ;
- gestion des organisations, agences, sites et périmètres ;
- rôles et habilitations ;
- notifications ;
- recherche ;
- pièces jointes éventuelles ;
- journal d'audit ;
- paramètres et référentiels partagés ;
- supervision des intégrations.

Le Planning reste un module isolé fonctionnellement. Un futur outil ne doit pas accéder
directement à ses tables internes.

## 4. Besoins fonctionnels du Planning

### 4.1 Agents

Pour chaque agent :

- identifiant RH stable, matricule, nom d'affichage et statut actif/inactif ;
- site ou sites de rattachement ;
- type de contrat et versions datées du contrat ;
- cible contractuelle hebdomadaire, mensuelle ou annuelle ;
- tolérance et règles d'heures supplémentaires ;
- compétences, habilitations et dates d'expiration ;
- indisponibilités, congés, absences et restrictions de planification ;
- groupes d'appartenance avec dates d'effet ;
- préférences de postes ;
- postes à éviter ;
- postes interdits ou non habilités, distincts d'une simple préférence négative ;
- préférences de créneaux, sites ou types d'opération si le métier le confirme ;
- historique des changements et de l'auteur du changement.

Les motifs médicaux, syndicaux, religieux ou disciplinaires ne doivent pas être saisis
en commentaire libre. Une restriction utile au planning doit être représentée par une
catégorie minimale, avec accès limité et durée de conservation définie.

### 4.2 Groupes d'agents

- création, renommage, archivage et composition datée ;
- groupe principal et groupes secondaires à confirmer ;
- cible d'heures propre au groupe ;
- cible ou quota individuel dérogeant éventuellement au groupe ;
- compétences ou postes communs ;
- règles de rotation et d'équité ;
- responsable ou planificateur du groupe ;
- filtres et vues par groupe.

Il faut distinguer la cible légale ou contractuelle d'un agent de l'objectif interne
d'allocation d'un groupe. Une cible d'allocation ne doit jamais autoriser une violation
d'une contrainte légale ou contractuelle.

### 4.3 Postes

Pour chaque poste :

- libellé, code stable, famille, description et statut ;
- site, zone et emplacement ;
- Centre Autos, Fret ou autre domaine ;
- compétences et habilitations obligatoires ;
- niveau de priorité opérationnelle ;
- effectif minimum, nominal et maximum ;
- fenêtres horaires fixes ou relatives à une arrivée/départ ;
- règles dépendant du navire, de la liaison ou de la charge ;
- incompatibilités avec d'autres postes ;
- temps de préparation, relève et fermeture ;
- postes pouvant être cumulés ou enchaînés ;
- règles de rotation, pénibilité ou équité à confirmer ;
- modèles de besoin réutilisables.

### 4.4 Référentiel maritime

- ports, terminaux, sites et fuseaux horaires ;
- navires avec code stable et alias historiques ;
- liaisons et rotations ;
- escales et mouvements d'arrivée/départ ;
- horaires planifiés, estimés et réels ;
- état : planifié, confirmé, retardé, avancé, annulé, terminé ;
- source, date de réception et niveau de confiance ;
- prévisions passagers, piétons, véhicules et fret ;
- historique de chaque mise à jour.

Les chaînes visibles dans Excel comme `BIA`, `AJA`, `ALG`, `TUN`, `PAQ 78` ou `CASA`
doivent devenir des identifiants référentiels documentés, jamais des valeurs libres.

### 4.5 Transformation des escales en besoins

Un modèle de besoin doit pouvoir exprimer, par exemple :

- ouvrir un poste X minutes avant le départ ;
- maintenir un poste Y minutes après l'arrivée ;
- demander N agents selon des seuils de véhicules ou de piétons ;
- activer des postes différents selon domestic/international, port, site ou navire ;
- ajouter un chef ou référent pour une combinaison d'opérations ;
- créer des besoins CA et Fret distincts pour la même escale ;
- conserver une justification lisible de chaque besoin généré.

Une modification d'un modèle ne doit pas réécrire silencieusement les plannings déjà
publiés. Les modèles et les plannings doivent être versionnés.

### 4.6 Construction du planning

- vues jour, semaine, agent, groupe, poste, site et escale ;
- création manuelle d'un shift et d'une affectation ;
- glisser-déposer accessible avec alternative clavier ;
- duplication contrôlée d'une journée ou d'une semaine ;
- proposition automatique d'affectations ;
- verrouillage d'un shift, d'une affectation ou d'une période ;
- détection immédiate des conflits ;
- affichage des postes non couverts et des sureffectifs ;
- affichage des compteurs d'heures et repos ;
- comparaison entre versions ;
- commentaires opérationnels structurés ;
- statut brouillon, en validation, publié, remplacé et archivé ;
- export PDF/Excel et impression lisible pendant la transition ;
- import initial contrôlé des référentiels historiques.

### 4.7 Contraintes du moteur

Les contraintes doivent être classées et explicables.

Contraintes dures, jamais violées par la génération automatique :

- chevauchement de shifts ou d'affectations incompatibles ;
- indisponibilité ;
- habilitation obligatoire manquante ou expirée ;
- temps de déplacement incompatible entre deux sites ;
- limites légales ou contractuelles validées par RH ;
- repos minimum ;
- poste explicitement interdit ;
- planning verrouillé ;
- effectif minimum d'un poste critique, sauf validation humaine tracée.

Contraintes souples, optimisées selon une pondération configurable :

- préférence positive ;
- poste à éviter ;
- équilibre des heures et des postes ;
- proximité de la cible hebdomadaire/mensuelle ;
- continuité d'une équipe ;
- limitation des changements tardifs ;
- équité des créneaux et postes moins recherchés ;
- stabilité par rapport au planning publié.

Chaque proposition automatique doit expliquer ses principaux choix et toute contrainte
non satisfaite. Le planificateur reste décisionnaire.

### 4.8 Calcul du temps

- un shift possède un début, une fin, des pauses et une durée payée ;
- une affectation relie une portion de shift à un poste ou une escale ;
- les shifts traversant minuit sont supportés ;
- les pauses payées et non payées sont distinguées ;
- les heures planifiées, réalisées et validées sont des compteurs différents ;
- les écarts sont calculés par semaine, mois et période contractuelle ;
- les absences et récupérations ont des règles explicites ;
- les arrondis sont centralisés et testés ;
- chaque compteur est recalculable et auditable à partir des événements sources.

La référence générique de 35 heures ne suffit pas. Les accords d'entreprise,
conventions, cycles, temps partiels, astreintes, travail de nuit et exceptions doivent
être validés par RH et représentés par des règles datées.

### 4.9 Retard, avance ou annulation d'un navire

Une mise à jour maritime suit ce flux :

1. réception idempotente de la nouvelle estimation ;
2. conservation de l'ancienne valeur et de la source ;
3. recalcul des fenêtres de besoin relatives à l'escale ;
4. analyse d'impact sur les besoins, shifts, affectations, repos et heures ;
5. proposition d'un nouveau scénario sans écraser le planning publié ;
6. conservation des éléments verrouillés ;
7. validation humaine selon seuil et proximité de l'événement ;
8. publication d'une nouvelle version ;
9. notification ciblée des agents concernés ;
10. accusé de réception et escalade des non-réponses ;
11. possibilité de retour arrière.

Par défaut, aucun planning publié ne doit être modifié silencieusement. Des règles de
réaction automatique pourront être activées uniquement pour des cas bornés et validés.

Paramètres à définir : seuil de retard, fenêtre de gel, horizon de replanification,
postes fixes, postes relatifs, canal de notification et autorité d'approbation.

### 4.10 Publication et communication

- aperçu des changements avant publication ;
- liste nominative des agents impactés ;
- notification web, e-mail, SMS ou canal d'entreprise à choisir ;
- accusé de lecture ou d'acceptation selon le processus RH ;
- journal de qui a publié quoi et pourquoi ;
- vues agent limitées à ses informations utiles ;
- mode impression et export de secours ;
- continuité dégradée en cas d'indisponibilité du SI.

## 5. Rôles proposés

- Administrateur plateforme : outils, organisations et intégrations.
- Administrateur Planning : référentiels et règles du module.
- Planificateur : création, génération et modification des brouillons.
- Validateur ou responsable d'exploitation : publication et dérogations.
- Superviseur : consultation opérationnelle et incidents du jour.
- Agent : consultation de son planning, préférences autorisées et accusés.
- RH : contrats, règles de temps et accès aux données RH nécessaires.
- Auditeur ou DPO : consultation ciblée des traces et politiques.

Les droits doivent être limités par site et domaine. Un rôle global ne doit pas donner
automatiquement accès à tous les agents et toutes les données RH.

## 6. Architecture cible

### 6.1 Choix directeur

Commencer par un monolithe modulaire NestJS, pas par une constellation de microservices.
Les limites de modules, les contrats d'événements et la base doivent néanmoins permettre
d'extraire un moteur d'optimisation ou une intégration si la charge le justifie.

Modules Nest proposés :

- Identity & Access ;
- Organization & Sites ;
- Workforce ;
- Groups ;
- Positions & Skills ;
- Maritime Operations ;
- Demand Templates ;
- Planning ;
- Time Ledger ;
- Disruption Management ;
- Notifications ;
- Audit ;
- Integrations.

### 6.2 Composants

- Next.js : interface, Server Components par défaut, Tailwind, aucun style inline dans
  la source et composants clients uniquement quand l'interaction le nécessite.
- NestJS : seule API métier consommée par le navigateur, OpenAPI versionnée.
- Supabase Postgres : source de vérité transactionnelle et migrations versionnées.
- Supabase Auth ou IdP d'entreprise : identité fédérée, à décider avec la DSI.
- Stockage objet : imports et exports, avec antivirus et durées de rétention.
- Worker durable : imports, recalculs, notifications et optimisation hors requête HTTP.
- Outbox transactionnelle : publication fiable des événements internes.
- Moteur d'optimisation : composant isolé derrière un contrat stable ; il ne doit pas
  écrire directement en base ni publier un planning.

Pour les transactions métier complexes, Nest doit utiliser une connexion PostgreSQL
avec un rôle dédié et de moindre privilège. La clé Supabase secrète globale doit être
réservée aux rares tâches système qui le nécessitent.

### 6.3 Modèle conceptuel minimal

- `organizations`, `sites`, `zones` ;
- `users`, `roles`, `role_scopes` ;
- `agents`, `employment_periods`, `contract_versions` ;
- `groups`, `group_memberships`, `hour_targets` ;
- `skills`, `agent_skills` ;
- `positions`, `position_requirements`, `agent_position_preferences` ;
- `ports`, `vessels`, `routes`, `port_calls`, `load_forecasts` ;
- `demand_templates`, `demand_template_versions`, `staffing_requirements` ;
- `planning_periods`, `schedule_versions`, `work_shifts`, `assignments` ;
- `time_ledger_entries`, `constraint_violations`, `approval_decisions` ;
- `notifications`, `acknowledgements` ;
- `integration_events`, `outbox_events`, `audit_events`.

Toutes les relations sensibles et toutes les règles variables dans le temps doivent
être datées. Les suppressions métier importantes sont des archivages, pas des suppressions
physiques immédiates.

## 7. Sécurité et protection des données

### 7.1 Identité et autorisation

- SSO d'entreprise, idéalement Microsoft Entra ID si c'est l'IdP Corsica Linea ;
- MFA imposée par l'IdP ;
- comptes locaux de secours très limités et surveillés ;
- sessions courtes pour les rôles privilégiés ;
- RBAC complété par le périmètre site/domaine ;
- contrôle d'autorisation dans Nest et politiques RLS en défense en profondeur ;
- révocation immédiate lors du départ ou changement de fonction.

Supabase rappelle que les clés de service peuvent contourner RLS. Elles ne doivent donc
jamais porter les requêtes courantes d'un utilisateur ni être exposées au navigateur.

### 7.2 Données et secrets

- TLS partout et chiffrement au repos ;
- secrets uniquement dans un coffre par environnement ;
- rotation et journalisation des accès aux secrets ;
- région d'hébergement et sous-traitants validés par DSI/DPO ;
- validation stricte de tous les imports ;
- antivirus pour les fichiers ;
- limitation des commentaires libres ;
- masquage des données personnelles dans les logs et environnements hors production ;
- jeux de tests synthétiques, jamais copie brute de production.

### 7.3 Audit

Un événement d'audit append-only doit contenir : acteur, action, ressource, horodatage,
périmètre, valeurs avant/après minimisées, motif et identifiant de corrélation.

À auditer au minimum : habilitations, agents, contrats, préférences, règles, imports,
générations, dérogations, publications, changements d'escale et exports.

### 7.4 RGPD et droit du travail

- registre de traitement et finalités ;
- information des salariés avant mise en service ;
- analyse DPO et, si nécessaire, AIPD ;
- habilitations strictes aux données de personnel ;
- droits d'accès et de rectification ;
- politique de conservation par catégorie ;
- consultation des instances représentatives à valider ;
- validation RH/juridique des règles de temps et délais de prévenance.

Sources de cadrage :

- CNIL, règles de gestion du personnel :
  https://www.cnil.fr/fr/les-regles-pour-la-gestion-du-personnel
- CNIL, durées de conservation RH :
  https://www.cnil.fr/fr/referentiel-durees-conservation-donnees-rh
- Service-Public, durée du travail :
  https://www.service-public.fr/particuliers/vosdroits/F1911
- Service-Public, repos hebdomadaire :
  https://www.service-public.fr/particuliers/vosdroits/F2327

Les règles exactes applicables à Corsica Linea ne doivent pas être déduites de ces seules
références générales. L'accord d'entreprise et la convention applicable sont requis.

### 7.5 Sécurité applicative et chaîne de livraison

- environnements dev, recette et production isolés ;
- infrastructure as code ;
- branches protégées, revue obligatoire et commits signés selon politique DSI ;
- SAST, analyse des dépendances, secret scanning, SBOM et analyse des conteneurs ;
- migrations testées sur restauration ;
- tests d'autorisation négatifs ;
- rate limiting, validation des entrées, CSP et en-têtes de sécurité ;
- observabilité centralisée, alertes et corrélation sans données RH en clair ;
- sauvegardes, restauration testée et PITR en production ;
- plan de réponse à incident et procédure de continuité manuelle.

Références :

- Supabase RLS : https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase SAML SSO : https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml
- Supabase PITR : https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery
- ANSSI, règles essentielles : https://cyber.gouv.fr/securisation/10-regles-or-securite-numerique/

## 8. Exigences non fonctionnelles proposées

Valeurs à contractualiser, pas à considérer comme acquises :

- disponibilité cible initiale : 99,9 % mensuel ;
- lecture courante : p95 inférieur à 500 ms côté API hors intégration externe ;
- sauvegarde/PITR : RPO recommandé inférieur ou égal à 15 minutes ;
- reprise : RTO recommandé inférieur ou égal à 2 heures ;
- aucun point de défaillance empêchant l'accès au dernier planning publié ;
- import idempotent et reprise après erreur ;
- génération d'une semaine explicable et reproductible ;
- conformité WCAG 2.2 AA pour les parcours essentiels ;
- usage tablette et mobile pour la consultation agent ;
- heure stockée en UTC, affichée selon le fuseau du site ;
- pagination et indexation dès la conception ;
- traçabilité distribuée par identifiant de corrélation.

## 9. Stratégie de test AAA

- tests unitaires des règles de temps et contraintes ;
- tests de propriétés sur chevauchements, repos et traversées de minuit ;
- tests d'intégration sur une vraie base PostgreSQL éphémère ;
- tests de migrations aller et restauration ;
- tests de contrats pour chaque flux maritime ;
- tests E2E des parcours planificateur, validateur et agent ;
- matrice automatisée d'autorisations positives et négatives ;
- tests de concurrence sur publication et replanification ;
- tests de charge sur une saison haute ;
- tests de chaos ciblés sur indisponibilité d'intégration et notification ;
- pentest avant production puis périodiquement ;
- cas de référence issus du corpus, anonymisés et validés par le métier.

## 10. Feuille de route recommandée

### Phase 0 - Découverte et gouvernance

- ateliers exploitation, planification, RH, DSI, DPO et représentants métier ;
- dictionnaire des codes et postes ;
- récupération des règles contractuelles ;
- identification des systèmes sources ;
- cartographie des rôles ;
- critères d'acceptation sur une semaine réelle anonymisée.

### Phase 1 - Fondation plateforme

- SSO, rôles, sites, audit et observabilité ;
- référentiels agents, groupes, postes, compétences et navires ;
- import initial contrôlé ;
- CI/CD, migrations et sauvegardes.

### Phase 2 - Planning manuel fiable

- escales et prévisions de charge ;
- modèles de besoins ;
- planning manuel avec conflits, compteurs et versioning ;
- validation, publication, export et consultation agent.

Cette phase doit déjà remplacer Excel sans dépendre d'un solveur automatique.

### Phase 3 - Aide à la génération

- génération des besoins ;
- propositions d'affectation ;
- préférences, équité et explications ;
- comparaison avec les plannings de référence ;
- réglage des pondérations avec les planificateurs.

### Phase 4 - Temps réel et perturbations

- intégration horaire estimée/réelle ;
- analyse d'impact et scénarios ;
- approbation, notifications et accusés ;
- exercices de retard, avance et annulation.

### Phase 5 - Industrialisation du Tools Panel

- catalogue extensible ;
- gouvernance des nouveaux outils ;
- mutualisation contrôlée des notifications, documents et référentiels.

## 11. Décisions bloquantes avant implémentation métier

1. Quels sites et équipes entrent dans le premier pilote : Joliette, Janet, Fret, CA ?
2. Quel est le système RH maître des agents, contrats, congés et absences ?
3. Quel IdP d'entreprise doit être utilisé ?
4. Quelle convention et quels accords d'entreprise régissent chaque population ?
5. Un agent peut-il appartenir à plusieurs groupes simultanément ?
6. La cible d'heures d'un groupe est-elle une enveloppe, une moyenne ou une obligation ?
7. Comment sont calculées pauses, nuits, dimanches, jours fériés, heures supplémentaires
   et shifts traversant minuit ?
8. Quels postes nécessitent une habilitation, une rotation ou un effectif minimum ?
9. Une préférence négative peut-elle être outrepassée ? Par qui et avec quelle trace ?
10. Quel système fournit escales, retards, avances et charges ? API, message, fichier ?
11. Quelle source fait foi en cas d'informations contradictoires ?
12. Quel retard déclenche une alerte, une proposition ou une replanification ?
13. Quelle fenêtre avant prise de poste interdit une modification automatique ?
14. Qui valide et publie un planning ou une dérogation ?
15. Quels canaux de notification sont autorisés et faut-il un accusé ?
16. Les agents peuvent-ils déclarer eux-mêmes préférences et indisponibilités ?
17. Faut-il gérer le réalisé ou uniquement le prévisionnel ?
18. Quels exports restent contractuels ou nécessaires au mode dégradé ?
19. Quels volumes maximaux : agents, sites, escales simultanées et utilisateurs ?
20. Quels objectifs DSI de disponibilité, RPO, RTO, hébergement et rétention ?

## 12. Critères de sortie du cadrage

Le développement métier peut commencer lorsque :

- le périmètre pilote et les responsables de décision sont nommés ;
- le dictionnaire agents/postes/navires/ports/codes est validé ;
- les règles de temps et de prévenance sont signées par RH/juridique ;
- les sources d'escales et de charge sont documentées ;
- les rôles et périmètres d'accès sont validés ;
- un jeu de données anonymisé et des résultats attendus sont disponibles ;
- les seuils de replanification et le workflow de publication sont décidés ;
- les exigences de sécurité, rétention, RPO et RTO sont acceptées ;
- les non-objectifs de la première version sont explicitement fixés.
