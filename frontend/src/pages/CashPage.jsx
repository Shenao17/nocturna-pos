import { useState, useEffect, useCallback } from 'react'
import {
  Landmark, Plus, Minus, Lock, Unlock,
  TrendingUp, TrendingDown, X, CheckCircle, Clock
} from 'lucide-react'
import { cashApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ui/Toast'

const fmt = (n) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n || 0)

// ─── Modal Abrir Turno ────────────────────────────────────────────
function OpenModal({ onClose, onOpened }) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) < 0) { setError('Ingresa el monto inicial'); return }
    setLoading(true)
    try {
      await cashApi.open({ open_amount: parseFloat(amount), notes: notes || null })
      onOpened()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al abrir turno')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <h3 className="modal-title">Abrir turno de caja</h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="input-group" style={{ marginBottom: 12 }}>
          <label className="input-label">Monto inicial en caja (COP)</label>
          <input
            className="input"
            type="number"
            value={amount}
            onChange={e => { setAmount(e.target.value); setError('') }}
            placeholder="0"
            autoFocus
            min="0"
          />
        </div>

        <div className="input-group" style={{ marginBottom: 16 }}>
          <label className="input-label">Nota (opcional)</label>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: Turno mañana" />
        </div>

        {error && <div style={{ color: '#E05555', fontSize: '0.82rem', marginBottom: 12 }}>{error}</div>}

        <button className="btn btn-success btn-lg w-full" onClick={handleSubmit} disabled={loading}>
          <Unlock size={16} />
          {loading ? 'Abriendo...' : 'Abrir turno'}
        </button>
      </div>
    </div>
  )
}

// ─── Modal Cerrar Turno ───────────────────────────────────────────
function CloseModal({ session, onClose, onClosed }) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const expected = session?.expected_amount || 0
  const diff = amount ? parseFloat(amount) - expected : null

  const handleSubmit = async () => {
    if (amount === '') { setError('Ingresa el monto físico en caja'); return }
    setLoading(true)
    try {
      await cashApi.close({ close_amount: parseFloat(amount), notes: notes || null })
      onClosed()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al cerrar turno')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">Cerrar turno de caja</h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16, border: '1px solid var(--border)' }}>
          <div className="flex justify-between" style={{ marginBottom: 4 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Monto esperado</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{fmt(expected)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Ventas en efectivo</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{fmt(session?.breakdown?.cash)}</span>
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 12 }}>
          <label className="input-label">Monto físico contado (COP)</label>
          <input
            className="input"
            type="number"
            value={amount}
            onChange={e => { setAmount(e.target.value); setError('') }}
            placeholder="Cuenta el dinero en caja..."
            autoFocus
            min="0"
          />
          {diff !== null && (
            <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: 4, color: diff === 0 ? '#3DBA6C' : diff > 0 ? '#D4A017' : '#E05555' }}>
              {diff === 0 ? '✅ Cuadre exacto' : diff > 0 ? `⚠️ Sobrante: ${fmt(diff)}` : `⚠️ Faltante: ${fmt(Math.abs(diff))}`}
            </div>
          )}
        </div>

        <div className="input-group" style={{ marginBottom: 16 }}>
          <label className="input-label">Nota (opcional)</label>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones del cierre..." />
        </div>

        {error && <div style={{ color: '#E05555', fontSize: '0.82rem', marginBottom: 12 }}>{error}</div>}

        <button className="btn btn-danger btn-lg w-full" onClick={handleSubmit} disabled={loading}>
          <Lock size={16} />
          {loading ? 'Cerrando...' : 'Cerrar turno'}
        </button>
      </div>
    </div>
  )
}

// ─── Modal Movimiento ─────────────────────────────────────────────
function MovementModal({ onClose, onSaved }) {
  const [type, setType]     = useState('income')
  const [amount, setAmount] = useState('')
  const [note, setNote]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) { setError('Ingresa un monto válido'); return }
    setLoading(true)
    try {
      await cashApi.addMovement({ type, amount: parseFloat(amount), note: note || null })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al registrar movimiento')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <h3 className="modal-title">Registrar movimiento</h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          <button
            className={`btn w-full${type === 'income' ? ' btn-success' : ' btn-ghost'}`}
            onClick={() => setType('income')}
          >
            <TrendingUp size={15} /> Ingreso
          </button>
          <button
            className={`btn w-full${type === 'expense' ? ' btn-danger' : ' btn-ghost'}`}
            onClick={() => setType('expense')}
          >
            <TrendingDown size={15} /> Egreso
          </button>
        </div>

        <div className="input-group" style={{ marginBottom: 12 }}>
          <label className="input-label">Monto (COP)</label>
          <input className="input" type="number" value={amount} onChange={e => { setAmount(e.target.value); setError('') }} placeholder="0" autoFocus min="0" />
        </div>

        <div className="input-group" style={{ marginBottom: 16 }}>
          <label className="input-label">Descripción</label>
          <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Ej: Pago proveedor, retiro..." />
        </div>

        {error && <div style={{ color: '#E05555', fontSize: '0.82rem', marginBottom: 12 }}>{error}</div>}

        <button className={`btn btn-lg w-full${type === 'income' ? ' btn-success' : ' btn-danger'}`} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Guardando...' : `Registrar ${type === 'income' ? 'ingreso' : 'egreso'}`}
        </button>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────
export default function CashPage() {
  const [session, setSession]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [history, setHistory]         = useState([])
  const [showOpen, setShowOpen]       = useState(false)
  const [showClose, setShowClose]     = useState(false)
  const [showMovement, setShowMovement] = useState(false)
  const { isAdmin }                   = useAuthStore()
  const { toasts, success, error }    = useToast()

  const loadSession = useCallback(async () => {
    try {
      const res = await cashApi.active()
      setSession(res.data.active ? res.data.session : null)
    } catch { error('Error cargando turno') }
    finally { setLoading(false) }
  }, [])

  const loadHistory = useCallback(async () => {
    if (!isAdmin()) return
    try {
      const res = await cashApi.history()
      setHistory(res.data)
    } catch {}
  }, [isAdmin])

  useEffect(() => { loadSession(); loadHistory() }, [])

  const handleOpened = () => {
    success('Turno abierto correctamente')
    setShowOpen(false)
    loadSession()
  }

  const handleClosed = () => {
    success('Turno cerrado correctamente')
    setShowClose(false)
    setSession(null)
    loadHistory()
  }

  const handleMovementSaved = () => {
    success('Movimiento registrado')
    setShowMovement(false)
    loadSession()
  }

  const elapsed = session ? (() => {
    const ms = Date.now() - new Date(session.opened_at).getTime()
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}h ${m}m`
  })() : null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Caja / Turnos</h2>
          <p>{session ? `Turno activo · ${elapsed} transcurridos` : 'Sin turno activo'}</p>
        </div>
        {!session && !loading && (
          <button className="btn btn-success" onClick={() => setShowOpen(true)}>
            <Unlock size={15} /> Abrir turno
          </button>
        )}
      </div>

      <div className="page-content">
        {loading ? (
          <div className="empty-state"><p>Cargando...</p></div>
        ) : session ? (
          <>
            {/* Stats del turno */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
              {[
                { label: 'Monto inicial',    value: fmt(session.open_amount),      color: null },
                { label: 'Ventas totales',   value: fmt(session.total_sales),      color: '#3DBA6C' },
                { label: 'Monto esperado',   value: fmt(session.expected_amount),  color: 'var(--accent)' },
                { label: 'Ventas realizadas', value: session.sales_count,          color: null },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-card-label">{s.label}</div>
                  <div className="stat-card-value" style={s.color ? { color: s.color } : {}}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Desglose por método de pago */}
            <div className="grid-3" style={{ marginBottom: 24, gap: 12 }}>
              {[
                { label: 'Efectivo',        value: session.breakdown?.cash,     icon: '💵' },
                { label: 'Tarjeta',         value: session.breakdown?.card,     icon: '💳' },
                { label: 'Transferencia',   value: session.breakdown?.transfer, icon: '📲' },
              ].map(b => (
                <div key={b.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: '1.4rem' }}>{b.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>{fmt(b.value)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Movimientos */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>Movimientos del turno</h3>
                <button className="btn btn-sm btn-ghost" onClick={() => setShowMovement(true)}>
                  <Plus size={13} /> Registrar
                </button>
              </div>
              {session.movements?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin movimientos manuales</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {session.movements.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.type === 'income' ? 'var(--success-dim)' : 'var(--danger-dim)', color: m.type === 'income' ? '#3DBA6C' : '#E05555', flexShrink: 0 }}>
                        {m.type === 'income' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{m.note || (m.type === 'income' ? 'Ingreso' : 'Egreso')}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: m.type === 'income' ? '#3DBA6C' : '#E05555' }}>
                        {m.type === 'income' ? '+' : '-'}{fmt(m.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón cerrar */}
            <button className="btn btn-danger btn-lg" onClick={() => setShowClose(true)}>
              <Lock size={16} /> Cerrar turno
            </button>
          </>
        ) : (
          <>
            <div className="empty-state" style={{ marginBottom: 32 }}>
              <Landmark className="empty-state-icon" />
              <h3>Sin turno activo</h3>
              <p>Abre un turno para comenzar a registrar ventas</p>
              <button className="btn btn-success btn-lg" style={{ marginTop: 8 }} onClick={() => setShowOpen(true)}>
                <Unlock size={16} /> Abrir turno
              </button>
            </div>

            {/* Historial (solo admin) */}
            {isAdmin() && history.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>Historial de turnos</h3>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Apertura</th>
                        <th>Cierre</th>
                        <th>Esperado</th>
                        <th>Contado</th>
                        <th>Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 500 }}>{s.user}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {new Date(s.opened_at).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {new Date(s.closed_at).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{fmt(s.expected_amount)}</td>
                          <td style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{fmt(s.close_amount)}</td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: s.difference === 0 ? '#3DBA6C' : s.difference > 0 ? '#D4A017' : '#E05555' }}>
                              {s.difference > 0 ? '+' : ''}{fmt(s.difference)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showOpen     && <OpenModal     onClose={() => setShowOpen(false)}     onOpened={handleOpened} />}
      {showClose    && <CloseModal    session={session} onClose={() => setShowClose(false)} onClosed={handleClosed} />}
      {showMovement && <MovementModal onClose={() => setShowMovement(false)} onSaved={handleMovementSaved} />}
      <ToastContainer toasts={toasts} />
    </div>
  )
}
