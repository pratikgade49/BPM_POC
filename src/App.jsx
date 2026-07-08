import React, { useEffect, useRef, useState } from 'react'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
} from 'bpmn-js-properties-panel'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'
import '@bpmn-io/properties-panel/assets/properties-panel.css'
import {
  FilePlus,
  Upload,
  Save,
  FileCode,
  Image as ImageIcon,
  Workflow,
  Activity,
} from 'lucide-react'
import { EMPTY_DIAGRAM } from './emptyDiagram.js'
import MiningView from './MiningView.jsx'

const STORAGE_KEY = 'bpm-poc-diagram'

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function ToolbarButton({ icon: Icon, label, onClick, variant = 'ghost', title }) {
  return (
    <button
      className={`tbtn tbtn-${variant}`}
      onClick={onClick}
      title={title || label}
      type="button"
    >
      <Icon size={15} strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  )
}

export default function App() {
  const containerRef = useRef(null)
  const panelRef = useRef(null)
  const modelerRef = useRef(null)
  const fileInputRef = useRef(null)
  const [status, setStatus] = useState({ text: 'Ready', tone: 'neutral' })
  const [processName, setProcessName] = useState('Untitled process')
  const [hasSelection, setHasSelection] = useState(false)
  const [view, setView] = useState('model')
  const [modelTaskNames, setModelTaskNames] = useState([])

  const setStatusMsg = (text, tone = 'neutral') => setStatus({ text, tone })

  useEffect(() => {
    const modeler = new BpmnModeler({
      container: containerRef.current,
      keyboard: { bindTo: window },
      propertiesPanel: {
        parent: panelRef.current,
      },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
      ],
    })
    modelerRef.current = modeler

    modeler.on('selection.changed', (e) => {
      setHasSelection(e.newSelection.length > 0)
    })

    const initial = localStorage.getItem(STORAGE_KEY) || EMPTY_DIAGRAM

    modeler
      .importXML(initial)
      .then(() => {
        modeler.get('canvas').zoom('fit-viewport')
        setStatusMsg('Diagram loaded')
      })
      .catch((err) => {
        console.error('Failed to import diagram', err)
        setStatusMsg('Could not load saved diagram — started blank', 'error')
        modeler.importXML(EMPTY_DIAGRAM)
      })

    return () => modeler.destroy()
  }, [])

  const handleNew = async () => {
    if (!window.confirm('Discard the current diagram and start a new one?')) return
    await modelerRef.current.importXML(EMPTY_DIAGRAM)
    modelerRef.current.get('canvas').zoom('fit-viewport')
    setStatusMsg('New diagram created')
  }

  const handleSaveLocal = async () => {
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true })
      localStorage.setItem(STORAGE_KEY, xml)
      setStatusMsg('Saved to browser storage')
    } catch (err) {
      console.error(err)
      setStatusMsg('Save failed', 'error')
    }
  }

  const handleExportXML = async () => {
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true })
      downloadFile(`${processName || 'process'}.bpmn`, xml, 'application/xml')
      setStatusMsg('BPMN 2.0 XML exported')
    } catch (err) {
      console.error(err)
      setStatusMsg('Export failed', 'error')
    }
  }

  const handleExportSVG = async () => {
    try {
      const { svg } = await modelerRef.current.saveSVG()
      downloadFile(`${processName || 'process'}.svg`, svg, 'image/svg+xml')
      setStatusMsg('SVG exported')
    } catch (err) {
      console.error(err)
      setStatusMsg('SVG export failed', 'error')
    }
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const getModelTaskNames = () => {
    const modeler = modelerRef.current
    if (!modeler) return []
    try {
      const registry = modeler.get('elementRegistry')
      return registry
        .filter((el) => el.type && /Task$/.test(el.type))
        .map((el) => el.businessObject?.name)
        .filter(Boolean)
    } catch (err) {
      console.error(err)
      return []
    }
  }

  const switchToMining = () => {
    setModelTaskNames(getModelTaskNames())
    setView('mining')
  }

  const switchToModel = () => {
    setView('model')
    // give the canvas a beat to become visible again before resizing bpmn-js to it
    setTimeout(() => {
      try {
        modelerRef.current?.get('canvas').resized()
      } catch (err) {
        // no-op
      }
    }, 0)
  }

  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        await modelerRef.current.importXML(evt.target.result)
        modelerRef.current.get('canvas').zoom('fit-viewport')
        setStatusMsg(`Imported ${file.name}`)
      } catch (err) {
        console.error(err)
        setStatusMsg('Import failed — invalid BPMN file', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-row">
          <div className="identity">
            <span className="mark" aria-hidden="true" />
            <input
              className="process-name-input"
              value={processName}
              onChange={(e) => setProcessName(e.target.value)}
              placeholder="Untitled process"
              aria-label="Process name"
            />
          </div>

          <div className="view-switch" role="tablist" aria-label="View">
            <button
              className={`view-tab ${view === 'model' ? 'active' : ''}`}
              onClick={switchToModel}
              type="button"
              role="tab"
              aria-selected={view === 'model'}
            >
              <Workflow size={14} strokeWidth={1.75} />
              <span>Model</span>
            </button>
            <button
              className={`view-tab ${view === 'mining' ? 'active' : ''}`}
              onClick={switchToMining}
              type="button"
              role="tab"
              aria-selected={view === 'mining'}
            >
              <Activity size={14} strokeWidth={1.75} />
              <span>Mining</span>
            </button>
          </div>

          <div className="toolbar-groups">
            <div className="tgroup">
              <ToolbarButton icon={FilePlus} label="New" onClick={handleNew} />
              <ToolbarButton icon={Upload} label="Import" onClick={handleImportClick} title="Import BPMN file" />
              <input
                ref={fileInputRef}
                type="file"
                accept=".bpmn,.xml"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
            </div>

            <div className="tdivider" />

            <div className="tgroup">
              <ToolbarButton icon={Save} label="Save" onClick={handleSaveLocal} title="Save to browser storage" />
            </div>

            <div className="tdivider" />

            <div className="tgroup">
              <ToolbarButton icon={FileCode} label="Export BPMN" onClick={handleExportXML} variant="primary" />
              <ToolbarButton icon={ImageIcon} label="Export SVG" onClick={handleExportSVG} />
            </div>
          </div>
        </div>
      </header>

      <div className="main-row">
        <div
          className="canvas-wrapper"
          ref={containerRef}
          style={{ display: view === 'model' ? 'block' : 'none' }}
        />

        <aside className="properties-panel" style={{ display: view === 'model' ? 'flex' : 'none' }}>
          <div className="properties-panel-header">
            <span>Properties</span>
          </div>
          {!hasSelection && (
            <div className="properties-panel-empty">
              Select an element on the canvas to edit its details.
            </div>
          )}
          <div
            className="properties-panel-body"
            ref={panelRef}
            style={{ display: hasSelection ? 'block' : 'none' }}
          />
        </aside>

        {view === 'mining' && (
          <div className="mining-scroll">
            <MiningView modelTaskNames={modelTaskNames} onStatus={(t) => setStatusMsg(t)} />
          </div>
        )}
      </div>

      <footer className="statusbar">
        <span className={`status-dot status-${status.tone}`} />
        <span className="status-text">{status.text}</span>
      </footer>
    </div>
  )
}
