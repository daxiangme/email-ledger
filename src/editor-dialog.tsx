import { useEffect, useRef, useState } from "react"
import { CalendarIcon, CheckIcon } from "lucide-react"
import { zhCN } from "react-day-picker/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  buildAccount,
  describeNurture,
  emailDomainSuggestions,
  formatCheckedAt,
  todayISODate,
  validateDraft,
} from "@/model.js"
import { SlideConfirm } from "@/slide-confirm"
import { blankDraft, type Account, type Draft } from "@/types"

type FieldName = "email" | "unusableReason" | "note" | "emailRegisteredAt" | "claudeRegisteredAt"
type Errors = Partial<Record<FieldName | "form", string>>

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"

export function EditorDialog({
  account,
  accounts,
  onClose,
  onSave,
  onDelete,
}: {
  account: Account | null
  accounts: Account[]
  onClose: () => void
  onSave: (account: Account) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(account ? draftFrom(account) : blankDraft())
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [phase, setPhase] = useState<"idle" | "saving" | "success">("idle")
  const [formError, setFormError] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(account?.id ?? null)
  const [emailFocused, setEmailFocused] = useState(false)
  const [domainsDismissed, setDomainsDismissed] = useState(false)
  const [domainIndex, setDomainIndex] = useState(0)
  const today = todayISODate()
  const suggestions = emailDomainSuggestions(draft.email) as string[]
  const domainCursor = Math.min(domainIndex, Math.max(suggestions.length - 1, 0))
  const domainsOpen = emailFocused && !domainsDismissed && suggestions.length > 0 && phase === "idle"
  const result = validateDraft(draft, accounts, today, recordId) as {
    ok: boolean
    errors: Errors
    value: Draft
  }
  const shown = (name: FieldName) =>
    phase === "success" ? undefined : submitted || touched[name] ? result.errors[name] : undefined

  useEffect(() => {
    const input = document.getElementById("email")
    if (!input) return
    const sync = () => setEmailFocused(document.activeElement === input)
    sync()
    input.addEventListener("focus", sync)
    input.addEventListener("blur", sync)
    return () => {
      input.removeEventListener("focus", sync)
      input.removeEventListener("blur", sync)
    }
  }, [draft.email])

  useEffect(() => {
    if (!domainsOpen) return
    document.getElementById(`email-domain-${domainCursor}`)?.scrollIntoView({ block: "nearest" })
  }, [domainsOpen, domainCursor])

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setFormError("")
  }

  function updateEmail(value: string) {
    update("email", value)
    setDomainsDismissed(false)
    setDomainIndex(0)
  }

  function chooseDomain(value: string) {
    update("email", value)
    setDomainsDismissed(true)
    setDomainIndex(0)
  }

  async function save() {
    setSubmitted(true)
    if (!result.ok || phase !== "idle") {
      const firstInvalid = (["email", "emailRegisteredAt", "claudeRegisteredAt", "unusableReason", "note"] as const).find(
        (name) => result.errors[name],
      )
      if (firstInvalid === "email") document.getElementById("email")?.focus()
      if (firstInvalid === "emailRegisteredAt") document.getElementById("email-date")?.focus()
      if (firstInvalid === "claudeRegisteredAt") document.getElementById("claude-date")?.focus()
      if (firstInvalid === "unusableReason") document.getElementById("reason")?.focus()
      if (firstInvalid === "note") document.getElementById("note")?.focus()
      return
    }
    const previous = account ?? (recordId ? ({ id: recordId } as Account) : null)
    const next = buildAccount(result.value, previous, new Date().toISOString()) as Account
    setRecordId(next.id)
    setPhase("saving")
    try {
      await onSave(next)
      setPhase("success")
      window.setTimeout(onClose, 800)
    } catch (error) {
      setPhase("idle")
      setFormError(error instanceof Error ? error.message : "没有保存，请再试一次。")
    }
  }

  async function remove() {
    if (!account || phase !== "idle") return
    setPhase("saving")
    try {
      await onDelete(account.id)
      onClose()
    } catch (error) {
      setPhase("idle")
      setConfirming(false)
      setFormError(error instanceof Error ? error.message : "没有保存，请再试一次。")
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && phase !== "saving") onClose()
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[min(640px,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        onInteractOutside={(event) => {
          if (event.target instanceof Element && event.target.closest("[data-slot=popover-content]")) return
          event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (event.target instanceof Element && event.target.closest("[data-slot=popover-content]")) return
          event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (confirming) {
            event.preventDefault()
            setConfirming(false)
            return
          }
          if (domainsOpen) {
            event.preventDefault()
            setDomainsDismissed(true)
          }
        }}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-4">
          <DialogTitle className="pr-8">{account ? "编辑邮箱" : "新增邮箱"}</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <FieldGroup>
            <Field data-invalid={Boolean(shown("email"))}>
              <FieldLabel htmlFor="email">邮箱</FieldLabel>
              <Popover open={domainsOpen}>
                <PopoverAnchor asChild>
                  <Input
                    id="email"
                    role="combobox"
                    aria-expanded={domainsOpen}
                    aria-controls="email-domains"
                    aria-autocomplete="list"
                    aria-activedescendant={domainsOpen ? `email-domain-${domainCursor}` : undefined}
                    value={draft.email}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={Boolean(shown("email"))}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => {
                      setEmailFocused(false)
                      setTouched((current) => ({ ...current, email: true }))
                    }}
                    onChange={(event) => updateEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (!domainsOpen) return
                      if (event.key === "ArrowDown") {
                        event.preventDefault()
                        setDomainIndex((domainCursor + 1) % suggestions.length)
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault()
                        setDomainIndex((domainCursor - 1 + suggestions.length) % suggestions.length)
                      } else if (event.key === "Enter") {
                        event.preventDefault()
                        chooseDomain(suggestions[domainCursor])
                      } else if (event.key === "Escape") {
                        event.preventDefault()
                        event.stopPropagation()
                        setDomainsDismissed(true)
                      }
                    }}
                  />
                </PopoverAnchor>
                <PopoverContent
                  align="start"
                  sideOffset={4}
                  className="z-[60] w-(--radix-popper-anchor-width) p-1"
                  onOpenAutoFocus={(event) => event.preventDefault()}
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  <ul id="email-domains" role="listbox" aria-label="常见邮箱后缀" className="max-h-60 overflow-y-auto">
                    {suggestions.map((item, index) => {
                      const at = item.indexOf("@")
                      return (
                        <li key={item}>
                          <button
                            id={`email-domain-${index}`}
                            type="button"
                            role="option"
                            aria-selected={index === domainCursor}
                            className={`flex w-full rounded-md px-2 py-1.5 text-left text-sm ${index === domainCursor ? "bg-accent text-accent-foreground" : ""}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setDomainIndex(index)}
                            onClick={() => chooseDomain(item)}
                          >
                            <span>{item.slice(0, at)}</span>
                            <span className="font-medium">{item.slice(at)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </PopoverContent>
              </Popover>
              <FieldError>{shown("email")}</FieldError>
            </Field>
            <Field>
              <FieldLabel>使用状态</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                spacing={2}
                value={draft.usage}
                onValueChange={(value) => {
                  if (value === "unknown" || value === "usable" || value === "unusable") update("usage", value)
                }}
              >
                <ToggleGroupItem value="unknown">未核对</ToggleGroupItem>
                <ToggleGroupItem value="usable">可用</ToggleGroupItem>
                <ToggleGroupItem value="unusable">不可用</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <div
              className="grid"
              style={{
                gridTemplateRows: draft.usage === "unusable" ? "1fr" : "0fr",
                transition: `grid-template-rows ${draft.usage === "unusable" ? 280 : 160}ms ${EASE}`,
              }}
            >
              <div className="overflow-hidden" inert={draft.usage !== "unusable" ? true : undefined}>
                <Field data-invalid={Boolean(shown("unusableReason"))}>
                  <FieldLabel htmlFor="reason">
                    不可用原因
                    <span className="font-normal text-muted-foreground">（可选）</span>
                  </FieldLabel>
                  <Input
                    id="reason"
                    value={draft.unusableReason}
                    placeholder="例如封禁、邮箱失效"
                    aria-invalid={Boolean(shown("unusableReason"))}
                    onBlur={() => setTouched((current) => ({ ...current, unusableReason: true }))}
                    onChange={(event) => update("unusableReason", event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground tabular-nums">{Array.from(draft.unusableReason).length} / 80</p>
                  <FieldError>{shown("unusableReason")}</FieldError>
                </Field>
              </div>
            </div>
            <Field>
              <FieldLabel>付费状态</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                value={draft.billing}
                onValueChange={(value) => {
                  if (value === "unpaid" || value === "paid") update("billing", value)
                }}
              >
                <ToggleGroupItem value="unpaid">未付费</ToggleGroupItem>
                <ToggleGroupItem value="paid">已付费</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <DateField
              id="email-date"
              label="邮箱注册日期"
              optional
              value={draft.emailRegisteredAt}
              max={today}
              error={shown("emailRegisteredAt")}
              onBlur={() => setTouched((current) => ({ ...current, emailRegisteredAt: true }))}
              onChange={(value) => update("emailRegisteredAt", value)}
            />
            <DateField
              id="claude-date"
              label="Claude 注册日期"
              optional
              value={draft.claudeRegisteredAt}
              max={today}
              error={shown("claudeRegisteredAt")}
              onBlur={() => setTouched((current) => ({ ...current, claudeRegisteredAt: true }))}
              onChange={(value) => update("claudeRegisteredAt", value)}
            />
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-sm text-muted-foreground">开通天数</span>
              <span className="text-sm font-medium tabular-nums">{describeNurture(draft.claudeRegisteredAt, today, "full")}</span>
            </div>
            <Field data-invalid={Boolean(shown("note"))}>
              <FieldLabel htmlFor="note">
                备注
                <span className="font-normal text-muted-foreground">（可选）</span>
              </FieldLabel>
              <Textarea
                id="note"
                value={draft.note}
                rows={3}
                aria-invalid={Boolean(shown("note"))}
                onBlur={() => setTouched((current) => ({ ...current, note: true }))}
                onChange={(event) => update("note", event.target.value)}
              />
              <p className="text-xs text-muted-foreground tabular-nums">{Array.from(draft.note).length} / 500</p>
              <FieldError>{shown("note")}</FieldError>
            </Field>
            {account && (
              <Field orientation="horizontal">
                <FieldLabel>上次核对</FieldLabel>
                <p className="text-sm">{formatCheckedAt(account.checkedAt) || "还没有核对"}</p>
              </Field>
            )}
          </FieldGroup>
          </div>
          {formError && <p className="shrink-0 px-4 pb-2 text-sm text-destructive">{formError}</p>}
          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none">
            {confirming && account ? (
              <SlideConfirm disabled={phase !== "idle"} onCancel={() => setConfirming(false)} onConfirm={() => void remove()} />
            ) : (
              <div className="flex w-full items-center gap-2">
                {account && (
                  <Button type="button" variant="destructive" disabled={phase !== "idle"} onClick={() => setConfirming(true)}>
                    删除
                  </Button>
                )}
                <Button type="button" variant="outline" disabled={phase === "saving"} onClick={onClose}>
                  取消
                </Button>
                <Button type="submit" className="min-w-0 flex-1 shrink" disabled={phase === "saving"}>
                  <span className="inline-flex size-4 items-center justify-center">
                    {phase === "saving" && <Spinner aria-label="提交中" />}
                    {phase === "success" && <CheckIcon data-icon="inline-start" />}
                  </span>
                  {phase === "saving" ? "提交中…" : "保存"}
                </Button>
              </div>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DateField({
  id,
  label,
  optional,
  value,
  max,
  error,
  onBlur,
  onChange,
}: {
  id: string
  label: string
  optional?: boolean
  value: string
  max: string
  error?: string
  onBlur: () => void
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const selected = isoToDate(value)
  const today = isoToDate(max)

  useEffect(() => {
    if (!open) return
    panelRef.current?.scrollIntoView({ block: "nearest" })
  }, [open])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
  }

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">（可选）</span>}
      </FieldLabel>
      <Button
        id={id}
        type="button"
        variant="outline"
        aria-invalid={Boolean(error)}
        aria-expanded={open}
        className="w-full justify-between font-normal"
        onBlur={onBlur}
        onClick={() => setOpen((current) => !current)}
      >
        {value || "选择日期"}
        <CalendarIcon data-icon="inline-end" />
      </Button>
      {open && (
        <div ref={panelRef} className="w-full overflow-hidden rounded-xl bg-popover ring-1 ring-foreground/10">
          <Calendar
            className="w-full bg-transparent"
            mode="single"
            locale={zhCN}
            selected={selected}
            defaultMonth={selected ?? today}
            disabled={today ? { after: today } : undefined}
            onSelect={(date) => {
              if (date) choose(dateToIso(date))
            }}
          />
          <div className="flex gap-2 border-t p-2">
            <Button type="button" variant="outline" size="sm" onClick={() => choose(max)}>
              今天
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => choose("")}>
                清除
              </Button>
            )}
          </div>
        </div>
      )}
      <FieldError>{error}</FieldError>
    </Field>
  )
}

function isoToDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function dateToIso(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function draftFrom(account: Account): Draft {
  return {
    email: account.email,
    usage: account.usage,
    unusableReason: account.unusableReason,
    billing: account.billing,
    emailRegisteredAt: account.emailRegisteredAt,
    claudeRegisteredAt: account.claudeRegisteredAt,
    note: account.note,
  }
}
