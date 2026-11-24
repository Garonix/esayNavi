import { onUnmounted } from 'vue'
import type { NavItem } from '../types/nav'
import {
  setDraggedCard,
  getDraggedCard,
  setDragHoverTarget,
  getDragHoverTarget,
  setFloatingCard,
  updateFloatingPointer,
  clearDragState
} from '../services/dragState'

/**
 * 40% / 60% 水平滞回索引计算（纯函数，便于单测验证）
 * 返回 null 表示落在中间死区（0.38 ~ 0.62），保持当前坑位不变以消除抖动
 */
export function computeHysteresisTargetIndex(ratio: number, currentItemIndex: number): number | null {
  if (ratio > 0.62) {
    return currentItemIndex + 1
  }
  if (ratio < 0.38) {
    return currentItemIndex
  }
  return null
}

// 共享单例指针坐标追踪（避免每个 CategorySection 实例重复绑定无法卸载的匿名全局监听器）
const sharedLastPointer = { x: 0, y: 0 }
let sharedTrackerRefCount = 0

function onSharedPointerTrack(e: PointerEvent) {
  sharedLastPointer.x = e.clientX
  sharedLastPointer.y = e.clientY
}

function retainPointerTracker() {
  if (typeof window === 'undefined') return
  if (sharedTrackerRefCount === 0) {
    window.addEventListener('pointerdown', onSharedPointerTrack, { passive: true, capture: true })
    window.addEventListener('pointermove', onSharedPointerTrack, { passive: true, capture: true })
  }
  sharedTrackerRefCount++
}

function releasePointerTracker() {
  if (typeof window === 'undefined') return
  sharedTrackerRefCount = Math.max(0, sharedTrackerRefCount - 1)
  if (sharedTrackerRefCount === 0) {
    window.removeEventListener('pointerdown', onSharedPointerTrack, { capture: true })
    window.removeEventListener('pointermove', onSharedPointerTrack, { capture: true })
  }
}

export interface GridReorderOptions {
  categoryId: () => string
  isReorderMode: () => boolean
  onStartReorder: (payload: { categoryId: string; item: NavItem }) => void
  onDragStartCard: (payload: { categoryId: string; item: NavItem; index: number }) => void
  onDragEndCard: () => void
  onDropCard: (payload: { targetCategoryId: string; targetIndex: number }) => void
}

/**
 * 网格卡片 Pointer 拖拽物理引擎与 40%/60% 滞回算法
 */
export function useGridReorder(options: GridReorderOptions) {
  retainPointerTracker()

  let dragStartPointerX = 0
  let dragStartPointerY = 0
  let lastPointerX = 0
  let lastPointerY = 0
  let isDragDeadzoneExceeded = false
  let isPointerDragging = false
  let lastReorderTime = 0
  let activePointerItem: NavItem | null = null
  let activePointerIndex = 0

  const performHitTest = (clientX: number, clientY: number) => {
    const currentDrag = getDraggedCard()
    if (!currentDrag || !options.isReorderMode()) return

    // 18px 挤占保护死区
    if (!isDragDeadzoneExceeded) {
      const dist = Math.hypot(clientX - dragStartPointerX, clientY - dragStartPointerY)
      if (dist < 18) return
      isDragDeadzoneExceeded = true
    }

    // 140ms FLIP 冷却锁
    const now = Date.now()
    if (now - lastReorderTime < 140) return

    const hitElement = document.elementFromPoint(clientX, clientY)
    if (!hitElement) return

    const cardEl = hitElement.closest('[data-reorder-card]') as HTMLElement | null
    if (cardEl) {
      if (cardEl.getAttribute('data-is-ghost') === 'true') return

      const targetCatId = cardEl.getAttribute('data-category-id')
      const targetCardId = cardEl.getAttribute('data-reorder-card')
      if (!targetCatId || !targetCardId) return

      const rect = cardEl.getBoundingClientRect()
      if (rect.width <= 0) return
      const ratio = (clientX - rect.left) / rect.width

      const sectionEl = cardEl.closest('[data-category-section-id]')
      if (!sectionEl) return
      const nonGhostCardEls = Array.from(
        sectionEl.querySelectorAll('[data-reorder-card]:not([data-is-ghost="true"])')
      )
      const targetItemIndex = nonGhostCardEls.findIndex(
        el => el.getAttribute('data-reorder-card') === targetCardId
      )
      if (targetItemIndex === -1) return

      const targetIndex = computeHysteresisTargetIndex(ratio, targetItemIndex)
      if (targetIndex === null) return

      const currentHover = getDragHoverTarget()
      if (!currentHover || currentHover.categoryId !== targetCatId || currentHover.index !== targetIndex) {
        lastReorderTime = now
        setDragHoverTarget({
          categoryId: targetCatId,
          index: targetIndex
        })
      }
      return
    }

    const sectionEl = hitElement.closest('[data-category-section-id]') as HTMLElement | null
    if (sectionEl) {
      const targetCatId = sectionEl.getAttribute('data-category-section-id')
      if (!targetCatId) return

      const currentHover = getDragHoverTarget()
      if (currentHover && currentHover.categoryId === targetCatId) return

      const nonGhostCardEls = Array.from(
        sectionEl.querySelectorAll('[data-reorder-card]:not([data-is-ghost="true"])')
      )
      lastReorderTime = now
      setDragHoverTarget({
        categoryId: targetCatId,
        index: nonGhostCardEls.length
      })
    }
  }

  const onGlobalScroll = () => {
    if (isPointerDragging) {
      performHitTest(lastPointerX, lastPointerY)
    }
  }

  const onGlobalPointerMove = (e: PointerEvent) => {
    lastPointerX = e.clientX
    lastPointerY = e.clientY

    if (!isPointerDragging) {
      const dist = Math.hypot(e.clientX - dragStartPointerX, e.clientY - dragStartPointerY)
      if (dist < 6) return

      isPointerDragging = true
      const catId = options.categoryId()

      if (activePointerItem) {
        setFloatingCard(activePointerItem, e.clientX, e.clientY)
        setDraggedCard({ categoryId: catId, item: activePointerItem, index: activePointerIndex })
        setDragHoverTarget({ categoryId: catId, index: activePointerIndex })
        options.onDragStartCard({ categoryId: catId, item: activePointerItem, index: activePointerIndex })
      }
    }

    if (isPointerDragging) {
      updateFloatingPointer(e.clientX, e.clientY)
      performHitTest(e.clientX, e.clientY)
    }
  }

  const detachDragListeners = () => {
    window.removeEventListener('pointermove', onGlobalPointerMove)
    window.removeEventListener('pointerup', onGlobalPointerUp)
    window.removeEventListener('pointercancel', onGlobalPointerUp)
    window.removeEventListener('scroll', onGlobalScroll)
  }

  const onGlobalPointerUp = () => {
    detachDragListeners()

    if (isPointerDragging) {
      const currentHover = getDragHoverTarget()
      const currentDrag = getDraggedCard()

      if (currentHover && currentDrag) {
        options.onDropCard({
          targetCategoryId: currentHover.categoryId,
          targetIndex: currentHover.index
        })
      }

      setFloatingCard(null)
      clearDragState()
      options.onDragEndCard()
    }

    isPointerDragging = false
    isDragDeadzoneExceeded = false
    activePointerItem = null
  }

  const attachDragListeners = () => {
    window.addEventListener('pointermove', onGlobalPointerMove, { passive: false })
    window.addEventListener('pointerup', onGlobalPointerUp)
    window.addEventListener('pointercancel', onGlobalPointerUp)
    window.addEventListener('scroll', onGlobalScroll, { passive: true })
  }

  const handleCardPointerDown = (e: PointerEvent, item: NavItem, index: number, isGhost: boolean) => {
    if (!options.isReorderMode() || isGhost) return
    if (e.button !== 0) return

    e.preventDefault()
    dragStartPointerX = e.clientX
    dragStartPointerY = e.clientY
    lastPointerX = e.clientX
    lastPointerY = e.clientY
    isDragDeadzoneExceeded = false
    isPointerDragging = false
    lastReorderTime = Date.now()
    activePointerItem = item
    activePointerIndex = index

    attachDragListeners()
  }

  const handleCardStartReorder = (item: NavItem, index: number) => {
    options.onStartReorder({ categoryId: options.categoryId(), item })

    dragStartPointerX = sharedLastPointer.x
    dragStartPointerY = sharedLastPointer.y
    lastPointerX = sharedLastPointer.x
    lastPointerY = sharedLastPointer.y
    isDragDeadzoneExceeded = false
    isPointerDragging = false
    lastReorderTime = Date.now()
    activePointerItem = item
    activePointerIndex = index

    attachDragListeners()
  }

  onUnmounted(() => {
    detachDragListeners()
    releasePointerTracker()
  })

  return {
    handleCardPointerDown,
    handleCardStartReorder
  }
}
