import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api, type ConfigItem, type DbosWorkflow } from "@/lib/api"
import {
  ConnectionModal,
  destinationPayloadFromDraft,
  newDraft,
  sourcePayloadFromDraft,
  type ConfigurationDraft,
  type FormField,
  type FormValue,
} from "@/pages/records"

const tableActionButtonClass =
  "!border !border-solid !border-slate-200 !bg-white !text-slate-900 !shadow-sm hover:!bg-slate-50 hover:!text-slate-900"
const sourceTypeLabels: Record<string, string> = {
  email_account: "Email Account",
  external_api_retrieve: "External API (Retrieve)",
  website_portal_retrieve: "Website / Portal (Retrieve)",
  rekeyzero_api_receive: "RekeyZero API (Receive)",
  rekeyzero_hosted_form_receive: "RekeyZero Hosted Form (Receive)",
}
const destinationTypeLabels: Record<string, string> = {
  api: "API",
  web_portal: "Web Portal",
  email: "Email",
  document_file: "Document / File",
}

function configurationType(item: ConfigItem) {
  if (item.mode === "non_predefined") return "Non pre-defined"
  if (item.mode === "predefined") return "Pre-defined"
  const storedType = String(item.type ?? "")
  if (sourceTypeLabels[storedType]) return sourceTypeLabels[storedType]
  if (destinationTypeLabels[storedType]) return destinationTypeLabels[storedType]
  return String(item.type ?? item.provider ?? "—").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
}

function configurationDraft(kind: "source" | "destination", item: ConfigItem): ConfigurationDraft {
  const storedType = String(item.type ?? "")
  const type = kind === "source" ? sourceTypeLabels[storedType] ?? configurationType(item) : destinationTypeLabels[storedType] ?? configurationType(item)
  const draft = newDraft(kind, type)
  const config = item.config && typeof item.config === "object" && !Array.isArray(item.config) ? item.config as Record<string, unknown> : {}
  const values: Record<string, FormValue> = { ...draft.values, name: String(item.name ?? item.id) }
  for (const [key, value] of Object.entries(config)) {
    if (["endpoint", "filename", "formFields", "url", "user_added"].includes(key)) continue
    if (typeof value === "string" || typeof value === "boolean") values[key] = value
  }
  for (const secretField of ["apiKey", "appPassword", "credential", "password"]) values[secretField] = ""
  if (kind === "destination" && !values.fieldMatching && item.mapping && typeof item.mapping === "object" && !Array.isArray(item.mapping)) {
    values.fieldMatching = Object.entries(item.mapping as Record<string, unknown>).map(([destinationField, informationField]) => `${String(informationField)} -> ${destinationField}`).join("\n")
  }
  if (kind === "destination" && type === "API" && !config.method) values.method = "POST"
  const formFields = Array.isArray(config.formFields)
    ? config.formFields.filter((field): field is FormField => Boolean(field && typeof field === "object" && "name" in field && "type" in field))
    : []
  const credential = item.credential_ref as { configured?: boolean } | undefined
  return {
    ...draft,
    id: item.id,
    values,
    formFields,
    enabled: item.enabled !== false,
    credentialConfigured: Boolean(credential?.configured),
  }
}

function ConfigurationTable({ title, items, onOpen }: { title: string; items: ConfigItem[]; onOpen: (item: ConfigItem) => void }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <Card className="overflow-hidden">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Active</th><th className="px-5 py-3">Action</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-neutral-500">No {title.toLowerCase()} configured.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50" tabIndex={0} onClick={() => onOpen(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(item) }}>
                  <td className="px-5 py-4"><div className="flex items-center gap-2"><span className="font-medium">{String(item.name ?? item.id)}</span>{Boolean(item.is_default) && <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-xs font-medium text-white">Default</span>}</div><div className="mt-0.5 text-xs text-neutral-500">{item.id}</div></td>
                  <td className="px-5 py-4 text-neutral-600">{configurationType(item)}</td>
                  <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${item.enabled === false ? "bg-neutral-100 text-neutral-600" : "bg-emerald-50 text-emerald-700"}`}>{item.enabled === false ? "Disabled" : "Enabled"}</span></td>
                  <td className="px-5 py-4"><Button type="button" size="sm" className={tableActionButtonClass} onClick={(event) => { event.stopPropagation(); onOpen(item) }}>Open</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  )
}

function WorkflowTable({ items }: { items: DbosWorkflow[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Default workflows ({items.length})</h2>
        <p className="mt-1 text-sm text-neutral-500">Live workflow definitions registered with DBOS. Provider-specific work stays inside its source or destination connector.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-neutral-500">No DBOS workflows registered.</CardContent></Card>
        ) : items.map((workflow) => (
          <Card key={workflow.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="border-b border-neutral-200 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div><div className="font-semibold">{workflow.name}</div><div className="mt-1 font-mono text-xs text-neutral-500">{workflow.function_name}</div></div>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">{workflow.engine}</span>
                </div>
                <p className="mt-3 text-sm text-neutral-600">{workflow.description}</p>
                <p className="mt-2 text-xs text-neutral-500">Inputs: {workflow.inputs.join(", ") || "None"}</p>
              </div>
              <ol className="divide-y divide-neutral-100">
                {workflow.stages.map((stage, index) => (
                  <li key={`${workflow.id}-${stage.name}`} className="flex items-start gap-3 px-5 py-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-medium text-white">{index + 1}</span>
                    <div><div className="text-sm font-medium text-neutral-900">{stage.name}</div><div className="mt-0.5 text-xs capitalize text-neutral-500">{stage.kind.replaceAll("_", " ")}</div></div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function ModelTaskTable({ policies, models }: { policies: ConfigItem[]; models: ConfigItem[] }) {
  const modelById = new Map(models.map((model) => [model.id, model]))
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Model tasks ({policies.length})</h2>
      <Card className="overflow-hidden">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <tr><th className="px-5 py-3">Task</th><th className="px-5 py-3">LLM</th><th className="px-5 py-3">Provider</th></tr>
            </thead>
            <tbody>
              {policies.map((policy) => {
                const model = modelById.get(String(policy.primary_model_id))
                return (
                  <tr key={policy.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-5 py-4"><div className="font-medium">{String(policy.task).replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())}</div><div className="mt-0.5 font-mono text-xs text-neutral-500">{String(policy.task)}</div></td>
                    <td className="px-5 py-4"><div className="font-medium">{String(model?.name ?? policy.primary_model_id)}</div><div className="mt-0.5 font-mono text-xs text-neutral-500">{String(model?.model_name ?? "")}</div></td>
                    <td className="px-5 py-4 text-neutral-600">{String(model?.provider ?? "—")}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  )
}

export function ConfigurationPage() {
  const queryClient = useQueryClient()
  const config = useQuery({ queryKey: ["config"], queryFn: api.config, refetchInterval: 3000 })
  const workflows = useQuery({ queryKey: ["dbos-workflows"], queryFn: api.dbosWorkflows, refetchInterval: 3000 })
  const addedSources = (config.data?.sources ?? []).filter((source) => Boolean((source.config as { user_added?: boolean } | undefined)?.user_added))
  const structures = config.data?.schemas ?? []
  const defaultStructure = structures.find((structure) => Boolean(structure.is_default))
  const dynamicStructure = structures.find((structure) => structure.mode === "non_predefined")
  const [plannerFieldLimit, setPlannerFieldLimit] = useState("60")
  const [editingDraft, setEditingDraft] = useState<ConfigurationDraft | null>(null)
  useEffect(() => {
    if (dynamicStructure?.planner_field_limit) setPlannerFieldLimit(String(dynamicStructure.planner_field_limit))
  }, [dynamicStructure?.planner_field_limit])
  const numericFieldLimit = Number(plannerFieldLimit)
  const fieldLimitIsValid = Number.isInteger(numericFieldLimit) && numericFieldLimit >= 60 && numericFieldLimit <= 200
  const setDefaultStructure = useMutation({
    mutationFn: api.setDefaultInformationStructure,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["config"] }),
  })
  const updateSource = useMutation({
    mutationFn: (draft: ConfigurationDraft) => api.updateSource(draft.id, sourcePayloadFromDraft(draft)),
    onSuccess: () => { setEditingDraft(null); queryClient.invalidateQueries({ queryKey: ["config"] }) },
  })
  const updateDestination = useMutation({
    mutationFn: (draft: ConfigurationDraft) => api.updateTarget(draft.id, destinationPayloadFromDraft(draft)),
    onSuccess: () => { setEditingDraft(null); queryClient.invalidateQueries({ queryKey: ["config"] }) },
  })
  const saveEditedConfiguration = () => {
    if (!editingDraft) return
    if (editingDraft.kind === "source") updateSource.mutate(editingDraft)
    else updateDestination.mutate(editingDraft)
  }

  return (
    <div className="space-y-8">
      <div><h1 className="text-3xl font-semibold tracking-tight">Setup</h1><p className="mt-2 text-sm text-neutral-500">Sources, destinations, information structures, DBOS workflows and model assignments used by RekeyZero.</p></div>
      <ConfigurationTable title="Sources" items={addedSources} onOpen={(item) => setEditingDraft(configurationDraft("source", item))} />
      <ConfigurationTable title="Destinations" items={config.data?.targets ?? []} onOpen={(item) => setEditingDraft(configurationDraft("destination", item))} />
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Schema</h2>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div><div className="font-medium">Default information structure</div><div className="mt-1 text-sm text-neutral-500">New cases use this mode. Existing cases retain their original structure.</div></div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-neutral-600">Schema mode</span><select className="min-w-48 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={String(defaultStructure?.mode ?? "non_predefined")} disabled={setDefaultStructure.isPending} onChange={(event) => setDefaultStructure.mutate({ mode: event.target.value as "non_predefined" | "predefined", planner_field_limit: fieldLimitIsValid ? numericFieldLimit : 60 })}><option value="non_predefined">Non pre-defined</option><option value="predefined">Pre-defined</option></select></label>
              <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-neutral-600">Planner field limit</span><input className="w-36 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" type="number" min={60} max={200} step={1} value={plannerFieldLimit} onChange={(event) => setPlannerFieldLimit(event.target.value)} /></label>
              <Button type="button" disabled={setDefaultStructure.isPending || !fieldLimitIsValid} onClick={() => setDefaultStructure.mutate({ mode: String(defaultStructure?.mode ?? "non_predefined") as "non_predefined" | "predefined", planner_field_limit: numericFieldLimit })}>Save</Button>
              <span className="w-full text-xs text-neutral-500">Allowed range: 60–200 fields. Default: 60.</span>
            </div>
          </CardContent>
        </Card>
      </section>
      <WorkflowTable items={workflows.data ?? []} />
      <ModelTaskTable policies={config.data?.model_policies ?? []} models={config.data?.models ?? []} />
      {editingDraft && <ConnectionModal draft={editingDraft} onChange={setEditingDraft} onCancel={() => setEditingDraft(null)} onSave={saveEditedConfiguration} saving={updateSource.isPending || updateDestination.isPending} mode="edit" />}
      {(updateSource.isError || updateDestination.isError) && <p className="text-sm text-red-700">Could not save the configuration changes.</p>}
    </div>
  )
}
