const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID = /^[0-9a-zA-Z-]{8,80}$/;

export const USAGE_LABEL = {
  unknown: "未核对",
  usable: "可用",
  unusable: "不可用",
};

export const BILLING_LABEL = {
  unpaid: "未付费",
  paid: "已付费",
};

export function todayISODate(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function parseISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const date = new Date(utc);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return utc;
}

export function isValidEmail(email) {
  return email.length <= 254 && EMAIL.test(email);
}

export function nurtureDays(claudeDate, today) {
  if (!claudeDate) return null;
  const start = parseISODate(claudeDate);
  const end = parseISODate(today);
  if (start == null || end == null) return null;
  return Math.round((end - start) / 86400000);
}

export function nurtureLabel(days) {
  if (days == null) return "未填写";
  if (days < 0) return "日期异常";
  if (days === 0) return "今天";
  return `${days} 天`;
}

export function describeNurture(claudeDate, today, style) {
  if (!claudeDate) return nurtureLabel(null, style);
  const days = nurtureDays(claudeDate, today);
  if (days == null || days < 0) return "日期异常";
  return nurtureLabel(days, style);
}

export function formatCheckedAt(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function counts(accounts) {
  return {
    all: accounts.length,
    unknown: accounts.filter((account) => account.usage === "unknown").length,
    usable: accounts.filter((account) => account.usage === "usable").length,
    unusable: accounts.filter((account) => account.usage === "unusable").length,
    paid: accounts.filter((account) => account.billing === "paid").length,
  };
}

export function visibleAccounts(accounts, { filter, query, sort }) {
  const needle = query.trim().toLowerCase();
  return accounts
    .filter((account) => {
      if (filter === "paid" && account.billing !== "paid") return false;
      if (
        ["unknown", "usable", "unusable"].includes(filter) &&
        account.usage !== filter
      ) {
        return false;
      }
      if (needle && !account.email.toLowerCase().includes(needle)) return false;
      return true;
    })
    .sort((left, right) => compareAccounts(left, right, sort));
}

export function validateDraft(draft, accounts, today, editingId) {
  const errors = {};
  const email = draft.email.trim().toLowerCase();
  if (!email) errors.email = "请填写邮箱";
  else if (!isValidEmail(email)) errors.email = "邮箱格式不对";
  else if (accounts.some((account) => account.email.toLowerCase() === email && account.id !== editingId)) {
    errors.email = "这个邮箱已经在列表里";
  }

  if (!Object.hasOwn(USAGE_LABEL, draft.usage)) errors.usage = "请选择使用状态";
  if (!Object.hasOwn(BILLING_LABEL, draft.billing)) errors.billing = "请选择付费状态";

  const unusableReason = draft.unusableReason.trim();
  if (draft.usage === "unusable" && Array.from(unusableReason).length > 80) {
    errors.unusableReason = "不可用原因最多 80 个字";
  }

  const note = draft.note.trim();
  if (Array.from(note).length > 500) errors.note = "备注最多 500 个字";

  const emailRegisteredAt = cleanFormDate(draft.emailRegisteredAt, today, errors, "emailRegisteredAt");
  const claudeRegisteredAt = cleanFormDate(draft.claudeRegisteredAt, today, errors, "claudeRegisteredAt");

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      email,
      usage: draft.usage,
      unusableReason: draft.usage === "unusable" ? unusableReason : "",
      billing: draft.billing,
      emailRegisteredAt,
      claudeRegisteredAt,
      note,
    },
  };
}

export function buildAccount(value, previous, nowIso) {
  const usageChanged = !previous || previous.usage !== value.usage;
  let checkedAt = previous?.checkedAt || "";
  if (usageChanged) checkedAt = value.usage === "unknown" ? "" : nowIso;
  return {
    id: previous?.id || crypto.randomUUID(),
    email: value.email,
    usage: value.usage,
    unusableReason: value.unusableReason,
    billing: value.billing,
    emailRegisteredAt: value.emailRegisteredAt,
    claudeRegisteredAt: value.claudeRegisteredAt,
    note: value.note,
    checkedAt,
    createdAt: previous?.createdAt || nowIso,
    updatedAt: nowIso,
  };
}

export function exportPayload(accounts, exportedAt) {
  return {
    app: "email-ledger",
    version: 1,
    exportedAt,
    accounts,
  };
}

export function importAccounts(local, data, nowIso, today) {
  if (!data || data.app !== "email-ledger" || data.version !== 1 || !Array.isArray(data.accounts)) {
    return { ok: false, error: "这不是 Email Ledger 的备份文件" };
  }

  const incoming = new Map();
  let skipped = 0;
  for (const raw of data.accounts) {
    const sanitized = sanitizeImport(raw, today);
    if (!sanitized) {
      skipped += 1;
      continue;
    }
    incoming.set(sanitized.email, sanitized);
  }

  const next = local.map((account) => ({ ...account }));
  const indexByEmail = new Map(next.map((account, index) => [account.email.toLowerCase(), index]));
  const takenIds = new Set(next.map((account) => account.id));
  const changed = [];
  let created = 0;
  let updated = 0;

  for (const account of incoming.values()) {
    const existingIndex = indexByEmail.get(account.email);
    if (existingIndex == null) {
      const id = safeId(account.id, takenIds);
      takenIds.add(id);
      const createdAccount = {
        ...account,
        id,
        createdAt: isTimestamp(account.createdAt) ? account.createdAt : nowIso,
        updatedAt: nowIso,
      };
      next.push(createdAccount);
      indexByEmail.set(createdAccount.email, next.length - 1);
      changed.push(createdAccount);
      created += 1;
    } else {
      const existing = next[existingIndex];
      const updatedAccount = {
        ...account,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: nowIso,
      };
      next[existingIndex] = updatedAccount;
      changed.push(updatedAccount);
      updated += 1;
    }
  }

  return { ok: true, accounts: next, changed, created, updated, skipped };
}

export function isStoredAccount(value) {
  if (!value || typeof value !== "object") return false;
  if (typeof value.id !== "string" || !ID.test(value.id)) return false;
  if (typeof value.email !== "string" || !isValidEmail(value.email)) return false;
  if (!Object.hasOwn(USAGE_LABEL, value.usage)) return false;
  if (!Object.hasOwn(BILLING_LABEL, value.billing)) return false;
  return true;
}

function cleanFormDate(value, today, errors, key) {
  const date = value.trim();
  if (!date) return "";
  if (parseISODate(date) == null) {
    errors[key] = "日期格式不对";
    return "";
  }
  if (date > today) {
    errors[key] = "日期不能晚于今天";
    return "";
  }
  return date;
}

function sanitizeImport(raw, today) {
  if (!raw || typeof raw !== "object") return null;
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) return null;
  if (!Object.hasOwn(USAGE_LABEL, raw.usage)) return null;
  if (!Object.hasOwn(BILLING_LABEL, raw.billing)) return null;
  const unusableReason = clip(typeof raw.unusableReason === "string" ? raw.unusableReason.trim() : "", 80);
  const note = clip(typeof raw.note === "string" ? raw.note.trim() : "", 500);
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    email,
    usage: raw.usage,
    unusableReason: raw.usage === "unusable" ? unusableReason : "",
    billing: raw.billing,
    emailRegisteredAt: cleanImportedDate(raw.emailRegisteredAt, today),
    claudeRegisteredAt: cleanImportedDate(raw.claudeRegisteredAt, today),
    note,
    checkedAt: isTimestamp(raw.checkedAt) ? raw.checkedAt : "",
    createdAt: isTimestamp(raw.createdAt) ? raw.createdAt : "",
    updatedAt: isTimestamp(raw.updatedAt) ? raw.updatedAt : "",
  };
}

function cleanImportedDate(value, today) {
  if (typeof value !== "string" || parseISODate(value) == null || value > today) return "";
  return value;
}

function clip(text, max) {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max).join("") : text;
}

function isTimestamp(value) {
  return typeof value === "string" && value !== "" && !Number.isNaN(Date.parse(value));
}

function safeId(id, taken) {
  if (ID.test(id) && !taken.has(id)) return id;
  let next = crypto.randomUUID();
  while (taken.has(next)) next = crypto.randomUUID();
  return next;
}

function compareAccounts(left, right, sort) {
  const byEmailDate = sort === "email-new" || sort === "email-old";
  const byDate = compareDate(
    byEmailDate ? left.emailRegisteredAt : left.claudeRegisteredAt,
    byEmailDate ? right.emailRegisteredAt : right.claudeRegisteredAt,
    sort === "nurture-short" || sort === "email-new" ? "desc" : "asc",
  );
  if (byDate !== 0) return byDate;
  return left.email.localeCompare(right.email);
}

function compareDate(left, right, direction) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  if (left === right) return 0;
  const order = left > right ? 1 : -1;
  return direction === "desc" ? -order : order;
}
