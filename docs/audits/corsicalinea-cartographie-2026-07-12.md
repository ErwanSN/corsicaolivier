# Cartographie de corsicalinea.com

Audit réalisé le 12 juillet 2026 sur la version française publique. Cette cartographie couvre l’intégralité de l’arborescence accessible depuis la navigation principale, les liens de pied de page et les entrées transactionnelles. Les archives du blog, les résultats de recherche/FAQ et les versions traduites sont des collections dynamiques, et non un ensemble fini de pages statiques.

## Architecture globale

| Univers     | Entrée                                        | Rôle                                                             |
| ----------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Accueil     | `/`                                           | Découverte, recherche rapide, offres, destinations, réassurance  |
| Réserver    | `/reserver/*` et `/tsw/*`                     | Traversées, horaires, promotions et moteur transactionnel SeaWeb |
| Préparer    | `/preparer-votre-voyage/*`                    | Ports, destinations et informations pratiques                    |
| Vie à bord  | `/vie-a-bord/*`                               | Navires, restauration et services                                |
| Fret        | `/fret/*`                                     | Parcours professionnel séparé                                    |
| Compagnie   | `/la-compagnie/*`                             | Institutionnel, recrutement, presse, partenaires                 |
| Engagements | `/nos-engagements/*`                          | Environnement, société et satisfaction                           |
| Assistance  | `/plus/faq`, `/la-compagnie/nous-contacter/*` | FAQ, agences et contact                                          |
| Compte      | `/tsw/consumer.login2.do`                     | Connexion, inscription, récupération, réservation existante      |
| Légal       | `/plus/*`                                     | CGV, CGT, CGO, données, cookies et tarifs                        |

## Réserver

- Index et horaires : `/reserver/infos-lignes-et-horaires`.
- Traversées : `marseille-la-corse`, `marseille-ajaccio`, `marseille-bastia`, `marseille-ile-rousse`, `marseille-propriano`, `marseille-alger`, `marseille-bejaia`, `marseille-skikda`, `marseille-tunis`, `sete-bejaia`, `sete-skikda`, sous `/reserver/les-traversees/`.
- Index d’offres : `/listes-d-offres/{corse,algerie,tunisie,residents-abonnes}` et `/reserver/offres-et-promotions/{corse,algerie,tunisie,residents-abonnes}`.
- Corse : `reservations-saison`, `reservations-apres-saison`, `tarifs-flex-et-super-flex`, `debarquement-prioritaire`, `offre-hebergeurs-ce`, `linea-club`.
- Algérie : `reservations`, `reservation-saison`, `tarif-famille`, `tarif-escapade`, `linea-fid`.
- Tunisie : `reservations`, `reservation-saison`, `operation-tunisie`, `tarif-amitie`, `tarif-famille`, `tarif-escapade`, `linea-fid`.
- Résidents et abonnés : `tarif-resident`, `abonnement`, `abonnement-professionnel`, `aria-e-mare`.

## Préparer le voyage

- Ports : index `/preparer-votre-voyage/les-ports`, puis `la-corse`, `marseille`, `ajaccio`, `bastia`, `ile-rousse`, `propriano`, `alger`, `bejaia`, `skikda`, `tunis`, `sete`.
- Destinations : `marseille`, `corse`, `alger`, `tunis` sous `/preparer-votre-voyage/les-destinations/`.
- Informations pratiques : `linea-fid`, `linea-club`, `embarquement`, `femmes-enceintes`, `pieces-d-identite-et-billets`, `voyager-avec-des-enfants`, `dispositifs-de-securite`, `voyage-vers-le-maghreb`, `facilites-de-reglement`, `personnes-a-mobilite-reduite`, `assistance-medicale`, `voyager-avec-son-animal`, `objets-trouves`, `assurance-voyage`.

## Vie à bord

- `/vie-a-bord/restauration-bars` et `/vie-a-bord/services-a-bord`.
- Navires : `capu-di-muru`, `capu-rossu`, `a-galeotta`, `pascal-paoli`, `vizzavona`, `danielle-casanova`, `paglia-orba`, `monte-d-oro`, `mediterranee`, `jean-nicoli`, sous `/vie-a-bord/nos-navires/`.

## Fret

- Expertise : `savoir-faire`, `offre-fret-corsica-linea`, `accueil-des-convoyeurs` sous `/fret/le-fret-avec-corsica-linea/`.
- Ports/agences : `marseille`, `propriano`, `ajaccio`, `bastia`, `alger`, `ile-rousse`, `tunis` sous `/fret/ports-agences/`.
- `/fret/faq-fret` et `/fret/cotation-et-reservation-fret`.

## Compagnie et engagements

- Entreprise : `offre-d-emplois`, `decouvrir-corsica-linea`, `nos-activites`, `nos-actualites`, `l-employeur-corsica-linea`, `le-centre-de-formation`, `presse`, `nos-fournisseurs` sous `/la-compagnie/l-entreprise/`.
- Services : `offres-entreprises`, `groupes`, `hebergeurs-activites`, `regie-publicitaire`, `distributeurs`, `media-kit` sous `/la-compagnie/services/`.
- Contact : `/la-compagnie/nous-contacter/nos-agences` et `contactez-nous`.
- Engagements : `transition-energetique`, `satisfaction-client`, `engagement-societal` sous `/nos-engagements/nos-engagements-adn-de-la-compagnie/`, plus `/nos-engagements/transport-durable/notre-politique-environnementale` et `/nos-engagements/propulsion-gnl/gaz-naturel-liquefie`.

## Assistance, compte, contenu et légal

- FAQ dynamique : `/plus/faq`, organisée en Réserver mon billet, Préparer, CORSICA linea et moi, Assistance, puis réseaux Corse/Tunisie/Algérie.
- Blog : `/le-blog`, avec collections éditoriales additionnelles `/le-blog-algerie/*` et `/le-blog-tunisie/*`.
- Compte : connexion, inscription, mot de passe oublié et identifiant oublié via `/tsw/consumer.*` ; recherche d’une réservation existante par référence et nom du contact.
- Légal : `/plus/mentions-legales`, `cgv`, `cgt`, `cgo2`, `cookies`, `tarifs`, `info-ventes-et-modifications`, `politique-de-protection-des-donnees-personnelles`.
- Documents liés : responsabilité des transporteurs, droits des passagers, assurances annulation Corse et Maghreb, index égalité et écarts de représentation.
- Langues : racines `/eng`, `/cr`, `/it` et arborescences localisées associées.

## Modèle de navigation observé

Le desktop repose sur un méga-menu à six univers, un accès Réserver très visible, un bloc Mon compte et une recherche de traversée intégrée à l’accueil. Le mobile duplique plusieurs entrées via des routes `m.consumer.*`. Les mêmes contenus apparaissent souvent dans le méga-menu, les carrousels de l’accueil et le pied de page, ce qui produit de nombreuses redondances.

## Limites et anomalies vérifiées

- Le moteur `/tsw` est une application avec état de session : une URL transactionnelle ouverte hors du contexte du navigateur renvoie vers la passerelle.
- La page d’accueil affiche encore un message de migration mentionnant des seuils de dates de septembre/octobre 2024, devenu obsolète en 2026.
- Certaines URLs existent avec et sans slash terminal ; elles représentent la même page canonique.
- Les listes du blog, de la FAQ, des actualités et des offres sont alimentées dynamiquement. Une promesse de « toutes les pages » doit donc être comprise comme toutes les familles et toutes les routes de navigation actuelles, pas chaque résultat CMS historique.
