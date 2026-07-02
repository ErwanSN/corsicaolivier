# Principes

## Objectif

Construire une plateforme client durable, observable, securisee et scalable pour le web,
iOS, Android et les integrations backend.

## Regles

- Le frontend ne connait jamais la base de donnees.
- Le backend expose des contrats stables, versionnes et testes.
- Les services sont stateless par defaut.
- Les operations lentes sont asynchrones.
- Le cache est explicite, mesure et invalidable.
- Les donnees personnelles sont minimales, protegees et tracables.
- Chaque chemin critique a des logs, metriques et traces.
- Les decisions structurantes sont documentees en ADR.
