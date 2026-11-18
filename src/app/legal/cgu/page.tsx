import type { Metadata } from 'next'
import Link from 'next/link'

import LegalDocument, { LegalSection } from '@/src/components/legal/LegalDocument'

export const metadata: Metadata = {
  title: 'Conditions générales d’utilisation — Krid',
  robots: { index: false, follow: false },
}

export default function CguPage() {
  return (
    <LegalDocument title="Conditions générales d’utilisation" updatedAt="18/11/2026">
      <LegalSection title="Article 1. Définitions">
        <p>Au sens des présentes CGU :</p>
        <ul>
          <li>
            <strong>CGU</strong> : les présentes conditions générales d’utilisation.
          </li>
          <li>
            <strong>Krid</strong> (ou « la Plateforme ») : le service SaaS de coaching marque blanche édité
            sous la marque Krid, accessible via le site marketing et l’application web coach / client.
          </li>
          <li>
            <strong>Coach</strong> : professionnel utilisant Krid pour créer programmes, prestations, contenus et
            une application à sa marque destinée à ses clients.
          </li>
          <li>
            <strong>Client</strong> : utilisateur final rattaché à un Coach via l’application / portail du Coach.
          </li>
          <li>
            <strong>Utilisateur</strong> : toute personne (Coach, Client ou administrateur) qui accède aux Services.
          </li>
          <li>
            <strong>Services</strong> : l’ensemble des fonctionnalités proposées par Krid (comptes, programmes,
            séances, bibliothèque, suivi clients, showroom, paiements le cas échéant, etc.).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Article 2. Objet et acceptation">
        <p>
          Les CGU définissent les conditions d’accès et d’utilisation des Services. Toute création de compte ou
          utilisation des Services vaut acceptation sans réserve des présentes CGU et de la{' '}
          <Link href="/legal/politique-de-confidentialite" className="font-semibold text-[var(--brand)] underline">
            politique de confidentialité
          </Link>
          .
        </p>
        <p>
          Krid peut modifier les CGU à tout moment. La version applicable est celle publiée à l’adresse{' '}
          <span className="text-[color:var(--fg)]">/legal/cgu</span> au moment de l’utilisation. En cas de
          désaccord, l’Utilisateur doit cesser d’utiliser les Services.
        </p>
      </LegalSection>

      <LegalSection title="Article 3. Capacité">
        <p>
          Les Services sont réservés aux personnes physiques majeures capables de contracter, ainsi qu’aux
          personnes morales agissant par un représentant habilité. Un mineur de 16 ans ou plus peut utiliser les
          Services avec l’autorisation de ses représentants légaux lorsque la loi l’exige.
        </p>
      </LegalSection>

      <LegalSection title="Article 4. Description des Services">
        <p>Selon l’offre et le rôle, Krid permet notamment de :</p>
        <ul>
          <li>créer et gérer un compte Coach ou Client ;</li>
          <li>composer programmes, séances, blocs et exercices ;</li>
          <li>suivre des clients, bilans, nutrition et contenus partagés ;</li>
          <li>personnaliser une application / espace client à la marque du Coach ;</li>
          <li>publier un showroom / prestations et capturer des leads ;</li>
          <li>gérer des abonnements ou paiements lorsque cette fonctionnalité est activée (ex. Stripe).</li>
        </ul>
        <p>
          Les équipements et frais de connexion de l’Utilisateur restent à sa charge. Krid s’efforce d’assurer une
          disponibilité raisonnable des Services, sans garantie d’absence d’interruption (maintenance, incidents,
          force majeure).
        </p>
      </LegalSection>

      <LegalSection title="Article 5. Compte">
        <p>
          La création d’un compte nécessite des informations exactes (notamment email et mot de passe).
          L’Utilisateur est responsable de la confidentialité de ses identifiants et de toute activité réalisée
          depuis son compte.
        </p>
        <p>
          Krid peut suspendre ou fermer un compte en cas de non-respect des CGU, de fraude, d’usurpation
          d’identité ou d’usage illicite, après mise en demeure lorsque cela est approprié, ou immédiatement en cas
          de manquement grave.
        </p>
        <p>
          L’Utilisateur peut demander la suppression de son compte via les paramètres ou en contactant le support.
          Sauf obligation légale contraire, les données associées sont effacées ou anonymisées dans un délai
          raisonnable (voir politique de confidentialité).
        </p>
      </LegalSection>

      <LegalSection title="Article 6. Offres, prix et paiement">
        <p>
          Certaines fonctionnalités peuvent être gratuites (essai) ou payantes. Les prix, durées d’essai et
          conditions commerciales sont indiqués sur le site ou dans l’espace facturation au moment de la commande.
        </p>
        <p>
          Les paiements, le cas échéant, sont traités par un prestataire sécurisé (ex. Stripe). Krid n’a pas accès
          aux données complètes de carte bancaire. Sauf disposition contraire affichée lors de la commande, les
          Services professionnels activés sont considérés comme exécutés dès l’activation, ce qui peut entraîner
          l’absence de droit de rétractation dans les conditions prévues par le Code de la consommation.
        </p>
      </LegalSection>

      <LegalSection title="Article 7. Obligations de l’Utilisateur">
        <ul>
          <li>fournir des informations sincères et à jour ;</li>
          <li>utiliser les Services conformément à la loi et aux droits des tiers ;</li>
          <li>ne pas perturber le fonctionnement de la Plateforme ni tenter d’accéder à des espaces non autorisés ;</li>
          <li>
            pour les Coachs : disposer des qualifications / autorisations professionnelles requises pour exercer
            leur activité, et rester seuls responsables du contenu coaching délivré à leurs Clients.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Article 8. Responsabilité">
        <p>
          Krid fournit un outil technique. Le Coach demeure seul responsable des programmes, conseils, contenus et
          relations avec ses Clients. Krid n’est pas responsable des dommages indirects, ni des actes ou omissions
          des Coachs, ni de l’usage que l’Utilisateur fait des contenus mis à disposition.
        </p>
        <p>
          Dans la limite autorisée par la loi, la responsabilité de Krid est limitée au montant des sommes
          effectivement payées par l’Utilisateur à Krid au titre des Services concernés sur les douze (12) derniers
          mois.
        </p>
      </LegalSection>

      <LegalSection title="Article 9. Propriété intellectuelle">
        <p>
          Krid et ses partenaires conservent tous les droits de propriété intellectuelle sur la Plateforme, les
          marques, logos, logiciels, bases de données et contenus catalogue fournis par Krid. Les contenus créés
          par un Coach lui appartiennent, sous réserve des licences nécessaires à l’hébergement et au
          fonctionnement des Services.
        </p>
      </LegalSection>

      <LegalSection title="Article 10. Données personnelles">
        <p>
          Le traitement des données personnelles est décrit dans la{' '}
          <Link href="/legal/politique-de-confidentialite" className="font-semibold text-[var(--brand)] underline">
            politique de confidentialité
          </Link>
          , qui fait partie intégrante des présentes CGU.
        </p>
      </LegalSection>

      <LegalSection title="Article 11. Force majeure, nullité, droit applicable">
        <p>
          Aucune Partie n’est responsable d’un manquement dû à un cas de force majeure. Si une clause est déclarée
          nulle, les autres demeurent applicables. Les CGU sont soumises au droit français. Tout litige sera soumis
          aux juridictions compétentes, sous réserve des règles protectrices applicables aux consommateurs.
        </p>
      </LegalSection>

      <LegalSection title="Article 12. Contact">
        <p>
          Pour toute question relative aux présentes CGU :{' '}
          <a href="mailto:support@krid.app" className="font-semibold text-[var(--brand)] underline">
            support@krid.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  )
}
