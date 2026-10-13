/**
 * Persistent Device Identity Manager for Sofiyem Cold Store POS & Tablets.
 * Ensures each device (Desktop, Tablet, Browser) maintains an immutable, unique deviceId.
 */

export interface DeviceProfile {
  deviceId: string
  deviceName: string
  deviceType: 'DESKTOP' | 'TABLET' | 'MOBILE' | 'WEB'
  storeId: string
  appVersion: string
}

const DEVICE_STORAGE_KEY = 'sml_coldstore_device_identity'

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'dev-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36)
}

function detectDeviceType(): 'DESKTOP' | 'TABLET' | 'MOBILE' | 'WEB' {
  if (typeof window !== 'undefined' && (window as any).api && !(window as any).Capacitor) {
    return 'DESKTOP'
  }
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase()
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'TABLET'
    if (/mobile|iphone|ipod|android/i.test(ua)) return 'TABLET' // Tablets in depot are primarily Android
  }
  return 'WEB'
}

export function getDeviceProfile(): DeviceProfile {
  if (typeof localStorage === 'undefined') {
    return {
      deviceId: 'hub-server-01',
      deviceName: 'Local Depot Hub',
      deviceType: 'DESKTOP',
      storeId: 'sml_accra_main',
      appVersion: '1.0.0',
    }
  }

  try {
    const raw = localStorage.getItem(DEVICE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.deviceId) return parsed
    }
  } catch {}

  const deviceType = detectDeviceType()
  const shortId = Math.random().toString(36).substring(2, 6).toUpperCase()
  const profile: DeviceProfile = {
    deviceId: generateUUID(),
    deviceName: `${deviceType === 'DESKTOP' ? 'Desktop POS' : 'Tablet Terminal'} (${shortId})`,
    deviceType,
    storeId: 'sml_accra_main',
    appVersion: '1.0.0',
  }

  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(profile))
  } catch {}

  return profile
}

export function updateDeviceName(name: string): DeviceProfile {
  const current = getDeviceProfile()
  const updated = { ...current, deviceName: name }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(updated))
  }
  return updated
}
