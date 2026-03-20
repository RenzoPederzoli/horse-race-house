import { QRCodeSVG } from 'qrcode.react'

export function QRCodePanel(props: { url: string }) {
  return (
    <div style={{ marginTop: 16, textAlign: 'center' }}>
      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Players: scan to join</h2>
      <div
        style={{
          display: 'inline-block',
          padding: 16,
          background: '#fff',
          borderRadius: 12,
        }}
      >
        <QRCodeSVG value={props.url} size={180} />
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 8, wordBreak: 'break-all' }}>
        {props.url}
      </div>
    </div>
  )
}
