const siteUrl = "https://www.corsicalinea.com";

export type Destination = Readonly<{
  description: string;
  href: string;
  image: string;
  title: string;
}>;

export const destinations: readonly Destination[] = [
  {
    description:
      "Véritable porte ouverte sur la Méditerranée, la cité phocéenne revêt des visages bien différents ! Ville cosmopolite, elle se découvre au gré des envies du voyageur : sportive, artistique ou culturelle.",
    href: `${siteUrl}/preparer-votre-voyage/les-destinations/marseille`,
    image: "/home/destinations/marseille.webp",
    title: "Marseille"
  },
  {
    description:
      "Ses plages immenses aux eaux turquoise, ses sommets accessibles aux amateurs comme aux grands sportifs, sa gastronomie, son terroir et ses traditions préservées font de la Corse une destination unique.",
    href: `${siteUrl}/preparer-votre-voyage/les-destinations/corse`,
    image: "/home/destinations/corse.webp",
    title: "La Corse"
  },
  {
    description:
      "Connue pour ses magnifiques plages de sable et son ensoleillement hors du commun, la Tunisie offre aussi le désert de sel, le Sahara et un patrimoine culturel d'une grande richesse.",
    href: `${siteUrl}/preparer-votre-voyage/les-destinations/tunis`,
    image: "/home/destinations/tunisie.webp",
    title: "La Tunisie"
  },
  {
    description:
      "D'Alger la blanche à Béjaïa, l'Algérie partage avec ses voyageurs la richesse de ses paysages, son patrimoine culturel, ses traditions et ses coutumes héritées de plusieurs millénaires.",
    href: `${siteUrl}/preparer-votre-voyage/les-destinations/alger`,
    image: "/home/destinations/algerie.webp",
    title: "L'Algérie"
  }
];

export type PracticalLink = Readonly<{
  href: string;
  image: string;
  label: string;
}>;

export const practicalLinks: readonly PracticalLink[] = [
  {
    href: `${siteUrl}/vie-a-bord/restauration-bars`,
    image: "/home/practical/restauration.webp",
    label: "Restauration & Bars"
  },
  {
    href: `${siteUrl}/vie-a-bord/services-a-bord`,
    image: "/home/practical/services.webp",
    label: "Services à bord"
  },
  {
    href: `${siteUrl}/preparer-votre-voyage/informations-pratiques/voyager-avec-son-animal`,
    image: "/home/practical/animal.webp",
    label: "Voyager avec son animal"
  },
  {
    href: `${siteUrl}/preparer-votre-voyage/les-ports`,
    image: "/home/practical/ports.webp",
    label: "Les ports"
  },
  {
    href: `${siteUrl}/preparer-votre-voyage/informations-pratiques/personnes-a-mobilite-reduite`,
    image: "/home/practical/pmr.webp",
    label: "Personnes à Mobilité Réduite"
  },
  {
    href: `${siteUrl}/preparer-votre-voyage/informations-pratiques/facilites-de-reglement`,
    image: "/home/practical/paiement.webp",
    label: "Facilités de règlement"
  },
  {
    href: `${siteUrl}/preparer-votre-voyage/informations-pratiques/assistance-medicale`,
    image: "/home/practical/medical.webp",
    label: "Assistance médicale"
  },
  {
    href: `${siteUrl}/preparer-votre-voyage/informations-pratiques/pieces-d-identite-et-billets`,
    image: "/home/practical/identite.webp",
    label: "Pièces d'identité et billets"
  }
];

export type Testimonial = Readonly<{
  author: string;
  date: string;
  quote: string;
}>;

export const testimonials: readonly Testimonial[] = [
  {
    author: "Herve H.",
    date: "18/05/2026",
    quote: "Très bien comme à chaque traversée ! Très bien"
  },
  {
    author: "Patrick L.",
    date: "23/04/2026",
    quote:
      "Parfait, embarquement rapide, accueil des membres d'équipage excellent. Je recommande CORSICA linea à 200 %. Très agréable."
  },
  {
    author: "Jocelyn L.",
    date: "28/05/2026",
    quote:
      "Être pris en charge par des personnels aussi professionnels est un pur bonheur que je souhaite à tous."
  }
];

export const companyContent = {
  href: `${siteUrl}/la-compagnie/l-entreprise/decouvrir-corsica-linea`,
  paragraphs: [
    "CORSICA linea est une compagnie maritime régionale assurant le transport de passagers et de marchandises entre la France, au départ de Marseille, la Corse, l'Algérie et la Tunisie.",
    "La compagnie dessert quotidiennement Ajaccio et Bastia, ainsi que les ports d'Île-Rousse, Propriano, Alger, Béjaïa, Skikda et Tunis, à bord d'une flotte de cargos mixtes et de ferries."
  ],
  title: "CORSICA linea, lignes de ferry pour la Corse, l'Algérie et la Tunisie"
} as const;
