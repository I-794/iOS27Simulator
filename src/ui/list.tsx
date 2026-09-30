import type { ReactNode, CSSProperties } from 'react'
import { ChevronRight } from 'lucide-react'
import { Switch } from './controls'

export function List({ header, footer, children, plain, style, bigHeader }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; plain?: boolean; style?: CSSProperties; bigHeader?: boolean }) {
  return (
    <section>
      {header && <div className={`list-header ${bigHeader ? 'big' : ''}`}>{header}</div>}
      <div className={`list ${plain ? 'plain' : ''}`} style={style} role="list">
        {children}
      </div>
      {footer && <div className="list-footer">{footer}</div>}
    </section>
  )
}

export function SettingsIcon({ color, children, size = 30 }: { color: string; children: ReactNode; size?: number }) {
  return (
    <span className="settings-icon" style={{ background: color, width: size, height: size, borderRadius: size * 0.27 }}>
      {children}
    </span>
  )
}

export interface RowProps {
  title: ReactNode
  subtitle?: ReactNode
  detail?: ReactNode
  icon?: ReactNode
  chevron?: boolean
  onClick?: () => void
  toggle?: { value: boolean; onChange: (v: boolean) => void; color?: string }
  trailing?: ReactNode
  destructive?: boolean
  tint?: boolean
  compact?: boolean
  style?: CSSProperties
  className?: string
  label?: string
  disabled?: boolean
}

export function Row({ title, subtitle, detail, icon, chevron, onClick, toggle, trailing, destructive, tint, compact, style, className = '', label, disabled }: RowProps) {
  const cls = `row-item ${icon ? 'has-icon' : ''} ${destructive ? 'destructive' : ''} ${tint ? 'tint' : ''} ${compact ? 'compact' : ''} ${className}`
  const inner = (
    <>
      {icon}
      <span className="row-main">
        <span className="row-title">{title}</span>
        {subtitle && <span className="row-sub">{subtitle}</span>}
      </span>
      {detail !== undefined && <span className="row-detail">{detail}</span>}
      {trailing}
      {toggle && <Switch checked={toggle.value} onChange={toggle.onChange} color={toggle.color} label={typeof title === 'string' ? title : label} disabled={disabled} />}
      {chevron && <ChevronRight className="chev" size={18} strokeWidth={2.6} />}
    </>
  )
  if (onClick && !toggle) {
    return (
      <button className={cls} onClick={onClick} style={style} role="listitem" aria-label={label} disabled={disabled}>
        {inner}
      </button>
    )
  }
  return (
    <div className={cls} style={style} role="listitem" onClick={toggle && !disabled ? () => toggle.onChange(!toggle.value) : onClick}>
      {inner}
    </div>
  )
}
