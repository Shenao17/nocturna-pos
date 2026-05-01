import { BarChart2, Landmark, Settings } from 'lucide-react'
export { default as POSPage }       from './POSPage'
export { default as InventoryPage } from './InventoryPage'
export { default as ClientsPage }   from './ClientsPage'

function PlaceholderPage({ icon: Icon, title, description }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="page-header-left"><h2>{title}</h2><p>{description}</p></div>
      </div>
      <div className="page-content">
        <div className="empty-state">
          <Icon className="empty-state-icon" />
          <h3>{title}</h3>
          <p>Módulo en construcción — próximas fases</p>
        </div>
      </div>
    </div>
  )
}

export const ReportsPage = () => <PlaceholderPage icon={BarChart2} title="Reportes"      description="Estadísticas y análisis" />
export const CashPage    = () => <PlaceholderPage icon={Landmark}  title="Caja / Turnos" description="Apertura y cierre de caja" />
export const UsersPage   = () => <PlaceholderPage icon={Settings}  title="Usuarios"      description="Gestión de usuarios y roles" />
