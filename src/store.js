import { isStoredAccount } from "./model.js";

const PREFIX = "acc:";
const LOCAL_KEY = "email-ledger:v1";

export function createStore() {
  const listeners = new Set();
  const area = globalThis.chrome?.storage?.sync || null;

  function notify(accounts) {
    for (const listener of listeners) listener(accounts);
  }

  async function load() {
    if (!area) return readLocal();
    const all = await area.get(null);
    return Object.entries(all)
      .filter(([key]) => key.startsWith(PREFIX))
      .map(([, value]) => value)
      .filter(isStoredAccount)
      .map((account) => ({ ...account }));
  }

  async function saveAccount(account, accounts) {
    const next = accounts.some((item) => item.id === account.id)
      ? accounts.map((item) => (item.id === account.id ? account : item))
      : [...accounts, account];
    await write(next, [account]);
    return next.map((item) => ({ ...item }));
  }

  async function deleteAccount(id, accounts) {
    const next = accounts.filter((account) => account.id !== id);
    if (!area) {
      writeLocal(next);
      return next;
    }
    try {
      await area.remove(`${PREFIX}${id}`);
    } catch (error) {
      throw storageError(error);
    }
    return next.map((account) => ({ ...account }));
  }

  async function saveImported(accounts, changed) {
    await write(accounts, changed);
    return accounts.map((account) => ({ ...account }));
  }

  function subscribe(listener) {
    listeners.add(listener);
    if (area && globalThis.chrome?.storage?.onChanged) {
      const onChanged = (changes, areaName) => {
        if (areaName !== "sync") return;
        if (!Object.keys(changes).some((key) => key.startsWith(PREFIX))) return;
        load()
          .then(listener)
          .catch(() => {});
      };
      chrome.storage.onChanged.addListener(onChanged);
      return () => {
        listeners.delete(listener);
        chrome.storage.onChanged.removeListener(onChanged);
      };
    }

    const onStorage = (event) => {
      if (event.key === LOCAL_KEY) listener(readLocal());
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  }

  async function write(accounts, changed) {
    if (!area) {
      writeLocal(accounts);
      return;
    }
    if (changed.length === 0) return;
    try {
      await area.set(Object.fromEntries(changed.map((account) => [`${PREFIX}${account.id}`, account])));
    } catch (error) {
      throw storageError(error);
    }
  }

  function writeLocal(accounts) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(accounts));
    notify(accounts.map((account) => ({ ...account })));
  }

  return { load, saveAccount, deleteAccount, saveImported, subscribe };
}

function readLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredAccount).map((account) => ({ ...account }));
  } catch {
    return [];
  }
}

function storageError(error) {
  const message = String(error?.message || error || "");
  if (message.toUpperCase().includes("QUOTA")) return new Error("同步空间已满，这条没有保存。");
  return new Error("没有保存，请再试一次。");
}
