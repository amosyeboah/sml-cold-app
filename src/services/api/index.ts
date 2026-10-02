import { mobileApi } from './mobileStorage'
import { hubClient, isCloudHosting } from './hubClient'

function getReadOnlyPortalApi() {
  return new Proxy(mobileApi, {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^(create|update|delete|remove|add|set|adjust|refund|cancel|complete|receive|record|process|retry|flush|pull|save|import|reset|seed|push)/i.test(property)) {
        return async () => {
          throw new Error('The owner portal is read-only. Business changes must be made on the local hub.')
        }
      }
      return Reflect.get(target, property, receiver)
    },
  })
}

/**
 * Unified API Client for SML Legacy Cold Store App.
 *
 * Architecture:
 * 1. Physical Store Tablet / Web / Vercel:
 *    Uses `mobileApi`. It provides offline-first transactional storage on the tablet
 *    (via IndexedDB / localStorage) and automatically reflects/syncs all transactions
 *    to Supabase Cloud whenever internet is available.
 * 2. Remote Access (Vercel at https://sml-cold-store.vercel.app):
 *    Admin / Owner opens the dashboard from anywhere. It reads the live reflected state
 *    from Supabase Cloud, giving 100% visibility into what is happening in the store.
 * 3. Electron Desktop App (if running on a Windows PC):
 *    Uses Electron IPC (`window.api`) with direct fallback to `mobileApi`.
 */
export function getApi() {
  if (typeof window !== 'undefined' && window.api) {
    const electronApi = window.api as any

    // Create a wrapper object that includes both Electron IPC and mobileApi methods
    const wrappedApi = {
      ...electronApi,

      refundSale: async (id: string, username?: string, userRole?: string) => {
        if ((window as any).electron?.ipcRenderer?.invoke) {
          try {
            return await (window as any).electron.ipcRenderer.invoke('sales:refund', id)
          } catch {
            // fallback
          }
        }
        return await hubClient.refundSale(id, username, userRole)
      },

      // Bluetooth printer methods
      connectBluetoothPrinter: () => mobileApi.connectBluetoothPrinter(),
      disconnectBluetoothPrinter: () => mobileApi.disconnectBluetoothPrinter(),
      getBluetoothPrinterStatus: () => mobileApi.getBluetoothPrinterStatus(),
      testBluetoothPrinter: () => mobileApi.testBluetoothPrinter(),
      setBluetoothPaperWidth: (w: any) => mobileApi.setBluetoothPaperWidth(w),

      // Enhanced printReceipt with Bluetooth printer priority
      printReceipt: async (html: string) => {
        const btStatus = mobileApi.getBluetoothPrinterStatus()
        if (btStatus.isConnected) {
          const btRes = await mobileApi.printReceipt(html)
          if (btRes.success) return btRes
        }
        if (typeof electronApi.printReceipt === 'function') {
          return await electronApi.printReceipt(html)
        }
        return await mobileApi.printReceipt(html)
      },

      // Enhanced openCashDrawer with Bluetooth printer priority
      openCashDrawer: async () => {
        const btStatus = mobileApi.getBluetoothPrinterStatus()
        if (btStatus.isConnected) {
          const btRes = await mobileApi.openCashDrawer()
          if (btRes.success) return btRes
        }
        if (typeof electronApi.openCashDrawer === 'function') {
          return await electronApi.openCashDrawer()
        }
        return await mobileApi.openCashDrawer()
      },

      // Enhanced getPrinters including Bluetooth printer
      getPrinters: async () => {
        let list: any[] = []
        if (typeof electronApi.getPrinters === 'function') {
          try {
            list = (await electronApi.getPrinters()) || []
          } catch {
            list = []
          }
        }
        const btStatus = mobileApi.getBluetoothPrinterStatus()
        if (btStatus.isConnected && btStatus.deviceName) {
          list = [{ name: `Bluetooth: ${btStatus.deviceName}`, displayName: `Bluetooth: ${btStatus.deviceName}`, isDefault: true }, ...list]
        }
        return list
      }
    }

    try {
      window.api = wrappedApi
    } catch {
      // ignore if non-writable
    }

    return wrappedApi
  }

  if (typeof window !== 'undefined' && isCloudHosting()) {
    return getReadOnlyPortalApi() as any
  }

  return { ...mobileApi, ...hubClient } as any
}

export const api = getApi()

if (typeof window !== 'undefined') {
  try {
    ;(window as any).api = api
  } catch {
    // ignore non-writable host bridges
  }
}
