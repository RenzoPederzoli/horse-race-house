import { HostApp } from './host/HostApp.tsx'
import { PlayerApp } from './player/PlayerApp.tsx'

export function App() {
  const path = window.location.pathname
  if (path === '/play') {
    return <PlayerApp />
  }
  return <HostApp />
}
