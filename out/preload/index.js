"use strict";
const electron = require("electron");
const api = {
  store: {
    list: (dir) => electron.ipcRenderer.invoke("store:list", dir),
    read: (path) => electron.ipcRenderer.invoke("store:read", path),
    write: (path, content) => electron.ipcRenderer.invoke("store:write", path, content),
    remove: (path) => electron.ipcRenderer.invoke("store:remove", path),
    mkdir: (dirPath) => electron.ipcRenderer.invoke("store:mkdir", dirPath),
    rmdir: (dirPath) => electron.ipcRenderer.invoke("store:rmdir", dirPath),
    readMeta: (path) => electron.ipcRenderer.invoke("store:readMeta", path),
    writeMeta: (path, data) => electron.ipcRenderer.invoke("store:writeMeta", path, data)
  },
  key: {
    generate: (name, email, passphrase) => electron.ipcRenderer.invoke("key:generate", name, email, passphrase),
    importKey: (armored) => electron.ipcRenderer.invoke("key:import", armored),
    unlock: (passphrase) => electron.ipcRenderer.invoke("key:unlock", passphrase),
    isSetup: () => electron.ipcRenderer.invoke("key:isSetup"),
    getKeyInfo: () => electron.ipcRenderer.invoke("key:getKeyInfo"),
    reset: () => electron.ipcRenderer.invoke("key:reset"),
    exportToGnuPG: () => electron.ipcRenderer.invoke("key:exportToGnuPG")
  },
  git: {
    init: (dir) => electron.ipcRenderer.invoke("git:init", dir),
    clone: (url) => electron.ipcRenderer.invoke("git:clone", url),
    status: () => electron.ipcRenderer.invoke("git:status"),
    pull: () => electron.ipcRenderer.invoke("git:pull"),
    push: () => electron.ipcRenderer.invoke("git:push"),
    commit: (message) => electron.ipcRenderer.invoke("git:commit", message),
    getRemote: () => electron.ipcRenderer.invoke("git:getRemote"),
    setRemote: (url) => electron.ipcRenderer.invoke("git:setRemote", url),
    hasRepo: () => electron.ipcRenderer.invoke("git:hasRepo"),
    branch: () => electron.ipcRenderer.invoke("git:branch")
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
