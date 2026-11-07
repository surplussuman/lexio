// WebSocket client for a live practice session (LLD §8.5, §18.1).
// The JWT travels as a query parameter because browsers can't set headers on
// a WebSocket handshake — see apps/practice/middleware.py.
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuthStore } from '../stores/useAuthStore'

function socketUrl(sessionId, token) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws/practice/${sessionId}/?token=${encodeURIComponent(token)}`
}

export function usePracticeSocket(sessionId, handlers) {
  const token = useAuthStore((s) => s.accessToken)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const socketRef = useRef(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!sessionId || !token) return undefined

    const socket = new WebSocket(socketUrl(sessionId, token))
    socketRef.current = socket

    socket.onopen = () => {
      setIsConnected(true)
      // Clear any error from a previous attempt. StrictMode's double-mount
      // closes the first socket immediately, which would otherwise leave
      // "lost the connection" on screen next to a live session.
      setError(null)
    }
    socket.onmessage = (event) => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      handlersRef.current[message.type]?.(message)
    }
    socket.onerror = () => {
      // Only surface this if the socket never opened; a close during teardown
      // is normal and shouldn't alarm the student.
      if (socket.readyState !== WebSocket.OPEN) {
        setError('Lost the connection to the coaching service.')
      }
    }
    socket.onclose = (event) => {
      if (socketRef.current !== socket) return // superseded by a newer socket
      setIsConnected(false)
      if (event.code === 4401) setError('Your session expired — log in again.')
      if (event.code === 4404) setError('This practice session is no longer active.')
    }

    return () => {
      socketRef.current = null
      socket.close()
    }
  }, [sessionId, token])

  const send = useCallback((payload) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload))
      return true
    }
    return false
  }, [])

  return { isConnected, error, send }
}
