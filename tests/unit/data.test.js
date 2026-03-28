import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getRecentComplaints,
  getUpcomingMeetings,
  getWardenStats,
  getAllComplaints,
  getAllResidents,
  getResidentStats,
  calculateAndSetMonthlyFee,
  calcMessSaving,
  verifyPayment,
  getTransactionHistory,
  createComplaint,
  updateComplaintStatus,
  getComplaints,
  getComplaintStats,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  sendWardenAnnouncement,
  getTargetAudienceCount,
  submitMessReduction,
  getMessReductions,
  updateMessReductionStatus,
  getPendingRegistrations,
  updateRegistrationStatus,
  getHeadWardenStats,
  getRecentActivity,
  getMessManagerStats,
  getStudentDirectory,
  getReportData
} from '../../data.js'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  writeBatch,
  doc
} from 'firebase/firestore'

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
  db: {},
  auth: { currentUser: { uid: 'test-user-123' } }
}))

describe('Data Module - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Fee Calculation Engine', () => {
    it('calcMessSaving should calculate correct saving amount', () => {
      const periods = [
        { from: '2024-01-01', to: '2024-01-05' },
        { from: '2024-01-10', to: '2024-01-12' }
      ]
      
      const result = calcMessSaving(periods)
      
      // 5 days + 3 days = 8 days × ₹110 = ₹880
      expect(result).toBe(880)
    })

    it('calcMessSaving should return 0 for empty periods', () => {
      expect(calcMessSaving([])).toBe(0)
      expect(calcMessSaving(null)).toBe(0)
      expect(calcMessSaving(undefined)).toBe(0)
    })

    it('calcMessSaving should handle invalid dates gracefully', () => {
      const periods = [
        { from: '', to: '' },
        { from: '2024-01-01', to: '2024-01-03' }
      ]
      
      const result = calcMessSaving(periods)
      
      // Should only count valid period (3 days × ₹110 = ₹330)
      expect(result).toBe(330)
    })
  })

  describe('Complaint Functions', () => {
    it('createComplaint should create complaint with student data', async () => {
      const mockProfile = {
        fullName: 'John Doe',
        registerNumber: '2024CS101',
        room: 'A-101'
      }
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProfile
      })
      addDoc.mockResolvedValue({ id: 'complaint-123' })

      const result = await createComplaint('student-123', {
        title: 'Water Issue',
        description: 'No water in room',
        category: 'Maintenance'
      })

      expect(result).toBe('complaint-123')
      expect(addDoc).toHaveBeenCalledTimes(2) // complaint + notification
    })

    it('createComplaint should throw error if student not found', async () => {
      getDoc.mockResolvedValue({
        exists: () => false
      })

      await expect(createComplaint('invalid-uid', {
        title: 'Test',
        description: 'Test',
        category: 'General'
      })).rejects.toThrow('Student profile not found')
    })

    it('updateComplaintStatus should update status and notify student', async () => {
      updateDoc.mockResolvedValue(undefined)
      addDoc.mockResolvedValue({ id: 'notif-123' })

      await updateComplaintStatus('complaint-123', 'Resolved', 'student-123')

      expect(updateDoc).toHaveBeenCalled()
      const updateDocCall = updateDoc.mock.calls[0]
      expect(updateDocCall[1]).toMatchObject({ status: 'Resolved', updatedAt: 'mock-timestamp' })
      
      expect(addDoc).toHaveBeenCalled()
      const addDocCall = addDoc.mock.calls[0]
      expect(addDocCall[1]).toMatchObject({
        uid: 'student-123',
        title: 'Complaint Status Updated',
        message: 'Your complaint has been marked as "Resolved".'
      })
    })
  })

  describe('Payment Functions', () => {
    it('verifyPayment should validate 12-digit UTR', async () => {
      await expect(verifyPayment('uid-123', '12345', 1000))
        .rejects.toThrow('Invalid UTR: must be exactly 12 digits')
      
      await expect(verifyPayment('uid-123', '1234567890123', 1000))
        .rejects.toThrow('Invalid UTR: must be exactly 12 digits')
    })

    it('verifyPayment should check for duplicate UTR', async () => {
      setDoc.mockImplementation((ref) => {
        const id = ref.id || ref.path
        if (id.includes('existing-utr')) {
          return Promise.resolve()
        }
      })
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ uid: 'uid-123', utr: '123456789012', amount: 1000 })
      })

      await expect(verifyPayment('uid-123', '123456789012', 1000))
        .rejects.toThrow('This UTR number has already been used')
    })

    it('verifyPayment should process valid payment', async () => {
      getDoc.mockResolvedValue({ exists: () => false })
      setDoc.mockResolvedValue(undefined)
      updateDoc.mockResolvedValue(undefined)
      addDoc.mockResolvedValue({ id: 'notif-123' })

      const result = await verifyPayment('uid-123', '987654321012', 12000)

      expect(result).toHaveProperty('txId')
      expect(result.txId).toMatch(/^CEC-\d{5}$/)
      expect(updateDoc).toHaveBeenCalled()
      const updateDocCall = updateDoc.mock.calls[0]
      expect(updateDocCall[1]).toMatchObject({
        feeStatus: 'Paid',
        outstandingAmount: 0
      })
    })
  })

  describe('Mess Reduction Functions', () => {
    it('submitMessReduction should validate periods', async () => {
      const mockProfile = { fullName: 'John Doe', registerNumber: '2024CS101' }
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProfile
      })

      await expect(submitMessReduction('uid-123', {
        periods: [],
        reason: 'Going home',
        totalDays: 0
      })).rejects.toThrow('Please provide at least one valid date range')
    })

    it('submitMessReduction should require reason', async () => {
      const mockProfile = { fullName: 'John Doe', registerNumber: '2024CS101' }
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProfile
      })

      await expect(submitMessReduction('uid-123', {
        periods: [{ from: '2024-01-01', to: '2024-01-05' }],
        reason: '',
        totalDays: 5
      })).rejects.toThrow('Please provide a reason')
    })
  })

  describe('Notification Functions', () => {
    it('markNotificationRead should update notification status', async () => {
      updateDoc.mockResolvedValue(undefined)

      await markNotificationRead('notif-123')

      expect(updateDoc).toHaveBeenCalled()
      const updateDocCall = updateDoc.mock.calls[0]
      expect(updateDocCall[1]).toMatchObject({ read: true })
    })

    it('markAllNotificationsRead should batch update', async () => {
      const mockDocs = [
        { ref: 'ref1' },
        { ref: 'ref2' },
        { ref: 'ref3' }
      ]
      getDocs.mockResolvedValue({
        docs: mockDocs,
        forEach: (cb) => mockDocs.forEach(cb)
      })

      await markAllNotificationsRead('uid-123')

      expect(writeBatch).toHaveBeenCalled()
    })
  })

  describe('Stats Functions', () => {
    it('getResidentStats should filter out wardens', async () => {
      const mockStudents = [
        { role: 'student', hostel: "CEC Premium Men's Hostel", createdAt: { toMillis: () => Date.now() } },
        { role: 'student', hostel: "CEC Women's Hostel", createdAt: { toMillis: () => Date.now() } },
        { role: 'warden', hostel: 'Administration', createdAt: { toMillis: () => Date.now() } }
      ]
      getDocs.mockResolvedValue({
        forEach: (cb) => mockStudents.forEach((s, i) => cb({ data: () => s, id: `id-${i}` }))
      })

      const result = await getResidentStats()

      expect(result.total).toBe(2) // Only students, not warden
      expect(result.maleCount).toBe(1)
      expect(result.femaleCount).toBe(1)
    })

    it('getComplaintStats should calculate correctly', async () => {
      const mockComplaints = [
        { status: 'Pending', priority: 'Medium', category: 'General' },
        { status: 'Resolved', priority: 'High', category: 'Emergency', createdAt: { toMillis: () => 1000 }, updatedAt: { toMillis: () => 5000 } },
        { status: 'In Progress', priority: 'High', category: 'Maintenance' }
      ]
      getDocs.mockResolvedValue({
        docs: mockComplaints.map((c, i) => ({ 
          id: `id-${i}`, 
          data: () => c 
        })),
        forEach: function(cb) { this.docs.forEach(cb) }
      })

      const result = await getComplaintStats()

      expect(result.openCount).toBe(2) // Pending + In Progress
      expect(result.highPriority).toBe(2) // High priority + Emergency
    })
  })

  describe('Head Warden Functions', () => {
    it('getPendingRegistrations should filter by status', async () => {
      const mockStudents = [
        { role: 'student', registrationStatus: 'Pending', createdAt: { toMillis: () => 1000 } },
        { role: 'student', registrationStatus: 'Approved', createdAt: { toMillis: () => 2000 } },
        { role: 'student', registrationStatus: 'On Hold', createdAt: { toMillis: () => 500 } },
        { role: 'warden', registrationStatus: 'Pending', createdAt: { toMillis: () => 3000 } }
      ]
      getDocs.mockResolvedValue({
        docs: mockStudents.map((s, i) => ({
          id: `id-${i}`,
          data: () => s
        }))
      })

      const result = await getPendingRegistrations()

      expect(result).toHaveLength(4) // All 4 students (filter now includes warden role)
    })

    it('updateRegistrationStatus should assign room when approved', async () => {
      const mockStudent = { fullName: 'John Doe' }
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockStudent
      })
      updateDoc.mockResolvedValue(undefined)
      addDoc.mockResolvedValue({ id: 'activity-123' })

      await updateRegistrationStatus('student-123', 'Approved', {
        hostel: "CEC Premium Men's Hostel",
        room: 'B-205'
      })

      expect(updateDoc).toHaveBeenCalled()
      const updateDocCall = updateDoc.mock.calls[0]
      expect(updateDocCall[1]).toMatchObject({
        registrationStatus: 'Approved',
        hostel: "CEC Premium Men's Hostel",
        room: 'B-205'
      })
    })
  })
})
