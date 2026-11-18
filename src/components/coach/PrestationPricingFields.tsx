'use client'

import { useState } from 'react'

import { daFieldClass, daSelectClass } from '@/src/components/ui'

type Props = {
  priceEuros: string
  pricingType: 'unique' | 'renewable'
}

export function PrestationPricingFields({ priceEuros, pricingType: initial }: Props) {
  const [pricingType, setPricingType] = useState<'unique' | 'renewable'>(initial)

  const hint =
    pricingType === 'renewable'
      ? 'Tes clients paient chaque mois pour garder l’accès (abo mensuel).'
      : 'Tes clients paient une fois — l’accès ne se renouvelle pas tout seul.'

  return (
    <>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-[color:var(--fg)]">Prix (€)</span>
        <input
          name="price_euros"
          type="number"
          min="0"
          step="0.01"
          defaultValue={priceEuros}
          className={daFieldClass}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-[color:var(--fg)]">Facturation</span>
        <select
          name="pricing_type"
          value={pricingType}
          onChange={(e) => setPricingType(e.target.value as 'unique' | 'renewable')}
          className={daSelectClass}
        >
          <option value="unique">Paiement unique</option>
          <option value="renewable">Mensuel</option>
        </select>
      </label>
      <p className="sm:col-span-2 text-[11px] text-[color:var(--muted)]">{hint}</p>
    </>
  )
}
