import { useQuery } from "@tanstack/react-query"

import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"

export function PerformancePage() {
  const { data } = useQuery({ queryKey: ["performance"], queryFn: api.performance })
  if (!data) return <p>Loading performance…</p>
  const baselineDescription = data.baseline_manual_seconds_per_field == null
    ? "Estimated using each Use Case's configured manual-entry baseline."
    : `Estimated using ${data.baseline_manual_seconds_per_field} seconds per manually entered field.`

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Performance</h1><p className="mt-1 text-sm text-neutral-500">Operational evidence from completed managed Use Case runs.</p></div>
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      <Metric label="Completed runs" value={data.completed_runs} />
      <Metric label="Shadow match rate" value={percent(data.shadow_match_rate)} />
      <Metric label="Shadow disagreement" value={percent(data.shadow_disagreement_rate)} />
      <Metric label="Assisted correction" value={percent(data.assisted_correction_rate)} />
      <Metric label="Fields reused" value={data.fields_reused} />
      <Metric label="Estimated minutes saved" value={data.estimated_minutes_saved} />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Metric label="Response capture rate" value={percent(data.response_capture_rate)} />
      <Metric label="System of Record write-back success" value={percent(data.writeback_success_rate)} />
    </div>
    <p className="text-xs text-neutral-500">{baselineDescription}</p>
    <Card><CardContent className="p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-neutral-50 text-neutral-500"><tr><th className="px-5 py-3">Field</th><th className="px-5 py-3">Compared</th><th className="px-5 py-3">Matches</th><th className="px-5 py-3">Shadow disagreements</th><th className="px-5 py-3">Corrections</th><th className="px-5 py-3">Health</th></tr></thead>
        <tbody>{data.field_health.map((field) => <tr className="border-b last:border-0" key={field.field}><td className="px-5 py-3 font-medium">{field.field}</td><td className="px-5 py-3">{field.comparable}</td><td className="px-5 py-3">{field.matches}</td><td className="px-5 py-3">{field.disagreements}</td><td className="px-5 py-3">{field.corrections}</td><td className="px-5 py-3">{percent(field.match_rate)}</td></tr>)}</tbody>
      </table>
      {!data.field_health.length && <div className="p-8 text-center text-sm text-neutral-500">Performance appears after managed runs are completed.</div>}
    </CardContent></Card>
  </div>
}

function percent(value: number | null) { return value == null ? "—" : `${(value * 100).toFixed(1)}%` }
function Metric({ label, value }: { label: string; value: string | number }) { return <Card><CardContent className="p-5"><div className="text-sm text-neutral-500">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></CardContent></Card> }
