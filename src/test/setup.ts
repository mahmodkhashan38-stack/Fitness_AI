import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { installMatchMedia } from '@/test/match-media'

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
  installMatchMedia(false)
})

afterEach(() => {
  cleanup()
})
