import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"

import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"

export function CorrectionsPage() {
  const { data = [] } = useQuery({ queryKey: ["use-cases"], queryFn: api.useCases })
  const details = useQuery({ queryKey: ["correction-details", data.map((item) => item.id)], queryFn: () => Promise.all(data.map((item) => api.useCase(item.id))), enabled: data.length > 0 })
  const corrections = (details.data ?? []).flatMap((useCase) => (useCase.runs ?? []).flatMap((run) => run.field_outcomes.filter((field) => field.outcome === "mismatch").map((field) => ({ ...field, useCase, run, kind: run.mode === "shadow" ? "Prediction disagreement" : field.was_corrected_by_user ? "Correction" : "Difference" }))))
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Corrections</h1><p className="mt-1 text-sm text-neutral-500">Shadow prediction disagreements are separated from corrections to values filled by RekeyZero.</p></div><Card><CardContent className="p-0"><table className="w-full text-left text-sm"><thead className="border-b bg-neutral-50 text-neutral-500"><tr><th className="px-5 py-3">Use case</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Field</th><th className="px-5 py-3">Predicted</th><th className="px-5 py-3">Observed</th><th className="px-5 py-3">Case</th></tr></thead><tbody>{corrections.map((item) => <tr className="border-b last:border-0" key={item.id}><td className="px-5 py-3"><Link className="underline" to={`/use-cases/${item.useCase.id}`}>{item.useCase.name}</Link></td><td className="px-5 py-3">{item.kind}</td><td className="px-5 py-3">{item.destination_field}</td><td className="px-5 py-3">{String(item.predicted_value ?? "—")}</td><td className="px-5 py-3">{String(item.observed_value ?? "—")}</td><td className="px-5 py-3 font-mono text-xs">{item.run.record_id}</td></tr>)}</tbody></table>{!corrections.length && <div className="p-8 text-center text-sm text-neutral-500">No material differences recorded.</div>}</CardContent></Card></div>
}
