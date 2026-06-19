import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(v: boolean) => void>(() => {})

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (result: boolean) => {
    resolver.current(result)
    setOpts(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">{opts.title}</h3>
            {opts.message && <p className="mt-2 text-sm text-slate-300">{opts.message}</p>}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => close(false)}
                className="flex-1 rounded-xl border border-border bg-surface-2 py-2.5 text-sm font-medium text-slate-200 active:scale-[0.98]"
              >
                {opts.cancelLabel ?? 'Annulla'}
              </button>
              <button
                onClick={() => close(true)}
                className={[
                  'flex-1 rounded-xl py-2.5 text-sm font-semibold text-white active:scale-[0.98]',
                  opts.danger ? 'bg-rose-600' : 'bg-accent-strong',
                ].join(' ')}
              >
                {opts.confirmLabel ?? 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm deve essere usato dentro ConfirmProvider')
  return ctx
}
