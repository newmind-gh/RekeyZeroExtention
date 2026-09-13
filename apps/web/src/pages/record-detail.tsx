import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Bot, CheckCircle2, LoaderCircle, Send, ShieldCheck, Square } from "lucide-react"
import { Link, useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  API_BASE,
  api,
  type AssetRecord,
  type CaseResponseContent,
  type EvidenceRecord,
  type InformationRevision,
} from "@/lib/api"

type InformationRow = { path: string; value: unknown }

function readableValue(value: unknown) {
  if (value == null || value === "") return "Not provided"
  return typeof value === "object" ? JSON.stringify(value) : String(value)
}

function responseTemplatePreview(template: string, context: Record<string, unknown>) {
  return template.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_, path: string) => {
    let value: unknown = context
    for (const part of path.split(".")) {
      if (!value || typeof value !== "object" || !(part in value)) return ""
      value = (value as Record<string, unknown>)[part]
    }
    return typeof value === "object" ? JSON.stringify(value) : String(value ?? "")
  })
}

function flattenInformation(value: unknown, path = ""): InformationRow[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    return value.flatMap((item, index) => flattenInformation(item, path ? `${path}.${index}` : String(index)))
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
    if (entries.length === 0) return []
    return entries.flatMap(([key, item]) => flattenInformation(item, path ? `${path}.${key}` : key))
  }
  if (value == null || value === "") return []
  return [{ path, value }]
}

function fieldLabel(path: string) {
  const parts = path.split(".")
  const displayParts = parts[0] === "items" && /^\d+$/.test(parts[1] ?? "")
    ? parts.slice(2)
    : parts
  return displayParts
    .map((part) => /^\d+$/.test(part)
      ? `Item ${Number(part) + 1}`
      : part.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()))
    .join(" · ")
}

function updateInformationValue(
  information: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const next = structuredClone(information)
  const parts = path.split(".")
  let cursor: any = next
  for (const part of parts.slice(0, -1)) cursor = cursor[part]
  cursor[parts.at(-1) ?? ""] = value
  return next
}

function FieldEditor({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  if (typeof value === "boolean") {
    return <select className="min-w-32 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={String(value)} onChange={(event) => onChange(event.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select>
  }
  if (typeof value === "number") {
    return <input className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" type="number" value={value} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} />
  }
  const text = value == null ? "" : String(value)
  if (text.length > 100 || text.includes("\n")) {
    return <textarea className="min-h-20 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" value={text} onChange={(event) => onChange(event.target.value)} />
  }
  return <input className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" value={text} onChange={(event) => onChange(event.target.value)} placeholder="Not provided" />
}

function InformationTable({
  information,
  evidence,
  assets,
  editable,
  onChange,
}: {
  information: Record<string, unknown>
  evidence: EvidenceRecord[]
  assets: AssetRecord[]
  editable: boolean
  onChange: (information: Record<string, unknown>) => void
}) {
  const rows = flattenInformation(information)
  return (
    <div className="max-h-[620px] overflow-auto rounded-xl border border-neutral-200">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="sticky top-0 z-[1] border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <tr><th className="w-2/5 px-4 py-3">Information</th><th className="px-4 py-3">Value and confidence</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const matchingEvidence = evidence
              .map((item) => ({
                item,
                path: item.field_path.replace(/^\$\./, ""),
              }))
              .filter(({ path }) => path === row.path || row.path.startsWith(`${path}.`))
              .sort((left, right) => {
                const leftExact = left.path === row.path ? 1 : 0
                const rightExact = right.path === row.path ? 1 : 0
                return rightExact - leftExact || right.path.length - left.path.length || right.item.confidence - left.item.confidence
              })[0]?.item
            const asset = assets.find((item) => item.id === matchingEvidence?.asset_id)
            const excerpt = matchingEvidence?.locator?.source_excerpt
            return (
              <tr key={row.path} className="border-b border-neutral-100 align-top last:border-0">
                <td className="px-4 py-4"><div className="font-medium text-neutral-900">{fieldLabel(row.path)}</div><div className="mt-1 font-mono text-[11px] text-neutral-400">{row.path}</div></td>
                <td className="px-4 py-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">{editable ? <FieldEditor value={row.value} onChange={(value) => onChange(updateInformationValue(information, row.path, value))} /> : <div className="min-h-9 rounded-md bg-neutral-50 px-3 py-2 font-medium text-neutral-900">{row.value == null || row.value === "" ? <span className="font-normal text-neutral-400">Not provided</span> : String(row.value)}</div>}</div>
                    <Badge>{matchingEvidence ? `${Math.round(matchingEvidence.confidence * 100)}%` : "0%"}</Badge>
                  </div>
                  {matchingEvidence && <div className="mt-2 text-xs text-neutral-500">{matchingEvidence.method === "human" ? "Confirmed by a person" : `Source: ${asset?.name ?? matchingEvidence.asset_id}`}{typeof excerpt === "string" && excerpt ? ` · “${excerpt}”` : ""}</div>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DestinationInformationTable({
  information,
  editable,
  onChange,
}: {
  information: Record<string, unknown>
  editable: boolean
  onChange: (information: Record<string, unknown>) => void
}) {
  const rows = flattenInformation(information).filter(
    (row) => row.path !== "attachment_ids" && !row.path.startsWith("attachment_ids."),
  )
  return (
    <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-neutral-200">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="sticky top-0 z-[1] border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <tr><th className="w-2/5 px-4 py-3">Destination field</th><th className="px-4 py-3">Value</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.path} className="border-b border-neutral-100 align-top last:border-0">
              <td className="px-4 py-4 font-medium text-neutral-900">{fieldLabel(row.path)}</td>
              <td className="px-4 py-4">
                {editable
                  ? <FieldEditor value={row.value} onChange={(value) => onChange(updateInformationValue(information, row.path, value))} />
                  : <div className="min-h-9 rounded-md bg-neutral-50 px-3 py-2 font-medium text-neutral-900">{String(row.value ?? "")}</div>}
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={2} className="px-4 py-6 text-center text-neutral-500">No destination information was prepared.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function AssetPreview({ asset }: { asset: AssetRecord }) {
  const dataUrl = asset.content_base64 ? `data:${asset.media_type};base64,${asset.content_base64}` : null
  if (dataUrl && asset.media_type === "application/pdf") {
    return <iframe className="h-[620px] w-full rounded-lg border border-neutral-200" src={dataUrl} title={asset.name} />
  }
  if (dataUrl && asset.media_type.startsWith("image/")) {
    return <div className="flex min-h-96 items-start justify-center rounded-lg bg-neutral-50 p-4"><img className="max-h-[580px] max-w-full object-contain" src={dataUrl} alt={asset.name} /></div>
  }
  if (dataUrl && asset.media_type.startsWith("audio/")) {
    return <div className="rounded-lg bg-neutral-50 p-5"><audio className="w-full" controls src={dataUrl}>Audio preview is unavailable.</audio></div>
  }
  const text = asset.preview_text ?? asset.content_text
  return <pre className={`max-h-[620px] min-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-4 text-sm leading-6 text-neutral-800 ${asset.media_type === "application/json" ? "font-mono" : "font-sans"}`}>{text || "A readable preview is not available for this source asset."}</pre>
}

function OriginalInformation({ assets }: { assets: AssetRecord[] }) {
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id ?? "")
  useEffect(() => {
    if (!assets.some((asset) => asset.id === selectedAssetId)) setSelectedAssetId(assets[0]?.id ?? "")
  }, [assets, selectedAssetId])
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? assets[0]
  if (!selectedAsset) return <div className="text-sm text-neutral-500">No original source is available.</div>
  return (
      <div className="space-y-3">
        {assets.length > 1 && <div className="flex flex-wrap gap-2">{assets.map((asset) => <button key={asset.id} type="button" onClick={() => setSelectedAssetId(asset.id)} className={`rounded-md border px-3 py-1.5 text-xs font-medium ${asset.id === selectedAsset.id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-700"}`}>{asset.name}</button>)}</div>}
      <div className="flex items-center justify-between gap-3"><div><div className="font-medium">{selectedAsset.name}</div><div className="text-xs text-neutral-500">{selectedAsset.media_type} · {selectedAsset.preview_mode ?? "original"}</div></div></div>
      <AssetPreview asset={selectedAsset} />
    </div>
  )
}

export function RecordDetailPage() {
  const { recordId = "" } = useParams()
  const queryClient = useQueryClient()
  const [executingActionIds, setExecutingActionIds] = useState<string[]>([])
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["record", recordId] }); queryClient.invalidateQueries({ queryKey: ["records"] }) }
  const record = useQuery({ queryKey: ["record", recordId], queryFn: () => api.record(recordId), refetchInterval: (query) => executingActionIds.length > 0 || query.state.data?.status === "generating_case_response" || query.state.data?.actions.some((action) => ["running", "response_processing"].includes(action.status)) ? 1200 : false })
  const processes = useQuery({ queryKey: ["record-processes", recordId], queryFn: () => api.recordProcesses(recordId), refetchInterval: 1000 })
  const config = useQuery({ queryKey: ["config"], queryFn: api.config })
  const [reviewInformation, setReviewInformation] = useState<Record<string, unknown>>({})
  const [destinationDrafts, setDestinationDrafts] = useState<Record<string, Record<string, unknown>>>({})
  const [caseResponseContent, setCaseResponseContent] = useState<CaseResponseContent>({ subject: "", message: "", document_type: "none", document_filename: "case-response", document_template: "{{subject}}\n\n{{message}}\n\nCase ID: {{case_id}}" })
  const pendingRevisionId = record.data?.pending_review_revision?.id
  useEffect(() => {
    if (record.data?.pending_review_revision) setReviewInformation(structuredClone(record.data.pending_review_revision.information))
  }, [pendingRevisionId])
  useEffect(() => {
    if (!record.data || executingActionIds.length === 0) return
    const statusByActionId = new Map(record.data.actions.map((action) => [action.id, action.status]))
    const unfinishedActionIds = executingActionIds.filter((actionId) => !["completed", "failed"].includes(statusByActionId.get(actionId) ?? ""))
    if (unfinishedActionIds.length !== executingActionIds.length) setExecutingActionIds(unfinishedActionIds)
  }, [record.data, executingActionIds])
  useEffect(() => {
    if (!record.data) return
    setDestinationDrafts((current) => {
      const next = { ...current }
      for (const action of record.data.actions) {
        if (!(action.id in next)) {
          next[action.id] = structuredClone(action.confirmed_payload ?? action.prepared_payload ?? action.payload)
        }
      }
      return next
    })
  }, [record.data])
  const latestCaseResponseId = record.data?.case_responses?.[0]?.id
  useEffect(() => {
    const response = record.data?.case_responses?.[0]
    if (!response) return
    const content = response.confirmed_content ?? response.prepared_content
    setCaseResponseContent({
      subject: content.subject ?? "",
      message: content.message ?? "",
      document_type: content.document_type ?? "none",
      document_filename: content.document_filename ?? "case-response",
      document_template: content.document_template ?? "{{subject}}\n\n{{message}}\n\nCase ID: {{case_id}}",
    })
  }, [latestCaseResponseId])

  const ingest = useMutation({ mutationFn: () => api.ingestRecord(recordId), onSuccess: invalidate })
  const validate = useMutation({ mutationFn: ({ revisionId, information }: { revisionId: string; information: Record<string, unknown> }) => api.validateRevision(recordId, revisionId, information), onSuccess: invalidate })
  const prepare = useMutation({ mutationFn: ({ revisionId, targetId }: { revisionId: string; targetId: string }) => api.prepareDestination(revisionId, targetId), onSuccess: invalidate })
  const confirm = useMutation({ mutationFn: ({ actionId, payload }: { actionId: string; payload: Record<string, unknown> }) => api.confirmAction(actionId, payload), onSuccess: invalidate })
  const execute = useMutation({ mutationFn: (actionId: string) => api.executeAction(actionId), onMutate: (actionId) => setExecutingActionIds((current) => [...new Set([...current, actionId])]), onSuccess: invalidate, onError: (_, actionId) => setExecutingActionIds((current) => current.filter((id) => id !== actionId)) })
  const executeMultiple = useMutation({ mutationFn: ({ actionIds, executionMode }: { actionIds: string[]; executionMode: "parallel" | "sequential" }) => api.executeActions(actionIds, executionMode), onMutate: ({ actionIds }) => setExecutingActionIds((current) => [...new Set([...current, ...actionIds])]), onSuccess: invalidate, onError: (_, { actionIds }) => setExecutingActionIds((current) => current.filter((id) => !actionIds.includes(id))) })
  const prepareCaseResponse = useMutation({ mutationFn: () => api.prepareCaseResponse(recordId), onSuccess: invalidate })
  const sendCaseResponse = useMutation({ mutationFn: ({ responseId, content }: { responseId: string; content: CaseResponseContent }) => api.confirmAndSendCaseResponse(responseId, content), onSuccess: invalidate })
  const stopProcesses = useMutation({ mutationFn: () => api.stopRecordProcesses(recordId), onSuccess: () => { setExecutingActionIds([]); invalidate(); queryClient.invalidateQueries({ queryKey: ["record-processes", recordId] }) } })

  if (record.isLoading) return <div className="text-sm text-neutral-500">Loading…</div>
  if (record.isError || !record.data) return <div className="text-sm text-red-700">Unable to load the information record.</div>

  const data = record.data
  const activeRevision = data.active_revision
  const pendingRevision = data.pending_review_revision
  const revisionConflicts = pendingRevision?.created_from?.conflicts ?? []
  const validatedRevision = data.current_validated_revision
  const reviewRevision = pendingRevision ?? validatedRevision
  const displayedInformation = pendingRevision ? reviewInformation : reviewRevision?.information ?? {}
  const organisation = activeRevision?.information.organisation as { legal_name?: string; trading_name?: string; name?: string } | undefined
  const organisationName = organisation?.legal_name ?? organisation?.trading_name ?? organisation?.name
  const error = stopProcesses.error ?? ingest.error ?? validate.error ?? prepare.error ?? confirm.error ?? execute.error ?? executeMultiple.error ?? prepareCaseResponse.error ?? sendCaseResponse.error
  const isBusy = ingest.isPending || validate.isPending || prepare.isPending || confirm.isPending || execute.isPending || executeMultiple.isPending || prepareCaseResponse.isPending || sendCaseResponse.isPending
  const hasOngoingProcesses = (processes.data?.active_count ?? 0) > 0 || ingest.isPending || prepare.isPending || execute.isPending || executeMultiple.isPending || prepareCaseResponse.isPending
  const confirmedActionIds = data.actions.filter((action) => action.status === "confirmed").map((action) => action.id)
  const destinationResponses = data.actions.filter((action) => action.execution)
  const latestCaseResponse = data.case_responses?.[0]
  const initiatingSource = data.sources.find((source) => source.initiating) ?? data.sources[0]
  const responseAttachments = Array.isArray(latestCaseResponse?.delivery_result.attachment_artifacts)
    ? latestCaseResponse.delivery_result.attachment_artifacts as { id: string; filename: string; media_type: string }[]
    : []
  const responsePreview = responseTemplatePreview(caseResponseContent.document_template, {
    ...(activeRevision?.information ?? {}),
    information: activeRevision?.information ?? {},
    case_id: data.case_id,
    subject: caseResponseContent.subject,
    message: caseResponseContent.message,
  })

  return <div className="space-y-6">
    <div><Link to="/" className="inline-flex items-center gap-2 text-sm text-neutral-500"><ArrowLeft className="size-4" />Workspace</Link><div className="mt-4 flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2"><h1 className="text-3xl font-semibold tracking-tight">{organisationName ?? "Information Record"}</h1><Badge>{data.status.replaceAll("_", " ")}</Badge></div><p className="mt-2 text-sm text-neutral-500">{data.information_structure_name ?? data.schema_name} · {data.revisions.length} revision{data.revisions.length === 1 ? "" : "s"}</p></div><div className="flex flex-wrap gap-2">{data.status === "pending_understanding" && <Button onClick={() => ingest.mutate()} disabled={isBusy}>{ingest.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Bot className="size-4" />}Understand information</Button>}<Button onClick={() => stopProcesses.mutate()} disabled={!hasOngoingProcesses || stopProcesses.isPending}>{stopProcesses.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Square className="size-4" />}Stop ongoing processes</Button></div></div>{error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{String(error.message)}</div>}</div>

    <Card>
      <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Information validation</CardTitle>{reviewRevision && <Badge>{pendingRevision ? "Pending review" : "Validated"}</Badge>}</div></CardHeader>
      <CardContent>
        {!reviewRevision ? <div className="text-sm text-neutral-500">Understand the source information to create a reviewable revision.</div> : <div className="items-start gap-6" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
          <section className="min-w-0"><OriginalInformation assets={data.assets} /></section>
          <section className="min-w-0 space-y-3"><h3 className="font-semibold">{pendingRevision ? "Information to validate" : "Validated information"}</h3>{revisionConflicts.length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4"><div className="font-medium text-amber-950">Conflicting information needs review</div><div className="mt-1 text-sm text-amber-800">Choose or edit the value below before confirming this revision.</div><div className="mt-3 space-y-2">{revisionConflicts.map((conflict, index) => <div key={`${conflict.field_path}-${index}`} className="rounded-lg border border-amber-200 bg-white p-3 text-sm"><div className="font-medium text-neutral-900">{fieldLabel(conflict.field_path)}</div><div className="mt-2 grid gap-2 sm:grid-cols-2"><div><span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Previously validated</span><div className="mt-1 rounded bg-neutral-50 px-2 py-1.5">{readableValue(conflict.previous)}</div></div><div><span className="text-xs font-medium uppercase tracking-wide text-amber-700">Destination returned</span><div className="mt-1 rounded bg-amber-50 px-2 py-1.5">{readableValue(conflict.received)}</div></div></div></div>)}</div></div>}<InformationTable information={displayedInformation} evidence={data.evidence} assets={data.assets} editable={Boolean(pendingRevision)} onChange={setReviewInformation} />{pendingRevision && <div className="flex justify-end"><Button onClick={() => validate.mutate({ revisionId: pendingRevision.id, information: reviewInformation })} disabled={isBusy}>{validate.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Confirm validated information</Button></div>}</section>
        </div>}
      </CardContent>
    </Card>

    <Card><CardHeader><CardTitle>Destination confirmation</CardTitle></CardHeader><CardContent className="space-y-4">{validatedRevision && <div><div className="mb-2 text-sm text-neutral-600">Choose one or more destination instances. RekeyZero prepares separate payloads; every payload requires human confirmation.</div><div className="flex flex-wrap gap-2">{(config.data?.targets ?? []).map((target) => <Button key={target.id} onClick={() => prepare.mutate({ revisionId: validatedRevision.id, targetId: target.id })} disabled={isBusy}>{String(target.name ?? target.id)}</Button>)}{(config.data?.targets ?? []).length === 0 && <span className="text-sm text-neutral-500">Add a destination in the Workspace first.</span>}</div></div>}{confirmedActionIds.length > 1 && <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4"><div><div className="text-sm font-medium">{confirmedActionIds.length} confirmed destinations</div><div className="mt-1 text-xs text-neutral-500">Execute them in one durable DBOS workflow and collect every response.</div></div><div className="flex flex-wrap gap-2"><Button onClick={() => executeMultiple.mutate({ actionIds: confirmedActionIds, executionMode: "parallel" })} disabled={isBusy}><Send className="size-4" />Run in parallel</Button><Button onClick={() => executeMultiple.mutate({ actionIds: confirmedActionIds, executionMode: "sequential" })} disabled={isBusy}><Send className="size-4" />Run sequentially</Button></div></div>}<div className="grid gap-3 md:grid-cols-2">{data.actions.map((action) => { const draft = destinationDrafts[action.id] ?? action.confirmed_payload ?? action.prepared_payload ?? action.payload; const selectedAttachmentIds = Array.isArray(draft.attachment_ids) ? draft.attachment_ids.map(String) : []; const attachmentChoices = [...data.assets.map((asset) => ({ id: asset.id, name: asset.name })), ...data.artifacts.map((artifact) => ({ id: artifact.id, name: String(artifact.filename ?? artifact.id) }))]; return <div key={action.id} className="rounded-xl border border-neutral-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{action.target_name}</div><div className="mt-1 text-xs text-neutral-500">Revision {action.record_revision_id ?? "—"}</div></div><Badge>{action.status.replaceAll("_", " ")}</Badge></div><DestinationInformationTable information={draft} editable={action.status === "pending_confirmation"} onChange={(information) => setDestinationDrafts((current) => ({ ...current, [action.id]: information }))} />{action.target_type === "email" && draft.attachments === "Selected files" && <div className="mt-3 rounded-xl border border-neutral-200 p-3"><div className="text-sm font-medium">Files to attach</div><div className="mt-2 space-y-2">{attachmentChoices.map((file) => <label key={file.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedAttachmentIds.includes(file.id)} disabled={action.status !== "pending_confirmation"} onChange={(event) => { const attachment_ids = event.target.checked ? [...selectedAttachmentIds, file.id] : selectedAttachmentIds.filter((id) => id !== file.id); setDestinationDrafts((current) => ({ ...current, [action.id]: { ...draft, attachment_ids } })) }} />{file.name}</label>)}{attachmentChoices.length === 0 && <div className="text-sm text-neutral-500">No case files are available.</div>}</div></div>}{action.status === "pending_confirmation" && <Button className="mt-3" onClick={() => confirm.mutate({ actionId: action.id, payload: draft })} disabled={isBusy || (action.target_type === "email" && draft.attachments === "Selected files" && selectedAttachmentIds.length === 0)}><ShieldCheck className="size-4" />Confirm destination information</Button>}{action.status === "confirmed" && <Button className="mt-3" onClick={() => execute.mutate(action.id)} disabled={isBusy}><Send className="size-4" />Execute confirmed information</Button>}{action.execution && <div className="mt-3 flex items-center gap-2 text-sm text-neutral-600"><CheckCircle2 className="size-4" />{action.execution.status}</div>}</div>})}</div></CardContent></Card>

    <Card><CardHeader><CardTitle>Destination responses</CardTitle></CardHeader><CardContent>{destinationResponses.length === 0 ? <div className="text-sm text-neutral-500">Responses will appear here after confirmed destinations are executed.</div> : <div className="grid gap-3 md:grid-cols-2">{destinationResponses.map((action) => <div key={action.id} className="rounded-xl border border-neutral-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{action.target_name}</div><div className="mt-1 text-xs text-neutral-500">{action.execution?.external_ref ? `Reference ${action.execution.external_ref}` : action.target_type}</div></div><Badge>{action.execution?.status ?? action.status}</Badge></div><div className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-400">Response</div><pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-neutral-50 p-3 text-xs">{JSON.stringify(action.execution?.result_data ?? {}, null, 2)}</pre></div>)}</div>}</CardContent></Card>

    <Card>
      <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Case Response</CardTitle>{latestCaseResponse && <Badge>{latestCaseResponse.status.replaceAll("_", " ")}</Badge>}</div></CardHeader>
      <CardContent className="space-y-4">
        {!latestCaseResponse ? <div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-sm text-neutral-600">Generate a response for the originating source after destination results are available.</div><div className="mt-1 text-xs text-neutral-500">The response uses the original source and media, then requires review before sending.</div></div><Button onClick={() => prepareCaseResponse.mutate()} disabled={isBusy || destinationResponses.length === 0}>{prepareCaseResponse.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Bot className="size-4" />}Generate Case Response</Button></div> : latestCaseResponse.status === "pending_review" ? (
          <div className="space-y-5">
            <div className="text-sm text-neutral-600">Initiating source: {initiatingSource?.name ?? latestCaseResponse.source_id} · Media: {latestCaseResponse.media_type}</div>
            <label className="grid gap-1.5 text-sm font-medium">Subject<input className="rounded-md border border-neutral-300 px-3 py-2 font-normal" value={caseResponseContent.subject} onChange={(event) => setCaseResponseContent((current) => ({ ...current, subject: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-sm font-medium">Message<textarea className="min-h-40 rounded-md border border-neutral-300 px-3 py-2 font-normal" value={caseResponseContent.message} onChange={(event) => setCaseResponseContent((current) => ({ ...current, message: event.target.value }))} /></label>
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="font-medium">Response document</div>
              <div className="mt-1 text-xs text-neutral-500">Optionally attach a reviewed PDF or Word document. Templates can use values such as {"{{case_id}}"}, {"{{subject}}"}, {"{{message}}"}, or {"{{organisation.legal_name}}"}.</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">Attachment<select className="rounded-md border border-neutral-300 bg-white px-3 py-2 font-normal" value={caseResponseContent.document_type} onChange={(event) => setCaseResponseContent((current) => ({ ...current, document_type: event.target.value as CaseResponseContent["document_type"] }))}><option value="none">No document</option><option value="pdf">PDF document</option><option value="docx">Word document</option></select></label>
                {caseResponseContent.document_type !== "none" && <label className="grid gap-1.5 text-sm font-medium">File name<input className="rounded-md border border-neutral-300 px-3 py-2 font-normal" value={caseResponseContent.document_filename} onChange={(event) => setCaseResponseContent((current) => ({ ...current, document_filename: event.target.value }))} /></label>}
              </div>
              {caseResponseContent.document_type !== "none" && <div className="mt-4 grid gap-4 lg:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Document template<textarea className="min-h-64 rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs font-normal" value={caseResponseContent.document_template} onChange={(event) => setCaseResponseContent((current) => ({ ...current, document_template: event.target.value }))} /></label><div><div className="mb-1.5 text-sm font-medium">Document preview</div><div className="min-h-64 whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">{responsePreview}</div></div></div>}
            </div>
            <div className="flex justify-end"><Button onClick={() => sendCaseResponse.mutate({ responseId: latestCaseResponse.id, content: caseResponseContent })} disabled={isBusy || !caseResponseContent.subject.trim() || !caseResponseContent.message.trim() || (caseResponseContent.document_type !== "none" && (!caseResponseContent.document_filename.trim() || !caseResponseContent.document_template.trim()))}>{sendCaseResponse.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}Confirm response</Button></div>
          </div>
        ) : <div className="space-y-3"><div className="text-sm text-neutral-600">Confirmed and ready for delivery through {String(latestCaseResponse.delivery_result.source_name ?? latestCaseResponse.source_id)} using {latestCaseResponse.media_type}.</div><div><div className="text-sm font-medium">{latestCaseResponse.confirmed_content?.subject}</div><div className="mt-2 whitespace-pre-wrap rounded-lg bg-neutral-50 p-4 text-sm">{latestCaseResponse.confirmed_content?.message}</div></div>{responseAttachments.length > 0 && <div><div className="text-sm font-medium">Attachments</div><div className="mt-2 flex flex-wrap gap-2">{responseAttachments.map((attachment) => <a key={attachment.id} href={`${API_BASE}/api/artifacts/${attachment.id}/download`} className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50">{attachment.filename}</a>)}</div></div>}</div>}
      </CardContent>
    </Card>
  </div>
}
