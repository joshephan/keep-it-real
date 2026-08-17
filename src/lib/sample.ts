import type { Item, Lang } from '../types'
import { addDays } from './date'

/**
 * Sample data, laid out relative to today so the drift case is always visible:
 * the "portfolio" plan ran 07-06 → 08-14 but actually shipped 17 days early.
 */
export function sampleItems(today: string, lang: Lang): Item[] {
  const d = (offset: number): string => addDays(today, offset)
  const ko = lang === 'ko'

  const make = (
    id: string,
    kind: Item['kind'],
    title: string,
    cat: Item['cat'],
    startOffset: number,
    endOffset: number,
    extra: Partial<Item> = {},
  ): Item => ({
    id,
    kind,
    title,
    cat,
    start: d(startOffset),
    end: d(endOffset),
    note: '',
    done: false,
    actualId: null,
    sourceId: null,
    deleted: false,
    deletedAt: null,
    ...extra,
  })

  const T = ko
    ? {
        portfolio: '포트폴리오 리뉴얼',
        release: 'OSS 첫 릴리스',
        checkup: '건강검진 예약',
        workation: '제주 워케이션',
        resume: '이력서 업데이트',
        rust: 'Rust 입문 스터디',
        design: '디자인 시스템 정리',
        running: '러닝 10km',
        retro: '팀 회고',
        backup: '데이터 백업 스크립트',
        subscriptions: '구독 정리',
      }
    : {
        portfolio: 'Portfolio revamp',
        release: 'First OSS release',
        checkup: 'Book health checkup',
        workation: 'Jeju workation',
        resume: 'Update résumé',
        rust: 'Intro to Rust study',
        design: 'Design system cleanup',
        running: '10km run',
        retro: 'Team retro',
        backup: 'Backup script',
        subscriptions: 'Cancel subscriptions',
      }

  return [
    make('kir-p1', 'plan', T.portfolio, 'work', -42, -3, { done: true, actualId: 'kir-a1' }),
    make('kir-a1', 'actual', T.portfolio, 'work', -28, -20, { sourceId: 'kir-p1' }),
    make('kir-p2', 'plan', T.release, 'work', 7, 18),
    make('kir-p3', 'plan', T.checkup, 'health', 3, 3),
    make('kir-p4', 'plan', T.workation, 'life', 28, 34),
    make('kir-p5', 'plan', T.resume, 'work', 49, 53),
    make('kir-p6', 'plan', T.rust, 'study', -7, 11),
    make('kir-a2', 'actual', T.design, 'work', -7, -4),
    make('kir-a3', 'actual', T.running, 'health', -1, -1),
    make('kir-a4', 'actual', T.retro, 'etc', -56, -54),
    make('kir-a5', 'actual', T.backup, 'study', 15, 17),
    make('kir-d1', 'plan', T.subscriptions, 'etc', -33, -33, {
      deleted: true,
      deletedAt: d(-18),
    }),
  ]
}
