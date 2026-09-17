import { redirect } from 'next/navigation'

/** Alias — création via CTA land `/nutrition`. */
export default function NutritionNewPage() {
  redirect('/nutrition')
}
