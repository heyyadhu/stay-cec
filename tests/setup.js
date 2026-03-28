// Test setup file
import { vi } from 'vitest'

// Mock Firebase
vi.mock('./firebase-config.js', () => ({
  auth: {},
  db: {},
  app: {},
  onAuthStateChanged: vi.fn()
}))

// Mock window.location
Object.defineProperty(window, 'location', {
  writable: true,
  value: { href: '' }
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
})
