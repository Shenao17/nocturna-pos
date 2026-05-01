import { NavLink, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, Package, Users, BarChart2,
  Landmark, Settings, LogOut, AlertTriangle
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const navItems = [
  { to: '/pos',        icon: ShoppingCart, label: 'Ventas / Caja' },
  { to: '/inventory',  icon: Package,      label: 'Inventario' },
  { to: '/clients',    icon: Users,        label: 'Clientes' },
  { to: '/cash',       icon: Landmark,     label: 'Caja / Turnos' },
  { to: '/reports',    icon: BarChart2,    label: 'Reportes' },
]

const adminItems = [
  { to: '/users',    icon: Settings,      label: 'Usuarios' },
]

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-name">
          <span className="sidebar-logo-dot" />
          NOCTURNA
        </div>
        <div className="sidebar-logo-sub">Point of Sale System</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Principal</div>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon className="nav-icon" />
            {label}
          </NavLink>
        ))}

        {isAdmin() && (
          <>
            <div className="nav-section-label">Administración</div>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <Icon className="nav-icon" />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name}</div>
            <div className="sidebar-user-role">{user?.role}</div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout} title="Cerrar sesión">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
