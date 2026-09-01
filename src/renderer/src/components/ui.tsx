import { ReactNode, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
  className = 'mb-8'
}: {
  title: string
  subtitle: string
  actions?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <header className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div>
        <div className="flex items-center gap-3">
          {icon ? (
            <span className="text-[var(--accent)]" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <h1 className="font-display text-3xl tracking-tight text-[var(--text)]">{title}</h1>
        </div>
        <p className="mt-2 max-w-2xl text-balance text-sm text-[var(--text-muted)]">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function SectionLabel({
  children,
  className = ''
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2
      className={`mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] ${className}`}
    >
      {children}
    </h2>
  )
}

export function InputActionRow({
  children,
  actions
}: {
  children: ReactNode
  actions: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-panel)_80%,transparent)] p-4 ${className}`}
    >
      {children}
    </div>
  )
}

const buttonStyles: Record<string, string> = {
  primary:
    'bg-[var(--accent-dim)] text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--accent-dim)_80%,white)]',
  secondary:
    'border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] hover:border-[var(--accent)]',
  danger: 'bg-[#7a2e36] text-[var(--text)] hover:bg-[#93343e]',
  ghost: 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-elevated)]'
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-deep)] disabled:cursor-not-allowed disabled:opacity-40'

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
  className = '',
  loading = false,
  icon
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  type?: 'button' | 'submit'
  className?: string
  loading?: boolean
  icon?: ReactNode
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${buttonBase} ${buttonStyles[variant]} ${className}`}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  )
}

export function NavButton({
  to,
  children,
  variant = 'primary',
  className = '',
  icon
}: {
  to: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  className?: string
  icon?: ReactNode
}) {
  return (
    <NavLink
      to={to}
      className={`${buttonBase} ${buttonStyles[variant]} ${className}`}
    >
      {icon}
      {children}
    </NavLink>
  )
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} strokeWidth={1.75} aria-hidden="true" />
}

export function Field({
  label,
  children,
  hint,
  error,
  htmlFor
}: {
  label: string
  children: ReactNode
  hint?: string
  error?: string
  htmlFor?: string
}) {
  return (
    <div className="block space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-[var(--text-muted)]">
        {label}
      </label>
      {children}
      {error ? (
        <span className="block text-xs text-[var(--danger)]" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="block text-xs text-[var(--text-muted)]">{hint}</span>
      ) : null}
    </div>
  )
}

const inputClass =
  'w-full rounded-md border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-deep)] aria-invalid:border-[var(--danger)] aria-invalid:focus:border-[var(--danger)] aria-invalid:focus-visible:ring-[var(--danger)]'

export function TextInput({
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={error || props['aria-invalid']}
      className={`${inputClass} ${props.className ?? ''}`}
    />
  )
}

export function PasswordInput({
  error,
  className = '',
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { error?: boolean }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        aria-invalid={error || props['aria-invalid']}
        className={`${inputClass} pr-10 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] transition hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

export function TextSelect({
  error,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select
      {...props}
      aria-invalid={error || props['aria-invalid']}
      className={`${inputClass} ${props.className ?? ''}`}
    />
  )
}

export function CheckboxRow({
  checked,
  onChange,
  label,
  hint,
  statusIcon
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hint?: string
  statusIcon?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md px-1 py-1.5 hover:bg-[var(--bg-elevated)]">
      {statusIcon ? <span className="mt-1 shrink-0">{statusIcon}</span> : null}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 accent-[var(--accent)]"
      />
      <span>
        <span className="block text-sm text-[var(--text)]">{label}</span>
        {hint ? (
          <span
            className={`block text-xs ${
              hint === 'Ready' || hint === 'Dump present'
                ? 'text-[var(--ok)]'
                : hint === 'Not ready' || hint === 'No dump file'
                  ? 'text-[var(--danger)]'
                  : 'text-[var(--text-muted)]'
            }`}
          >
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  )
}

export function StatusDot({
  ok,
  warn = false,
  label
}: {
  ok: boolean
  warn?: boolean
  label?: string
}) {
  const color = ok ? 'bg-[var(--ok)]' : warn ? 'bg-[var(--warn)]' : 'bg-[var(--danger)]'
  const statusLabel = label ?? (ok ? 'OK' : warn ? 'Warning' : 'Not OK')
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden="true" />
      <span className="sr-only">{statusLabel}</span>
    </span>
  )
}

export function CommandPreview({ command }: { command: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2">
      <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        Command preview
      </p>
      <pre className="font-mono whitespace-pre-wrap break-all text-xs text-[var(--accent)]">
        {command || '—'}
      </pre>
    </div>
  )
}

const alertStyles: Record<string, string> = {
  info: 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)]',
  success:
    'border-[var(--ok)] bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] text-[var(--text)]',
  warning:
    'border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] text-[var(--text)]',
  error:
    'border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--text)]'
}

export function Alert({
  variant = 'info',
  title,
  children,
  className = ''
}: {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role="alert"
      className={`rounded-lg border px-4 py-3 text-sm ${alertStyles[variant]} ${className}`}
    >
      {title ? <p className="mb-1 font-medium">{title}</p> : null}
      <div className="text-[var(--text-muted)] [&_a]:text-[var(--accent)] [&_a]:underline">
        {children}
      </div>
    </div>
  )
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label
}: {
  value: T
  onChange: (next: T) => void
  options: Array<{ value: T; label: string }>
  label?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={[
            'rounded-md border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
            value === option.value
              ? 'border-[var(--accent)] bg-[var(--bg-elevated)] text-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-[var(--text-muted)]">
      <Spinner />
      <p>{message}</p>
    </div>
  )
}
