import { useState, useEffect, useCallback } from 'react'
import {
  BarChart2, TrendingUp, ShoppingCart, Users,
  Package, AlertTriangle, Calendar
} from 'lucide-react'
import { reportsApi } from '../api/client'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ui/Toast'

const fmt = (n) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n || 0)

const fmtNum = (n) => new Intl.NumberFormat('es-CO').format(n || 0)

// ─── Mini barra de progreso ───────────────────────────────────────
function Bar({ value, max, color = 'var(--accent)' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ height: 6, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 600ms ease' }} />
    </div>
  )
}

// ─── Gráfica de barras simple (SVG) ──────────────────────────────
function DailyChart({ data }) {
  if (!data?.length) return (
    <div className="empty-state" style={{ padding: 40 }}>
      <BarChart2 className="empty-state-icon" />
      <p>Sin datos para el periodo</p>
    </div>
  )

  const maxVal = Math.max(...data.map(d => d.total_revenue))
  const W = 700, H = 180, PAD = 40, BAR_W = Math.min(40, (W - PAD * 2) / data.length - 4)

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H + 40}`} style={{ width: '100%', minWidth: 400 }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct}
            x1={PAD} y1={PAD + (1 - pct) * H}
            x2={W - PAD} y2={PAD + (1 - pct) * H}
            stroke="var(--border)" strokeWidth="1"
          />
        ))}

        {/* Barras */}
        {data.map((d, i) => {
          const x = PAD + i * ((W - PAD * 2) / data.length) + ((W - PAD * 2) / data.length - BAR_W) / 2
          const barH = maxVal > 0 ? (d.total_revenue / maxVal) * H : 0
          const y = PAD + H - barH

          return (
            <g key={d.date}>
              <rect
                x={x} y={y}
                width={BAR_W} height={barH}
                fill="var(--accent)"
                opacity="0.85"
                rx="3"
              />
              {/* Label fecha */}
              <text
                x={x + BAR_W / 2} y={H + PAD + 16}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="10"
                fontFamily="var(--font-body)"
              >
                {d.date.slice(5)}
              </text>
              {/* Valor encima */}
              {barH > 20 && (
                <text
                  x={x + BAR_W / 2} y={y - 5}
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize="9"
                  fontFamily="var(--font-display)"
                >
                  {d.total_sales}v
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────
export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'

  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo]     = useState(today)
  const [summary, setSummary]   = useState(null)
  const [topProducts, setTopProducts] = useState([])
  const [topClients, setTopClients]   = useState([])
  const [byCategory, setByCategory]   = useState([])
  const [daily, setDaily]             = useState([])
  const [lowStock, setLowStock]       = useState([])
  const [loading, setLoading]         = useState(true)
  const { toasts, error }             = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const params = { date_from: dateFrom || undefined, date_to: dateTo || undefined }
    try {
      const [sRes, tpRes, tcRes, bcRes, dRes, lsRes] = await Promise.all([
        reportsApi.summary(params),
        reportsApi.topProducts(params),
        reportsApi.topClients(params),
        reportsApi.byCategory(params),
        reportsApi.daily(params),
        reportsApi.lowStockAlert(),
      ])
      setSummary(sRes.data)
      setTopProducts(tpRes.data)
      setTopClients(tcRes.data)
      setByCategory(bcRes.data)
      setDaily(dRes.data)
      setLowStock(lsRes.data.products || [])
    } catch { error('Error cargando reportes') }
    finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const maxProductQty  = topProducts[0]?.total_qty || 1
  const maxClientSpent = topClients[0]?.total_spent || 1
  const maxCatRevenue  = byCategory[0]?.total_revenue || 1

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Reportes</h2>
          <p>Análisis de ventas y estadísticas</p>
        </div>
        {/* Filtro de fechas */}
        <div className="flex items-center gap-2">
          <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
          <input
            className="input"
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ width: 145 }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
          <input
            className="input"
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ width: 145 }}
          />
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="empty-state"><p>Cargando reportes...</p></div>
        ) : (
          <>
            {/* ── Alertas stock ── */}
            {lowStock.length > 0 && (
              <div style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: '#D4A017', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} />
                <span><strong>{lowStock.length} producto{lowStock.length > 1 ? 's' : ''}</strong> con stock bajo o agotado</span>
              </div>
            )}

            {/* ── Stats generales ── */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
              {[
                { icon: ShoppingCart, label: 'Ventas totales',    value: fmtNum(summary?.total_sales),    color: 'var(--accent)' },
                { icon: TrendingUp,   label: 'Ingresos totales',  value: fmt(summary?.total_revenue),     color: '#3DBA6C' },
                { icon: BarChart2,    label: 'Ticket promedio',   value: fmt(summary?.average_ticket),    color: '#D4A017' },
                { icon: Package,      label: 'Items vendidos',    value: fmtNum(summary?.total_items_sold), color: 'var(--text-primary)' },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-card-icon" style={{ color: s.color, borderColor: s.color, background: `${s.color}22` }}>
                    <s.icon size={16} />
                  </div>
                  <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-card-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── Métodos de pago ── */}
            {summary?.by_payment_method && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>Por método de pago</h3>
                </div>
                <div className="grid-3" style={{ gap: 16 }}>
                  {[
                    { key: 'cash',     label: 'Efectivo',        emoji: '💵' },
                    { key: 'card',     label: 'Tarjeta',         emoji: '💳' },
                    { key: 'transfer', label: 'Transferencia',   emoji: '📲' },
                  ].map(m => (
                    <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '1.3rem' }}>{m.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                          {fmt(summary.by_payment_method[m.key])}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Gráfica diaria ── */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>Ventas por día</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ingresos · número de ventas</span>
              </div>
              <DailyChart data={daily} />
            </div>

            <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
              {/* ── Top Productos ── */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>Top productos</h3>
                  <span className="badge badge-accent">{topProducts.length}</span>
                </div>
                {topProducts.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin datos</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {topProducts.slice(0, 8).map((p, i) => (
                      <div key={p.product_id}>
                        <div className="flex justify-between items-center" style={{ marginBottom: 5 }}>
                          <div className="flex items-center gap-8">
                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: 16 }}>#{i + 1}</span>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{p.name}</div>
                              {p.category && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.category}</div>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem' }}>{fmtNum(p.total_qty)} uds</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{fmt(p.total_revenue)}</div>
                          </div>
                        </div>
                        <Bar value={p.total_qty} max={maxProductQty} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Por categoría ── */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>Por categoría</h3>
                </div>
                {byCategory.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin datos</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {byCategory.map(c => (
                      <div key={c.category}>
                        <div className="flex justify-between items-center" style={{ marginBottom: 5 }}>
                          <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{c.category}</span>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem' }}>{fmt(c.total_revenue)}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{fmtNum(c.total_qty)} uds</div>
                          </div>
                        </div>
                        <Bar value={c.total_revenue} max={maxCatRevenue} color="#3DBA6C" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Top Clientes ── */}
            {topClients.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>Top clientes</h3>
                  <span className="badge badge-muted">{topClients.length}</span>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Cliente</th>
                        <th>Compras</th>
                        <th>Total gastado</th>
                        <th>Puntos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topClients.map((c, i) => (
                        <tr key={c.client_id}>
                          <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)' }}>#{i + 1}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{c.name}</div>
                            {c.email && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.email}</div>}
                          </td>
                          <td style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{c.total_purchases}</td>
                          <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#3DBA6C' }}>{fmt(c.total_spent)}</td>
                          <td>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              ⭐ <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{c.loyalty_points}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Alertas stock bajo detalle ── */}
            {lowStock.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>Productos con stock bajo</h3>
                  <span className="badge badge-warning">{lowStock.length}</span>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>SKU</th>
                        <th>Stock actual</th>
                        <th>Mínimo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStock.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 500 }}>{p.name}</td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{p.sku || '—'}</td>
                          <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: p.stock === 0 ? '#E05555' : '#D4A017' }}>{p.stock}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{p.min_stock}</td>
                          <td>
                            {p.stock === 0
                              ? <span className="badge badge-danger">Agotado</span>
                              : <span className="badge badge-warning">Stock bajo</span>}
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
      <ToastContainer toasts={toasts} />
    </div>
  )
}
