<script setup lang="ts">
import { ref } from 'vue'
import type { TreeNode } from '../types'

const props = defineProps<{
  nodes: TreeNode[]
  selectedPath: string | null
  depth?: number
}>()

const emit = defineEmits<{
  select: [path: string]
  selectFolder: [path: string]
  deleteFolder: [path: string]
}>()

const expanded = ref<Set<string>>(new Set())
const contextMenu = ref<{ x: number; y: number; target: TreeNode } | null>(null)

function toggle(name: string) {
  if (expanded.value.has(name)) {
    expanded.value.delete(name)
  } else {
    expanded.value.add(name)
  }
}

function isExpanded(name: string) {
  return expanded.value.has(name)
}

function select(path: string) {
  emit('select', path)
}

function onContextMenu(e: MouseEvent, node: TreeNode) {
  if (!node.isDir) return
  e.preventDefault()
  contextMenu.value = { x: e.clientX, y: e.clientY, target: node }
}

function closeContextMenu() {
  contextMenu.value = null
}

function confirmDeleteFolder() {
  if (contextMenu.value) {
    emit('deleteFolder', contextMenu.value.target.path)
  }
  contextMenu.value = null
}
</script>

<template>
  <div @click="closeContextMenu">
    <div v-for="node in nodes" :key="node.path">
      <div
        v-if="node.isDir"
        class="select-none"
        :style="{ paddingLeft: (depth ?? 0) * 12 + 'px' }"
      >
        <div
          class="flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm hover:bg-gray-800 text-gray-400 group"
          :class="{ 'text-blue-400': selectedPath?.startsWith(node.path + '/') }"
          @click="toggle(node.path); emit('selectFolder', node.path)"
          @contextmenu="onContextMenu($event, node)"
        >
          <span class="text-xs w-4">{{ isExpanded(node.path) ? '▼' : '▶' }}</span>
          <span>&#128193;</span>
          <span class="truncate flex-1">{{ node.name }}</span>
          <span
            class="text-xs text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
            title="Delete folder"
            @click.stop="emit('deleteFolder', node.path)"
          >&#10005;</span>
        </div>
        <div v-if="isExpanded(node.path)">
          <TreeView
            :nodes="node.children"
            :selectedPath="selectedPath"
            :depth="(depth ?? 0) + 1"
            @select="select"
            @selectFolder="(p: string) => emit('selectFolder', p)"
            @deleteFolder="(p: string) => emit('deleteFolder', p)"
          />
        </div>
      </div>

      <div
        v-else
        class="flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm hover:bg-gray-800"
        :class="{ 'bg-gray-800 text-blue-400': selectedPath === node.path }"
        :style="{ paddingLeft: ((depth ?? 0) * 12 + 16) + 'px' }"
        @click="select(node.path)"
      >
        <span class="text-gray-500">&#128274;</span>
        <span class="truncate">{{ node.name }}</span>
      </div>
    </div>

    <!-- Context menu -->
    <div
      v-if="contextMenu"
      class="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 text-sm"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <button
        class="w-full text-left px-4 py-2 hover:bg-gray-700 text-red-400 whitespace-nowrap"
        @click="confirmDeleteFolder"
      >
        Delete folder
      </button>
    </div>
  </div>
</template>
