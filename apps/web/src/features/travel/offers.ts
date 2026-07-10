export type Offer = Readonly<{
  detail?: string;
  href: string;
  image: string;
  label: string;
  title: string;
}>;

export type OfferCategoryKey = "algerie" | "corse" | "residents" | "tunisie";

type OfferCategory = Readonly<{
  href: string;
  label: string;
  offers: readonly Offer[];
}>;

const siteUrl = "https://www.corsicalinea.com";

export const offerCategoryOrder: readonly OfferCategoryKey[] = [
  "corse",
  "algerie",
  "tunisie",
  "residents"
];

export const offerCategories: Readonly<Record<OfferCategoryKey, OfferCategory>> = {
  corse: {
    href: `${siteUrl}/reserver/offres-et-promotions/corse`,
    label: "Corse",
    offers: [
      {
        href: `${siteUrl}/reserver/offres-et-promotions/corse/reservations-saison`,
        image: "/offers/saison-2026.jpg",
        label: "Saison 2026",
        title: "Top départ des réservations"
      },
      {
        href: `${siteUrl}/reserver/offres-et-promotions/corse/reservations-apres-saison`,
        image: "/offers/apres-saison-2026.webp",
        label: "L'après-saison 2026",
        title: "Réservez votre traversée"
      },
      {
        href: `${siteUrl}/reserver/offres-et-promotions/corse/tarifs-flex-et-super-flex`,
        image: "/offers/flex-super-flex.jpg",
        label: "Tarif Flex et Super Flex",
        title: "Voyagez en toute sérénité !"
      },
      {
        href: `${siteUrl}/reserver/offres-et-promotions/corse/debarquement-prioritaire`,
        image: "/offers/debarquement-prioritaire.jpg",
        label: "Débarquement prioritaire",
        title: "Pour les plus pressés"
      },
      {
        detail: "La traversée jusqu'à -35 %",
        href: `${siteUrl}/reserver/offres-et-promotions/corse/offre-hebergeurs-ce`,
        image: "/offers/offres-partenaires.jpg",
        label: "Offres partenaires",
        title: "Vos vacances moins chères !"
      },
      {
        href: `${siteUrl}/reserver/offres-et-promotions/corse/linea-club`,
        image: "/offers/linea-club.webp",
        label: "Programme de fidélité",
        title: "Rejoignez le linea CLUB"
      }
    ]
  },
  algerie: {
    href: `${siteUrl}/reserver/offres-et-promotions/algerie`,
    label: "Algérie",
    offers: [
      {
        href: `${siteUrl}/reserver/offres-et-promotions/algerie/reservation-saison`,
        image: "/offers/algerie-saison-2026.webp",
        label: "Saison 2026",
        title: "Top départ des réservations"
      },
      {
        href: `${siteUrl}/reserver/offres-et-promotions/algerie/reservations`,
        image: "/offers/algerie-2026.webp",
        label: "L'Algérie en 2026",
        title: "Top départ des réservations"
      },
      {
        href: `${siteUrl}/reserver/offres-et-promotions/algerie/linea-fid`,
        image: "/offers/linea-fid-algerie.webp",
        label: "Programme de fidélité",
        title: "Rejoignez le linea FID"
      },
      {
        detail: "en Saison",
        href: `${siteUrl}/reserver/offres-et-promotions/algerie/tarif-famille`,
        image: "/offers/tarif-famille.jpg",
        label: "Tarif Famille",
        title: "voyagez avec cabine + véhicule"
      },
      {
        detail: "En Algérie",
        href: `${siteUrl}/reserver/offres-et-promotions/algerie/tarif-escapade`,
        image: "/offers/algerie-escapade.jpg",
        label: "Tarif Escapade",
        title: "Pour vos courts séjours"
      }
    ]
  },
  tunisie: {
    href: `${siteUrl}/reserver/offres-et-promotions/tunisie`,
    label: "Tunisie",
    offers: [
      {
        href: `${siteUrl}/reserver/offres-et-promotions/tunisie/operation-tunisie`,
        image: "/offers/tunisie-pieton.webp",
        label: "-60 %* de remise",
        title: "Grâce à la PROMO PIÉTON*"
      },
      {
        href: `${siteUrl}/reserver/offres-et-promotions/tunisie/linea-fid`,
        image: "/offers/linea-fid-tunisie.webp",
        label: "Programme de fidélité",
        title: "Rejoignez le linea FID"
      },
      {
        href: `${siteUrl}/reserver/offres-et-promotions/tunisie/reservation-saison`,
        image: "/offers/tunisie-saison-2026.webp",
        label: "Saison 2026",
        title: "Top départ des réservations"
      },
      {
        href: `${siteUrl}/reserver/offres-et-promotions/tunisie/reservations`,
        image: "/offers/tunisie-traversees-2026.webp",
        label: "Votre traversée France ↔ Tunisie",
        title: "Traversées 2026"
      },
      {
        detail: "à prix mini",
        href: `${siteUrl}/reserver/offres-et-promotions/tunisie/tarif-amitie`,
        image: "/offers/tarif-amitie.jpg",
        label: "Tarif Amitié",
        title: "Passager + voiture"
      },
      {
        detail: "à petit prix",
        href: `${siteUrl}/reserver/offres-et-promotions/tunisie/tarif-famille`,
        image: "/offers/tarif-famille.jpg",
        label: "Tarif Famille",
        title: "Cabine + véhicule"
      },
      {
        detail: "Tarif idéal",
        href: `${siteUrl}/reserver/offres-et-promotions/tunisie/tarif-escapade`,
        image: "/offers/tunisie-escapade.jpg",
        label: "Tarif Escapade",
        title: "Court séjour en Tunisie"
      }
    ]
  },
  residents: {
    href: `${siteUrl}/reserver/offres-et-promotions/residents-abonnes`,
    label: "Résidents & Abonnés",
    offers: [
      {
        detail: "-30 %",
        href: `${siteUrl}/reserver/offres-et-promotions/residents-abonnes/abonnement-professionnel`,
        image: "/offers/abonnes-pro.webp",
        label: "Abonnés professionnels",
        title: "Voyagez toute l'année"
      },
      {
        detail: "-30 %",
        href: `${siteUrl}/reserver/offres-et-promotions/residents-abonnes/abonnement`,
        image: "/offers/abonnes.jpg",
        label: "Abonnés",
        title: "Voyagez toute l'année"
      },
      {
        detail: "à prix promo",
        href: `${siteUrl}/reserver/offres-et-promotions/residents-abonnes/aria-e-mare`,
        image: "/offers/aria-e-mare.jpg",
        label: "Aria e mare",
        title: "Le combiné avion et bateau"
      },
      {
        detail: "Souplesse",
        href: `${siteUrl}/reserver/offres-et-promotions/residents-abonnes/tarif-resident`,
        image: "/offers/tarif-resident.jpg",
        label: "Tarif Résident",
        title: "Prix résident garanti"
      },
      {
        href: `${siteUrl}/reserver/offres-et-promotions/corse/debarquement-prioritaire`,
        image: "/offers/debarquement-prioritaire.jpg",
        label: "Débarquement prioritaire",
        title: "Pour les plus pressés"
      }
    ]
  }
};

export const offerCategoryOptions = offerCategoryOrder.map((key) => ({
  label: offerCategories[key].label,
  value: key
}));
