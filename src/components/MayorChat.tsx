import { useState, useRef, useEffect } from 'react'
import { THEME } from '../constants'
import { PixelPanel, PixelButton } from './gba'

interface ChatMessage {
  id: number
  role: 'user' | 'mayor'
  text: string
  timestamp: Date
}

export function MayorChat({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'mayor',
      text: "Welcome to Gas Town! I'm the Mayor. Ask me anything about the town, your rigs, or what the agents are up to.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (visible) inputRef.current?.focus()
  }, [visible])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = {
      id: messages.length,
      role: 'user',
      text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/mayor-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      let reply = "I'm not available right now. The bridge server may be offline."
      if (res.ok) {
        const data = await res.json()
        reply = data.reply || reply
      }

      setMessages((prev) => [
        ...prev,
        { id: prev.length, role: 'mayor', text: reply, timestamp: new Date() },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length,
          role: 'mayor',
          text: 'Cannot reach the bridge server. Start it with: npm run server',
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      right: 16,
      bottom: 16,
      width: 380,
      height: 500,
      zIndex: 1000,
    }}>
      <PixelPanel variant="accent" style={{ height: '100%', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          padding: '8px 14px',
          background: THEME.bgHeader,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: `2px solid ${THEME.goldDim}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontFamily: 'sans-serif' }}>&#x1F3A9;</span>
          <span style={{ color: THEME.gold, fontWeight: 'bold', fontSize: 13, flex: 1, fontFamily: THEME.fontFamily, letterSpacing: 2, textTransform: 'uppercase' }}>Mayor</span>
          <PixelButton size="sm" onClick={onClose} style={{ padding: '0 6px', height: 20, minWidth: 0 }}>
            x
          </PixelButton>
        </div>

        {/* Messages */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
            }}>
              <div style={{
                background: msg.role === 'user' ? '#1a2a10' : THEME.bgPanel,
                color: msg.role === 'user' ? THEME.green : THEME.textSecondary,
                padding: '8px 12px',
                fontSize: 11,
                lineHeight: 1.5,
                border: `2px solid ${msg.role === 'user' ? THEME.greenDim : THEME.borderPanel}`,
                fontFamily: THEME.fontFamily,
              }}>
                {msg.text}
              </div>
              <div style={{
                fontSize: 8,
                color: THEME.textMuted,
                marginTop: 2,
                textAlign: msg.role === 'user' ? 'right' : 'left',
                fontFamily: THEME.fontFamily,
              }}>
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ color: THEME.textMuted, fontSize: 10, fontStyle: 'italic', fontFamily: THEME.fontFamily }}>
              Mayor is thinking...
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        {/* Input */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          padding: '10px 12px',
          borderTop: `1px solid ${THEME.borderPanel}`,
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask the Mayor..."
            style={{
              flex: 1,
              background: THEME.bgBody,
              border: `2px solid ${THEME.borderPanel}`,
              color: THEME.textPrimary,
              padding: '6px 10px',
              fontSize: 11,
              fontFamily: THEME.fontFamily,
              outline: 'none',
            }}
          />
          <PixelButton
            onClick={sendMessage}
            disabled={loading}
            variant="primary"
            size="sm"
          >Send</PixelButton>
        </div>
      </PixelPanel>
    </div>
  )
}
