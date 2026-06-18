"use strict";
const electron = require("electron");
const path = require("path");
const promises = require("fs/promises");
const openpgp = require("openpgp");
const child_process = require("child_process");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const openpgp__namespace = /* @__PURE__ */ _interopNamespaceDefault(openpgp);
async function generateKey(name, email, passphrase) {
  const key = await openpgp__namespace.generateKey({
    userIDs: [{ name, email }],
    type: "rsa",
    rsaBits: 4096,
    passphrase
  });
  return key;
}
async function readPrivateKey(armored) {
  return await openpgp__namespace.readPrivateKey({ armoredKey: armored });
}
async function decryptKey(privateKey, passphrase) {
  return await openpgp__namespace.decryptKey({ privateKey, passphrase });
}
async function encryptText(text, publicKeys) {
  const message = await openpgp__namespace.createMessage({ text });
  const encrypted = await openpgp__namespace.encrypt({
    message,
    encryptionKeys: publicKeys
  });
  return encrypted;
}
async function decryptText(armored, privateKey) {
  const message = await openpgp__namespace.readMessage({ armoredMessage: armored });
  const { data } = await openpgp__namespace.decrypt({
    message,
    decryptionKeys: [privateKey]
  });
  return data;
}
function getPublicKey(privateKey) {
  return privateKey.toPublic();
}
function getFingerprint(key) {
  return key.getFingerprint();
}
function getUserIds(key) {
  return key.getUserIDs().map((uid) => {
    const match = uid.match(/^(.*?)\s*<(.*?)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2] };
    }
    return { name: uid, email: "" };
  });
}
function passDir$2() {
  return path.join(electron.app.getPath("home"), ".password-store");
}
function keyFile() {
  return path.join(passDir$2(), ".gpg-key.asc");
}
function gpgIdFile() {
  return path.join(passDir$2(), ".gpg-id");
}
let unlockedPrivateKey = null;
let unlockedPublicKey = null;
function getUnlockedPrivateKey() {
  return unlockedPrivateKey;
}
function getUnlockedPublicKey() {
  return unlockedPublicKey;
}
function registerKeyHandlers() {
  electron.ipcMain.handle("key:isSetup", async () => {
    try {
      await promises.access(keyFile());
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("key:generate", async (_event, name, email, passphrase) => {
    const key = await generateKey(name, email, passphrase);
    const privKey = await readPrivateKey(key.privateKey);
    const fingerprint = getFingerprint(privKey);
    await promises.mkdir(passDir$2(), { recursive: true });
    await promises.writeFile(keyFile(), key.privateKey, "utf-8");
    await promises.writeFile(gpgIdFile(), fingerprint, "utf-8");
    const decrypted = await decryptKey(privKey, passphrase);
    const pubKey = getPublicKey(decrypted);
    await encryptText("ping", [pubKey]);
    unlockedPrivateKey = decrypted;
    unlockedPublicKey = pubKey;
    return key.privateKey;
  });
  electron.ipcMain.handle("key:import", async (_event, armored) => {
    const privKey = await readPrivateKey(armored);
    const fingerprint = getFingerprint(privKey);
    await promises.mkdir(passDir$2(), { recursive: true });
    await promises.writeFile(keyFile(), armored, "utf-8");
    await promises.writeFile(gpgIdFile(), fingerprint, "utf-8");
    return fingerprint;
  });
  electron.ipcMain.handle("key:reset", async () => {
    unlockedPrivateKey = null;
    unlockedPublicKey = null;
    try {
      await promises.rm(keyFile(), { force: true });
    } catch {
    }
    try {
      await promises.rm(gpgIdFile(), { force: true });
    } catch {
    }
  });
  electron.ipcMain.handle("key:unlock", async (_event, passphrase) => {
    try {
      const data = await promises.readFile(keyFile(), "utf-8");
      const privKey = await readPrivateKey(data);
      const decrypted = await decryptKey(privKey, passphrase);
      if (!decrypted.isDecrypted()) return false;
      const pubKey = getPublicKey(decrypted);
      await encryptText("ping", [pubKey]);
      unlockedPrivateKey = decrypted;
      unlockedPublicKey = pubKey;
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("key:exportToGnuPG", async () => {
    if (!unlockedPrivateKey) return false;
    try {
      const armored = unlockedPrivateKey.armor();
      await new Promise((resolve, reject) => {
        const proc = child_process.execFile("gpg", ["--import"], { input: armored }, (err) => {
          err ? reject(err) : resolve();
        });
      });
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("key:getKeyInfo", async () => {
    if (!unlockedPrivateKey) return null;
    return {
      id: unlockedPrivateKey.getKeyID().toHex(),
      fingerprint: getFingerprint(unlockedPrivateKey),
      userIds: getUserIds(unlockedPrivateKey)
    };
  });
}
function passDir$1() {
  return path.join(electron.app.getPath("home"), ".password-store");
}
function metaPath(gpgPath) {
  return gpgPath.replace(/\.gpg$/, "").replace(/\\/g, "/") + ".meta.json";
}
async function listRecursive(dir, baseDir) {
  const entries = [];
  try {
    const items = await promises.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith(".")) continue;
      if (item.name.endsWith(".meta.json")) continue;
      const fullPath = path.join(dir, item.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      if (item.isDirectory()) {
        entries.push({ name: item.name, path: relPath, isDir: true });
        entries.push(...await listRecursive(fullPath, baseDir));
      } else if (item.name.endsWith(".gpg") && !item.name.startsWith(".")) {
        const name = item.name.slice(0, -4);
        entries.push({ name, path: relPath, isDir: false });
      }
    }
  } catch {
  }
  return entries;
}
function registerStoreHandlers() {
  electron.ipcMain.handle("store:list", async (_event, dir) => {
    const root = passDir$1();
    const targetDir = dir ? path.join(root, dir) : root;
    return await listRecursive(targetDir, root);
  });
  electron.ipcMain.handle("store:read", async (_event, path$1) => {
    const root = passDir$1();
    const fullPath = path.join(root, path$1);
    const armored = await promises.readFile(fullPath, "utf-8");
    const privKey = getUnlockedPrivateKey();
    if (!privKey) throw new Error("Key not unlocked");
    return await decryptText(armored, privKey);
  });
  electron.ipcMain.handle("store:write", async (_event, path$1, content) => {
    const root = passDir$1();
    const fullPath = path.join(root, path$1);
    const pubKey = getUnlockedPublicKey();
    if (!pubKey) throw new Error("Key not unlocked");
    const encrypted = await encryptText(content, [pubKey]);
    await promises.mkdir(path.dirname(fullPath), { recursive: true });
    await promises.writeFile(fullPath, encrypted, "utf-8");
  });
  electron.ipcMain.handle("store:remove", async (_event, path$1) => {
    const root = passDir$1();
    const fullPath = path.join(root, path$1);
    await promises.unlink(fullPath);
    const metaFull = path.join(root, metaPath(path$1));
    await promises.rm(metaFull, { force: true });
  });
  electron.ipcMain.handle("store:mkdir", async (_event, dirPath) => {
    const root = passDir$1();
    const fullPath = path.join(root, dirPath);
    await promises.mkdir(fullPath, { recursive: true });
  });
  electron.ipcMain.handle("store:rmdir", async (_event, dirPath) => {
    const root = passDir$1();
    const fullPath = path.join(root, dirPath);
    await promises.rm(fullPath, { recursive: true, force: true });
  });
  electron.ipcMain.handle("store:readMeta", async (_event, path$1) => {
    const root = passDir$1();
    const fullPath = path.join(root, metaPath(path$1));
    try {
      const data = await promises.readFile(fullPath, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  });
  electron.ipcMain.handle("store:writeMeta", async (_event, path$1, data) => {
    const root = passDir$1();
    const fullPath = path.join(root, metaPath(path$1));
    await promises.mkdir(path.dirname(fullPath), { recursive: true });
    await promises.writeFile(fullPath, JSON.stringify(data, null, 2), "utf-8");
  });
}
const GIT_ENV = {
  GIT_AUTHOR_NAME: "pass-manager",
  GIT_AUTHOR_EMAIL: "pass@local",
  GIT_COMMITTER_NAME: "pass-manager",
  GIT_COMMITTER_EMAIL: "pass@local"
};
function git(args, cwd) {
  return new Promise((resolve, reject) => {
    child_process.execFile("git", args, { cwd, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, ...GIT_ENV } }, (err, stdout, stderr) => {
      if (err) {
        const details = (stderr?.trim() || stdout?.trim() || err.stderr?.trim() || err.stdout?.trim() || err.message || String(err)).slice(0, 500);
        reject(new Error(details));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}
async function initRepo(dir) {
  await git(["init", dir], dir);
}
async function cloneRepo(url, dir) {
  await git(["clone", url, dir], process.cwd());
}
async function getStatus(dir) {
  const modified = [];
  const added = [];
  const deleted = [];
  let ahead = 0;
  let behind = 0;
  try {
    const out = await git(["status", "--porcelain"], dir);
    for (const line of out.split("\n")) {
      if (!line.trim()) continue;
      const status = line.slice(0, 2);
      const filepath = line.slice(3);
      if (filepath === ".gpg-key.asc") continue;
      if (status.includes("?")) added.push(filepath);
      else if (status.startsWith("D") || status[1] === "D") deleted.push(filepath);
      else modified.push(filepath);
    }
  } catch {
  }
  try {
    const local = await git(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], dir);
    const parts = local.split("	");
    if (parts.length === 2) {
      behind = parseInt(parts[0]) || 0;
      ahead = parseInt(parts[1]) || 0;
    }
  } catch {
  }
  return { modified, added, deleted, ahead, behind };
}
async function addAll(dir) {
  await git(["add", "-A"], dir);
}
async function commit(dir, message) {
  await git(["commit", "-m", message], dir);
}
async function pull(dir) {
  await git(["pull", "--ff-only", "--rebase=false"], dir);
}
async function push(dir) {
  await git(["push"], dir);
}
async function getRemotes(dir) {
  try {
    const out = await git(["remote", "-v"], dir);
    const remotes = [];
    for (const line of out.split("\n")) {
      const parts = line.match(/^(\S+)\s+(\S+)/);
      if (parts) {
        const exists = remotes.find((r) => r.remote === parts[1]);
        if (!exists) {
          remotes.push({ remote: parts[1], url: parts[2] });
        }
      }
    }
    return remotes;
  } catch {
    return [];
  }
}
async function setRemoteUrl(dir, url) {
  const existing = await getRemotes(dir);
  if (existing.find((r) => r.remote === "origin")) {
    await git(["remote", "set-url", "origin", url], dir);
  } else {
    await git(["remote", "add", "origin", url], dir);
  }
}
async function hasGitRepo(dir) {
  try {
    await git(["rev-parse", "--git-dir"], dir);
    return true;
  } catch {
    return false;
  }
}
async function currentBranch(dir) {
  try {
    return await git(["rev-parse", "--abbrev-ref", "HEAD"], dir);
  } catch {
    return null;
  }
}
function passDir() {
  return path.join(electron.app.getPath("home"), ".password-store");
}
function friendlyError(e) {
  const msg = String(e);
  if (msg.includes("fast-forward") || msg.includes("Not possible"))
    return "Your local and remote have diverged. Pull manually via terminal or back up your changes.";
  if (msg.includes("401") || msg.includes("403"))
    return "Authentication failed. Set up your SSH key or git credential helper.";
  if (msg.includes("Could not read from remote"))
    return "Could not connect to remote. Check your SSH key and remote URL.";
  return msg.slice(0, 300);
}
function registerGitHandlers() {
  electron.ipcMain.handle("git:init", async () => {
    try {
      await initRepo(passDir());
      await addAll(passDir());
      await commit(passDir(), "Initial commit");
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  });
  electron.ipcMain.handle("git:clone", async (_event, url) => {
    try {
      await cloneRepo(url, passDir());
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  });
  electron.ipcMain.handle("git:status", async () => {
    try {
      return await getStatus(passDir());
    } catch {
      return { modified: [], added: [], deleted: [], ahead: 0, behind: 0 };
    }
  });
  electron.ipcMain.handle("git:pull", async () => {
    try {
      await pull(passDir());
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  });
  electron.ipcMain.handle("git:push", async () => {
    try {
      await push(passDir());
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  });
  electron.ipcMain.handle("git:commit", async (_event, message) => {
    try {
      await addAll(passDir());
      await commit(passDir(), message);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  });
  electron.ipcMain.handle("git:getRemote", async () => {
    try {
      const remotes = await getRemotes(passDir());
      return remotes.find((r) => r.remote === "origin")?.url ?? null;
    } catch {
      return null;
    }
  });
  electron.ipcMain.handle("git:setRemote", async (_event, url) => {
    try {
      await setRemoteUrl(passDir(), url);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  });
  electron.ipcMain.handle("git:hasRepo", async () => {
    return await hasGitRepo(passDir());
  });
  electron.ipcMain.handle("git:branch", async () => {
    return await currentBranch(passDir());
  });
}
let mainWindow = null;
let isQuitting = false;
function createWindow() {
  const iconPath = path.join(__dirname, "../../build/icon.png");
  mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true
    },
    show: false,
    titleBarStyle: "hiddenInset"
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
async function autoCommitOnClose() {
  const dir = path.join(electron.app.getPath("home"), ".password-store");
  try {
    const isRepo = await hasGitRepo(dir);
    if (!isRepo) return;
    const status = await getStatus(dir);
    const hasChanges = status.modified.length > 0 || status.added.length > 0 || status.deleted.length > 0;
    if (!hasChanges) return;
    await addAll(dir);
    await commit(dir, "Se cerró sin guardar cambios");
    await push(dir);
  } catch {
  }
}
electron.app.whenReady().then(() => {
  registerStoreHandlers();
  registerKeyHandlers();
  registerGitHandlers();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("before-quit", async (event) => {
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  await autoCommitOnClose();
  electron.app.quit();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
