import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, Package, Edit2, Trash2,
  AlertTriangle, ChevronUp, ChevronDown, X, Check
} from 'lucide-react'
import { productsApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ui/Toast'

// ─── Modal Producto ───────────────────────────────────────────────
function ProductModal({ product, onClose, onSaved }) {
  const isEdit = !!product
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    category: product?.category || '',
    description: product?.description || '',
    price: product?.price || '',
    cost: product?.cost || '',
    stock: product?.stock ?? 0,
    min_stock: product?.min_stock ?? 5,
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Requerido'
    if (!form.price || form.price <= 0) e.price = 'Debe ser mayor a 0'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    try {
      const data = {
        ...form,
        price: parseFloat(form.price),
        cost: form.cost ? parseFloat(form.cost) : null,
        stock: parseInt(form.stock),
        min_stock: parseInt(form.min_stock),
      }
      if (isEdit) await productsApi.update(product.id, data)
      else await productsApi.create(data)
      onSaved()
    } catch (e) {
      setErrors({ general: e.response?.data?.detail || 'Error al guardar' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h3>
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
            <input className={`input${errors.name ? ' input-error' : ''}`} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre del producto" />
            {errors.name && <span style={{ color: '#E05555', fontSize: '0.75rem' }}>{errors.name}</span>}
          </div>

          <div className="input-group">
            <label className="input-label">SKU</label>
            <input className="input" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="SKU-001" />
          </div>

          <div className="input-group">
            <label className="input-label">Barcode</label>
            <input className="input" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="7501234567890" />
          </div>

          <div className="input-group">
            <label className="input-label">Categoría</label>
            <input className="input" value={form.category} onChange={e => set('category', e.target.value)} placeholder="Ej: Bebidas" />
          </div>

          <div className="input-group">
            <label className="input-label">Precio venta (COP) *</label>
            <input className={`input${errors.price ? ' input-error' : ''}`} type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0" />
            {errors.price && <span style={{ color: '#E05555', fontSize: '0.75rem' }}>{errors.price}</span>}
          </div>

          <div className="input-group">
            <label className="input-label">Precio costo (COP)</label>
            <input className="input" type="number" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="0" />
          </div>

          {!isEdit && (
            <div className="input-group">
              <label className="input-label">Stock inicial</label>
              <input className="input" type="number" value={form.stock} onChange={e => set('stock', e.target.value)} min="0" />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Stock mínimo</label>
            <input className="input" type="number" value={form.min_stock} onChange={e => set('min_stock', e.target.value)} min="0" />
          </div>

          <div className="input-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Descripción</label>
            <textarea className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descripción opcional..." rows={2} style={{ resize: 'vertical' }} />
          </div>
        </div>

        <div className="flex gap-2 mt-4" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Ajuste de Stock ────────────────────────────────────────
function StockModal({ product, onClose, onSaved }) {
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isPositive = parseInt(qty) > 0

  const handleSubmit = async () => {
    const n = parseInt(qty)
    if (!n || n === 0) { setError('Ingresa una cantidad válida'); return }
    setLoading(true)
    try {
      await productsApi.adjustStock(product.id, n, note || null)
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al ajustar stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">Ajustar stock</h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{product.name}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2 }}>
            Stock actual: <span style={{ color: product.low_stock ? '#D4A017' : '#3DBA6C', fontWeight: 600 }}>{product.stock}</span> unidades
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 12 }}>
          <label className="input-label">Cantidad (+ entrada / - salida)</label>
          <input
            className="input"
            type="number"
            value={qty}
            onChange={e => { setQty(e.target.value); setError('') }}
            placeholder="Ej: 10 o -5"
            autoFocus
          />
          {qty && !isNaN(parseInt(qty)) && (
            <span style={{ fontSize: '0.78rem', color: isPositive ? '#3DBA6C' : '#E05555' }}>
              {isPositive ? `↑ Entrada de ${qty} unidades` : `↓ Salida de ${Math.abs(parseInt(qty))} unidades`}
            </span>
          )}
        </div>

        <div className="input-group" style={{ marginBottom: 16 }}>
          <label className="input-label">Nota (opcional)</label>
          <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Ej: Compra proveedor, ajuste inventario..." />
        </div>

        {error && <div style={{ color: '#E05555', fontSize: '0.82rem', marginBottom: 12 }}>{error}</div>}

        <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando...' : 'Aplicar ajuste'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────
export default function InventoryPage() {
  const [products, setProducts]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [category, setCategory]     = useState('')
  const [categories, setCategories] = useState([])
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [stockProduct, setStockProduct] = useState(null)
  const [sortBy, setSortBy]         = useState('name')
  const [sortDir, setSortDir]       = useState('asc')
  const { isAdmin }                 = useAuthStore()
  const { toasts, success, error }  = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prodRes, catRes] = await Promise.all([
        productsApi.list({ search: search || undefined, category: category || undefined }),
        productsApi.categories(),
      ])
      setProducts(prodRes.data)
      setCategories(catRes.data)
    } catch {
      error('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [search, category])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const handleDeactivate = async (p) => {
    if (!confirm(`¿Desactivar "${p.name}"?`)) return
    try {
      await productsApi.deactivate(p.id)
      success(`"${p.name}" desactivado`)
      load()
    } catch { error('Error al desactivar') }
  }

  const handleSaved = () => {
    success(editProduct ? 'Producto actualizado' : 'Producto creado')
    setShowModal(false)
    setEditProduct(null)
    load()
  }

  const handleStockSaved = () => {
    success('Stock actualizado')
    setStockProduct(null)
    load()
  }

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const sorted = [...products]
    .filter(p => !lowStockOnly || p.low_stock)
    .sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy]
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })

  const lowStockCount = products.filter(p => p.low_stock).length

  const SortIcon = ({ col }) => sortBy === col
    ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
    : null

  const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2>Inventario</h2>
          <p>{products.length} productos · {lowStockCount > 0 && <span style={{ color: '#D4A017' }}>{lowStockCount} con stock bajo</span>}</p>
        </div>
        {isAdmin() && (
          <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowModal(true) }}>
            <Plus size={15} /> Nuevo producto
          </button>
        )}
      </div>

      <div className="page-content">
        {/* Alertas stock bajo */}
        {lowStockCount > 0 && (
          <div style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: '#D4A017', fontSize: '0.85rem' }}>
            <AlertTriangle size={16} />
            <span><strong>{lowStockCount} producto{lowStockCount > 1 ? 's' : ''}</strong> con stock bajo o agotado</span>
            <button className="btn btn-sm" style={{ marginLeft: 'auto', background: 'var(--warning-dim)', borderColor: 'var(--warning)', color: '#D4A017' }} onClick={() => setLowStockOnly(v => !v)}>
              {lowStockOnly ? 'Ver todos' : 'Ver solo alertas'}
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-3 items-center" style={{ marginBottom: 16 }}>
          <div className="input-icon-wrapper" style={{ flex: 1 }}>
            <Search className="input-icon" />
            <input
              className="input"
              placeholder="Buscar por nombre, SKU o barcode..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input" style={{ width: 180 }} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="empty-state"><p>Cargando productos...</p></div>
        ) : sorted.length === 0 ? (
          <div className="empty-state">
            <Package className="empty-state-icon" />
            <h3>Sin productos</h3>
            <p>{search ? 'No hay resultados para tu búsqueda' : 'Crea el primer producto'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                    <span className="flex items-center gap-2">Producto <SortIcon col="name" /></span>
                  </th>
                  <th>SKU</th>
                  <th>Categoría</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('price')}>
                    <span className="flex items-center gap-2">Precio <SortIcon col="price" /></span>
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('stock')}>
                    <span className="flex items-center gap-2">Stock <SortIcon col="stock" /></span>
                  </th>
                  <th>Estado</th>
                  {isAdmin() && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      {p.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{p.description.slice(0, 60)}{p.description.length > 60 ? '...' : ''}</div>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{p.sku || '—'}</td>
                    <td>
                      {p.category
                        ? <span className="badge badge-muted">{p.category}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{fmt(p.price)}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: p.stock === 0 ? '#E05555' : p.low_stock ? '#D4A017' : '#3DBA6C' }}>
                        {p.stock}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 4 }}>/ mín {p.min_stock}</span>
                    </td>
                    <td>
                      {p.stock === 0
                        ? <span className="badge badge-danger">Agotado</span>
                        : p.low_stock
                          ? <span className="badge badge-warning">Stock bajo</span>
                          : <span className="badge badge-success">OK</span>}
                    </td>
                    {isAdmin() && (
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-sm btn-ghost" onClick={() => setStockProduct(p)} title="Ajustar stock">
                            <ChevronUp size={13} />
                          </button>
                          <button className="btn btn-sm btn-ghost" onClick={() => { setEditProduct(p); setShowModal(true) }} title="Editar">
                            <Edit2 size={13} />
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(p)} title="Desactivar">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      {showModal && (
        <ProductModal
          product={editProduct}
          onClose={() => { setShowModal(false); setEditProduct(null) }}
          onSaved={handleSaved}
        />
      )}
      {stockProduct && (
        <StockModal
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          onSaved={handleStockSaved}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
