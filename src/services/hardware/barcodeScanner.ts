/**
 * Barcode Scanner Service
 * Supports:
 * - Bluetooth Wireless Barcode Scanners (HID Keyboard Wedge & Direct SPP)
 * - USB Handheld & Desktop Barcode Scanners
 * - Android Tablet Bluetooth Scanners (Netum, Inateck, Eyoyo, Tera, Symcode, Zebra, Honeywell, etc.)
 */

import { bluetoothPrinter, NativeBluetoothDevice } from './bluetoothPrinter'

export type ScannerConnectionType = 'bluetooth-hid' | 'bluetooth-spp' | 'usb-hid' | 'serial'
export type LatencyTolerance = 'relaxed' | 'standard' | 'fast'

export interface BarcodeScanEvent {
  barcode: string
  rawLength: number
  durationMs: number
  timestamp: number
  source: 'bluetooth' | 'usb' | 'keyboard'
}

export interface BarcodeScannerConfig {
  enabled: boolean
  connectionType: ScannerConnectionType
  selectedDeviceAddress: string
  selectedDeviceName: string
  latencyTolerance: LatencyTolerance
  audioFeedback: boolean
  autoAddToCart: boolean
  clearSearchOnScan: boolean
  minBarcodeLength: number
}

const DEFAULT_CONFIG: BarcodeScannerConfig = {
  enabled: true,
  connectionType: 'bluetooth-hid',
  selectedDeviceAddress: '',
  selectedDeviceName: '',
  latencyTolerance: 'relaxed', // 220ms - ideal for Bluetooth wireless latency
  audioFeedback: true,
  autoAddToCart: true,
  clearSearchOnScan: true,
  minBarcodeLength: 3,
}

class BarcodeScannerService {
  private config: BarcodeScannerConfig = { ...DEFAULT_CONFIG }
  private listeners: ((event: BarcodeScanEvent) => void)[] = []
  private statusListeners: ((config: BarcodeScannerConfig) => void)[] = []

  // Scanner buffer tracking
  private buffer: string = ''
  private lastKeyTime: number = 0
  private scanStartTime: number = 0

  constructor() {
    this.loadConfig()
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown, true)
    }
  }

  private loadConfig() {
    if (typeof localStorage === 'undefined') return
    try {
      const saved = localStorage.getItem('sml_barcode_scanner_config')
      if (saved) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) }
      }
    } catch {
      this.config = { ...DEFAULT_CONFIG }
    }
  }

  public saveConfig(updates: Partial<BarcodeScannerConfig>) {
    this.config = { ...this.config, ...updates }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('sml_barcode_scanner_config', JSON.stringify(this.config))
      } catch {}
    }
    this.notifyStatus()
  }

  public getConfig(): BarcodeScannerConfig {
    return { ...this.config }
  }

  public subscribe(callback: (event: BarcodeScanEvent) => void): () => void {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback)
    }
  }

  public subscribeConfig(callback: (config: BarcodeScannerConfig) => void): () => void {
    this.statusListeners.push(callback)
    callback(this.getConfig())
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== callback)
    }
  }

  private notifyStatus() {
    const cfg = this.getConfig()
    this.statusListeners.forEach((l) => {
      try {
        l(cfg)
      } catch {}
    })
  }

  public async listPairedBluetoothScanners(): Promise<NativeBluetoothDevice[]> {
    if (!bluetoothPrinter.isNative()) return []
    try {
      const res = await bluetoothPrinter.listPairedDevices()
      if (res.success && Array.isArray(res.devices)) {
        return res.devices
      }
    } catch (err) {
      console.warn('Failed to list paired Bluetooth devices for scanner:', err)
    }
    return []
  }

  /**
   * Generates POS scanner audio feedback using Web Audio API
   */
  public playFeedbackSound(success: boolean = true) {
    if (!this.config.audioFeedback) return
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }

      if (success) {
        // High-pitched pleasant dual-tone POS beep (1850Hz -> 2300Hz)
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1850, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(2300, ctx.currentTime + 0.08)

        gain.gain.setValueAtTime(0.18, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.1)
      } else {
        // Low buzz warning tone
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(280, ctx.currentTime)
        osc.frequency.setValueAtTime(210, ctx.currentTime + 0.1)

        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.23)
      }
    } catch {
      // Audio autoplay policy catch
    }
  }

  /**
   * Sanitizes barcode string (removes AIM symbology prefixes like ]C1, ]E0, STX/ETX controls)
   */
  public cleanBarcode(code: string): string {
    if (!code) return ''
    let cleaned = code.trim()
    // Remove control chars (STX=0x02, ETX=0x03, etc.)
    cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '')
    // Remove AIM standard prefixes (e.g. ]C1, ]E0, ]e0, ]d1, ]Q1)
    if (/^\][a-zA-Z0-9]{2}/.test(cleaned)) {
      cleaned = cleaned.substring(3)
    }
    return cleaned.trim()
  }

  private getMaxIntervalMs(): number {
    switch (this.config.latencyTolerance) {
      case 'fast':
        return 75
      case 'standard':
        return 140
      case 'relaxed':
      default:
        return 240 // Bluetooth wireless threshold
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.config.enabled) return

    const now = Date.now()
    const maxInterval = this.getMaxIntervalMs()
    const timeDiff = now - this.lastKeyTime
    this.lastKeyTime = now

    // Identify if the keypress is a scanner termination character
    const isTerminator = e.key === 'Enter' || e.key === 'Tab'

    if (isTerminator) {
      if (this.buffer.length >= this.config.minBarcodeLength) {
        const cleaned = this.cleanBarcode(this.buffer)
        if (cleaned.length >= this.config.minBarcodeLength) {
          const totalDuration = now - (this.scanStartTime || now)
          const isFastInput = this.buffer.length > 2 && (totalDuration / this.buffer.length < maxInterval)

          const scanEvent: BarcodeScanEvent = {
            barcode: cleaned,
            rawLength: this.buffer.length,
            durationMs: totalDuration,
            timestamp: now,
            source: isFastInput ? 'bluetooth' : 'keyboard',
          }

          // Emit to all listeners
          this.listeners.forEach((listener) => {
            try {
              listener(scanEvent)
            } catch (err) {
              console.error('Barcode listener error:', err)
            }
          })

          this.playFeedbackSound(true)
        }
      }
      this.buffer = ''
      this.scanStartTime = 0
      return
    }

    // Capture single printable characters
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (this.buffer.length === 0 || timeDiff > maxInterval) {
        this.buffer = e.key
        this.scanStartTime = now
      } else {
        this.buffer += e.key
      }
    }
  }
}

export const barcodeScanner = new BarcodeScannerService()
