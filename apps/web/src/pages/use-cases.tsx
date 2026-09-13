import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api, type UseCaseMode } from "@/lib/api"

const tableActionButtonClass =
  "!border !border-solid !border-slate-200 !bg-white !text-slate-900 !shadow-sm hover:!bg-slate-50 hover:!text-slate-900"
const inputClass = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"

export function UseCasesPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [targetId, setTargetId] = useState("")
  const [mode, setMode] = useState<UseCaseMode>("shadow")
  const { data = [] } = useQuery({ queryKey: ["use-cases"], queryFn: api.useCases })
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: api.config })
  const create = useMutation({
    mutationFn: () => api.addUseCase({ name, description, destination_target_id: targetId, mode, source_ids: [], critical_fields: [], promotion_policy: {}, writeback_mapping: {}, enabled: true }),
    onSuccess: () => {
      setOpen(false)
      setName("")
      void queryClient.invalidateQueries({ queryKey: ["use-cases"] })
    },
  })
  const targets = (config?.targets ?? []).filter((target) => target.type === "web_portal")

  return <div className="space-y-6">
    <div className="flex items-start justify-between"><div><h1 className="text-2xl font-semibold">Use Cases</h1><p className="mt-1 text-sm text-neutral-500">Manage Shadow, Assisted and Exception automation lifecycles.</p></div><Button onClick={() => setOpen(true)}><Plus className="size-4" />Add Use Case</Button></div>
    <Card><CardContent className="p-0"><table className="w-full text-left text-sm"><thead className="border-b bg-neutral-50 text-neutral-500"><tr><th className="px-5 py-3">Use case</th><th className="px-5 py-3">Mode</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Version</th><th className="px-5 py-3">Action</th></tr></thead><tbody>{data.map((item) => <tr className="border-b last:border-0" key={item.id}><td className="px-5 py-4"><strong>{item.name}</strong><div className="text-xs text-neutral-500">{item.description || "No description"}</div></td><td className="px-5 py-4"><Badge>{item.mode}</Badge></td><td className="px-5 py-4">{item.enabled ? "Enabled" : "Disabled"}</td><td className="px-5 py-4">v{item.version}</td><td className="px-5 py-4"><Button size="sm" className={tableActionButtonClass} onClick={() => navigate(`/use-cases/${item.id}`)}>Open</Button></td></tr>)}</tbody></table>{!data.length && <div className="p-8 text-center text-sm text-neutral-500">No managed Use Cases yet.</div>}</CardContent></Card>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6"><h2 className="text-xl font-semibold">Add Use Case</h2><label className="block text-sm">Name<input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-sm">Description<textarea className={inputClass} value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="block text-sm">Destination<select className={inputClass} value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Select Destination</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label><label className="block text-sm">Initial mode<select className={inputClass} value={mode} onChange={(event) => setMode(event.target.value as UseCaseMode)}><option value="shadow">Shadow</option><option value="assisted">Assisted</option><option value="exception">Exception</option></select></label><div className="flex justify-end gap-2"><Button onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => create.mutate()} disabled={!name || !targetId || create.isPending}>Save</Button></div></div></div>}
  </div>
}
