import { useState, useCallback } from 'react'

export function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const success = (msg) => addToast(msg, 'success')
  const error   = (msg) => addToast(msg, 'error')
  const info    = (msg) => addToast(msg, 'info')

  return { toasts, success, error, info }
}
