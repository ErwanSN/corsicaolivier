# Scénarios fictifs de démonstration

Les données sont clairement identifiables par les préfixes `[DEMO]`, `DEMO-*` et les UUID
commençant par `d0000000`. Elles ont été créées par la migration
`202607190019_demo_operational_scenarios.sql` et sont destinées à l'audit fonctionnel.

## Parcours conseillé

1. Ouvrir **Planning** et sélectionner **Joliette**.
2. Choisir la semaine du **20 au 26 juillet 2026**.
3. Observer les arrivées/départs, les affectations, la haute charge et l'escale annulée.
4. Ouvrir **Collaborateurs** pour retrouver les sept profils `[DEMO]`.
5. Ouvrir **Groupes** puis `[DEMO] Équipe mixte matin` pour voir le groupe transverse
   Joliette/Janet et sa cible de 35 h.
6. Ouvrir **Replanification** pour examiner l'avance, le retard, le départ seul retardé et
   l'annulation.

## Collaborateurs fictifs

| Matricule | Profil                                                  | Heures planifiées |
| --------- | ------------------------------------------------------- | ----------------: |
| DEMO-001  | temps plein, préférence guichets                        |              35 h |
| DEMO-002  | temps plein, toises à éviter                            |              35 h |
| DEMO-003  | contrat 28 h, cheffe habilitée, cible individuelle 28 h |              21 h |
| DEMO-004  | contrat 20 h                                            |              15 h |
| DEMO-005  | temps plein, formation le mercredi                      |              14 h |
| DEMO-006  | contrat 28 h, restriction portique                      |              14 h |
| DEMO-007  | temps plein Janet, membre du groupe transverse          |               0 h |

Les écarts ne sont pas des erreurs de seed : ils servent à rendre visibles les manques de
contrôle et d'aide à l'équilibrage.

## Charges inspirées du corpus

Les sept escales contiennent des valeurs fictives mais plausibles de passagers, piétons,
véhicules, fret et autocars. Le profil `[DEMO] Centre Autos haute charge` ouvre des besoins
sur chef de navire, guichets, toises, contrôles et portique fret, avec ancres arrivée ou
départ.

## Précaution

Le seed et les scénarios `[DEMO]` sont entièrement fictifs. Toute source opérationnelle
reste hors du dépôt, dans le stockage métier contrôlé prévu à cet effet.
