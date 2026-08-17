import { describe, expect, it } from 'vitest'
import { langOfLocale } from './locale'

describe('langOfLocale', () => {
  it('gives Korean desktops Korean', () => {
    expect(langOfLocale('ko')).toBe('ko')
    expect(langOfLocale('ko-KR')).toBe('ko')
    expect(langOfLocale('KO-kr')).toBe('ko')
  })

  it('falls back to English for everything else', () => {
    for (const locale of ['en-US', 'ja-JP', 'de', 'zh-Hans-CN', '', null, undefined]) {
      expect(langOfLocale(locale)).toBe('en')
    }
  })
})
