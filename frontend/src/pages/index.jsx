import { Settings } from 'lucide-react'
export { default as POSPage }       from './POSPage'
export { default as InventoryPage } from './InventoryPage'
export { default as ClientsPage }   from './ClientsPage'
export { default as CashPage }      from './CashPage'
export { default as ReportsPage }   from './ReportsPage'

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
          <p>Módulo en construcción — próxima fase</p>
        </div>
      </div>
    </div>
  )
}

export const UsersPage = () => <PlaceholderPage icon={Settings} title="Usuarios" description="Gestión de usuarios y roles" />
