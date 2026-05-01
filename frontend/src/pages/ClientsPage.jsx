import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, User, Edit2, Trash2, X,
  ChevronRight, Star, ShoppingBag, Mail, Phone
} from 'lucide-react'
import { clientsApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ui/Toast'

const fmt = (n) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n)

const DISCOUNT_TYPES = [
  { value: 'none',       label: 'Sin descuento' },
  { value: 'percentage', label: 'Porcentaje (%)' },
  { value: 'fixed',      label: 'Monto fijo (COP)' },
]

// ─── Modal Cliente ────────────────────────────────────────────────
function ClientModal({ client, onClose, onSaved }) {
  const isEdit = !!client
  const [form, setForm] = useState({
    name:           client?.name || '',
    phone:          client?.phone || '',
    email:          client?.email || '',
    document_id:    client?.document_id || '',
    discount_type:  client?.discount_type || 'none',
    discount_value: client?.discount_value || '',
    notes:          client?.notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Requerido'
    if (form.discount_type !== 'none' && (!form.discount_value || parseFloat(form.discount_value) <= 0))
      e.discount_value = 'Ingresa un valor mayor a 0'
    if (form.discount_type === 'percentage' && parseFloat(form.discount_value) > 100)
      e.discount_value = 'No puede ser mayor a 100%'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    try {
      const data = {
        ...form,
        discount_value: form.discount_type === 'none' ? 0 : parseFloat(form.discount_value || 0),
        phone:       form.phone || null,
        email:       form.email || null,
        document_id: form.document_id || null,
        notes:       form.notes || null,
      }
      if (isEdit) await clientsApi.update(client.id, data)
      else await clientsApi.create(data)
      onSaved()
    } catch (e) {
      setErrors({ general: e.response?.data?.detail || 'Error al guardar' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        {errors.general && (
          <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, color: '#E05555', fontSize: '0.85rem' }}>
            {errors.general}
          </div>
        )}

        <div className="grid-2" style={{ gap: 14 }}>
          <div className="input-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Nombre *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre completo" />
            {errors.name && <span style={{ color: '#E05555', fontSize: '0.75rem' }}>{errors.name}</span>}
          </div>

          <div className="input-group">
            <label className="input-label">Teléfono</label>
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="300 000 0000" />
          </div>

          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@ejemplo.com" />
          </div>

          <div className="input-group">
            <label className="input-label">Documento (CC / NIT)</label>
            <input className="input" value={form.document_id} onChange={e => set('document_id', e.target.value)} placeholder="123456789" />
          </div>

          <div className="input-group">
            <label className="input-label">Tipo de descuento</label>
            <select className="input" value={form.discount_type} onChange={e => { set('discount_type', e.target.value); set('discount_value', '') }}>
              {DISCOUNT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          {form.discount_type !== 'none' && (
            <div className="input-group" style={{ gridColumn: '1/-1' }}>
              <label className="input-label">
                {form.discount_type === 'percentage' ? 'Porcentaje de descuento (%)' : 'Monto de descuento (COP)'}
              </label>
              <input
                className="input"
                type="number"
                value={form.discount_value}
                onChange={e => set('discount_value', e.target.value)}
                placeholder={form.discount_type === 'percentage' ? '0-100' : '0'}
                min="0"
                max={form.discount_type === 'percentage' ? '100' : undefined}
              />
              {errors.discount_value && <span style={{ color: '#E05555', fontSize: '0.75rem' }}>{errors.discount_value}</span>}
            </div>
          )}

          <div className="input-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Notas</label>
            <textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notas internas..." rows={2} style={{ resize: 'vertical' }} />
          </div>
        </div>

        <div className="flex gap-2 mt-4" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Historial ──────────────────────────────────────────────
function HistoryModal({ client, onClose }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    clientsApi.history(client.id)
      .then(r => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [client.id])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3 className="modal-title">Historial — {client.name}</h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        {loading ? (
          <div className="empty-state"><p>Cargando...</p></div>
        ) : !history ? (
          <div className="empty-state"><p>Error al cargar historial</p></div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid-3" style={{ marginBottom: 20, gap: 10 }}>
              {[
                { label: 'Compras', value: history.total_purchases },
                { label: 'Total gastado', value: fmt(history.total_spent) },
                { label: 'Puntos', value: `${history.loyalty_points} pts` },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent)' }}>{s.value}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Lista de ventas */}
            {history.sales.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}>
                <ShoppingBag className="empty-state-icon" />
                <p>Sin compras registradas</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Fecha</th>
                      <th>Items</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.sales.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {String(s.id).padStart(6, '0')}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {new Date(s.created_at).toLocaleDateString('es-CO')}
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>{s.items_count}</td>
                        <td style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{fmt(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────
export default function ClientsPage() {
  const [clients, setClients]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editClient, setEditClient] = useState(null)
  const [historyClient, setHistoryClient] = useState(null)
  const { isAdmin }               = useAuthStore()
  const { toasts, success, error } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await clientsApi.list({ search: search || undefined })
      setClients(res.data)
    } catch { error('Error al cargar clientes') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const handleDeactivate = async (c) => {
    if (!confirm(`¿Desactivar a "${c.name}"?`)) return
    try {
      await clientsApi.deactivate(c.id)
      success(`"${c.name}" desactivado`)
      load()
    } catch { error('Error al desactivar') }
  }

  const handleSaved = () => {
    success(editClient ? 'Cliente actualizado' : 'Cliente creado')
    setShowModal(false)
    setEditClient(null)
    load()
  }

  const discountLabel = (c) => {
    if (c.discount_type === 'none' || !c.discount_value) return null
    return c.discount_type === 'percentage'
      ? `${c.discount_value}% desc.`
      : `${fmt(c.discount_value)} desc.`
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Clientes</h2>
          <p>{clients.length} clientes registrados</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditClient(null); setShowModal(true) }}>
          <Plus size={15} /> Nuevo cliente
        </button>
      </div>

      <div className="page-content">
        {/* Buscador */}
        <div className="input-icon-wrapper" style={{ maxWidth: 400, marginBottom: 20 }}>
          <Search className="input-icon" />
          <input
            className="input"
            placeholder="Buscar por nombre, teléfono o documento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="empty-state"><p>Cargando clientes...</p></div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <User className="empty-state-icon" />
            <h3>Sin clientes</h3>
            <p>{search ? 'No hay resultados' : 'Registra el primer cliente'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Descuento</th>
                  <th>Fidelización</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--accent)', flexShrink: 0 }}>
                          {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          {c.document_id && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CC {c.document_id}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {c.phone && <span style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={11} style={{ color: 'var(--text-muted)' }} />{c.phone}</span>}
                        {c.email && <span style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}><Mail size={11} style={{ color: 'var(--text-muted)' }} />{c.email}</span>}
                        {!c.phone && !c.email && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </div>
                    </td>
                    <td>
                      {discountLabel(c)
                        ? <span className="badge badge-accent">{discountLabel(c)}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Star size={13} style={{ color: '#D4A017' }} />
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{c.loyalty_points}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>pts</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-ghost" onClick={() => setHistoryClient(c)} title="Ver historial">
                          <ChevronRight size={13} />
                        </button>
                        {isAdmin() && (
                          <>
                            <button className="btn btn-sm btn-ghost" onClick={() => { setEditClient(c); setShowModal(true) }} title="Editar">
                              <Edit2 size={13} />
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(c)} title="Desactivar">
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ClientModal
          client={editClient}
          onClose={() => { setShowModal(false); setEditClient(null) }}
          onSaved={handleSaved}
        />
      )}
      {historyClient && (
        <HistoryModal
          client={historyClient}
          onClose={() => setHistoryClient(null)}
        />
      )}
      <ToastContainer toasts={toasts} />
    </div>
  )
}
