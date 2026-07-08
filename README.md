# BPM Modeler — Proof of Concept

A minimal, working BPMN 2.0 diagramming tool built as the first step toward a
custom BPM platform. This is the L3/L4 layer: the actual process-modeling
canvas, with swimlanes (roles), gateways, tasks, and events — exportable as
standards-compliant BPMN 2.0 XML.

Built on [bpmn-js](https://github.com/bpmn-io/bpmn-js), the same open-source
modeling engine used by Camunda and many other BPM tools. This gives you a
production-grade canvas, palette, and BPMN XML import/export for free, so you
can focus on the parts unique to your product.

## What this POC proves

- Drag-and-drop BPMN modeling on a canvas (tasks, gateways, events, lanes)
- Swimlanes for roles (edit lane names by double-clicking them)
- A properties panel (right side) for editing the selected element's ID,
  name, and documentation — select any element to see its details
- Import an existing `.bpmn` file
- Export a valid BPMN 2.0 XML file
- Export a static SVG snapshot of the diagram
- Save/reload your work in the browser (localStorage) between sessions
- A lightweight **process mining** tab: upload a CSV event log to discover
  the actual process flow and compare it against your modeled diagram

## What this POC intentionally does NOT include (see "Next steps")

- No L0–L2 taxonomy (process hierarchy / value chains)
- No L5 work instructions attached to individual tasks
- No multi-user collaboration, accounts, or a real backend/database
- No process mining or analytics

## Getting started

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

To build a static production bundle:

```bash
npm run build
npm run preview
```

## How to use it

1. The canvas loads with a starter diagram: two swimlanes ("Role A", "Role B")
   and a Start event.
2. Use the palette on the left edge of the canvas to drag out tasks,
   gateways (diamonds), and end events, and connect them with sequence flows.
3. Double-click any element to rename it in place. Click an element once to
   open its details in the **Properties** panel on the right, where you can
   edit its ID, name, and documentation. To change a task's *type* (e.g. from
   a plain task to a User Task or Service Task), hover the element and use
   the wrench icon in its context pad — this is bpmn-js's built-in "change
   element type" action.
4. Click **Export BPMN XML** to download a `.bpmn` file — this is valid
   BPMN 2.0 XML, openable in Camunda Modeler, Signavio, or any BPMN-compliant
   tool.
5. Click **Save (browser)** to persist your current diagram in localStorage
   so it reloads automatically next time you open the app.
6. Click **Import BPMN** to load an existing `.bpmn` file back into the canvas.

## Project structure

```
bpm-poc/
├── index.html            Vite entry HTML
├── src/
│   ├── main.jsx           React bootstrap
│   ├── App.jsx            Toolbar + bpmn-js modeler wiring
│   ├── emptyDiagram.js     Starter BPMN XML (2 lanes + start event)
│   └── index.css          Layout & toolbar styling
├── package.json
└── vite.config.js
```

## Process mining (lightweight)

Switch to the **Mining** tab in the toolbar to try this. It's a
Directly-Follows Graph discovery approach — the standard first technique in
real process mining tools (including SAP Signavio) — scoped down to run
entirely in the browser:

1. Upload a CSV event log with one row per event: a case ID, an activity
   name, and a timestamp. Column names are auto-detected where possible, or
   map them manually. Use **Try sample data** to see it work instantly
   without a file of your own.
2. The tool groups events by case, sorts them by time, and counts how often
   each activity is directly followed by another — that produces the
   discovered flow diagram, with line thickness showing frequency.
3. Stats (cases, events, unique activities, process variants, average case
   duration) and the top 5 most common variants are shown alongside.
4. If you've named tasks in your **Model** diagram, it also runs a basic
   conformance check: which activities were executed but never modeled,
   which were modeled but never executed, and which match up.

This intentionally does **not** implement full conformance-checking
algorithms (token replay, alignments) or live system connectors — those are
a meaningfully larger effort and worth scoping as their own project if you
want to go further.

1. **Backend + persistence** — replace localStorage with a real API
   (`POST /diagrams`, `GET /diagrams/:id`) backed by Postgres. Store each
   diagram as `{ id, name, bpmn_xml, created_at, updated_at }`.
2. **L0–L2 taxonomy** — add a sidebar tree (Value Chain → End-to-End Process →
   Process Group) where each leaf node links to a diagram. This is standard
   CRUD, no new hard technical problems.
3. **L5 activity content** — extend the properties panel (or attach via
   custom extension elements in the BPMN XML) to hold instructions,
   screenshots, or SOP links per task.
4. **Collaboration** — comments, versioning, and approval workflows on top of
   the diagram records.
5. **Process mining** (much later) — a separate, larger effort: ingesting
   event logs from source systems and reconciling them against modeled
   processes.
