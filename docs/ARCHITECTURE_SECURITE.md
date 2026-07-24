# Architecture et sécurité

Statut : fondations implémentées, à faire homologuer par la DSI, le RSSI, le DPO et les
représentants métier avant mise en production.

## 1. Découpage et frontières de confiance

Le navigateur exécute Next.js et ne reçoit que la clé Supabase publiable. Supabase Auth
gère la session. Toute opération métier transite ensuite par NestJS avec le JWT de
l’utilisateur. NestJS vérifie cryptographiquement le JWT, applique les rôles et le
périmètre demandé, puis interroge Supabase avec ce même JWT. PostgreSQL applique la RLS
comme deuxième contrôle indépendant.

Ni le web ni l’API métier ne chargent de clé secrète Supabase. Une telle clé est réservée
aux traitements système explicitement isolés : worker d’outbox, intégrations et
maintenance. Elle ne doit jamais être utilisée pour une requête métier ordinaire, car
elle contourne la RLS.

## 2. Autorisations

Les rôles sont `platform_admin`, `planning_admin`, `planner`, `approver`, `supervisor`,
`agent`, `hr` et `auditor`. Une attribution est datée et porte sur une organisation,
éventuellement limitée à un site. `platform_admin` est le seul rôle global.

La vérification suit quatre étapes :

1. signature, expiration et nature non anonyme du JWT ;
2. compte applicatif actif ;
3. rôle compatible avec l’action ;
4. organisation et site compatibles avec l’attribution active.

Les agents n’accèdent qu’à leurs données personnelles prévues par les policies. Les
compétences vérifiées et interdictions de poste sont modifiables uniquement par les
rôles administratifs/RH. La publication exige un approbateur.

## 3. Modèle de données Planning

Le modèle sépare les contrats, les dérogations d’objectif hebdomadaire, les shifts et le
registre des heures. Il sépare également le shift de l’affectation à un poste : plusieurs
affectations au cours d’un même shift ne multiplient donc jamais les heures de l’agent.

Les escales conservent toutes leurs révisions. Les besoins de personnel sont liés à une
escale et à une version de profil de charge. Un retard, une avance ou une annulation crée
un événement de perturbation, puis un scénario d’impact. Le planning publié n’est jamais
modifié sur place : un scénario approuvé produit une version candidate, publiée dans une
transaction qui archive la version précédente, marque le scénario appliqué et crée des
notifications d’agents idempotentes ainsi qu’un événement d’outbox.

Les contraintes PostgreSQL empêchent notamment :

- les références croisées entre organisations ;
- deux shifts qui se chevauchent pour un agent dans une même version ;
- une affectation située hors des bornes de son shift ;
- plusieurs versions publiées pour une même période ;
- la modification du contenu d’une version publiée ou archivée.

## 4. Audit et traçabilité

`audit_events` est append-only. Les triggers de tables enregistrent l’acteur, le périmètre,
la ressource et les états avant/après. Le journal est lisible uniquement par les rôles
autorisés. Les événements de notification utilisent une outbox transactionnelle et une
clé d’idempotence, afin qu’une panne de canal ne perde pas la décision métier.

Les requêtes HTTP ont un identifiant renvoyé dans `x-request-id`. Fastify produit les logs
structurés et l’API applique Helmet, une CORS explicite, une validation stricte des DTO et
une limitation globale du débit.

## 5. Secrets et données personnelles

- Secrets en coffre de secrets par environnement, rotation documentée et jamais dans Git.
- Clé publiable côté web/API métier ; clé secrète uniquement dans un worker système isolé.
- Les scénarios automatisés utilisent uniquement des agents `[DEMO]`. Le seed local
  historique contient toutefois des noms issus du corpus ; il est réservé aux
  environnements autorisés et doit être anonymisé avant toute généralisation.
- Le corpus reste une source d’analyse locale et ne fait pas partie des artifacts de build.
- Les durées de conservation, droits d’accès, finalités et exports RGPD restent à valider avec le DPO.

## 6. Exploitation cible

Avant production, il faut achever et prouver :

- SSO d’entreprise, MFA obligatoire pour les rôles sensibles et politique de session ;
- environnements Supabase isolés, sauvegardes/PITR et exercice de restauration ;
- WAF ou reverse proxy, quotas par route et règles réseau ;
- collecte centralisée des logs, métriques, traces, alertes et tableaux SLO ;
- scan SAST, dépendances, secrets, images et migrations dans la CI ;
- tests RLS sur une vraie instance PostgreSQL, tests de charge et test d’intrusion ;
- procédure d’habilitation/déshabilitation, revue périodique des droits et runbooks d’incident ;
- validation juridique des règles d’heures, repos, absences et conventions applicables.

La dépendance transitive PostCSS est forcée vers une version corrigée par un override pnpm.
La CI doit continuer à échouer sur toute vulnérabilité haute ou critique et contrôler que
cet override reste compatible à chaque mise à jour de Next.js.
