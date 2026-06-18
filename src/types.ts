export interface ListEntry {
  name: string
  path: string
  isDir: boolean
}

export interface KeyInfo {
  id: string
  fingerprint: string
  userIds: { name: string; email: string }[]
}

export interface GitStatus {
  modified: string[]
  added: string[]
  deleted: string[]
  ahead: number
  behind: number
}

export interface TreeNode {
  name: string
  path: string
  isDir: boolean
  children: TreeNode[]
}

export interface EntryMeta {
  url?: string
  user?: string
  notes?: string
}
