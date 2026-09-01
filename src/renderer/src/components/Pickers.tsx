import { AlertTriangle, Check } from 'lucide-react'
import { DATABASES, SERVICES } from '../../../shared/types'
import { Alert, CheckboxRow, Panel, SectionLabel, Button, StatusDot } from './ui'

export function ServicePicker({
  selected,
  onChange,
  readyMap
}: {
  selected: string[]
  onChange: (next: string[]) => void
  readyMap?: Record<string, boolean>
}) {
  const toggle = (name: string, checked: boolean) => {
    onChange(checked ? [...selected, name] : selected.filter((s) => s !== name))
  }

  const notReadySelected = readyMap
    ? selected.filter((name) => readyMap[name] === false)
    : []

  return (
    <Panel className="transition-shadow hover:shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel className="mb-0">Services</SectionLabel>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onChange([...SERVICES])}>
            All
          </Button>
          <Button variant="ghost" onClick={() => onChange([])}>
            None
          </Button>
        </div>
      </div>
      {notReadySelected.length > 0 ? (
        <Alert variant="warning" className="mb-3">
          {notReadySelected.length} selected service{notReadySelected.length > 1 ? 's are' : ' is'}{' '}
          not ready: {notReadySelected.join(', ')}
        </Alert>
      ) : null}
      <div className="grid gap-1 sm:grid-cols-2">
        {SERVICES.map((name) => {
          const ready = readyMap?.[name]
          const hint = readyMap ? (ready ? 'Ready' : 'Not ready') : undefined
          return (
            <CheckboxRow
              key={name}
              checked={selected.includes(name)}
              onChange={(c) => toggle(name, c)}
              label={name}
              hint={hint}
              statusIcon={
                readyMap ? (
                  ready ? (
                    <Check size={14} strokeWidth={1.75} className="text-[var(--ok)]" aria-hidden="true" />
                  ) : (
                    <AlertTriangle
                      size={14}
                      strokeWidth={1.75}
                      className="text-[var(--warn)]"
                      aria-hidden="true"
                    />
                  )
                ) : (
                  <StatusDot ok={true} label="Unknown" />
                )
              }
            />
          )
        })}
      </div>
    </Panel>
  )
}

export function DatabasePicker({
  selected,
  onChange,
  dumpMap
}: {
  selected: string[]
  onChange: (next: string[]) => void
  dumpMap?: Record<string, boolean>
}) {
  const toggle = (name: string, checked: boolean) => {
    onChange(checked ? [...selected, name] : selected.filter((s) => s !== name))
  }

  const missingDumpSelected = dumpMap
    ? selected.filter((name) => dumpMap[name] === false)
    : []

  return (
    <Panel className="transition-shadow hover:shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel className="mb-0">Databases</SectionLabel>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onChange([...DATABASES])}>
            All
          </Button>
          <Button variant="ghost" onClick={() => onChange([])}>
            None
          </Button>
        </div>
      </div>
      {missingDumpSelected.length > 0 ? (
        <Alert variant="warning" className="mb-3">
          {missingDumpSelected.length} selected database{missingDumpSelected.length > 1 ? 's have' : ' has'}{' '}
          no dump file: {missingDumpSelected.join(', ')}
        </Alert>
      ) : null}
      <div className="grid gap-1 sm:grid-cols-2">
        {DATABASES.map((name) => {
          const hasDump = dumpMap?.[name]
          const hint = dumpMap ? (hasDump ? 'Dump present' : 'No dump file') : undefined
          return (
            <CheckboxRow
              key={name}
              checked={selected.includes(name)}
              onChange={(c) => toggle(name, c)}
              label={name}
              hint={hint}
              statusIcon={
                dumpMap ? (
                  hasDump ? (
                    <Check size={14} strokeWidth={1.75} className="text-[var(--ok)]" aria-hidden="true" />
                  ) : (
                    <AlertTriangle
                      size={14}
                      strokeWidth={1.75}
                      className="text-[var(--danger)]"
                      aria-hidden="true"
                    />
                  )
                ) : undefined
              }
            />
          )
        })}
      </div>
    </Panel>
  )
}
