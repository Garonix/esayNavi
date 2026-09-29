import { ref } from 'vue'
import type { NavItem } from '../types/nav'

export interface DraggedItemInfo {
  categoryId: string
  item: NavItem
  index: number
}

// 全局响应式与即时共享的拖拽状态
export const activeDraggedCard = ref<DraggedItemInfo | null>(null)

export function setDraggedCard(info: DraggedItemInfo | null) {
  activeDraggedCard.value = info
}

export function getDraggedCard(): DraggedItemInfo | null {
  return activeDraggedCard.value
}
