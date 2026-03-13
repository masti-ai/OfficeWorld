export type MessageHandler = (data: Record<string, unknown>) => void

let socket: WebSocket | null = null
const handlers: MessageHandler[] = []
let reconnectDelay = 1000
const MAX_RECONNECT_DELAY = 30000
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

export function connect(url = `ws://${window.location.host}/ws`) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  socket = new WebSocket(url)

  socket.onopen = () => {
    reconnectDelay = 1000 // reset backoff on successful connection
  }

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      for (const h of handlers) h(data)
    } catch {
      // ignore non-JSON messages
    }
  }

  socket.onclose = () => {
    socket = null
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY)
      connect(url)
    }, reconnectDelay)
  }

  socket.onerror = () => {
    // onclose will fire after onerror, triggering reconnection
  }
}

export function isConnected(): boolean {
  return socket?.readyState === WebSocket.OPEN
}

export function onMessage(handler: MessageHandler) {
  handlers.push(handler)
  return () => {
    const idx = handlers.indexOf(handler)
    if (idx >= 0) handlers.splice(idx, 1)
  }
}

export function send(data: Record<string, unknown>) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data))
  }
}
