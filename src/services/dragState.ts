import { ref } from 'vue'
import type { NavItem } from '../types/nav'

export interface DraggedItemInfo {
  categoryId: string
  item: NavItem
  index: number
}

export interface DragHoverTarget {
  categoryId: string
  index: number
}

// 全局响应式与即时共享的拖拽状态
export const activeDraggedCard = ref<DraggedItemInfo | null>(null)
export const dragHoverTarget = ref<DragHoverTarget | null>(null)

export function setDraggedCard(info: DraggedItemInfo | null) {
  activeDraggedCard.value = info
}

export function getDraggedCard(): DraggedItemInfo | null {
  return activeDraggedCard.value
}

export function setDragHoverTarget(target: DragHoverTarget | null) {
  dragHoverTarget.value = target
}

export function getDragHoverTarget(): DragHoverTarget | null {
  return dragHoverTarget.value
}

export function clearDragState() {
  activeDraggedCard.value = null
  dragHoverTarget.value = null
}
