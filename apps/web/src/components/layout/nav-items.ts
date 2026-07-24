import { type Route } from "next";

export type HeaderNavLink = Readonly<{ href: Route; label: string }>;
export type HeaderNavGroup = Readonly<{ title: string; links: readonly HeaderNavLink[] }>;
export type HeaderNavItem = Readonly<{
  groups: readonly HeaderNavGroup[];
  href: Route;
  label: string;
}>;

const links = (href: Route, labels: readonly string[]): readonly HeaderNavLink[] =>
  labels.map((label) => ({ href, label }));

export const navItems: readonly HeaderNavItem[] = [
  {
    href: "/#reservation",
    label: "Réserver",
    groups: [
      {
        title: "Votre traversée en ferry",
        links: links("/#reservation", ["Infos lignes et horaires"])
      },
      {
        title: "Offres et promotions",
        links: links("/#offres", ["Corse", "Tunisie", "Résidents & Abonnés", "Algérie"])
      },
      {
        title: "Les traversées",
        links: links("/#reservation", [
          "Marseille-La Corse",
          "Marseille-Ajaccio",
          "Marseille-Bastia",
          "Marseille-Île-Rousse",
          "Marseille-Propriano",
          "Marseille-Alger",
          "Marseille-Béjaïa",
          "Marseille-Skikda",
          "Marseille-Tunis",
          "Sète-Béjaïa",
          "Sète-Skikda"
        ])
      }
    ]
  },
  {
    href: "/#preparer",
    label: "Préparer votre voyage",
    groups: [
      {
        title: "Les ports",
        links: links("/port", [
          "La Corse",
          "Marseille",
          "Ajaccio",
          "Bastia",
          "Île-Rousse",
          "Propriano",
          "Alger",
          "Tunis",
          "Skikda",
          "Béjaïa",
          "Sète"
        ])
      },
      {
        title: "Informations pratiques",
        links: links("/#preparer", [
          "linea FID",
          "linea CLUB",
          "Embarquement",
          "Femmes enceintes",
          "Pièces d’identité et billets",
          "Voyager avec des enfants",
          "Dispositifs de sécurité",
          "Voyage vers le Maghreb",
          "Facilités de règlement",
          "Personnes à Mobilité Réduite",
          "Assistance médicale",
          "Voyager avec son animal",
          "Objets Trouvés",
          "Assurance voyage"
        ])
      },
      {
        title: "Les destinations",
        links: links("/#destinations", ["Marseille", "La Corse", "L’Algérie", "La Tunisie"])
      }
    ]
  },
  {
    href: "/#vie-a-bord",
    label: "Vie à bord",
    groups: [
      { title: "Restauration & Bars", links: links("/#vie-a-bord", ["Nos offres"]) },
      { title: "Services à bord", links: links("/#vie-a-bord", ["Services à bord"]) },
      {
        title: "Nos navires",
        links: links("/#vie-a-bord", [
          "Capu di Muru",
          "Capu Rossu",
          "A Galeotta",
          "Pascal Paoli",
          "Vizzavona",
          "Danielle Casanova",
          "Paglia Orba",
          "Monte d’Oro",
          "Méditerranée",
          "Jean Nicoli"
        ])
      }
    ]
  },
  {
    href: "/#fret",
    label: "Fret",
    groups: [
      {
        title: "Le Fret avec CORSICA linea",
        links: links("/#fret", [
          "Savoir-Faire",
          "Offre fret CORSICA linea",
          "Accueil des convoyeurs"
        ])
      },
      {
        title: "Ports & Agences",
        links: links("/port", [
          "Marseille",
          "Propriano",
          "Ajaccio",
          "Bastia",
          "Alger",
          "Île-Rousse",
          "Tunis"
        ])
      },
      {
        title: "Services fret",
        links: links("/#fret", ["Questions fréquentes", "Cotation & Réservation"])
      }
    ]
  },
  {
    href: "/#compagnie",
    label: "La compagnie",
    groups: [
      {
        title: "L’entreprise",
        links: links("/#compagnie", [
          "Offres d’emploi",
          "Découvrir CORSICA linea",
          "Nos activités",
          "Nos actualités",
          "L’employeur CORSICA linea",
          "Le centre de formation",
          "Presse",
          "Nos fournisseurs"
        ])
      },
      {
        title: "Services",
        links: links("/#compagnie", [
          "Offres entreprises",
          "Groupes",
          "Hébergeurs & Activités",
          "Régie Publicitaire",
          "Distributeurs",
          "Média Kit"
        ])
      },
      { title: "Contact", links: links("/#contact", ["Nos agences", "Contactez-nous"]) }
    ]
  },
  {
    href: "/#engagements",
    label: "Nos engagements",
    groups: [
      {
        title: "Nos engagements - ADN de la compagnie",
        links: links("/#engagements", [
          "Transition Energétique",
          "Satisfaction Client",
          "Engagement Sociétal"
        ])
      },
      {
        title: "Transport durable",
        links: links("/#engagements", ["Notre Politique Environnementale"])
      },
      { title: "Propulsion GNL", links: links("/#engagements", ["Gaz Naturel Liquéfié"]) }
    ]
  }
];
