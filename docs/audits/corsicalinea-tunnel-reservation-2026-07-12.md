# Tunnel de réservation CORSICA Linea

Audit fonctionnel du 12 juillet 2026, arrêté avant toute validation de paiement. Le moteur transactionnel officiel est SeaWeb (`/tsw`) et conserve son état côté session.

## Parcours nominal

| Étape                | Données et décisions                                                                                       | Sortie attendue                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 0. Recherche rapide  | Aller-retour ou aller simple, réseau, dates, code promotionnel facultatif                                  | Lancement du moteur avec les critères            |
| 1. Traversées        | Port de départ/arrivée, date, horaire, navire, tarif ; choix séparé aller et retour                        | Itinéraire et classe tarifaire                   |
| 2. Prestations       | Nombre et catégories de passagers, véhicule facultatif et caractéristiques                                 | Composition du voyage et tarification recalculée |
| 3. Installations     | Sans place affectée, fauteuil ou cabine ; quantité et répartition des passagers, pour chaque trajet        | Couchages/places cohérents avec les voyageurs    |
| 4. Restauration      | Formules prépayées par trajet et quantités, ou refus explicite                                             | Options de repas                                 |
| 5. Animal            | Nombre d’animaux et espace chenil, ou « Non merci »                                                        | Option animal                                    |
| 6. Voyageurs/contact | Civilité, nom, prénom, âge/date de naissance, adresse, coordonnées et, selon le réseau, passeport/identité | Dossier nominatif conforme                       |
| 7. Récapitulatif     | Trajets, passagers, véhicule, installations, options, taxes, conditions, code promo/avantage               | Consentement éclairé avant paiement              |
| 8. Paiement          | Moyen de paiement, paiement intégral ou partiel si éligible, informations du moyen choisi                  | Redirection PSP puis confirmation                |
| 9. Confirmation      | Numéro de dossier, statut du règlement, billet et email                                                    | Réservation consultable dans Mon compte          |

## Embranchements à reproduire

- Réseaux Corse, Algérie et Tunisie : ports, documents exigés, offres et contraintes diffèrent.
- Aller simple versus aller-retour ; sélection tarifaire indépendante par segment.
- Avec/sans véhicule : type, hauteur/longueur et véhicule tracté influencent disponibilité et prix.
- Adultes, enfants, bébés et âges : contrôles de cohérence avec les installations.
- Avec/sans installation ; plusieurs cabines/fauteuils et répartition nominative.
- Restauration et animal peuvent être refusés explicitement afin d’éviter une étape ambiguë.
- Compte facultatif : réservation invitée possible, création/connexion recommandée pour fidélité et gestion ultérieure.
- Code promotionnel/code avantage dans le panier ; éligibilité recalculée.
- Paiement partiel : minimum annoncé de 20 % hors taxes lorsque le dossier est éligible, avec échéance de solde.
- Moyens historiquement documentés : CB/Visa/Mastercard, American Express sous conditions, PayPal sous conditions et solutions alternatives selon éligibilité. La disponibilité exacte doit venir du backend, jamais être codée en dur dans l’UI.

## États d’erreur indispensables

- Traversée épuisée ou tarif devenu indisponible pendant le parcours.
- Cabine insuffisante pour le nombre/âge des occupants.
- Véhicule hors gabarit ou combinaison véhicule/remorque non admise.
- Document obligatoire manquant, expiré ou format invalide pour le Maghreb.
- Code promotionnel invalide, expiré, non cumulable ou incompatible avec le tarif.
- Changement de prix avant récapitulatif, session expirée, double soumission.
- Paiement refusé, interrompu, authentification 3-D Secure abandonnée ou retour PSP incertain.
- Paiement partiel non éligible ou échéance dépassée.

## Proposition améliorée

1. Un configurateur unique et progressif avec récapitulatif persistant, prix total visible et sauvegarde automatique.
2. Recherche port-à-port plutôt que choix préalable d’un « réseau » interne à l’entreprise.
3. Résultats comparables par durée, arrivée, navire, flexibilité et prix total, avec explication claire des tarifs.
4. Voyageurs et véhicule saisis une seule fois ; options présentées ensuite selon leur éligibilité réelle.
5. Cabines sous forme de cartes visuelles avec capacité, sanitaires, accessibilité, photos et différence de prix.
6. Options réellement facultatives avec bouton « Continuer sans… », sans dark pattern.
7. Identités demandées le plus tard possible mais contraintes documentaires annoncées dès la recherche.
8. Récapitulatif détaillant tarif, installations, options, taxes et conditions de modification/remboursement.
9. Paiement isolé dans une étape courte, reprise sûre après 3-D Secure et confirmation idempotente.
10. Accessibilité WCAG 2.2 AA, navigation clavier, erreurs liées aux champs, annonces live et conservation des saisies.

## Architecture cible dans Corsica

Le domaine recommandé est `/reservation`, distinct du site éditorial et des espaces salarié/admin :

```text
/reservation
  /traversees
  /voyageurs
  /installations
  /options
  /coordonnees
  /recapitulatif
  /paiement
  /confirmation
```

L’état doit être un `BookingDraft` versionné côté serveur, adressé par un identifiant opaque, avec calcul tarifaire exclusivement serveur. Chaque étape valide un sous-schéma contractuel. Les intentions de paiement et confirmations doivent utiliser des clés d’idempotence. Aucune donnée bancaire ne doit transiter par l’application : utiliser les composants hébergés/tokenisés du prestataire de paiement.

## Critères de qualité avant implémentation

- Matrice de tests couvrant réseaux × sens × véhicule × composition × installation × tarif.
- Tests contractuels du moteur de disponibilité et de tarification.
- E2E du parcours nominal, reprise de session, indisponibilité et échec de paiement simulé.
- Budget performance mobile : LCP < 2,5 s, INP < 200 ms, CLS < 0,1 au 75e percentile.
- Événements analytiques sémantiques par étape, sans données personnelles.
- Journal d’audit du prix accepté et des conditions tarifaires présentées.

## Sources publiques utilisées

- Accueil et navigation officielle de corsicalinea.com.
- Guide officiel « Comment réserver un billet CORSICA linea ».
- FAQ officielle et pages « Facilités de règlement » / conditions générales d’offres.
- Pages officielles des traversées, offres, ports, informations pratiques, navires et entreprise.

Le paiement n’a pas été soumis et aucune réservation réelle n’a été créée pendant cet audit.
