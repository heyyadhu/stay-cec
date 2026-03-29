import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  saveMealSchedule,
  getWeeklyMealSchedule,
  getMealSchedules,
  mapMealTypeToSlot,
  parseLocalDateOnly,
  deleteMealSchedule
} from '../../data.js'
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from 'firebase/firestore'

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
  Timestamp: {
    now: vi.fn(() => ({ toMillis: () => Date.now() })),
    fromDate: vi.fn((date) => ({ toMillis: () => date.getTime() }))
  }
}))

vi.mock('../../firebase-config.js', () => ({
  db: {},
  storage: {}
}))

describe('Meal Schedule Module - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('mapMealTypeToSlot', () => {
    it('should map breakfast and brunch to breakfast slot', () => {
      expect(mapMealTypeToSlot('breakfast')).toBe('breakfast')
      expect(mapMealTypeToSlot('Breakfast')).toBe('breakfast')
      expect(mapMealTypeToSlot('BRUNCH')).toBe('breakfast')
      expect(mapMealTypeToSlot('brunch')).toBe('breakfast')
    })

    it('should map lunch, evening, and snack to lunch slot', () => {
      expect(mapMealTypeToSlot('lunch')).toBe('lunch')
      expect(mapMealTypeToSlot('Lunch')).toBe('lunch')
      expect(mapMealTypeToSlot('evening')).toBe('lunch')
      expect(mapMealTypeToSlot('Evening')).toBe('lunch')
      expect(mapMealTypeToSlot('snack')).toBe('lunch')
    })

    it('should map dinner to dinner slot', () => {
      expect(mapMealTypeToSlot('dinner')).toBe('dinner')
      expect(mapMealTypeToSlot('Dinner')).toBe('dinner')
    })

    it('should default unknown types to lunch', () => {
      expect(mapMealTypeToSlot('unknown')).toBe('lunch')
      expect(mapMealTypeToSlot('')).toBe('lunch')
      expect(mapMealTypeToSlot(null)).toBe('lunch')
    })
  })

  describe('parseLocalDateOnly', () => {
    it('should parse YYYY-MM-DD correctly', () => {
      const result = parseLocalDateOnly('2026-03-29')
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(2) // March = 2 (0-indexed)
      expect(result.getDate()).toBe(29)
    })

    it('should handle invalid dates', () => {
      expect(Number.isNaN(parseLocalDateOnly('invalid').getTime())).toBe(true)
      expect(Number.isNaN(parseLocalDateOnly('').getTime())).toBe(true)
      expect(Number.isNaN(parseLocalDateOnly(null).getTime())).toBe(true)
    })
  })

  describe('getMealSchedules', () => {
    it('should filter meals by date range correctly', async () => {
      const mockMeals = [
        { id: 'meal-1', date: '2026-03-24', type: 'breakfast', title: 'Poha' },
        { id: 'meal-2', date: '2026-03-25', type: 'lunch', title: 'Thali' },
        { id: 'meal-3', date: '2026-03-26', type: 'dinner', title: 'Biryani' },
        { id: 'meal-4', date: '2026-03-30', type: 'breakfast', title: 'Future meal' }
      ]
      
      getDocs.mockResolvedValue({
        docs: mockMeals.map(m => ({
          id: m.id,
          data: () => m
        }))
      })

      const result = await getMealSchedules('2026-03-24', '2026-03-26')

      expect(result).toHaveLength(3)
      expect(result.map(m => m.title)).toContain('Poha')
      expect(result.map(m => m.title)).toContain('Thali')
      expect(result.map(m => m.title)).toContain('Biryani')
      expect(result.map(m => m.title)).not.toContain('Future meal')
    })

    it('should handle meals with Timestamp dates', async () => {
      const mockDate = new Date('2026-03-29')
      const mockMeals = [
        { 
          id: 'meal-1', 
          date: { toDate: () => mockDate },
          type: 'breakfast', 
          title: 'Timestamp meal' 
        }
      ]
      
      getDocs.mockResolvedValue({
        docs: mockMeals.map(m => ({
          id: m.id,
          data: () => m
        }))
      })

      const result = await getMealSchedules('2026-03-24', '2026-03-31')
      
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Timestamp meal')
    })
  })

  describe('getWeeklyMealSchedule', () => {
    it('should organize meals by day and slot correctly', async () => {
      const mockMeals = [
        { id: 'bf-1', date: '2026-03-24', type: 'breakfast', title: 'Monday Breakfast' },
        { id: 'lu-1', date: '2026-03-24', type: 'lunch', title: 'Monday Lunch' },
        { id: 'di-1', date: '2026-03-24', type: 'dinner', title: 'Monday Dinner' },
        { id: 'bf-2', date: '2026-03-25', type: 'breakfast', title: 'Tuesday Breakfast' },
        { id: 'br-1', date: '2026-03-29', type: 'brunch', title: 'Sunday Brunch' }
      ]
      
      getDocs.mockResolvedValue({
        docs: mockMeals.map(m => ({
          id: m.id,
          data: () => m
        }))
      })

      const result = await getWeeklyMealSchedule('2026-03-23') // Monday of that week

      // Check Monday has all 3 meals
      expect(result['2026-03-24'].breakfast.title).toBe('Monday Breakfast')
      expect(result['2026-03-24'].lunch.title).toBe('Monday Lunch')
      expect(result['2026-03-24'].dinner.title).toBe('Monday Dinner')
      
      // Check Tuesday breakfast
      expect(result['2026-03-25'].breakfast.title).toBe('Tuesday Breakfast')
      
      // Check Sunday brunch maps to breakfast slot
      expect(result['2026-03-29'].breakfast.title).toBe('Sunday Brunch')
      
      // All slots should be initialized (null if no meal)
      expect(result['2026-03-24']).toHaveProperty('breakfast')
      expect(result['2026-03-24']).toHaveProperty('lunch')
      expect(result['2026-03-24']).toHaveProperty('dinner')
    })

    it('should return empty object for invalid week start date', async () => {
      const result = await getWeeklyMealSchedule('invalid-date')
      expect(result).toEqual({})
    })
  })

  describe('saveMealSchedule', () => {
    it('should create new meal when no id provided', async () => {
      addDoc.mockResolvedValue({ id: 'new-meal-id' })
      
      const mealData = {
        date: '2026-03-29',
        type: 'lunch',
        title: 'Test Meal',
        description: 'Test Description',
        imageUrl: 'http://example.com/image.jpg'
      }
      
      const result = await saveMealSchedule(mealData)
      
      expect(addDoc).toHaveBeenCalled()
      expect(result).toBe('new-meal-id')
    })

    it('should update existing meal when id provided', async () => {
      updateDoc.mockResolvedValue(undefined)
      
      const mealData = {
        id: 'existing-meal-id',
        date: '2026-03-29',
        type: 'dinner',
        title: 'Updated Meal',
        description: 'Updated Description',
        imageUrl: 'http://example.com/updated.jpg'
      }
      
      const result = await saveMealSchedule(mealData)
      
      expect(updateDoc).toHaveBeenCalled()
      expect(result).toBe('existing-meal-id')
    })

    it('should normalize meal type to slot', async () => {
      addDoc.mockResolvedValue({ id: 'new-id' })
      
      // Test that 'brunch' gets normalized to 'breakfast'
      await saveMealSchedule({
        date: '2026-03-29',
        type: 'brunch',
        title: 'Brunch Test',
        description: 'Test',
        imageUrl: 'http://test.jpg'
      })
      
      const addDocCall = addDoc.mock.calls[0]
      expect(addDocCall[1].type).toBe('breakfast')
    })
  })

  describe('deleteMealSchedule', () => {
    it('should delete meal by id', async () => {
      deleteDoc.mockResolvedValue(undefined)
      
      await deleteMealSchedule('meal-to-delete')
      
      expect(deleteDoc).toHaveBeenCalled()
    })
  })
})
