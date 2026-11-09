import { useEffect, useMemo, useRef, useState } from "react"
import { CheckIcon, DownloadIcon, PlusIcon, SquareArrowOutUpRightIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EditorDialog } from "@/editor-dialog"
import { MailMark } from "@/mail-mark"
import {
  BILLING_LABEL,
  USAGE_LABEL,
  counts,
  describeNurture,
  exportPayload,
  formatCheckedAt,
  importAccounts,
  todayISODate,
  visibleAccounts,
} from "@/model.js"
import { RollingNumber } from "@/rolling-number"
import { createStore } from "@/store.js"
import type { Account, Billing, Filter, Sort, Usage } from "@/types"

type Surface = "popup" | "page"
type Phase = "idle" | "working" | "done"

const FILTERS: Array<[Filter, string]> = [
  ["all", "全部"],
  ["unknown", "未核对"],
  ["usable", "可用"],
  ["unusable", "不可用"],
  ["paid", "已付费"],
]

export function LedgerApp({ surface }: { surface: Surface }) {
  const store = useMemo(() => createStore(), [])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<Sort>("nurture-long")
  const [editor, setEditor] = useState<Account | null | "new">(null)
  const [importing, setImporting] = useState<Phase>("idle")
  const [exporting, setExporting] = useState<Phase>("idle")
  const fileRef = useRef<HTMLInputElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const ignoring = useRef<string | null>(null)
  const editorRef = useRef(editor)
  editorRef.current = editor

  useEffect(() => {
    let alive = true
    const apply = (next: Account[]) => {
      if (!alive) return
      setAccounts(next)
      setReady(true)
      setLoadError("")
      const current = editorRef.current
      if (current && current !== "new" && !next.some((account) => account.id === current.id) && ignoring.current !== current.id) {
        setEditor(null)
        toast.error("这条记录已经不在列表里")
      }
    }
    const unsubscribe = store.subscribe((next: Account[]) => apply(next))
    store.load().then(apply).catch(() => {
      if (!alive) return
      setReady(true)
      setLoadError("读取失败，请重开一次。")
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [store])

  const tally = counts(accounts)
  const today = todayISODate()
  const visible = visibleAccounts(accounts, { filter, query, sort }) as Account[]
  const editing = editor && editor !== "new" ? accounts.find((account) => account.id === editor.id) ?? null : null

  function openEditor(account: Account | "new") {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setEditor(account)
  }

  function closeEditor() {
    setEditor(null)
    requestAnimationFrame(() => opener.current?.focus())
  }

  async function save(account: Account) {
    const next = (await store.saveAccount(account, accounts)) as Account[]
    setAccounts(next)
  }

  async function remove(id: string) {
    ignoring.current = id
    try {
      const next = (await store.deleteAccount(id, accounts)) as Account[]
      setAccounts(next)
    } finally {
      ignoring.current = null
    }
  }

  function exportFile() {
    const payload = exportPayload(accounts, new Date().toISOString())
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `email-ledger-${todayISODate()}.json`
    link.click()
    URL.revokeObjectURL(url)
    setExporting("done")
    toast.success("已导出")
    window.setTimeout(() => setExporting("idle"), 1200)
  }

  async function importFile(file: File) {
    setImporting("working")
    let data: unknown
    try {
      data = JSON.parse(await file.text())
    } catch {
      setImporting("idle")
      toast.error("这不是 Email Ledger 的备份文件")
      return
    }
    const result = importAccounts(accounts, data, new Date().toISOString(), todayISODate()) as {
      ok: boolean
      error?: string
      accounts: Account[]
      changed: Account[]
      created: number
      updated: number
      skipped: number
    }
    if (!result.ok) {
      setImporting("idle")
      toast.error(result.error || "这不是 Email Ledger 的备份文件")
      return
    }
    try {
      const next = (await store.saveImported(result.accounts, result.changed)) as Account[]
      setAccounts(next)
      if (editor) closeEditor()
      setImporting("done")
      toast.success(`已导入，新增 ${result.created} 条，更新 ${result.updated} 条，跳过 ${result.skipped} 条`)
      window.setTimeout(() => setImporting("idle"), 1200)
    } catch (error) {
      setImporting("idle")
      toast.error(error instanceof Error ? error.message : "没有保存，请再试一次。")
    }
  }

  return (
    <main className={surface === "page" ? "mx-auto flex min-h-screen w-full max-w-[980px] flex-col gap-4 px-6 py-9" : "flex h-full flex-col gap-3 p-4"}>
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-medium tracking-tight">邮箱台账</h1>
          <div className="flex shrink-0 items-center gap-2">
          <IconAction phase={exporting} label="导出" doneLabel="已导出" icon={DownloadIcon} onClick={exportFile} />
          <IconAction phase={importing} label="导入" doneLabel="已导入" icon={UploadIcon} onClick={() => fileRef.current?.click()} />
          {surface === "popup" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" asChild>
                  <a href="./manage.html" target="_blank" rel="noreferrer" aria-label="打开完整页面">
                    <SquareArrowOutUpRightIcon />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>打开完整页面</TooltipContent>
            </Tooltip>
          )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">保存在这台 Chrome，并随当前登录的 Google 账号同步。</p>
      </header>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        className={surface === "popup" ? "w-full" : "w-fit"}
        value={filter}
        onValueChange={(value) => {
          if (value) setFilter(value as Filter)
        }}
      >
        {FILTERS.map(([id, label]) => (
          <ToggleGroupItem
            key={id}
            value={id}
            aria-label={label}
            className={surface === "popup" ? "min-w-0 flex-1 shrink px-1" : undefined}
          >
            {label}
            <RollingNumber value={tally[id]} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex items-center gap-2">
        <Input
          value={query}
          placeholder="搜索邮箱"
          aria-label="搜索邮箱"
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
          <SelectTrigger aria-label="排序" className="w-48 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            <SelectGroup>
              <SelectItem value="nurture-long">Claude 注册从早到晚</SelectItem>
              <SelectItem value="nurture-short">Claude 注册从晚到早</SelectItem>
              <SelectItem value="email-new">邮箱注册从新到旧</SelectItem>
              <SelectItem value="email-old">邮箱注册从旧到新</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <section className={surface === "popup" ? "min-h-0 flex-1 overflow-auto" : "min-h-40"} aria-live="polite">
        <AccountList
          surface={surface}
          ready={ready}
          loadError={loadError}
          accounts={accounts}
          visible={visible}
          today={today}
          onCreate={() => openEditor("new")}
          onOpen={(account) => openEditor(account)}
        />
      </section>
      {ready && accounts.length > 0 && (
        <div>
          <Button onClick={() => openEditor("new")}>
            <PlusIcon data-icon="inline-start" />
            新增
          </Button>
        </div>
      )}
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        aria-label="选择备份文件"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void importFile(file)
        }}
      />
      {editor && (
        <EditorDialog
          account={editor === "new" ? null : editing}
          accounts={accounts}
          onClose={closeEditor}
          onSave={save}
          onDelete={remove}
        />
      )}
    </main>
  )
}

function AccountList({
  surface,
  ready,
  loadError,
  accounts,
  visible,
  today,
  onCreate,
  onOpen,
}: {
  surface: Surface
  ready: boolean
  loadError: string
  accounts: Account[]
  visible: Account[]
  today: string
  onCreate: () => void
  onOpen: (account: Account) => void
}) {
  if (!ready) return <SkeletonRows surface={surface} />
  if (loadError) {
    return <p className="text-sm text-muted-foreground">{loadError}</p>
  }
  if (accounts.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>还没有邮箱</EmptyTitle>
          <EmptyDescription>加上一条 Outlook 邮箱后，就可以看出哪些能用、哪些不能用、哪些付过费。</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onCreate}>
            <PlusIcon data-icon="inline-start" />
            新增
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
  if (visible.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">这个条件下没有邮箱</p>
  }
  if (surface === "popup") {
    return (
      <div className="flex flex-col">
        {visible.map((account) => (
          <button
            key={account.id}
            type="button"
            className="ledger-row flex items-center justify-between gap-3 border-b py-2 text-left transition-colors duration-100 hover:bg-muted/60"
            onClick={() => onOpen(account)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <MailMark email={account.email} />
              <span className="min-w-0">
              <span className="block truncate text-sm">{account.email}</span>
              {account.usage === "unusable" && account.unusableReason && (
                <span className="block truncate text-xs text-muted-foreground">{account.unusableReason}</span>
              )}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <StatusBadge usage={account.usage} />
              <BillingBadge billing={account.billing} />
              <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                {describeNurture(account.claudeRegisteredAt, today, "short")}
              </span>
            </span>
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className="opacity-100 transition-opacity duration-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>邮箱</TableHead>
            <TableHead>使用状态</TableHead>
            <TableHead>付费</TableHead>
            <TableHead>开通天数</TableHead>
            <TableHead>Claude 注册</TableHead>
            <TableHead>邮箱注册</TableHead>
            <TableHead>上次核对</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((account) => (
            <TableRow key={account.id} className="ledger-row transition-colors duration-100">
              <TableCell>
                <button type="button" className="flex items-center gap-2 text-left" onClick={() => onOpen(account)}>
                  <MailMark email={account.email} />
                  <span className="block">{account.email}</span>
                  {account.usage === "unusable" && account.unusableReason && (
                    <span className="block text-xs text-muted-foreground">{account.unusableReason}</span>
                  )}
                </button>
              </TableCell>
              <TableCell><StatusBadge usage={account.usage} /></TableCell>
              <TableCell><BillingBadge billing={account.billing} /></TableCell>
              <TableCell className="tabular-nums">{describeNurture(account.claudeRegisteredAt, today, "short")}</TableCell>
              <TableCell className="tabular-nums">{account.claudeRegisteredAt || "—"}</TableCell>
              <TableCell className="tabular-nums">{account.emailRegisteredAt || "—"}</TableCell>
              <TableCell className="tabular-nums">{formatCheckedAt(account.checkedAt) || "—"}</TableCell>
              <TableCell className="text-right">
                <Button className="row-actions" variant="outline" size="sm" onClick={() => onOpen(account)}>
                  编辑
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function SkeletonRows({ surface }: { surface: Surface }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="sr-only">正在读取</p>
      {Array.from({ length: surface === "popup" ? 6 : 5 }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}

function StatusBadge({ usage }: { usage: Usage }) {
  const variant = usage === "unusable" ? "destructive" : usage === "usable" ? "secondary" : "outline"
  return <Badge variant={variant}>{USAGE_LABEL[usage]}</Badge>
}

function BillingBadge({ billing }: { billing: Billing }) {
  return <Badge variant={billing === "paid" ? "default" : "outline"}>{BILLING_LABEL[billing]}</Badge>
}

function IconAction({
  phase,
  label,
  doneLabel,
  icon: Icon,
  onClick,
}: {
  phase: Phase
  label: string
  doneLabel: string
  icon: typeof DownloadIcon
  onClick: () => void
}) {
  const text = phase === "working" ? "提交中…" : phase === "done" ? doneLabel : label
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={text} disabled={phase === "working"} onClick={onClick}>
          {phase === "working" ? <Spinner aria-label="提交中" /> : phase === "done" ? <CheckIcon /> : <Icon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}
