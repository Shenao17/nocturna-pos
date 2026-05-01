import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Delete } from 'lucide-react'
import { authApi } from '../api/client'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const [users, setUsers]           = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [pin, setPin]               = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const { login, isAuthenticated }  = useAuthStore()
  const navigate                    = useNavigate()

  useEffect(() => {
    if (isAuthenticated) navigate('/pos')
  }, [isAuthenticated])

  useEffect(() => {
    authApi.getUsers()
      .then(r => setUsers(r.data))
      .catch(() => setError('No se pudo conectar al servidor'))
  }, [])

  useEffect(() => {
    if (pin.length === 4 && selectedUser) handleLogin(pin)
  }, [pin])

  const handleKey = (key) => {
    if (pin.length >= 4) return
    setError('')
    setPin(prev => prev + key)
  }

  const handleDelete = () => setPin(prev => prev.slice(0, -1))

  const handleLogin = async (currentPin) => {
    if (!selectedUser) { setError('Selecciona un usuario'); return }
    setLoading(true)
    try {
      const res = await authApi.login(selectedUser.id, currentPin)
      login(res.data.user, res.data.access_token)
      navigate('/pos')
    } catch (e) {
      setError('PIN incorrecto')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const keys = ['1','2','3','4','5','6','7','8','9','','0','del']

  return (
    <div className="login-page">
      <div className="login-bg-glow" />

      <div className="login-card">
        <div className="login-logo">NOCT<span>U</span>RNA</div>
        <div className="login-subtitle">Point of Sale · BlackLabs Development</div>

        {/* Selector de usuario */}
        {users.length > 0 && (
          <div className="user-selector">
            {users.map(u => (
              <div
                key={u.id}
                className={`user-option${selectedUser?.id === u.id ? ' selected' : ''}`}
                onClick={() => { setSelectedUser(u); setPin(''); setError('') }}
              >
                <div className="user-option-avatar">
                  {u.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div className="user-option-name">{u.name}</div>
                  <div className="user-option-role">{u.role}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PIN dots */}
        {selectedUser && (
          <>
            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
              Ingresa tu PIN
            </div>
            <div className="pin-display">
              {[0,1,2,3].map(i => (
                <div key={i} className={`pin-dot${i < pin.length ? ' filled' : ''}`} />
              ))}
            </div>

            {error && (
              <div style={{ textAlign: 'center', color: '#E05555', fontSize: '0.8rem', marginBottom: 8 }}>
                {error}
              </div>
            )}

            {/* Keypad */}
            <div className="pin-keypad">
              {keys.map((key, i) => (
                key === '' ? <div key={i} /> :
                key === 'del' ? (
                  <button key={i} className="pin-key delete" onClick={handleDelete}>
                    <Delete size={18} />
                  </button>
                ) : (
                  <button key={i} className="pin-key" onClick={() => handleKey(key)} disabled={loading}>
                    {key}
                  </button>
                )
              ))}
            </div>
          </>
        )}

        {!selectedUser && users.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px 0' }}>
            {error || 'Cargando usuarios...'}
          </div>
        )}
      </div>

      <div className="version-tag">v1.0.0 · Nocturna POS · BlackLabs Development</div>
    </div>
  )
}
