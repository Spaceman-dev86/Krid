import { SpecShell } from '../../../components/spec-workspace/SpecShell'

export default function SpecLayout({ children }: { children: React.ReactNode }) {
  return <SpecShell>{children}</SpecShell>
}
