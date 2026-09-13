# RekeyZero deterministic extension portal

This synthetic local portal implements the compatibility classes used by release validation. Start it with:

```powershell
node tests/extension-portal/server.mjs
```

Routes cover native and controlled inputs, select/radio/checkbox controls, multi-step and dynamic URLs, success/rejection/validation responses, ambiguous and destructive actions, iframe and Shadow DOM boundaries, oversized forms, adversarial labels, file upload, and rich text.

## Four-system batch-transfer scenario

Open `http://127.0.0.1:4178/transfer-demo` after starting the server. The workspace links to four deliberately different applications:

- **System Alpha CRM** (`/transfer-demo/source`) is the populated, read-only source customer profile.
- **System Beta Marketplace Portal** (`/transfer-demo/marketplace`) is an empty seller-onboarding target with marketplace-specific labels and field names.
- **System Gamma Fulfilment** (`/transfer-demo/fulfilment`) is a fulfilment-partner target with a different layout, different field names, select values, and one protected existing value.
- **System Delta Modern Portal** (`/transfer-demo/delta`) is a real React target with controlled inputs, adapter-backed custom comboboxes, and dependent-control replacement.

Open Alpha and any target pages in separate tabs, then create a Mapping Profile that selects Alpha as the source and maps Beta, Gamma, and/or Delta as targets. Gamma exercises select conversion, visible application identity, and explicit existing-value policy. Delta exercises React state, explicit custom-control adapters, and dynamic dependent controls. RekeyZero must not navigate or submit any target form.

File upload, rich text, cross-frame fields, and Shadow DOM fields are deliberately unsupported by automated fill in Release Candidate 1. They must appear as exceptions or remain unobserved; the extension must not weaken its safety boundary to automate them.
