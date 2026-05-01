import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, Plus, Minus, Trash2, User, X,
  CreditCard, Banknote, ArrowLeftRight,
  CheckCircle, Receipt, ChevronRight
} from 'lucide-react'
import { productsApi, clientsApi, salesApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ui/Toast'

const fmt = (n) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n)

const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Efectivo',    icon: Banknote },
  { value: 'card',     label: 'Tarjeta',     icon: CreditCard },
  { value: 'transfer', label: 'Transferencia', icon: ArrowLeftRight },
]

// ─── Modal Pago ───────────────────────────────────────────────────
function PaymentModal({ cart, client, onClose, onConfirm }) {
  const subtotal  = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discount  = client?.discount_type === 'percentage'
    ? subtotal * (client.discount_value / 100)
    : client?.discount_type === 'fixed' ? Math.min(client.discount_value, subtotal) : 0
  const total     = subtotal - discount
  const [method, setMethod]   = useState('cash')
  const [paid, setPaid]       = useState('')
  const [loading, setLoading] = useState(false)
  const change = paid ? Math.max(0, parseFloat(paid) - total) : 0

  const handleConfirm = async () => {
    if (method === 'cash' && parseFloat(paid || 0) < total) return
    setLoading(true)
    try {
      await onConfirm({ method, paid: paid ? parseFloat(paid) : null, total, discount })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3 className="modal-title">Confirmar pago</h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Resumen */}
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20, border: '1px solid var(--border)' }}>
          <div className="flex justify-between" style={{ marginBottom: 6 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Subtotal</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{fmt(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between" style={{ marginBottom: 6 }}>
              <span style={{ color: '#3DBA6C', fontSize: '0.85rem' }}>
                Descuento {client?.discount_type === 'percentage' ? `(${client.discount_value}%)` : ''}
              </span>
              <span style={{ color: '#3DBA6C', fontFamily: 'var(--font-display)', fontWeight: 600 }}>-{fmt(discount)}</span>
            </div>
          )}
          <div className="divider" style={{ margin: '10px 0' }} />
          <div className="flex justify-between">
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>TOTAL</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--accent)' }}>{fmt(total)}</span>
          </div>
          {client && (
            <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Cliente: {client.name} · +{Math.floor(total / 1000)} pts fidelización
            </div>
          )}
        </div>

        {/* Método de pago */}
        <div style={{ marginBottom: 16 }}>
          <label className="input-label" style={{ marginBottom: 8, display: 'block' }}>Método de pago</label>
          <div className="flex gap-2">
            {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                className={`btn flex-col${method === value ? ' btn-primary' : ' btn-ghost'}`}
                style={{ flex: 1, padding: '12px 8px', gap: 4, height: 'auto' }}
                onClick={() => setMethod(value)}
              >
                <Icon size={18} />
                <span style={{ fontSize: '0.72rem' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Monto pagado (solo efectivo) */}
        {method === 'cash' && (
          <div className="input-group" style={{ marginBottom: 16 }}>
            <label className="input-label">Monto recibido (COP)</label>
            <input
              className="input"
              type="number"
              value={paid}
              onChange={e => setPaid(e.target.value)}
              placeholder={`Mínimo ${fmt(total)}`}
              autoFocus
            />
            {paid && parseFloat(paid) >= total && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Vuelto:</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: '#3DBA6C' }}>{fmt(change)}</span>
              </div>
            )}
            {paid && parseFloat(paid) < total && (
              <span style={{ color: '#E05555', fontSize: '0.78rem' }}>Monto insuficiente</span>
            )}
          </div>
        )}

        <button
          className="btn btn-primary btn-lg w-full"
          onClick={handleConfirm}
          disabled={loading || (method === 'cash' && (!paid || parseFloat(paid) < total))}
        >
          <CheckCircle size={17} />
          {loading ? 'Procesando...' : `Confirmar pago · ${fmt(total)}`}
        </button>
      </div>
    </div>
  )
}

// ─── Modal Venta Completada ───────────────────────────────────────
function SuccessModal({ sale, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 380, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, background: 'var(--success-dim)', border: '2px solid var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#3DBA6C' }}>
          <CheckCircle size={32} />
        </div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: 6 }}>¡Venta completada!</h3>
        <p style={{ marginBottom: 20 }}>Venta #{String(sale?.id).padStart(6, '0')} procesada correctamente</p>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20, border: '1px solid var(--border)', textAlign: 'left' }}>
          <div className="flex justify-between" style={{ marginBottom: 6 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{fmt(sale?.total)}</span>
          </div>
          {sale?.change_amount > 0 && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Vuelto</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#3DBA6C' }}>{fmt(sale?.change_amount)}</span>
            </div>
          )}
          {sale?.client_name && (
            <div className="flex justify-between" style={{ marginTop: 6 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cliente</span>
              <span style={{ fontSize: '0.85rem' }}>{sale.client_name}</span>
            </div>
          )}
        </div>

        <button className="btn btn-primary w-full btn-lg" onClick={onClose}>
          Nueva venta
        </button>
      </div>
    </div>
  )
}

// ─── Página Principal POS ─────────────────────────────────────────
export default function POSPage() {
  const [products, setProducts]       = useState([])
  const [search, setSearch]           = useState('')
  const [category, setCategory]       = useState('')
  const [categories, setCategories]   = useState([])
  const [cart, setCart]               = useState([])
  const [client, setClient]           = useState(null)
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState([])
  const [showClientSearch, setShowClientSearch] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [lastSale, setLastSale]       = useState(null)
  const { user }                      = useAuthStore()
  const { toasts, success, error }    = useToast()
  const searchRef                     = useRef()

  // Cargar productos
  const loadProducts = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        productsApi.list({ search: search || undefined, category: category || undefined }),
        productsApi.categories(),
      ])
      setProducts(pRes.data.filter(p => p.active))
      setCategories(cRes.data)
    } catch { error('Error cargando productos') }
  }, [search, category])

  useEffect(() => {
    const t = setTimeout(loadProducts, 250)
    return () => clearTimeout(t)
  }, [loadProducts])

  // Buscar clientes
  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await clientsApi.search(clientSearch)
        setClientResults(res.data)
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [clientSearch])

  // Cart actions
  const addToCart = (product) => {
    if (product.stock === 0) { error(`"${product.name}" sin stock`); return }
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) {
        if (existing.qty >= product.stock) { error(`Stock máximo: ${product.stock}`); return prev }
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const updateQty = (id, delta) => {
    setCart(prev => prev
      .map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
      .filter(i => i.qty > 0)
    )
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id))
  const clearCart = () => { setCart([]); setClient(null) }

  // Totales
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discount = client?.discount_type === 'percentage'
    ? subtotal * (client.discount_value / 100)
    : client?.discount_type === 'fixed' ? Math.min(client.discount_value, subtotal) : 0
  const total = subtotal - discount

  // Confirmar venta
  const handleConfirmSale = async ({ method, paid }) => {
    try {
      const payload = {
        client_id: client?.id || null,
        items: cart.map(i => ({ product_id: i.id, quantity: i.qty })),
        payment_method: method,
        amount_paid: paid,
      }
      const res = await salesApi.create(payload)
      setLastSale(res.data)
      setShowPayment(false)
      clearCart()
      loadProducts()
    } catch (e) {
      error(e.response?.data?.detail || 'Error al procesar la venta')
      throw e
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>

      {/* ── Panel izquierdo: Productos ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <h2>Ventas</h2>
            <p>{user?.name} · {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <div className="input-icon-wrapper" style={{ flex: 1 }}>
            <Search className="input-icon" />
            <input
              ref={searchRef}
              className="input"
              placeholder="Buscar producto, SKU o barcode..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input" style={{ width: 160 }} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Todas</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Grid de productos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {products.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <p>{search ? 'Sin resultados' : 'No hay productos disponibles'}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock === 0}
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${cart.find(i => i.id === p.id) ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 12px',
                    cursor: p.stock === 0 ? 'not-allowed' : 'pointer',
                    opacity: p.stock === 0 ? 0.4 : 1,
                    textAlign: 'left',
                    transition: 'all var(--transition)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                  onMouseEnter={e => { if (p.stock > 0) e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onMouseLeave={e => { if (!cart.find(i => i.id === p.id)) e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  {p.category && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.category}</span>
                  )}
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>{p.name}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>{fmt(p.price)}</span>
                  <span style={{ fontSize: '0.7rem', color: p.low_stock ? '#D4A017' : 'var(--text-muted)' }}>
                    {p.stock === 0 ? 'Agotado' : `${p.stock} disponibles`}
                  </span>
                  {cart.find(i => i.id === p.id) && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600 }}>
                      × {cart.find(i => i.id === p.id).qty} en carrito
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel derecho: Carrito ── */}
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>

        {/* Cliente */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          {client ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
              <User size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name}</div>
                {client.discount_value > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#3DBA6C' }}>
                    Descuento: {client.discount_type === 'percentage' ? `${client.discount_value}%` : fmt(client.discount_value)}
                  </div>
                )}
              </div>
              <button onClick={() => setClient(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div className="input-icon-wrapper">
                <User className="input-icon" />
                <input
                  className="input"
                  placeholder="Buscar cliente (opcional)..."
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientSearch(true) }}
                  onFocus={() => setShowClientSearch(true)}
                />
              </div>
              {showClientSearch && clientResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', zIndex: 50, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                  {clientResults.map(c => (
                    <div
                      key={c.id}
                      style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => { setClient(c); setClientSearch(''); setShowClientSearch(false); setClientResults([]) }}
                    >
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {c.phone} · {c.loyalty_points} pts
                        {c.discount_value > 0 && ` · Desc ${c.discount_type === 'percentage' ? c.discount_value + '%' : fmt(c.discount_value)}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Items del carrito */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {cart.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <Receipt className="empty-state-icon" />
              <p>Agrega productos al carrito</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{fmt(item.price)} c/u</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="btn btn-sm btn-ghost btn-icon" onClick={() => updateQty(item.id, -1)}><Minus size={12} /></button>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                  <button className="btn btn-sm btn-ghost btn-icon" onClick={() => updateQty(item.id, 1)} disabled={item.qty >= item.stock}><Plus size={12} /></button>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', minWidth: 70, textAlign: 'right' }}>
                  {fmt(item.price * item.qty)}
                </div>
                <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Totales y cobrar */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
          {cart.length > 0 && (
            <>
              <div style={{ marginBottom: 12 }}>
                <div className="flex justify-between" style={{ marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Subtotal</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{fmt(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between" style={{ marginBottom: 4 }}>
                    <span style={{ color: '#3DBA6C', fontSize: '0.85rem' }}>Descuento</span>
                    <span style={{ color: '#3DBA6C', fontFamily: 'var(--font-display)', fontWeight: 600 }}>-{fmt(discount)}</span>
                  </div>
                )}
                <div className="divider" style={{ margin: '8px 0' }} />
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>TOTAL</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--accent)' }}>{fmt(total)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="btn btn-ghost" onClick={clearCart} style={{ flex: 'none' }}>
                  <Trash2 size={14} />
                </button>
                <button className="btn btn-primary btn-lg w-full" onClick={() => setShowPayment(true)}>
                  Cobrar <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modales */}
      {showPayment && (
        <PaymentModal
          cart={cart}
          client={client}
          onClose={() => setShowPayment(false)}
          onConfirm={handleConfirmSale}
        />
      )}
      {lastSale && (
        <SuccessModal
          sale={lastSale}
          onClose={() => setLastSale(null)}
        />
      )}
      <ToastContainer toasts={toasts} />
    </div>
  )
}
