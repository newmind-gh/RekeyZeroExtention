# RekeyZero Personal Browser Extension

The Chromium Manifest V3 extension performs deterministic and browser-local-AI-assisted transfers and adds a browser-native ReKeyZero Admin page.

Neither extension performs final submission, unattended navigation, or business-response capture.

## Build and load

```powershell
cd apps/extension
npm ci
npm run build
```

Load `dist/rekeyzero-personal` through `chrome://extensions` or `edge://extensions` with Developer mode enabled. Future builds overwrite the same directory, so keep the extension installed and click **Reload** to preserve its unpacked path and browser-local model cache.

Useful validation commands:

```powershell
npm run check
npm test
npx playwright install chromium
npm run test:e2e
```

The manually triggered GitHub Actions workflow runs the extension on Playwright bundled Chromium, type-checks and builds it, runs unit tests, and builds and scans release artifacts. Firefox and Safari are outside the current Chromium Manifest V3 product boundary.

Release candidates are produced with:

```powershell
npm run release
```

Release output is written to the stable repository-level `dist/rekeyzero-personal` path, with matching `.zip` and `.manifest.json` files overwritten by each release. Builds are completed in temporary staging and copied into the stable directory before stale assets are removed, so required files such as `content-script.js` are never intentionally absent from the live unpacked path. The embedded release manifest records the source commit or deterministic snapshot hash and the repository's static executable and secret checks.

## Mapping Profile transfer model

The Side Panel is the only transfer UX. Its normal flow is:

```text
Profile dropdown
Create Profile
Open Profile
Fill
Reset
```

**Create Profile** lets the user select one source tab and one or more target tabs, observe those pages, configure target-field relationships and existing-value policy, and save the result. **Open Profile** edits the selected Mapping Profile. **Fill** rebinds the selected Mapping Profile to currently open tabs and executes the deterministic fill. **Reset** clears only the active batch and does not delete saved Mapping Profiles.

Mapping Profiles contain no current customer values. They retain stable page-template and field-template identities plus existing-value policy. Runtime customer values live only in the active source snapshot and transfer session.

The durable transfer mapping source of truth is:

```text
transfer_mapping_profiles
        ↓
   MappingProfile
        ↓
    controller
        ↓
     planner
        ↓
  page executor
```

There is no second destination/mapping persistence layer.

## Page matching and execution safety

The Side Panel dynamically lists open HTTP(S) tabs across browser windows. Website access remains optional and is requested for the exact source/target origins the user chooses.

A saved Mapping Profile identifies source and target page types by stable origin, value-free path shape, observed page template, and normalized title. Field relationships use record-normalized template keys; active execution uses instance keys that preserve stable record/row identity when available.

At Fill time the controller:

1. locates currently open tabs that match the selected Mapping Profile;
2. fails closed on ambiguous source matches;
3. observes and snapshots the source again;
4. verifies source identity/structure before freezing the batch;
5. plans target actions deterministically;
6. checks target state immediately before each write;
7. applies only supported field operations;
8. reads the page back after writes and re-plans untouched actions when dependent page structure changes.

Different existing target values are protected unless the Mapping Profile explicitly permits overwrite. Page/permission changes invalidate ready actions. Unknown Next/Submit controls are never clicked. Cancellation stops unsent actions and retains already-applied field changes.

The worker checkpoints the active batch in `chrome.storage.session`. It allows at most three concurrent sites and one writing target per origin. After worker recovery, uncertain writes are read before replay so already-matching values are not rewritten.

Supported controls include native text/date/number inputs, textarea, single-select, checkbox, grouped radio controls, and the explicit listbox-combobox adapter contract. Unadapted custom widgets, nested frames, Shadow DOM, PDFs and canvas are not filled.

## ReKeyZero Admin

The extension-owned options page is **ReKeyZero Admin**. The gear icon in the Side Panel header opens it through `chrome.runtime.openOptionsPage()`.

Current Admin sections are:

```text
Profiles
AI Setups
Log
Privacy
```

### Profiles

Profiles lists the Mapping Profiles used by the Side Panel. Users can open, edit, save, and delete them. Profile revisions are broadcast through extension storage so an already-open Side Panel refreshes its Profile dropdown after an Admin change.

Page identity metadata remains protected in Admin. Profile names, field relationships, and existing-value policies can be edited there; rebuilding source or target page structure remains in the Side Panel's **Open Profile** flow.

### AI Fill

The Personal Side Panel includes an **AI Fill** section below Profile, organized around a Setup dropdown with **Create Setup**, **Open Setup**, **Fill**, and **Reset** actions. Source and target tab selection, optional source and target URLs, and the setup name are contained in the Create/Open Setup editor.

The model selector contains the available browser-local WebLLM models plus **Gemini · API**, **DeepSeek · API**, and **GPT · API**. Every model option is selectable. Selecting a local model downloads and loads it in the browser. Selecting an API model opens **API settings**, where the user enters the model name and API key. GPT defaults to `gpt-5.6-terra`. The Extension calls the selected provider directly without a RekeyZero backend proxy. Saved setups use the existing Mapping Profile storage with the `ai_fill_setup` kind and the guarded transfer executor. **Fill** runs the selected setup; **Reset** clears only the active batch and retains saved setups.

API keys are never read from a repository `.env`. A key stays only in extension session storage and must be entered again after the browser restarts. RekeyZero restricts that storage area to trusted extension contexts. Keys are excluded from normal exports and diagnostics, and removing a provider deletes its stored key and provider host permission. Existing remembered provider keys are migrated to session-only storage when their configuration is loaded.

Admin → **AI Setups** lists saved AI Fill setups. Model download and enablement are controlled from the Side Panel rather than Admin.

Admin → **Log** stores each LLM request, every raw response attempt, the parsed response, accepted high-confidence model matches, deterministic exact/curated-label fallback additions, and the final mappings. The complete chronological log is displayed as raw JSON in one scrollable window. These logs stay in the browser. Field matching sends labels and control metadata, not source field values.

The old destination-response extraction path is not part of the current product. The extension does not inspect a post-submit business response to create reusable facts.

### Privacy and host permissions

Password controls are excluded from observation, model context, and fill.

Optional host permission ownership in Personal is limited to:

- enabled BYO AI provider origins; and
- origins referenced by saved Mapping Profiles.

The Personal manifest has no mandatory host permissions. HTTPS provider and website origins, plus localhost fixture origins, remain optional and are requested from the user when needed.

When the last Mapping Profile using an origin is deleted, the permission can be removed if no enabled provider still needs that origin.

## Personal persistence

Personal IndexedDB v7 contains only current durable product state:

```text
records
revisions
evidence
provider_configs
settings
transfer_mapping_profiles
```

The following old Personal single-page stores are retired and removed from the current schema:

```text
destinations
mappings
browser_tasks
actions
executions
events
transfer_mappings
transfer_target_groups
```

No legacy destination/task/action/execution data is converted into Mapping Profiles. Mapping Profiles remain the only durable transfer mapping model.

Normal Workspace export contains the current durable stores, including `transfer_mapping_profiles`, and excludes provider API keys. Diagnostics exclude Information values, Mapping Profile content, API keys, page text, and provider response bodies.

## Current architecture constraints

The extension is DOM-first. It does not execute model-generated JavaScript, arbitrary selectors, visual Computer Use, or unattended navigation. Real customer portals still require acceptance testing for site-specific autosave, delayed validation, custom controls, and server-side persistence behavior.

Build, permission, persistence, and validation procedures are documented in this file and the repository README.
