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
  LogIn,
  LogOut,
  Home,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { EMPTY_DIAGRAM } from './emptyDiagram.js'
import MiningView from './MiningView.jsx'

import {
  apiHealth,
  apiLogin,
  apiMe,
  apiListProcesses,
  apiGetProcessDetail,
  apiCreateProcess,
  apiUpdateProcess,
  apiRegister,
  apiAdminListUsers,
  apiAdminActivateUser,
  apiAdminDeactivateUser,
} from './api/client.js'


import { getAccessToken, clearTokens, setTokens } from './api/authStore.js'


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

function ToolbarButton({ icon: Icon, label, onClick, variant = 'ghost', title, disabled = false }) {
  return (
    <button
      className={`tbtn tbtn-${variant}`}
      onClick={onClick}
      title={title || label}
      type="button"
      disabled={disabled}
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

  const [savedProcesses, setSavedProcesses] = useState([])
  const [savedProcessesLoading, setSavedProcessesLoading] = useState(false)
  const [savedProcessesErr, setSavedProcessesErr] = useState('')
  const [showSavedProcessesModal, setShowSavedProcessesModal] = useState(false)
  const [showAdminUsersModal, setShowAdminUsersModal] = useState(false)


  const [hasSelection, setHasSelection] = useState(false)
  const [view, setView] = useState('model')
  const [screen, setScreen] = useState('landing')
  const [modelTaskNames, setModelTaskNames] = useState([])

  const [backendStatus, setBackendStatus] = useState({ state: 'unknown', detail: '' })

  const [auth, setAuth] = useState({
    accessToken: getAccessToken() || null,
    me: null,
  })

  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
  })

  const [signupForm, setSignupForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'viewer',
  })


  // Track which backend process the current diagram represents.
  const [activeProcessId, setActiveProcessId] = useState(null)
  const [hasLoadedWorkspaceOnce, setHasLoadedWorkspaceOnce] = useState(false)


  const [adminUsers, setAdminUsers] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminErr, setAdminErr] = useState('')

  const setStatusMsg = (text, tone = 'neutral') => setStatus({ text, tone })


  useEffect(() => {
    // Backend connectivity check (proves integration)
    ;(async () => {
      try {
        const res = await apiHealth()
        setBackendStatus({ state: 'ok', detail: res?.status || 'ok' })
      } catch (e) {
        setBackendStatus({ state: 'error', detail: e?.message || 'error' })
      }
    })()
  }, [])

  useEffect(() => {
    if (screen !== 'workspace') {
      modelerRef.current?.destroy()
      modelerRef.current = null
      return
    }

    if (!containerRef.current || !panelRef.current) return

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

    const initial = hasLoadedWorkspaceOnce
      ? localStorage.getItem(STORAGE_KEY) || EMPTY_DIAGRAM
      : EMPTY_DIAGRAM

    modeler
      .importXML(initial)
      .then(() => {
        modeler.get('canvas').zoom('fit-viewport')
        setStatusMsg('Diagram loaded')
        setHasLoadedWorkspaceOnce(true)
      })
      .catch((err) => {
        console.error('Failed to import diagram', err)
        setStatusMsg('Could not load saved diagram — started blank', 'error')
        modeler.importXML(EMPTY_DIAGRAM)
        setHasLoadedWorkspaceOnce(true)
      })


    return () => {
      modeler.destroy()
      modelerRef.current = null
    }
  }, [screen])

  useEffect(() => {
    ;(async () => {
      if (!auth.accessToken) {
        setAuth((a) => ({ ...a, me: null }))
        return
      }
      try {
        const me = await apiMe(auth.accessToken)
        setAuth((a) => ({ ...a, me }))
      } catch {
        clearTokens()
        setAuth({ accessToken: null, me: null })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.accessToken])

  const isAdmin = auth.me?.role === 'admin'

  useEffect(() => {
    if (!isAdmin || !auth.accessToken) return


    ;(async () => {
      setAdminLoading(true)
      setAdminErr('')
      try {
        const users = await apiAdminListUsers(auth.accessToken)
        setAdminUsers(users || [])
      } catch (e) {
        setAdminErr(e?.message || 'Failed to load users')
      } finally {
        setAdminLoading(false)
      }
    })()
  }, [isAdmin, auth.accessToken])







  const canEdit = ['editor', 'admin'].includes(auth.me?.role)




  const handleNew = async () => {

    if (!canEdit) {
      setStatusMsg('Editor access is required to create a new diagram', 'error')
      return
    }

    if (!window.confirm('Discard the current diagram and start a new one?')) return
    // Starting a brand-new process in the UI should create a new backend record (POST),
    // not attempt to update an existing process (PUT).
    setActiveProcessId(null)
    setProcessName('Untitled process')

    await modelerRef.current.importXML(EMPTY_DIAGRAM)
    modelerRef.current.get('canvas').zoom('fit-viewport')
    setStatusMsg('New diagram created')
  }

  const handleSaveBackend = async () => {
    try {
      if (!auth.accessToken) {
        setStatusMsg('Login required to save', 'error')
        return
      }

      if (!canEdit) {
        setStatusMsg('Viewer access cannot save changes', 'error')
        return
      }

      const { xml } = await modelerRef.current.saveXML({ format: true })

      if (!activeProcessId) {
        const created = await apiCreateProcess(auth.accessToken, {
          name: processName || 'Untitled process',
          bpmn_xml: xml,
        })
        setActiveProcessId(created.id)
        setStatusMsg('Saved to backend (created process)')
      } else {
        const updated = await apiUpdateProcess(auth.accessToken, {
          process_id: activeProcessId,
          name: processName || 'Untitled process',
          bpmn_xml: xml,
        })
        setActiveProcessId(updated.id)
        setStatusMsg('Saved to backend')
      }

      // keep local copy as well (non-breaking, useful while loading)
      localStorage.setItem(STORAGE_KEY, xml)
    } catch (err) {
      console.error(err)
      setStatusMsg(err?.message || 'Save failed', 'error')
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

  const handleExportPDF = async () => {
    try {
      if (!modelerRef.current) return

      const canvas = modelerRef.current.get('canvas')

      // Ensure the diagram is laid out and visible
      try {
        canvas.zoom('fit-viewport')
      } catch {
        // ignore
      }

      // Render to a high-resolution PNG and embed into a 1-page PDF.
      // This avoids brittle SVG->PDF conversions.
      const { svg } = await modelerRef.current.saveSVG()

      // Convert SVG -> canvas image -> PNG
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.decoding = 'async'

      await new Promise((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = (e) => reject(e)
        img.src = url
      })

      URL.revokeObjectURL(url)

      // High DPI render
      const scale = 2.5
      const width = Math.max(1, img.width || 1200)
      const height = Math.max(1, img.height || 800)

      const renderCanvas = document.createElement('canvas')
      renderCanvas.width = Math.floor(width * scale)
      renderCanvas.height = Math.floor(height * scale)
      const ctx = renderCanvas.getContext('2d')

      if (!ctx) throw new Error('Failed to create canvas')

      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0)

      const pngDataUrl = renderCanvas.toDataURL('image/png')

      // Lazy-load jsPDF to avoid adding dependency errors at startup.
      const mod = await import('jspdf')
      const jsPDF = mod.default

      // Letter size: 612x792 pt-ish. jsPDF uses mm by default.
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      // Convert image pixels to mm while keeping aspect ratio
      // Use the rendered canvas size as reference.
      const imgW = renderCanvas.width
      const imgH = renderCanvas.height
      const ratio = imgW / imgH

      let targetW = pageWidth - 20
      let targetH = targetW / ratio
      if (targetH > pageHeight - 20) {
        targetH = pageHeight - 20
        targetW = targetH * ratio
      }

      const x = (pageWidth - targetW) / 2
      const y = (pageHeight - targetH) / 2

      pdf.addImage(pngDataUrl, 'PNG', x, y, targetW, targetH, undefined, 'FAST')
      pdf.save(`${processName || 'process'}.pdf`)
      setStatusMsg('PDF exported')
    } catch (err) {
      console.error(err)
      setStatusMsg(err?.message || 'PDF export failed', 'error')
    }
  }

  const handleImportClick = () => {
    if (!canEdit) {
      setStatusMsg('Editor access is required to import BPMN files', 'error')
      return
    }
    fileInputRef.current?.click()
  }

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

    if (!canEdit) {
      setStatusMsg('Editor access is required to import BPMN files', 'error')
      e.target.value = ''
      return
    }

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

  const loadProcessIntoCanvas = async (process) => {
    if (!process?.id || !process?.bpmn_xml) return

    setProcessName(process?.name || 'Untitled process')
    setActiveProcessId(process.id)

    try {
      await modelerRef.current.importXML(process.bpmn_xml)
      modelerRef.current.get('canvas').zoom('fit-viewport')
      setStatusMsg(`Loaded saved workspace: ${process.name}`)
    } catch (err) {
      console.error(err)
      setStatusMsg(err?.message || 'Failed to load saved workspace', 'error')
    }
  }

  const fetchSavedProcesses = async () => {

    if (!auth.accessToken) return
    setSavedProcessesLoading(true)
    setSavedProcessesErr('')
    try {
      const list = await apiListProcesses(auth.accessToken)
      setSavedProcesses(list || [])
    } catch (e) {
      setSavedProcessesErr(e?.message || 'Failed to load saved workspaces')
    } finally {
      setSavedProcessesLoading(false)
    }
  }

  return (
    <div className="app">

      {screen === 'landing' ? (
        <main className="landing-page">
          <section className="landing-hero">
            <div className="landing-badge">
              <ShieldCheck size={15} strokeWidth={1.8} />
              <span>Process intelligence workspace</span>
            </div>
            <h1>Model, review, and compare BPMN processes in a dedicated workspace.</h1>
            <p>
              Start with a polished landing experience, then open the actual canvas to edit diagrams,
              import BPMN files, and compare your process design with event data.
            </p>
            <div className="landing-actions">
              <button
                className="tbtn tbtn-primary"
                onClick={async () => {
                  if (!auth.accessToken) {
                    setStatusMsg('Login required to open workspace', 'error')
                    return
                  }
                  if (auth.me) {
                    setScreen('workspace')
                    return
                  }
                  try {
                    const me = await apiMe(auth.accessToken)
                    setAuth((a) => ({ ...a, me }))
                    setScreen('workspace')
                    setHasLoadedWorkspaceOnce(false)
                    setActiveProcessId(null)
                    setStatusMsg('Logged in')
                  } catch {
                    clearTokens()
                    setAuth({ accessToken: null, me: null })
                    setActiveProcessId(null)
                    setScreen('landing')
                    setStatusMsg('Session expired — please login again', 'error')
                  }
                }}
                type="button"
              >
                <span>Open workspace</span>
                <ArrowRight size={15} strokeWidth={1.75} />
              </button>
              <button className="tbtn tbtn-ghost" onClick={() => setStatusMsg('Landing screen ready', 'neutral')} type="button">
                <span>Preview capabilities</span>
              </button>
            </div>

            <div className="landing-highlights">
              <div className="landing-card">
                <Workflow size={16} strokeWidth={1.7} />
                <div>
                  <strong>Visual modeling</strong>
                  <p>Design and edit BPMN diagrams with the embedded canvas.</p>
                </div>
              </div>
              <div className="landing-card">
                <Activity size={16} strokeWidth={1.7} />
                <div>
                  <strong>Process mining</strong>
                  <p>Compare the modeled flow with real event logs.</p>
                </div>
              </div>
              <div className="landing-card">
                <ShieldCheck size={16} strokeWidth={1.7} />
                <div>
                  <strong>Role-aware access</strong>
                  <p>Editor and admin accounts can modify models while viewers can inspect safely.</p>
                </div>
              </div>
            </div>
          </section>

          <aside className="landing-panel">
            <div className="landing-panel-card">
              <h2>Access your workspace</h2>

              {auth.me ? (
                <>
                  <p>You are signed in as <strong>{auth.me.email}</strong>.</p>
                  <div className="role-pill">Role: {auth.me.role}</div>
                  <p>
                    {canEdit
                      ? 'Your role allows editing and saving diagrams.'
                      : 'Viewer access is active, so the canvas stays read-only for you.'}
                  </p>

                  <button className="tbtn tbtn-ghost" onClick={() => {
                    clearTokens()
                    setAuth({ accessToken: null, me: null })
                    setActiveProcessId(null)
                    setScreen('landing')
                    setStatusMsg('Logged out')
                  }} type="button">
                    <LogOut size={15} strokeWidth={1.75} />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <p>Sign in to save your work to the backend. Editor and admin roles can change the process model.</p>
                  <div className="landing-auth-form">


                    <input
                      value={authForm.email}
                      onChange={(e) => setAuthForm((s) => ({ ...s, email: e.target.value }))}
                      placeholder="email"
                      className="process-name-input"
                      aria-label="Email"
                    />
                    <input
                      value={authForm.password}
                      onChange={(e) => setAuthForm((s) => ({ ...s, password: e.target.value }))}
                      placeholder="password"
                      type="password"
                      className="process-name-input"
                      aria-label="Password"
                    />
                    <button
                      className="tbtn tbtn-primary"
                      onClick={async () => {
                        try {
                          const res = await apiLogin({
                            email: authForm.email,
                            password: authForm.password,
                          })
                          setTokens(res)
                          setAuth({ accessToken: res.access_token, me: null })
                          setScreen('workspace')
                          setStatusMsg('Logged in')
                        } catch (e) {
                          setStatusMsg(e?.message || 'Login failed', 'error')
                        }
                      }}
                      type="button"
                    >
                      <LogIn size={15} strokeWidth={1.75} />
                      <span>Login</span>
                    </button>

                    <div className="landing-auth-divider" />

                    <div className="landing-signup">
                      <h3 style={{ margin: '12px 0 6px 0', fontSize: 14 }}>
                        Request access (admin approval required)
                      </h3>

                      <input
                        value={signupForm.email}
                        onChange={(e) =>
                          setSignupForm((s) => ({ ...s, email: e.target.value }))
                        }
                        placeholder="email"
                        className="process-name-input"
                        aria-label="Email"
                        style={{ minWidth: 0 }}
                      />
                      <input
                        value={signupForm.password}
                        onChange={(e) =>
                          setSignupForm((s) => ({ ...s, password: e.target.value }))
                        }
                        placeholder="password (min 8 chars)"
                        type="password"
                        className="process-name-input"
                        aria-label="Password"
                      />
                      <input
                        value={signupForm.fullName}
                        onChange={(e) =>
                          setSignupForm((s) => ({ ...s, fullName: e.target.value }))
                        }
                        placeholder="full name (optional)"
                        className="process-name-input"
                        aria-label="Full name"
                      />

                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                          Requested role
                        </span>
                        <select
                          value={signupForm.role}
                          onChange={(e) =>
                            setSignupForm((s) => ({ ...s, role: e.target.value }))
                          }
                          className="process-name-input"
                          aria-label="Role"
                          style={{ minWidth: 180, padding: '8px 10px' }}
                        >
                          <option value="viewer">viewer</option>
                          <option value="editor">editor</option>
                        </select>
                      </div>

                      <button
                        className="tbtn tbtn-ghost"
                        onClick={async () => {
                          try {
                            const res = await apiRegister({
                              email: signupForm.email,
                              password: signupForm.password,
                              full_name: signupForm.fullName || null,
                              role: signupForm.role,
                            })
                            setStatusMsg(
                              `Request submitted. Admin will activate ${res.email}.`,
                              'neutral'
                            )
                          } catch (e) {
                            setStatusMsg(e?.message || 'Signup failed', 'error')
                          }
                        }}
                        type="button"
                      >
                        <ShieldCheck size={15} strokeWidth={1.75} />
                        <span>Request signup</span>
                      </button>
                    </div>

                  </div>
                </>
              )}
            </div>
          </aside>
        </main>
      ) : (
        <>
          <header className="toolbar">
            <div className="toolbar-row">
              <div className="identity">
                <button className="tbtn tbtn-ghost" onClick={() => setScreen('landing')} type="button">
                  <Home size={14} strokeWidth={1.75} />
                  <span>Home</span>
                </button>
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
                {!auth.me && (
                  <div className="tgroup" style={{ alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        value={authForm.email}
                        onChange={(e) => setAuthForm((s) => ({ ...s, email: e.target.value }))}
                        placeholder="email"
                        className="process-name-input"
                        style={{ minWidth: 210 }}
                        aria-label="Email"
                      />
                      <input
                        value={authForm.password}
                        onChange={(e) => setAuthForm((s) => ({ ...s, password: e.target.value }))}
                        placeholder="password"
                        type="password"
                        className="process-name-input"
                        style={{ minWidth: 210 }}
                        aria-label="Password"
                      />
                    </div>
                    <ToolbarButton
                      icon={LogIn}
                      label="Login"
                      onClick={async () => {
                        try {
                          const res = await apiLogin({
                            email: authForm.email,
                            password: authForm.password,
                          })
                          setTokens(res)
                          setAuth({ accessToken: res.access_token, me: null })
                          setScreen('workspace')
                          setStatusMsg('Logged in')
                        } catch (e) {
                          setStatusMsg(e?.message || 'Login failed', 'error')
                        }
                      }}
                      variant="primary"
                    />
                  </div>
                )}

                {!!auth.me && (
                  <div className="tgroup">
                    <ToolbarButton
                      icon={LogOut}
                      label="Logout"
                      onClick={() => {
                        clearTokens()
                        setAuth({ accessToken: null, me: null })
                        setActiveProcessId(null)
                        setScreen('landing')
                        setStatusMsg('Logged out')
                      }}
                      variant="ghost"
                    />
                  </div>
                )}

                <div className="tgroup">
                  <ToolbarButton icon={FilePlus} label="New" onClick={handleNew} disabled={!canEdit} />
                  <ToolbarButton icon={Upload} label="Import" onClick={handleImportClick} title="Import BPMN file" disabled={!canEdit} />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".bpmn,.xml"
                    style={{ display: 'none' }}
                    onChange={handleImportFile}
                  />
                </div>

                {!!auth.me && (
                  <div className="tgroup">
                    <ToolbarButton
                      icon={FileCode}
                      label={savedProcessesLoading ? 'Loading…' : 'Saved workspaces'}
                      onClick={async () => {
                        setShowSavedProcessesModal(true)
                        await fetchSavedProcesses()
                      }}
                      disabled={savedProcessesLoading}
                      title="Load a previously saved workspace"
                      variant="ghost"
                    />
                  </div>
                )}


                <div className="tdivider" />

                <div className="tgroup">
                  <ToolbarButton
                    icon={Save}
                    label="Save"
                    onClick={handleSaveBackend}
                    title={auth.accessToken ? 'Save to backend' : 'Login required to save to backend'}
                    variant={auth.accessToken ? 'primary' : 'ghost'}
                    disabled={!canEdit}
                  />
                </div>

                <div className="tdivider" />

                <div className="tgroup">
                  <ToolbarButton icon={FileCode} label="Export BPMN" onClick={handleExportXML} variant="primary" />
                  <ToolbarButton icon={ImageIcon} label="Export PDF" onClick={handleExportPDF} />
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

          {showSavedProcessesModal && (
            <div
              className="modal-overlay"
              onClick={() => setShowSavedProcessesModal(false)}
              role="presentation"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
            >
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                style={{
                  width: 'min(980px, 92vw)',
                  maxHeight: '80vh',
                  overflow: 'auto',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <h3 style={{ margin: 0 }}>Saved workspaces</h3>
                  <button className="tbtn tbtn-ghost" type="button" onClick={() => setShowSavedProcessesModal(false)}>
                    Close
                  </button>
                </div>

                {savedProcessesErr ? (
                  <div style={{ marginTop: 10, color: 'var(--danger)' }}>{savedProcessesErr}</div>
                ) : null}

                <div style={{ marginTop: 12 }}>
                  {!savedProcessesLoading && !savedProcesses.length && (
                    <div style={{ padding: '12px 0', color: 'var(--ink-muted)' }}>
                      No saved workspaces found.
                    </div>
                  )}

                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', fontSize: 12, color: 'var(--ink-muted)', paddingBottom: 8 }}>Name</th>
                        <th style={{ textAlign: 'left', fontSize: 12, color: 'var(--ink-muted)', paddingBottom: 8 }}>Owner</th>
                        <th style={{ textAlign: 'left', fontSize: 12, color: 'var(--ink-muted)', paddingBottom: 8 }}>Version</th>
                        <th style={{ textAlign: 'right', fontSize: 12, color: 'var(--ink-muted)', paddingBottom: 8 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedProcesses.map((p) => (
                        <tr key={p.id}>
                          <td style={{ padding: '6px 0' }}>
                            {p.name}
                            {p.is_archived ? <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--ink-muted)' }}>(archived)</span> : null}
                          </td>
                          <td style={{ padding: '6px 0', color: 'var(--ink-muted)' }}>{p.owner_email}</td>
                          <td style={{ padding: '6px 0', fontFamily: 'var(--font-mono)' }}>{p.version}</td>
                          <td style={{ padding: '6px 0', textAlign: 'right' }}>
                            <button
                              className="tbtn tbtn-primary"
                              type="button"
                              disabled={savedProcessesLoading}
                              onClick={async () => {
                                try {
                                  setShowSavedProcessesModal(false)
                                  setStatusMsg('Loading saved workspace…')

                                  // apiListProcesses() returns summary rows; fetch full BPMN XML first
                                  const full = await apiGetProcessDetail(auth.accessToken, p.id)
                                  await loadProcessIntoCanvas(full)

                                  setTimeout(() => {
                                    try {
                                      modelerRef.current?.get('canvas').resized()
                                    } catch (err) {
                                      // no-op
                                    }
                                  }, 0)

                                } catch {
                                  setStatusMsg('Failed to load workspace', 'error')
                                }
                              }}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {isAdmin && (
            <div style={{ position: 'fixed', bottom: 78, right: 18, zIndex: 10 }}>
              <button
                className="tbtn tbtn-primary"
                type="button"
                onClick={async () => {
                  setShowAdminUsersModal(true)
                }}
              >
                Admin: Approve users
              </button>
            </div>
          )}

          {showAdminUsersModal && isAdmin && (

            <div
              className="modal-overlay"
              onClick={() => setShowAdminUsersModal(false)}
              role="presentation"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 60,
              }}
            >
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                style={{
                  width: 'min(980px, 92vw)',
                  maxHeight: '80vh',
                  overflow: 'auto',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <h3 style={{ margin: 0 }}>Admin - User approval</h3>
                  <button className="tbtn tbtn-ghost" type="button" onClick={() => setShowAdminUsersModal(false)}>
                    Close
                  </button>
                </div>

                {adminErr ? (
                  <div style={{ marginTop: 10, color: 'var(--danger)' }}>{adminErr}</div>
                ) : null}

                <div style={{ marginTop: 12, overflow: 'auto' }}>
                  <div style={{ marginBottom: 10, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}>
                    {adminLoading ? 'Loading…' : `${adminUsers.length} users`}
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', fontSize: 12, color: 'var(--ink-muted)', paddingBottom: 8 }}>Email</th>
                        <th style={{ textAlign: 'left', fontSize: 12, color: 'var(--ink-muted)', paddingBottom: 8 }}>Role</th>
                        <th style={{ textAlign: 'left', fontSize: 12, color: 'var(--ink-muted)', paddingBottom: 8 }}>Status</th>
                        <th style={{ textAlign: 'right', fontSize: 12, color: 'var(--ink-muted)', paddingBottom: 8 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((u) => (
                        <tr key={u.id}>
                          <td style={{ padding: '6px 0' }}>{u.email}</td>
                          <td style={{ padding: '6px 0' }}>{u.role}</td>
                          <td style={{ padding: '6px 0' }}>{u.is_active ? 'Active' : 'Pending'}</td>
                          <td style={{ padding: '6px 0', textAlign: 'right' }}>
                            {u.is_active ? (
                              <button
                                className="tbtn tbtn-ghost"
                                type="button"
                                onClick={async () => {
                                  try {
                                    await apiAdminDeactivateUser(auth.accessToken, u.id)
                                    const refreshed = await apiAdminListUsers(auth.accessToken)
                                    setAdminUsers(refreshed || [])
                                    setStatusMsg(`Deactivated ${u.email}`)
                                  } catch (e) {
                                    setStatusMsg(e?.message || 'Failed to deactivate user', 'error')
                                  }
                                }}
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                className="tbtn tbtn-primary"
                                type="button"
                                onClick={async () => {
                                  try {
                                    await apiAdminActivateUser(auth.accessToken, u.id)
                                    const refreshed = await apiAdminListUsers(auth.accessToken)
                                    setAdminUsers(refreshed || [])
                                    setStatusMsg(`Activated ${u.email}`)
                                  } catch (e) {
                                    setStatusMsg(e?.message || 'Failed to activate user', 'error')
                                  }
                                }}
                              >
                                Activate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          <footer className="statusbar">
            <span className={`status-dot status-${status.tone}`} />
            <span className="status-text">{status.text}</span>


            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-muted)' }}>
                API: {backendStatus.state === 'ok' ? 'OK' : backendStatus.state === 'error' ? 'OFFLINE' : '...' }
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-muted)' }}>
                {auth.me ? `${auth.me.email} (${auth.me.role})` : ''}
              </span>
            </span>
          </footer>
        </>
      )}
    </div>
  )
}
