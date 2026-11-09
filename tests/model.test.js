import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAccount,
  counts,
  describeNurture,
  exportPayload,
  formatCheckedAt,
  importAccounts,
  todayISODate,
  validateDraft,
  visibleAccounts,
} from "../src/model.js";

const today = "2026-11-07";

function draft(overrides = {}) {
  return {
    email: "a@outlook.com",
    usage: "unknown",
    unusableReason: "",
    billing: "unpaid",
    emailRegisteredAt: "",
    claudeRegisteredAt: "",
    note: "",
    ...overrides,
  };
}

function account(overrides = {}) {
  return {
    id: "account-1",
    email: "a@outlook.com",
    usage: "usable",
    unusableReason: "",
    billing: "unpaid",
    emailRegisteredAt: "",
    claudeRegisteredAt: "",
    note: "",
    checkedAt: "",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

test("养号天数只从 Claude 注册日算到今天", () => {
  assert.equal(describeNurture("", today, "full"), "未填写");
  assert.equal(describeNurture("2026-11-07", today, "full"), "今天");
  assert.equal(describeNurture("2026-11-07", today, "short"), "今天");
  assert.equal(describeNurture("2026-10-01", today, "full"), "37 天");
  assert.equal(describeNurture("2026-10-01", today, "short"), "37 天");
  assert.equal(describeNurture("2026-11-08", today, "short"), "日期异常");
  assert.equal(describeNurture("2026-02-31", today, "full"), "日期异常");
});

test("今天的日期按本地日历，不按 UTC", () => {
  assert.equal(todayISODate(new Date(2026, 10, 7, 23, 30)), "2026-11-07");
});

test("上次核对时间显示到分钟", () => {
  const iso = "2026-11-07T13:04:00.000Z";
  const date = new Date(iso);
  const pad = (value) => String(value).padStart(2, "0");
  const expected = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  assert.equal(formatCheckedAt(iso), expected);
  assert.equal(formatCheckedAt(""), "");
});

test("可用且已付费的账号同时计入两个数字", () => {
  const tally = counts([
    account({ usage: "usable", billing: "paid" }),
    account({ id: "account-2", email: "b@outlook.com", usage: "unusable", billing: "unpaid" }),
  ]);
  assert.deepEqual(tally, { all: 2, unknown: 0, usable: 1, unusable: 1, paid: 1 });
});

test("已付费筛选包含不能用的付费账号，搜索和筛选同时生效", () => {
  const accounts = [
    account({ usage: "usable", billing: "paid", claudeRegisteredAt: "2026-10-01" }),
    account({
      id: "account-2",
      email: "b@outlook.com",
      usage: "unusable",
      billing: "paid",
      claudeRegisteredAt: "",
    }),
  ];
  assert.deepEqual(
    visibleAccounts(accounts, { filter: "paid", query: "", sort: "nurture-long" }).map((item) => item.email),
    ["a@outlook.com", "b@outlook.com"],
  );
  assert.deepEqual(
    visibleAccounts(accounts, { filter: "usable", query: "b@", sort: "nurture-long" }).map((item) => item.email),
    [],
  );
});

test("养得最久把没填 Claude 日期的放在最后，邮箱排序也把空日期放在最后", () => {
  const accounts = [
    account({ id: "b", email: "b@outlook.com", claudeRegisteredAt: "", emailRegisteredAt: "2026-05-01" }),
    account({ id: "a", email: "a@outlook.com", claudeRegisteredAt: "2026-10-01", emailRegisteredAt: "" }),
    account({ id: "c", email: "c@outlook.com", claudeRegisteredAt: "2026-11-01", emailRegisteredAt: "2026-01-01" }),
    account({ id: "d", email: "d@outlook.com", claudeRegisteredAt: "2026-10-01", emailRegisteredAt: "2026-02-01" }),
  ];
  const emails = (sort) => visibleAccounts(accounts, { filter: "all", query: "", sort }).map((item) => item.email);
  assert.deepEqual(emails("nurture-long"), ["a@outlook.com", "d@outlook.com", "c@outlook.com", "b@outlook.com"]);
  assert.deepEqual(emails("nurture-short"), ["c@outlook.com", "a@outlook.com", "d@outlook.com", "b@outlook.com"]);
  assert.deepEqual(emails("email-new"), ["b@outlook.com", "d@outlook.com", "c@outlook.com", "a@outlook.com"]);
  assert.deepEqual(emails("email-old"), ["c@outlook.com", "d@outlook.com", "b@outlook.com", "a@outlook.com"]);
});

test("保存时检查邮箱和日期，不可用以外不保留原因", () => {
  const duplicate = validateDraft(draft({ email: "A@Outlook.com" }), [account()], today, null);
  assert.equal(duplicate.errors.email, "这个邮箱已经在列表里");

  const badEmail = validateDraft(draft({ email: "not-an-email" }), [], today, null);
  assert.equal(badEmail.errors.email, "邮箱格式不对");

  const future = validateDraft(draft({ claudeRegisteredAt: "2026-12-01" }), [], today, null);
  assert.equal(future.errors.claudeRegisteredAt, "日期不能晚于今天");

  const impossible = validateDraft(draft({ emailRegisteredAt: "2026-02-31" }), [], today, null);
  assert.equal(impossible.errors.emailRegisteredAt, "日期格式不对");

  const kept = validateDraft(draft({ usage: "usable", unusableReason: "封禁" }), [], today, null);
  assert.equal(kept.ok, true);
  assert.equal(kept.value.unusableReason, "");
  assert.equal(kept.value.email, "a@outlook.com");

  const tooLong = validateDraft(draft({ usage: "unusable", unusableReason: "封".repeat(81) }), [], today, null);
  assert.equal(tooLong.errors.unusableReason, "不可用原因最多 80 个字");
});

test("只有使用状态变化时才更新上次核对时间", () => {
  const now = "2026-11-07T12:00:00.000Z";
  const previous = account({
    usage: "unusable",
    unusableReason: "旧原因",
    checkedAt: "2026-11-01T00:00:00.000Z",
  });
  const sameUsage = validateDraft(
    draft({ usage: "unusable", unusableReason: "新原因", billing: "paid" }),
    [previous],
    today,
    previous.id,
  );
  const updated = buildAccount(sameUsage.value, previous, now);
  assert.equal(updated.checkedAt, previous.checkedAt);
  assert.equal(updated.createdAt, previous.createdAt);
  assert.equal(updated.unusableReason, "新原因");
  assert.equal(updated.billing, "paid");

  const usable = buildAccount(validateDraft(draft({ usage: "usable" }), [previous], today, previous.id).value, previous, now);
  assert.equal(usable.checkedAt, now);
  assert.equal(usable.unusableReason, "");

  const cleared = buildAccount(validateDraft(draft({ usage: "unknown" }), [previous], today, previous.id).value, previous, now);
  assert.equal(cleared.checkedAt, "");

  const created = buildAccount(validateDraft(draft({ usage: "usable" }), [], today, null).value, null, now);
  assert.equal(created.checkedAt, now);
  assert.equal(created.usage, "usable");
});

test("导入按邮箱合并，跳过坏行，不删除本地独有记录", () => {
  const local = [
    account({ email: "keep@outlook.com", id: "keep-id", note: "本地" }),
    account({ email: "same@outlook.com", id: "same-id", billing: "unpaid", createdAt: "2026-01-01T00:00:00.000Z" }),
  ];
  const result = importAccounts(
    local,
    {
      app: "email-ledger",
      version: 1,
      accounts: [
        { email: "bad", usage: "usable", billing: "unpaid", password: "secret" },
        {
          email: "Same@Outlook.com",
          usage: "unusable",
          billing: "paid",
          unusableReason: "封".repeat(81),
          claudeRegisteredAt: "2999-01-01",
          emailRegisteredAt: "2026-02-31",
          note: "覆盖",
          checkedAt: "2026-11-02T00:00:00.000Z",
          password: "secret",
        },
        { email: "new@outlook.com", usage: "unknown", billing: "unpaid", id: "new-id" },
        { email: "new@outlook.com", usage: "usable", billing: "paid", id: "later-id" },
      ],
    },
    "2026-11-07T12:00:00.000Z",
    today,
  );

  assert.equal(result.ok, true);
  assert.equal(result.created, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.accounts.some((item) => item.email === "keep@outlook.com" && item.note === "本地"), true);

  const same = result.accounts.find((item) => item.email === "same@outlook.com");
  assert.equal(same.id, "same-id");
  assert.equal(same.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(same.billing, "paid");
  assert.equal(same.usage, "unusable");
  assert.equal(Array.from(same.unusableReason).length, 80);
  assert.equal(same.claudeRegisteredAt, "");
  assert.equal(same.emailRegisteredAt, "");
  assert.equal(same.note, "覆盖");
  assert.equal("password" in same, false);

  const created = result.accounts.find((item) => item.email === "new@outlook.com");
  assert.equal(created.usage, "usable");
  assert.equal(created.billing, "paid");
  assert.equal(created.id, "later-id");
});

test("不是本应用的备份文件会被整份拒绝", () => {
  const result = importAccounts([], { app: "other", version: 1, accounts: [] }, "2026-11-07T00:00:00.000Z", today);
  assert.deepEqual(result, { ok: false, error: "这不是 Email Ledger 的备份文件" });
});

test("导出不写入已经算出的天数", () => {
  const payload = exportPayload([account({ claudeRegisteredAt: "2026-10-01" })], "2026-11-07T00:00:00.000Z");
  assert.equal(payload.app, "email-ledger");
  assert.equal(payload.version, 1);
  assert.equal("nurtureDays" in payload.accounts[0], false);
});
