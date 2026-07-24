# Audit fonctionnel, UX, technique et sécurité — 19 juillet 2026

> État historique au 19 juillet 2026. Plusieurs constats ont depuis été corrigés,
> notamment l’éditeur manuel complet, le drag-and-drop et la consolidation de la
> replanification dans le calendrier hebdomadaire unique.

## Verdict

La plateforme est maintenant un **prototype métier cohérent et testable**, mais elle ne
peut pas encore remplacer les classeurs opérationnels ni être homologuée pour la
production. Les fondations sont solides (RLS, rôles, audit, versions immuables,
contraintes temporelles, Next/Nest séparés), tandis que plusieurs fonctions métier
indispensables restent partielles ou absentes.

Le jeu `[DEMO]` a été déployé sur l'instance Supabase distante. Il a permis de découvrir
des défauts réels que la seule lecture du code n'avait pas révélés, notamment : insertion
de shifts impossible à cause d'un trigger générique, recalcul des besoins incompatible
avec un planning publié, retard d'un départ sans arrivée mal calculé et publication d'un
planning vide.

## Méthode et périmètre

- lecture des cinq classeurs Excel et des deux PDF présents dans `corpus/` ;
- comparaison des feuilles vierges avec les trois semaines remplies du 4 au 24 mai 2026 ;
- création de cas fictifs inspirés des charges, postes et mouvements observés ;
- exécution transactionnelle des migrations sur PostgreSQL distant avant déploiement ;
- interrogation directe des résultats et invariants en base ;
- audit statique des parcours Next.js, commandes NestJS, RLS et fonctions PostgreSQL ;
- lint, typage, tests, build de production et audit des dépendances ;
- contrôle HTTP des serveurs locaux.

Limite : le navigateur intégré n'a pas pu établir de session de test authentifiée dans
l'environnement d'audit. Le rendu du corpus a été inspecté visuellement et les écrans ont
été contrôlés par leur source, leurs tests et leur build, mais un vrai test E2E visuel
connecté reste à réaliser.

## Jeu de données et situations créées

La semaine fictive va du lundi 20 au dimanche 26 juillet 2026, sur Joliette.

| Élément                 | Données créées | Intention de test                                                         |
| ----------------------- | -------------: | ------------------------------------------------------------------------- |
| Collaborateurs          |              7 | temps plein, 80 %, 20 h et collaboratrice Janet dans un groupe transverse |
| Escales                 |              7 | arrivées, départ seul, haute charge et annulation                         |
| Services / affectations |        20 / 20 | 0 chevauchement, un service traversant minuit                             |
| Préférences             |              2 | poste préféré et poste à éviter                                           |
| Restriction             |              1 | interdiction temporaire de portique                                       |
| Indisponibilité         |              1 | formation sécurité                                                        |
| Compétence obligatoire  |              1 | coordination d'escale niveau 3                                            |
| Groupe                  |              1 | groupe indépendant des zones, avec membres Joliette et Janet              |
| Perturbations           |              4 | avance, retard, retard du départ seul, annulation                         |

Situations maritimes vérifiées :

- `DEMO-ROT-0721`, Jean Nicoli : avance de 45 minutes, 4 impacts ;
- `DEMO-ROT-0722`, Vizzavona : retard de 90 minutes, 3 impacts ;
- `DEMO-ROT-0723`, A Galeotta : aucune arrivée renseignée et départ retardé de
  75 minutes, 3 impacts correctement ancrés sur le départ ;
- `DEMO-ROT-0725`, Pascal Paoli : annulation, impact critique et besoins masqués dans
  la grille opérationnelle.

Les heures fictives volontairement imparfaites rendent les écarts visibles : 35 h pour
`DEMO-001` et `DEMO-002`, 21 h pour `DEMO-003`, 15 h pour `DEMO-004`, 14 h pour
`DEMO-005` et `DEMO-006`, et aucune heure pour `DEMO-007`. Le système sait calculer ces
écarts, mais ne les utilise pas encore comme garde-fou de publication.

## Comparaison avec le corpus

| Besoin observé dans les Excel/PDF        | État actuel          | Écart restant                                                                                |
| ---------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| Semaine lundi–dimanche                   | Présent              | La grille est figée à 7 jours même si la base accepte jusqu'à 93 jours.                      |
| Lignes Arrivées / Départs                | Présent              | Les ports, codes PAQ et routes ne figurent pas dans la grille.                               |
| Plusieurs mouvements par jour            | Présent              | Affichage compact, sans hiérarchie par escale ni port.                                       |
| Navire et horaires à la minute           | Présent              | Heure réelle d'arrivée/départ non éditable dans l'interface.                                 |
| Charges passagers, piétons, véhicules    | Présent              | Les piétons sont stockés mais ne pilotent pas encore les règles de besoin.                   |
| Fret et autocars                         | Présent              | Stockés et affichés, mais ignorés par le calcul automatique des effectifs.                   |
| Centre Autos et Fret séparés             | Présent              | La famille est déduite du préfixe du code, pas d'un référentiel métier.                      |
| Postes Joliette détaillés                | Largement présent    | Certains libellés/variantes doivent encore être validés par l'exploitation.                  |
| Postes Janet détaillés                   | Largement présent    | Même réserve sur le dictionnaire et les alias historiques.                                   |
| Chefs de navire et référents             | Présent comme postes | Pas de rôle visuel ou de règle de présence obligatoire dédiée.                               |
| Nom et plage horaire dans chaque cellule | Présent              | Un shift traversant minuit n'est visible que le jour de début.                               |
| Plusieurs postes dans un même shift      | Modèle présent       | Lecture possible, mais création/édition multi-affectation absente de l'UI.                   |
| Catalogue d'agents                       | Présent              | Import RH, identité maître et contrôle des doublons restent à réaliser.                      |
| Zones Janet/Joliette extensibles         | Présent              | Aucune gestion d'adresse, terminal ou temps de déplacement entre zones.                      |
| Groupes indépendants des zones           | Présent              | L'objectif de groupe signifie actuellement une cible par membre, ce qui doit être explicité. |
| Objectifs 35 h / temps partiel           | Présent              | Pas de cycles, modulation, nuit, astreinte, majoration ou règles conventionnelles.           |
| Préférence / poste à éviter              | Stocké               | Aucune proposition automatique ne les optimise ; l'évitement n'avertit pas le planificateur. |
| Interdiction et compétence obligatoire   | Contrôlé             | Seulement à la création d'un nouveau shift par la commande métier.                           |
| Besoins relatifs à l'escale              | Présent              | Modèles limités aux ratios passagers/véhicules et non versionnés avec le planning.           |
| Détection manque/sureffectif             | Partiel              | Manque visible ; sureffectif, synthèse et blocage contrôlé de publication absents.           |
| Retard / avance / annulation             | Présent              | Explication UI trop technique, rejet/annulation et fenêtre de gel absents.                   |
| Historique des révisions                 | Présent en base      | Non consultable dans l'interface.                                                            |
| Versions de planning                     | Présent              | Comparaison visuelle de deux versions absente.                                               |
| Export Excel/PDF / impression            | Absent               | Bloquant pour la transition et le mode dégradé.                                              |
| Import Excel/PDF                         | Absent               | Toute saisie est manuelle ; pas de rapprochement ni rapport d'erreurs.                       |
| Programme navires PDF automatisé         | Absent               | Aucune intégration temps réel ou ingestion planifiée.                                        |

La grille reproduit désormais l'idée essentielle du corpus — postes en lignes, jours en
colonnes, mouvements au-dessus, noms et heures dans les cellules — sans reproduire les
milliers de cellules fusionnées. Elle reste toutefois moins riche que les documents sur
les ports, PAQ, charges en tête de journée, référents et impression papier.

## Défauts corrigés pendant l'audit

1. Le trigger de protection des plannings référençait une colonne inexistante sur
   `planning_shifts`, ce qui empêchait toute insertion réelle de shift.
2. Le recalcul des besoins supprimait puis recréait les lignes ; les clés étrangères d'un
   planning publié tentaient alors d'être modifiées et déclenchaient l'immuabilité.
   Le recalcul met maintenant les besoins à jour de façon stable.
3. Deux recalculs dans la même seconde pouvaient utiliser la même clé d'outbox.
4. Un retard portant uniquement sur le départ produisait un décalage nul. Les ancres
   arrivée et départ sont désormais calculées séparément.
5. Une révision maritime identique pouvait être retraitée. Une clé d'idempotence source
   est maintenant imposée.
6. La couverture additionnait les effectifs d'une journée au lieu de mesurer le minimum
   simultané sur le créneau. Elle est désormais temporelle et liée à la bonne escale.
7. Plusieurs affectations d'un même shift n'étaient pas restituées correctement.
8. Les piétons, le fret et les autocars n'étaient pas saisis/affichés complètement.
9. Plusieurs écrans utilisaient silencieusement la première zone. Ils conservent
   maintenant la zone choisie dans les liens et retours.
10. La vue opérationnelle affichait un brouillon avant le planning publié. Elle privilégie
    désormais la version publiée tout en donnant un accès explicite au brouillon.
11. Les escales annulées n'étaient pas clairement visibles dans le calendrier.
12. La publication acceptait un planning vide. Elle refuse maintenant les versions sans
    shift, les shifts sans poste et les affectations liées à une escale annulée.
13. Une vulnérabilité XSS modérée de PostCSS a été supprimée par un override vers 8.5.10.
14. La documentation affirmait à tort qu'aucun nom du corpus n'était seedé. Elle décrit
    maintenant correctement le risque DPO.

## Défauts restant à traiter

### Bloquants avant toute production

1. **Rotation du secret PostgreSQL superutilisateur.** L'URL complète a été communiquée
   hors d'un coffre. Elle doit être considérée exposée, changée, puis remplacée par des
   identités techniques à privilèges minimaux et filtrage réseau.
2. **Authentification non homologable.** La vérification d'e-mail est volontairement
   désactivée et le compte initial est local. Il faut SSO d'entreprise, MFA pour les rôles
   sensibles, politique de session et procédure de dés/habilitation.
3. **Règles RH et légales non validées.** Repos, maximum journalier, nuit, pauses payées,
   modulation, absences et conventions ne sont ni modélisés ni contrôlés.
4. **Pas de source maître intégrée.** Agents, absences, escales et charges reposent sur la
   saisie manuelle ; aucune garantie de fraîcheur ou de complétude opérationnelle.
5. **Exploitation non prouvée.** Sauvegardes/PITR, restauration, supervision, alertes,
   centralisation des logs, SLO, WAF et plan de continuité doivent être configurés et
   testés sur Coolify/Supabase.
6. **Données du corpus.** Le seed contient des noms potentiellement personnels. Il faut
   une décision DPO, une base de développement contrôlée et de préférence un corpus
   anonymisé.

### Priorité haute — fiabilité métier

1. La publication ne bloque pas encore un planning sous-couvert ni un écart d'heures ; il
   faut une validation complète, avec dérogation humaine motivée pour les exceptions.
2. Les besoins ne sont pas figés par version de planning. Une modification de profil peut
   changer a posteriori l'indicateur de couverture d'un planning publié.
3. Aucun contrôle du repos minimum, amplitude, heures quotidiennes, déplacement entre
   sites ou charge mensuelle n'est appliqué à la création d'un shift.
4. Les préférences et postes à éviter sont purement informatifs ; il n'existe ni score,
   ni avertissement, ni solveur d'affectation explicable.
5. L'éditeur sait seulement ajouter un shift. Il ne permet pas de corriger, supprimer,
   déplacer, dupliquer, verrouiller ou scinder un shift en plusieurs postes.
6. La commande de création exige que l'agent appartienne à la zone du planning ; un groupe
   transverse ne suffit donc pas pour planifier temporairement une personne d'une autre
   zone.
7. L'approbation d'un scénario crée une version candidate mais marque déjà le scénario
   `applied` avant publication de cette candidate. Les états métier sont ambigus.
8. L'annulation génère un impact mais le workflow de remplacement, retrait ou confirmation
   des agents n'est pas réalisé.
9. Aucune règle de seuil, fenêtre de gel ou urgence ne distingue un retard à J-3 d'un
   changement trente minutes avant prise de poste.
10. Les prévisions piétons/fret/autocars ne sont pas utilisées par le moteur de besoins.

### Priorité haute — UX opérationnelle

1. La page de replanification affiche des codes techniques et des fragments d'UUID au lieu
   du navire, de l'agent, du poste, des anciennes/nouvelles heures et du décalage lisible.
2. La grille ne propose ni filtre, ni recherche, ni vue agent/groupe/escale, ni synthèse des
   postes non couverts.
3. Les compteurs d'heures ne sont pas visibles directement pendant l'affectation.
4. Les messages d'erreur sont génériques et ne restituent pas la règle exacte rejetée par
   PostgreSQL.
5. Le formulaire d'escale ne choisit ni route, ni port de départ/destination, ni terminal,
   malgré leur présence dans le corpus.
6. Une garde explicite de changements non enregistrés et un vrai retour arrière de saisie
   restent absents.
7. L'accessibilité clavier, le contraste, les lecteurs d'écran, le responsive tablette et
   le zoom à forte densité n'ont pas été testés en E2E WCAG 2.2 AA.

### Priorité moyenne — données et intégrations

1. Pas d'import contrôlé Excel/PDF, de prévisualisation, de rapport d'erreurs ou de
   dédoublonnage.
2. Pas d'export Excel/PDF, d'impression ni de cache hors ligne du dernier planning publié.
3. Pas d'API maritime entrante, de signature de webhook, de quarantaine ou de reprise.
4. Les ports, liaisons, rotations et alias historiques ne sont pas administrables depuis
   l'interface.
5. La liste des escales est limitée à 250 sans filtre de période ni pagination ; elle
   privilégie maintenant les plus récentes mais ne constitue pas un historique navigable.
6. Les listes d'agents, postes, périodes et scénarios ont également des limites fixes sans
   pagination curseur.
7. Les catégories CA/Fret sont inférées par préfixe de code ; elles doivent devenir un
   attribut référentiel.
8. La grille force sept colonnes et ne découpe pas visuellement un shift traversant minuit.

### Qualité, tests et infrastructure

1. Pas de tests E2E authentifiés couvrant planificateur, approbateur et agent.
2. Pas de matrice d'autorisation exécutée sur une base PostgreSQL éphémère réelle.
3. Pas de tests de concurrence sur publication/replanification ni de tests de charge saison
   haute.
4. Pas de test de migration descendante/restauration ; les migrations sont seulement
   validées en montée et syntaxiquement.
5. Pas de contrat OpenAPI versionné ni de client généré entre Next et Nest.
6. L'identifiant HTTP est renvoyé par l'API mais n'est pas propagé jusqu'aux événements DB
   pour une trace distribuée complète.
7. L'outbox et les notifications existent en base, mais aucun worker ni canal de livraison
   n'est opérationnel.

## Contrôles réussis

- migration distante 019 : scénarios et corrections de génération ;
- migration distante 020 : garde-fous de publication ;
- test négatif réel : une publication vide est maintenant rejetée ;
- 7 appels démo, 7 agents démo, 20 shifts, 20 affectations, 0 chevauchement ;
- avance `-45`, retard `+90`, départ seul `+75`, annulation détectée ;
- lint et TypeScript sans erreur ;
- tests Nest, web et migrations sans échec ;
- builds de production NestJS et Next.js réussis ;
- audit des dépendances de production : aucune vulnérabilité connue ;
- API locale `GET /api/health` : `{"status":"ok"}` ; page de connexion locale : HTTP 200.

## Ordre recommandé pour la suite

1. Rotation du secret et sécurisation réseau/SSO.
2. Atelier métier/RH pour figer règles dures, dictionnaire des postes et sens des objectifs
   de groupe.
3. Éditeur de planning visuel complet avec correction/suppression, compteurs et validation
   avant publication.
4. Versionnement des besoins et comparaison de versions.
5. Replanification lisible, publication de la candidate, notifications et accusés.
6. Import/export de transition et intégrations maritimes/RH idempotentes.
7. Campagne E2E, RLS, concurrence, charge, restauration et pentest avant pilote.
