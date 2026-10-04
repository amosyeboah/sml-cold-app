/**
 * Hybrid ESC/POS Thermal Receipt Printer Service
 * - Native Android: Direct Bluetooth Classic SPP & BLE via Native Capacitor Plugin
 * - Web Browsers: Web Bluetooth API (Chrome / Edge with GATT)
 * Supports 58mm and 80mm portable Bluetooth receipt printers.
 */

import { Capacitor, registerPlugin } from '@capacitor/core'

export interface NativeBluetoothDevice {
  name: string
  address: string
}

interface NativeBluetoothPlugin {
  isAvailable(): Promise<{ available: boolean; enabled: boolean }>
  listPairedDevices(): Promise<{ devices: NativeBluetoothDevice[] }>
  connect(options: { address: string }): Promise<{ success: boolean; name: string; address: string }>
  disconnect(): Promise<{ success: boolean }>
  getStatus(): Promise<{ isConnected: boolean; deviceName?: string | null; deviceId?: string | null }>
  printRaw(options: { data: string }): Promise<{ success: boolean }>
  openCashDrawer(): Promise<{ success: boolean }>
}

const NativePrinter = registerPlugin<NativeBluetoothPlugin>('NativeBluetoothPrinter')

const KNOWN_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Chinese / ESC-POS printer service (Xprinter, GOOJPRT, POS-58, etc.)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Nordic UART
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service standard
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic Serial service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 UART
  '0000ffe5-0000-1000-8000-00805f9b34fb', // Rongta / MPT-II UART
  '0000fff0-0000-1000-8000-00805f9b34fb', // Milestone / POS printer
  '0000ffff-0000-1000-8000-00805f9b34fb', // Generic ESC/POS
  '0000ae00-0000-1000-8000-00805f9b34fb', // Android thermal printer
  '0000ae01-0000-1000-8000-00805f9b34fb', // Android thermal printer secondary
  '0000af00-0000-1000-8000-00805f9b34fb', // Cat / PeriPage / Paperang
  '000018f1-0000-1000-8000-00805f9b34fb', // Secondary printer service
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent POS / Microchip service
  '0000e7cf-0000-1000-8000-00805f9b34fb',
]

const KNOWN_WRITE_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '49535343-1e4d-4bd9-ba61-23c647249616',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009914',
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ff01-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000ffe2-0000-1000-8000-00805f9b34fb',
  '0000fff1-0000-1000-8000-00805f9b34fb',
  '0000fff2-0000-1000-8000-00805f9b34fb',
  '0000ae01-0000-1000-8000-00805f9b34fb',
  '0000ae02-0000-1000-8000-00805f9b34fb',
  '0000fec7-0000-1000-8000-00805f9b34fb',
  '0000fec8-0000-1000-8000-00805f9b34fb',
  '0000e702-0000-1000-8000-00805f9b34fb',
]

export type PaperWidth = '58mm' | '80mm'

export interface BluetoothPrinterStatus {
  isSupported: boolean
  isNative: boolean
  isConnected: boolean
  deviceName: string | null
  deviceId: string | null
  paperWidth: PaperWidth
}

class BluetoothPrinterService {
  // Web Bluetooth state
  private device: any = null
  private server: any = null
  private writeCharacteristic: any = null

  // Native Android state
  private nativeConnected: boolean = false
  private nativeDeviceName: string | null = null
  private nativeDeviceId: string | null = null

  private paperWidth: PaperWidth =
    typeof localStorage !== 'undefined'
      ? ((localStorage.getItem('bt_printer_paper_width') as PaperWidth) || '58mm')
      : '58mm'
  private listeners: ((status: BluetoothPrinterStatus) => void)[] = []

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.disconnect().catch(() => {})
      })
    }

    if (this.isNative()) {
      this.checkNativeStatus().catch(() => {})
    }
  }

  public isNative(): boolean {
    return (
      typeof Capacitor !== 'undefined' &&
      typeof Capacitor.isNativePlatform === 'function' &&
      Capacitor.isNativePlatform()
    )
  }

  public isSupported(): boolean {
    if (this.isNative()) {
      return true
    }
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  public getStatus(): BluetoothPrinterStatus {
    const isConn = this.isNative()
      ? this.nativeConnected
      : Boolean(this.server?.connected && this.writeCharacteristic)

    return {
      isSupported: this.isSupported(),
      isNative: this.isNative(),
      isConnected: isConn,
      deviceName:
        (this.isNative() ? this.nativeDeviceName : this.device?.name) ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('bt_printer_name') : null) ||
        null,
      deviceId:
        (this.isNative() ? this.nativeDeviceId : this.device?.id) ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('bt_printer_id') : null) ||
        null,
      paperWidth: this.paperWidth,
    }
  }

  public subscribe(callback: (status: BluetoothPrinterStatus) => void): () => void {
    this.listeners.push(callback)
    callback(this.getStatus())
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback)
    }
  }

  private notify() {
    const status = this.getStatus()
    this.listeners.forEach((cb) => cb(status))
  }

  public setPaperWidth(width: PaperWidth) {
    this.paperWidth = width
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('bt_printer_paper_width', width)
    }
    this.notify()
  }

  public async checkNativeStatus(): Promise<void> {
    if (!this.isNative()) return
    try {
      const status = await NativePrinter.getStatus()
      if (status.isConnected) {
        this.nativeConnected = true
        this.nativeDeviceName = status.deviceName || null
        this.nativeDeviceId = status.deviceId || null
        this.notify()
      } else {
        const savedId = typeof localStorage !== 'undefined' ? localStorage.getItem('bt_printer_id') : null
        if (savedId) {
          try {
            const res = await NativePrinter.connect({ address: savedId })
            if (res.success) {
              this.nativeConnected = true
              this.nativeDeviceName = res.name || 'Bluetooth Printer'
              this.nativeDeviceId = savedId
              this.notify()
            }
          } catch {
            // ignore background auto-reconnect failure
          }
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * List paired Bluetooth devices (Available on Android Native)
   */
  public async listPairedDevices(): Promise<{ success: boolean; devices: NativeBluetoothDevice[]; error?: string }> {
    if (!this.isNative()) {
      return { success: false, devices: [], error: 'Listing paired devices is only available on Android native app.' }
    }
    try {
      const res = await NativePrinter.listPairedDevices()
      return { success: true, devices: res?.devices || [] }
    } catch (err: any) {
      return { success: false, devices: [], error: err?.message || 'Failed to list paired Bluetooth devices.' }
    }
  }

  /**
   * Request Bluetooth device selection and connect:
   * - On Native Android: Connects via direct SPP RFCOMM to paired Bluetooth printer
   * - On Web Browsers: Connects via Web Bluetooth GATT
   */
  public async connect(
    addressOrOptions?: string | { address?: string }
  ): Promise<{ success: boolean; deviceName?: string; error?: string | null; cancelled?: boolean }> {
    const address = typeof addressOrOptions === 'string' ? addressOrOptions : addressOrOptions?.address

    // --- 1. Native Android Path ---
    if (this.isNative()) {
      try {
        let targetAddress = address
        if (!targetAddress) {
          const savedAddress = typeof localStorage !== 'undefined' ? localStorage.getItem('bt_printer_id') : null
          if (savedAddress) {
            targetAddress = savedAddress
          } else {
            const paired = await this.listPairedDevices()
            if (!paired.success) {
              return { success: false, error: paired.error }
            }
            if (paired.devices.length === 0) {
              return {
                success: false,
                error:
                  'No paired Bluetooth printers found. Please pair your Bluetooth printer in Android Device Settings first (PIN: 0000 or 1234), then try again.',
              }
            }
            targetAddress = paired.devices[0].address
          }
        }

        const res = await NativePrinter.connect({ address: targetAddress })
        if (res.success) {
          this.nativeConnected = true
          this.nativeDeviceId = targetAddress
          this.nativeDeviceName = res.name || 'Bluetooth Printer'
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('bt_printer_name', this.nativeDeviceName)
            localStorage.setItem('bt_printer_id', targetAddress)
          }
          this.notify()
          return { success: true, deviceName: this.nativeDeviceName }
        }
        return { success: false, error: 'Connection failed' }
      } catch (err: any) {
        this.nativeConnected = false
        this.notify()
        return { success: false, error: err?.message || 'Could not connect to printer.' }
      }
    }

    // --- 2. Web Bluetooth Path (Desktop Chrome / Browsers) ---
    if (!this.isSupported()) {
      return {
        success: false,
        error:
          'Web Bluetooth is not supported in this browser or environment. On Android, please use the SML Tablet App or open Google Chrome with Bluetooth enabled.',
      }
    }

    try {
      const nav = navigator as any
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_PRINTER_SERVICES,
      })

      if (!device) {
        return { success: false, error: 'No device selected' }
      }

      this.device = device
      device.addEventListener('gattserverdisconnected', () => {
        console.warn('Bluetooth printer disconnected:', device.name)
        this.server = null
        this.writeCharacteristic = null
        this.notify()
      })

      const server = await device.gatt.connect()
      this.server = server

      let characteristic: any = null

      // Try known services first
      for (const serviceUuid of KNOWN_PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid)
          if (service) {
            const characteristics = await service.getCharacteristics()
            characteristic = characteristics.find(
              (c: any) =>
                c.properties?.writeWithoutResponse ||
                c.properties?.write ||
                KNOWN_WRITE_CHARACTERISTICS.includes(c.uuid?.toLowerCase())
            )
            if (characteristic) break
          }
        } catch {
          // Continue searching other services
        }
      }

      // Fallback: query all primary services
      if (!characteristic) {
        try {
          const services = await server.getPrimaryServices()
          for (const service of services) {
            try {
              const characteristics = await service.getCharacteristics()
              characteristic = characteristics.find(
                (c: any) => c.properties?.writeWithoutResponse || c.properties?.write
              )
              if (characteristic) break
            } catch {
              // continue
            }
          }
        } catch {
          // ignore
        }
      }

      if (!characteristic) {
        throw new Error('Could not find a writable ESC/POS channel on this Bluetooth device.')
      }

      this.writeCharacteristic = characteristic

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bt_printer_name', device.name || 'Bluetooth Printer')
        localStorage.setItem('bt_printer_id', device.id)
      }

      this.notify()
      return { success: true, deviceName: device.name || 'Bluetooth Printer' }
    } catch (err: any) {
      const errorMessage = err?.message || ''
      const isUserCancelled =
        err?.name === 'NotAllowedError' ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('Cancelled') ||
        errorMessage.includes('User cancelled')

      if (!isUserCancelled) {
        console.error('Failed to connect Bluetooth printer:', err)
      }

      this.disconnect().catch(() => {})
      return {
        success: false,
        error: isUserCancelled ? null : err?.message || 'Bluetooth connection failed.',
        cancelled: isUserCancelled,
      }
    }
  }

  /**
   * Disconnect from currently connected Bluetooth printer
   */
  public async disconnect(): Promise<void> {
    if (this.isNative()) {
      try {
        await NativePrinter.disconnect()
      } catch {}
      this.nativeConnected = false
      this.nativeDeviceId = null
      this.nativeDeviceName = null
      this.notify()
      return
    }

    try {
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect()
      }
    } catch {
      // ignore
    } finally {
      this.server = null
      this.writeCharacteristic = null
      this.notify()
    }
  }

  /**
   * Send raw binary data chunks to Bluetooth printer
   */
  public async sendRawBytes(bytes: Uint8Array): Promise<{ success: boolean; error?: string }> {
    if (this.isNative()) {
      if (!this.nativeConnected) {
        // Attempt quick auto-reconnect if deviceId is stored
        const savedId = this.nativeDeviceId || (typeof localStorage !== 'undefined' ? localStorage.getItem('bt_printer_id') : null)
        if (savedId) {
          const reconn = await this.connect(savedId)
          if (!reconn.success) {
            return { success: false, error: 'Bluetooth printer is not connected. Reconnect from Settings.' }
          }
        } else {
          return { success: false, error: 'Bluetooth printer is not connected' }
        }
      }

      try {
        let binary = ''
        const len = bytes.byteLength
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const base64Data = btoa(binary)
        const res = await NativePrinter.printRaw({ data: base64Data })
        return { success: res.success }
      } catch (err: any) {
        this.nativeConnected = false
        this.notify()
        return { success: false, error: err?.message || 'Failed to send data to printer' }
      }
    }

    if (!this.writeCharacteristic) {
      return { success: false, error: 'Bluetooth printer is not connected' }
    }

    const CHUNK_SIZE = 64
    try {
      for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
        const chunk = bytes.slice(offset, offset + CHUNK_SIZE)

        let written = false
        if (
          this.writeCharacteristic.properties?.writeWithoutResponse &&
          typeof this.writeCharacteristic.writeValueWithoutResponse === 'function'
        ) {
          try {
            await this.writeCharacteristic.writeValueWithoutResponse(chunk)
            written = true
          } catch {
            written = false
          }
        }

        if (!written) {
          if (typeof this.writeCharacteristic.writeValue === 'function') {
            await this.writeCharacteristic.writeValue(chunk)
          } else if (typeof this.writeCharacteristic.writeValueWithResponse === 'function') {
            await this.writeCharacteristic.writeValueWithResponse(chunk)
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 25))
      }
      return { success: true }
    } catch (err: any) {
      console.error('Bluetooth write error:', err)
      return { success: false, error: err?.message || 'Failed to send data to printer' }
    }
  }

  /**
   * Kick open cash drawer via connected Bluetooth printer
   */
  public async openCashDrawer(): Promise<{ success: boolean; error?: string }> {
    if (this.isNative()) {
      if (!this.nativeConnected) {
        return { success: false, error: 'Bluetooth printer is not connected' }
      }
      try {
        const res = await NativePrinter.openCashDrawer()
        return { success: res.success }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to trigger cash drawer' }
      }
    }

    if (!this.getStatus().isConnected) {
      return { success: false, error: 'Bluetooth printer is not connected' }
    }

    try {
      const kickCommand = new Uint8Array([
        0x1b, 0x70, 0x00, 0x19, 0xfa,
        0x1b, 0x70, 0x01, 0x19, 0xfa,
        0x10, 0x14, 0x01, 0x00, 0x05,
        0x07,
      ])
      return await this.sendRawBytes(kickCommand)
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send cash drawer kick command' }
    }
  }

  /**
   * Formats receipt lines into ESC/POS commands and sends to Bluetooth printer
   */
  public async printReceipt(html: string): Promise<{ success: boolean; error?: string }> {
    if (!this.getStatus().isConnected) {
      return { success: false, error: 'Bluetooth printer is not connected' }
    }

    try {
      const escPosBytes = this.htmlToEscPos(html, this.paperWidth)
      return await this.sendRawBytes(escPosBytes)
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to format receipt for Bluetooth printer' }
    }
  }

  /**
   * Print a test receipt to verify connection and paper alignment
   */
  public async testPrint(): Promise<{ success: boolean; error?: string }> {
    if (!this.getStatus().isConnected) {
      return { success: false, error: 'Bluetooth printer is not connected. Please connect first.' }
    }

    const currentName = this.getStatus().deviceName || 'BT Printer'
    const testHtml = `
      <div style="font-family:monospace;width:100%;">
        <h2 style="text-align:center;">SML COLD STORE</h2>
        <p style="text-align:center;">*** BLUETOOTH TEST PRINT ***</p>
        <hr/>
        <p>Device: ${currentName}</p>
        <p>Mode: ${this.isNative() ? 'Android Native SPP' : 'Web Bluetooth BLE'}</p>
        <p>Paper Width: ${this.paperWidth}</p>
        <p>Date: ${new Date().toLocaleString()}</p>
        <hr/>
        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Total</th></tr>
          </thead>
          <tbody>
            <tr><td>Tilapia 1kg Large</td><td>1</td><td>GHc 45.00</td></tr>
            <tr><td>Chicken Wings 2kg</td><td>2</td><td>GHc 90.00</td></tr>
          </tbody>
        </table>
        <hr/>
        <table>
          <tr><td>GRAND TOTAL:</td><td>GHc 135.00</td></tr>
        </table>
        <hr/>
        <p style="text-align:center;">Printer Connection Verified!</p>
        <p style="text-align:center;">Software developed by Paylite<br/>www.mypaylite.com</p>
      </div>
    `
    return await this.printReceipt(testHtml)
  }

  /**
   * Convert an HTML receipt into standard ESC/POS binary bytecode
   */
  public htmlToEscPos(html: string, width: PaperWidth): Uint8Array {
    const charsPerLine = width === '80mm' ? 48 : 32
    const separator = '-'.repeat(charsPerLine)

    const ESC = 0x1b
    const GS = 0x1d

    const INIT = [ESC, 0x40] // ESC @ (initialize)
    const ALIGN_LEFT = [ESC, 0x61, 0]
    const ALIGN_CENTER = [ESC, 0x61, 1]
    const BOLD_ON = [ESC, 0x45, 1]
    const BOLD_OFF = [ESC, 0x45, 0]
    const DOUBLE_SIZE = [GS, 0x21, 0x11]
    const NORMAL_SIZE = [GS, 0x21, 0x00]
    const FEED_3 = [ESC, 0x64, 3]
    const CUT = [GS, 0x56, 0]

    const encoder = new TextEncoder()
    const buffer: number[] = [...INIT]

    const append = (bytes: number[]) => {
      buffer.push(...bytes)
    }

    const printText = (text: string, newline = true) => {
      const clean = text
        .replace(/GH[₵c]/gi, 'GHc ')
        .replace(/[₵]/g, 'GHc ')
        .replace(/[•]/g, '-')
      const encoded = encoder.encode(clean + (newline ? '\n' : ''))
      for (let i = 0; i < encoded.length; i++) {
        buffer.push(encoded[i])
      }
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const titleEl = doc.querySelector('h1, h2')
    if (titleEl) {
      append(ALIGN_CENTER)
      append(BOLD_ON)
      append(DOUBLE_SIZE)
      printText(titleEl.textContent?.trim() || 'RECEIPT')
      append(NORMAL_SIZE)
      append(BOLD_OFF)
    }

    const handledNodes = new Set<Node>()
    if (titleEl) handledNodes.add(titleEl)

    const processParagraph = (p: HTMLElement) => {
      if (handledNodes.has(p)) return
      handledNodes.add(p)

      const text = p.innerText?.trim()
      if (!text) return

      const isCenter = p.style.textAlign === 'center' || p.getAttribute('align') === 'center'
      const isBold = p.style.fontWeight === 'bold' || p.querySelector('strong') !== null

      append(isCenter ? ALIGN_CENTER : ALIGN_LEFT)
      if (isBold) append(BOLD_ON)
      printText(text)
      if (isBold) append(BOLD_OFF)
    }

    const processTable = (table: HTMLElement) => {
      if (handledNodes.has(table)) return
      handledNodes.add(table)

      const rows = Array.from(table.querySelectorAll('tr'))
      append(ALIGN_LEFT)

      rows.forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('th, td')).map((c) =>
          (c.textContent || '').trim().replace(/GH[₵c]/gi, 'GHc ')
        )
        if (cells.length === 0) return

        if (cells.length === 3) {
          const [item, qty, total] = cells
          const qtyWidth = width === '80mm' ? 6 : 4
          const totalWidth = width === '80mm' ? 14 : 10
          const itemWidth = charsPerLine - qtyWidth - totalWidth

          const truncatedItem = item.slice(0, itemWidth).padEnd(itemWidth, ' ')
          const paddedQty = qty.padStart(qtyWidth, ' ')
          const paddedTotal = total.padStart(totalWidth, ' ')

          printText(`${truncatedItem}${paddedQty}${paddedTotal}`)
        } else if (cells.length === 2) {
          const [label, val] = cells
          const isGrandTotal = label.toUpperCase().includes('GRAND TOTAL')
          const valWidth = width === '80mm' ? 18 : 12
          const labelWidth = charsPerLine - valWidth

          const truncatedLabel = label.slice(0, labelWidth).padEnd(labelWidth, ' ')
          const paddedVal = val.padStart(valWidth, ' ')

          if (isGrandTotal) {
            append(BOLD_ON)
            printText(`${truncatedLabel}${paddedVal}`)
            append(BOLD_OFF)
          } else {
            printText(`${truncatedLabel}${paddedVal}`)
          }
        } else {
          printText(cells.join('  '))
        }
      })
    }

    const allNodes = Array.from(doc.body.children[0]?.children || doc.body.children)
    allNodes.forEach((node) => {
      const el = node as HTMLElement
      const tagName = el.tagName?.toUpperCase()

      if (tagName === 'H1' || tagName === 'H2') {
        // already handled
      } else if (tagName === 'HR') {
        append(ALIGN_CENTER)
        printText(separator)
      } else if (tagName === 'P') {
        processParagraph(el)
      } else if (tagName === 'TABLE') {
        processTable(el)
      } else if (tagName === 'DIV') {
        const childTables = Array.from(el.querySelectorAll('table'))
        const childPs = Array.from(el.querySelectorAll('p'))
        const childHrs = Array.from(el.querySelectorAll('hr'))

        childPs.forEach((p) => processParagraph(p as HTMLElement))
        childTables.forEach((t) => processTable(t as HTMLElement))
        childHrs.forEach(() => {
          append(ALIGN_CENTER)
          printText(separator)
        })
      }
    })

    append(ALIGN_CENTER)
    append(FEED_3)
    append(CUT)

    return new Uint8Array(buffer)
  }
}

export const bluetoothPrinter = new BluetoothPrinterService()
