import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

let sharedSocket: Socket | null = null

function getSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io({
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })
  }
  return sharedSocket
}

export function useSocket() {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [socket] = useState(getSocket)

  useEffect(() => {
    const onConnect = () => {
      setConnected(true)
      setError(null)
    }
    const onDisconnect = () => setConnected(false)
    const onError = (err: Error) => {
      console.error('[socket] connect_error:', err.message)
      setError(err.message)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onError)

    // If already connected (e.g. shared socket from another component)
    if (socket.connected) {
      setConnected(true)
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onError)
    }
  }, [socket])

  return { socket, connected, error }
}
