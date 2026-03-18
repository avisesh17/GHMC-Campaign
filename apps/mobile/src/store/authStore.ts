import { create } from 'zustand'
import { api, tokenStore } from '../services/api'
import * as SecureStore from 'expo-secure-store'

interface User {
  id:                string
  name:              string
  role:              'tenant_owner' | 'ward_admin' | 'volunteer' | 'viewer'
  tenantSlug:        string
  tenantName:        string
  assignedWardId:    string | null
  assignedBoothId:   string | null
  schema:            string
}

interface AuthState {
  user:         User | null
  token:        string | null
  isLoading:    boolean
  error:        string | null
  tenantSlug:   string

  setTenantSlug:  (slug: string) => void
  requestOtp:     (phone: string, slug: string) => Promise<void>
  verifyOtp:      (phone: string, otp: string) => Promise<void>
  logout:         () => Promise<void>
  restoreSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:        null,
  token:       null,
  isLoading:   false,
  error:       null,
  tenantSlug:  '',

  setTenantSlug: (slug) => set({ tenantSlug: slug, error: null }),

  requestOtp: async (phone, slug) => {
    set({ isLoading: true, error: null })
    try {
      await api.requestOtp(phone, slug)
      set({ isLoading: false })
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.response?.data?.error || 'Failed to send OTP'
      })
      throw err
    }
  },

  verifyOtp: async (phone, otp) => {
    const { tenantSlug } = get()
    set({ isLoading: true, error: null })
    try {
      const data = await api.verifyOtp(phone, otp, tenantSlug)
      const u = data.user
      set({
        isLoading: false,
        token: data.token,
        user: {
          id:               u.id,
          name:             u.name,
          role:             u.role,
          tenantSlug:       u.tenantSlug,
          tenantName:       u.tenantName,
          assignedWardId:   u.assigned_ward_id,
          assignedBoothId:  u.assigned_booth_id,
          schema:           u.schema,
        }
      })
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.response?.data?.error || 'OTP verification failed'
      })
      throw err
    }
  },

  logout: async () => {
    await api.logout()
    set({ user: null, token: null, error: null })
  },

  restoreSession: async () => {
    const token = await tokenStore.get()
    if (!token) return
    // Decode JWT payload (without verification — server verifies on each request)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp * 1000 < Date.now()) {
        await tokenStore.clear()
        return
      }
      set({
        token,
        user: {
          id:              payload.user_id,
          name:            payload.name,
          role:            payload.role,
          tenantSlug:      payload.tenant_slug,
          tenantName:      payload.tenant_slug,
          assignedWardId:  payload.assigned_ward_id,
          assignedBoothId: payload.assigned_booth_id,
          schema:          payload.schema,
        }
      })
    } catch {
      await tokenStore.clear()
    }
  }
}))
