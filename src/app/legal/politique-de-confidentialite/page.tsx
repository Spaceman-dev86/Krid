import type { Metadata } from 'next'
import Link from 'next/link'

import LegalDocument, { LegalSection } from '@/src/components/legal/LegalDocument'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Krid',
  robots: { index: false, follow: false },
}

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Politique de confidentialité" updatedAt="18/11/2026">
      <p className="text-[color:var(--muted)]">
        Cette politique décrit comment Krid collecte, utilise, protège et partage les données personnelles dans le
        cadre de la Plateforme, conformément au RGPD et à la loi « Informatique et libertés ».
      </p>

      <LegalSection title="1. Qui sommes-nous ?">
        <p>
          Responsable de traitement : l’éditeur de la plateforme <strong>Krid</strong>. Contact :{' '}
          <a href="mailto:support@krid.app" className="font-semibold text-[var(--brand)] underline">
            support@krid.app
          </a>
          .
        </p>
        <p>
          Lorsqu’un Coach collecte des données de ses propres Clients via son espace / application, le Coach peut
          agir en tant que responsable de traitement pour ces finalités ; Krid agit alors souvent comme
          sous-traitant technique. Les rôles exacts dépendent du cas d’usage.
        </p>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <p>Selon le rôle et les fonctionnalités utilisées, nous pouvons traiter notamment :</p>
        <ul>
          <li>
            <strong>Coachs</strong> : identité, email, informations de compte, branding (logo, couleurs, slug),
            contenus créés (programmes, séances, médias), données d’abonnement / facturation (via prestataire de
            paiement), historique de connexion et d’usage.
          </li>
          <li>
            <strong>Clients des Coachs</strong> : identité, email, données de suivi (séances, progression), bilans,
            informations nutritionnelles ou de condition physique éventuellement renseignées, fichiers partagés.
          </li>
          <li>
            <strong>Données techniques</strong> : logs, adresse IP, type de navigateur / appareil, cookies
            nécessaires au fonctionnement et à la sécurité.
          </li>
        </ul>
        <p>
          Certaines données peuvent être considérées comme sensibles (santé). Elles ne sont traitées que dans le
          cadre du service demandé, avec le consentement ou une autre base légale appropriée.
        </p>
      </LegalSection>

      <LegalSection title="3. Finalités">
        <ul>
          <li>fournir et sécuriser les Services ;</li>
          <li>créer et gérer les comptes ;</li>
          <li>permettre le coaching, le suivi et la personnalisation de l’app Coach ;</li>
          <li>traiter les paiements et abonnements lorsque activés ;</li>
          <li>assurer le support et améliorer la qualité du produit ;</li>
          <li>respecter les obligations légales.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Bases légales">
        <ul>
          <li>exécution du contrat (CGU / fourniture des Services) ;</li>
          <li>consentement (ex. certaines données de santé, cookies non essentiels) ;</li>
          <li>intérêt légitime (sécurité, amélioration produit, prévention de la fraude) ;</li>
          <li>obligations légales (comptabilité, réponses aux autorités).</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Destinataires et sous-traitants">
        <p>
          Les données sont accessibles aux équipes Krid habilitées et à des sous-traitants techniques nécessaires
          au fonctionnement (hébergement, base de données, email transactionnel, paiement). Exemples typiques :
          infrastructure cloud (ex. Vercel), base / auth (ex. Supabase), paiement (ex. Stripe).
        </p>
        <p>
          Les données d’un Client ne sont pas vendues. Un Coach n’accède qu’aux données de ses propres Clients,
          dans le cadre de la relation de coaching.
        </p>
      </LegalSection>

      <LegalSection title="6. Transferts hors UE">
        <p>
          Certains prestataires peuvent traiter des données hors de l’Union européenne. Dans ce cas, des garanties
          appropriées sont mises en place (ex. clauses contractuelles types) lorsque requis.
        </p>
      </LegalSection>

      <LegalSection title="7. Durées de conservation">
        <ul>
          <li>compte actif : pendant la durée d’utilisation des Services ;</li>
          <li>
            après suppression de compte : conservation limitée puis suppression / anonymisation (délai indicatif
            jusqu’à 30 jours pour les données opérationnelles, sous réserve d’obligations légales plus longues pour
            la facturation).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Sécurité">
        <p>
          Nous mettons en œuvre des mesures techniques et organisationnelles raisonnables (chiffrement en transit,
          contrôle d’accès, isolation multi-tenant via politiques d’accès) pour protéger les données. Aucun
          système n’est totalement exempt de risque.
        </p>
      </LegalSection>

      <LegalSection title="9. Vos droits">
        <p>
          Conformément au RGPD, vous disposez d’un droit d’accès, de rectification, d’effacement, de portabilité,
          d’opposition, de limitation, et de retrait du consentement le cas échéant.
        </p>
        <p>
          Pour exercer ces droits :{' '}
          <a href="mailto:support@krid.app" className="font-semibold text-[var(--brand)] underline">
            support@krid.app
          </a>
          . Vous pouvez également introduire une réclamation auprès de la CNIL (
          <a href="https://www.cnil.fr" className="font-semibold text-[var(--brand)] underline" target="_blank" rel="noreferrer">
            www.cnil.fr
          </a>
          ).
        </p>
      </LegalSection>

      <LegalSection title="10. Cookies">
        <p>
          Nous utilisons des cookies et stockages locaux nécessaires à l’authentification, à la sécurité et au
          fonctionnement de l’application (ex. session, préférence de thème). Des outils d’analytics ou de support
          pourront être ajoutés ultérieurement ; le cas échéant, un consentement sera demandé lorsque requis.
        </p>
      </LegalSection>

      <LegalSection title="11. Modifications">
        <p>
          Cette politique peut être mise à jour. La version en vigueur est celle publiée sur{' '}
          <span className="text-[color:var(--fg)]">/legal/politique-de-confidentialite</span>. En cas de
          changement majeur, une information pourra être communiquée via l’application ou par email.
        </p>
      </LegalSection>

      <LegalSection title="12. Documents liés">
        <p>
          Voir également les{' '}
          <Link href="/legal/cgu" className="font-semibold text-[var(--brand)] underline">
            conditions générales d’utilisation
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  )
}
