import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  updateStudentFees, 
  signUp, 
  signIn, 
  logOut, 
  getStudentProfile, 
  updateStudentProfile,
  requireAuth,
  getCurrentUser 
} from '../../auth.js'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth'
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc 
} from 'firebase/firestore'

// Mock Firebase modules
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn()
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined)
  })),
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
  Timestamp: {
    now: vi.fn(() => ({ toMillis: () => Date.now() })),
    fromDate: vi.fn((date) => ({ toMillis: () => date.getTime() }))
  }
}))

vi.mock('../../firebase-config.js', () => ({
  auth: { currentUser: { uid: 'test-user-123' } },
  db: {},
  app: {},
  onAuthStateChanged: vi.fn()
}))

describe('Auth Module - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.href = ''
  })

  describe('updateStudentFees', () => {
    it('should update student fee status to Paid', async () => {
      const mockUid = 'test-uid-123'
      
      await updateStudentFees(mockUid)
      
      expect(updateDoc).toHaveBeenCalled()
      const updateDocCall = updateDoc.mock.calls[0]
      expect(updateDocCall[1]).toMatchObject({
        outstandingAmount: 0,
        feeStatus: 'Paid',
        lastPaymentDate: 'mock-timestamp'
      })
    })
  })

  describe('signUp', () => {
    it('should create user and save profile to Firestore', async () => {
      const mockUser = { uid: 'new-user-123', email: 'test@example.com' }
      const mockCred = { user: mockUser }
      createUserWithEmailAndPassword.mockResolvedValue(mockCred)
      setDoc.mockResolvedValue(undefined)

      const profileData = {
        fullName: 'John Doe',
        registerNumber: '2024CS101',
        department: 'cs',
        phone: '+91 9876543210',
        role: 'student',
        gender: 'male'
      }

      const result = await signUp('test@example.com', 'password123', profileData)

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(), 
        'test@example.com', 
        'password123'
      )
      expect(setDoc).toHaveBeenCalled()
      const setDocCall = setDoc.mock.calls[0]
      expect(setDocCall[1]).toMatchObject({
        fullName: 'John Doe',
        email: 'test@example.com',
        role: 'student',
        gender: 'male',
        createdAt: 'mock-timestamp'
      })
      expect(result).toEqual(mockUser)
    })

    it('should handle signup errors', async () => {
      const error = new Error('Email already in use')
      error.code = 'auth/email-already-in-use'
      createUserWithEmailAndPassword.mockRejectedValue(error)

      await expect(signUp('test@example.com', 'password123', {}))
        .rejects.toThrow('Email already in use')
    })
  })

  describe('signIn', () => {
    it('should sign in existing user', async () => {
      const mockUser = { uid: 'existing-user-123', email: 'test@example.com' }
      signInWithEmailAndPassword.mockResolvedValue({ user: mockUser })

      const result = await signIn('test@example.com', 'password123')

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'password123'
      )
      expect(result).toEqual(mockUser)
    })

    it('should handle invalid credentials', async () => {
      const error = new Error('Invalid password')
      error.code = 'auth/wrong-password'
      signInWithEmailAndPassword.mockRejectedValue(error)

      await expect(signIn('test@example.com', 'wrongpass'))
        .rejects.toThrow('Invalid password')
    })
  })

  describe('logOut', () => {
    it('should sign out and redirect to index.html', async () => {
      signOut.mockResolvedValue(undefined)

      await logOut()

      expect(signOut).toHaveBeenCalledWith(expect.anything())
      expect(window.location.href).toBe('index.html')
    })
  })

  describe('getStudentProfile', () => {
    it('should return student profile when found', async () => {
      const mockProfile = {
        fullName: 'John Doe',
        email: 'test@example.com',
        role: 'student'
      }
      getDoc.mockResolvedValue({
        exists: () => true,
        id: 'student-123',
        data: () => mockProfile
      })

      const result = await getStudentProfile('student-123')

      expect(result).toEqual({
        id: 'student-123',
        ...mockProfile
      })
    })

    it('should return null when profile not found', async () => {
      getDoc.mockResolvedValue({
        exists: () => false
      })

      const result = await getStudentProfile('nonexistent-uid')

      expect(result).toBeNull()
    })
  })

  describe('updateStudentProfile', () => {
    it('should throw error if not authenticated', async () => {
      // Mock auth.currentUser as null
      const { auth } = await import('../../firebase-config.js')
      auth.currentUser = null

      await expect(updateStudentProfile({ fullName: 'New Name' }))
        .rejects.toThrow('Not authenticated')
    })
  })
})
