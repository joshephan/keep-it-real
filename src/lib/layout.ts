import type { Item } from '../types'
import type { Axis } from './axis'
import { LANE_PAD_BOTTOM, ROW_PITCH } from '../tokens'

export interface Box {
  item: Item
  left: number
  width: number
  lane: number
}

const MIN_BAR_WIDTH = 52
const LANE_GAP = 6

/**
 * Greedy lane packing: bars are sorted by left edge and dropped into the first
 * lane whose previous bar ends at least `LANE_GAP` before this one starts.
 */
export function layoutBars(list: Item[], axis: Axis): { boxes: Box[]; laneCount: number } {
  const boxes: Box[] = list
    .map((item) => {
      const l = axis.colIndex(item.start) * axis.colW
      const r = (axis.colIndex(item.end || item.start) + 1) * axis.colW
      const left = Math.max(0, l) + 4
      const width = Math.max(MIN_BAR_WIDTH, Math.min(axis.total, r) - Math.max(0, l) - 8)
      return { item, left, width, lane: 0 }
    })
    .sort((a, b) => a.left - b.left)

  const laneEnds: number[] = []
  for (const box of boxes) {
    let i = 0
    while (i < laneEnds.length && laneEnds[i] > box.left - LANE_GAP) i++
    laneEnds[i] = box.left + box.width
    box.lane = i
  }

  return { boxes, laneCount: laneEnds.length }
}

export function laneHeight(laneCount: number): number {
  return Math.max(1, laneCount) * ROW_PITCH + LANE_PAD_BOTTOM
}
