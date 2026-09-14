# RekeyZero

This repository contains the browser extension, supporting web sources, and the synthetic test-page server. It does not include a FastAPI backend, server-managed Gemini/DeepSeek credentials, or an Ollama bridge.

**Get information once. Understand it once. Use it everywhere.**

RekeyZero is an information-reuse layer for business workflows. It turns incoming information into a reviewable, versioned Information Record and then helps users reuse validated information across downstream systems without repeatedly re-keying the same facts.

> **If RekeyZero already knows a fact, a human should not have to type it again.**

## What RekeyZero does

RekeyZero is built around a simple flow:

```text
Sources / files / forms
        ↓
Intake + original assets
        ↓
Information understanding
        ↓
Pending Information Revision
        ↓
Human validation
        ↓
Validated Information
        ↓
Destination preparation
        ↓
Human confirmation
        ↓
API / browser / email / file execution
        ↓
Destination response
        ↓
Optional new pending revision
```

Key concepts:

- **Information Record** — a long-lived container for reusable business or personal information.
- **Information Revision** — a versioned candidate or validated set of information.
- **Validated Information** — the information eligible for record-driven downstream composition; fill-only page batches use separate, explicitly authorized session snapshots.
- **Evidence** — provenance and source context associated with extracted information.
- **Destination** — a configured downstream API, web portal, email or document/file target.
- **Action / Execution** — a prepared destination operation and the resulting execution.
- **Destination Response** — the captured result of an execution, retained separately from validated information.

New information never silently overwrites the current validated revision. Reusable facts returned by a destination become a new pending revision and require review before they can be reused.

## Deployment profile

RekeyZero provides a Personal Chromium Manifest V3 extension. It uses browser IndexedDB for primary storage and deterministic matching with an optional browser-local model.

The Personal build can also call Gemini, DeepSeek, or GPT directly with a model name and API key entered by the user in the extension UI. External AI is optional; no RekeyZero backend proxies or stores these requests.

A RekeyZero-hosted cloud service is not required.

## Safety and human control

RekeyZero is designed to automate repetitive transfer of information without giving a model unrestricted browser authority.

- only validated information is eligible for record-driven destination composition;
- the browser extension never performs consequential final submission;
- browser execution uses a constrained action set tied to the current page state;
- stale or changed page state invalidates the prepared fill plan;
- uncertain or unsupported behavior becomes an exception / **Human Required** state;
- password fields are not captured or filled;
- CAPTCHA and MFA are not bypassed;
- arbitrary model-generated JavaScript or selectors are not executed;
- destructive or ambiguous actions are not executed automatically;
- destination submission remains a manual action on each target website.

## Main capabilities

### Information intake and review

RekeyZero can create Information Records from configured sources and direct intake such as files, text/JSON, forms and other supported connectors. Original assets are retained so extracted information can be reviewed against source evidence.

Information structures can be generated for the incoming information or use a predefined schema. Users review and correct pending revisions before marking information as validated.

### Browser extension and Side Panel

`apps/extension` contains the Personal extension.

The Side Panel is a non-AI, fill-only batch transfer task that pins one source page, selects multiple
open target tabs, protects existing values, and checks each result. Its temporary
source snapshot is separate from validated Information Records. See `apps/extension/README.md` for supported controls and recovery.

Non-technical users can create multiple Mapping Profiles from one open source and multiple open target
page types. A saved profile contains page-template identities, field relationships, and existing-value
policies—not customer or current field values. The Side Panel selects the first saved profile by default;
**Open Profile** supports editing, saving, or deleting that selection, while **Fill** performs both the
prepare and fill steps in one action.

The extension keeps its information and workflow state in the browser and does not require a RekeyZero server.

## Getting started

### Requirements

For the current Windows reference development setup:

- Node.js 22+
- npm
- a supported Chromium-based browser

The extension declares Chrome/Chromium 124+. Local AI additionally requires a browser/device with WebGPU support.

### Set up the repository

From the repository root:

```powershell
.\setup.ps1
```

The setup installs and checks the extension and supporting web packages. No Python environment or local model service is required.

## Build the browser extension

```powershell
cd apps\extension
npm ci
```

```powershell
npm run build
```

Build output is written to `dist/rekeyzero-personal`. Load that directory from the browser's extensions page. `apps/extension/dist` is not used.

## Repository layout

```text
apps/web/          Demo Workspace web source (requires an external compatible API)
apps/extension/    Personal browser extension
tests/extension-portal/ Synthetic pages used for extension validation
```

## Development and testing

The repository contains frontend and Personal browser-extension tests.

From `apps/extension`:

```powershell
npm run check
npm test
```

Browser end-to-end tests are also available through the extension package scripts. See `CONTRIBUTING.md` for contribution guidance.

Run the deterministic browser test and create a release candidate from a clean committed source state:

```powershell
cd apps\extension
npm run test:e2e
npm run release
```

The release command writes the ZIP and its verification manifest to the repository-level `dist/` directory. Real-Chrome validation must install the unpacked contents of that exact ZIP, record its SHA-256, and restart from release generation whenever product source changes.

## Privacy and security

RekeyZero may process sensitive business or personal information. Do not commit real credentials, customer data or other secrets to the repository or test fixtures.

For security reporting and supported disclosure channels, see [SECURITY.md](SECURITY.md).

## Project files

- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Support](SUPPORT.md)
- [Maintainers](MAINTAINERS.md)
- [Governance](GOVERNANCE.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)

## License

RekeyZero is licensed under the permissive [MIT License](LICENSE.md).
