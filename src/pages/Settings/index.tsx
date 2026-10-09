import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Printer,
  Cpu,
  Save,
  CheckCircle,
  Settings as SettingsIcon,
  Phone,
  Mail,
  MapPin,
  Globe,
  FileText,
  Hash,
  DollarSign,
  Receipt,
  AlignLeft,
  AlignCenter,
  ToggleLeft,
  ToggleRight,
  Usb,
  ScanBarcode,
  MonitorSpeaker,
  AlertCircle,
  ChevronRight,
  ShoppingBag,
  Percent,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Smartphone,
  Archive,
  RefreshCw,
  Check,
  Radio,
  Volume2,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { bluetoothPrinter, BluetoothPrinterStatus, PaperWidth, NativeBluetoothDevice } from '@/services/hardware/bluetoothPrinter'
import { barcodeScanner, BarcodeScannerConfig, BarcodeScanEvent, ScannerConnectionType, LatencyTolerance } from '@/services/hardware/barcodeScanner'
import { api } from '@/services/api'

// ── Default settings values ──────────────────────────────────────────────────
const DEFAULTS: Record<string, string> = {
  // Business Info
  'biz.name': 'SOFIYEM Legacy Limited',
  'biz.type': 'Cold store',
  'biz.tagline': 'Quality Frozen Foods & Cold Storage Services',
  'biz.phone': '+233 54 386 4610',
  'biz.email': 'sorphygold@yahoo.com',
  'biz.ownerName': 'Sofiyat Opeyemi Yusuf',
  'biz.ownerEmail': 'sorphygold@yahoo.com',
  'biz.ownerPhone': '+447999007775',
  'biz.address': 'Cold Store Market Depot',
  'biz.city': 'Accra, Greater Accra',
  'biz.website': '',
  'biz.taxId': '',
  'biz.currency': 'GHS',
  'biz.currencySymbol': 'GH₵',
  // POS & Checkout
  'pos.enableDiscount': 'false',
  'pos.enableTax': 'false',
  'pos.taxRate': '0',
  'pos.enableRefund': 'true',
  // Receipt & Invoice
  'receipt.paperSize': '58mm',
  'receipt.headerText': 'Quality Frozen Foods & Cold Storage',
  'receipt.footerText': 'Thank you for choosing SOFIYEM Legacy! Keep frozen at -18°C.',
  'receipt.showLogo': 'true',
  'receipt.showAddress': 'true',
  'receipt.showPhone': 'true',
  'receipt.showTaxId': 'false',
  'receipt.showBarcode': 'true',
  'receipt.alignment': 'center',
  'receipt.copies': '1',
  // Hardware
  'hw.printerName': '',
  'hw.printerPort': 'USB',
  'hw.scannerEnabled': 'true',
  'hw.scannerType': 'bluetooth-hid',
  'hw.scannerPort': 'Bluetooth (HID)',
  'hw.scannerLatency': 'relaxed',
  'hw.scannerAudio': 'true',
  'hw.scannerAutoAdd': 'true',
  'hw.drawerEnabled': 'false',
  'hw.drawerPort': 'COM4',
  'hw.drawerPulseMs': '200',
}

type Tab = 'business' | 'pos' | 'receipt' | 'hardware'

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-blue-600' : 'bg-slate-200'
        }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'
          }`}
      />
    </button>
  )
}

function FieldRow({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex w-48 flex-shrink-0 items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-gray-400" />}
        <Label className="text-xs font-semibold text-gray-600">{label}</Label>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{children}</p>
  )
}

export default function Settings() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('business')
  const [form, setForm] = useState<Record<string, string>>(DEFAULTS)
  const [saved, setSaved] = useState(false)

  const { data: stored = {}, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => window.api.getSettings(),
  })

  const { data: installedPrinters = [] } = useQuery<any[]>({
    queryKey: ['system-printers'],
    queryFn: () => window.api.getPrinters?.() ?? Promise.resolve([]),
  })

  const [btStatus, setBtStatus] = useState<BluetoothPrinterStatus>(bluetoothPrinter.getStatus())
  const [isConnectingBt, setIsConnectingBt] = useState(false)
  const [btFeedback, setBtFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [pairedDevices, setPairedDevices] = useState<NativeBluetoothDevice[]>([])
  const [selectedDeviceAddress, setSelectedDeviceAddress] = useState<string>(
    typeof localStorage !== 'undefined' ? localStorage.getItem('bt_printer_id') || '' : ''
  )
  const [isLoadingPaired, setIsLoadingPaired] = useState(false)
  const [scannerConfig, setScannerConfig] = useState<BarcodeScannerConfig>(barcodeScanner.getConfig())
  const [lastScanEvent, setLastScanEvent] = useState<BarcodeScanEvent | null>(null)
  const [scannerTestInput, setScannerTestInput] = useState('')

  useEffect(() => {
    const unConfig = barcodeScanner.subscribeConfig((cfg) => {
      setScannerConfig(cfg)
    })
    const unScan = barcodeScanner.subscribe((ev) => {
      setLastScanEvent(ev)
      setScannerTestInput(ev.barcode)
    })
    return () => {
      unConfig()
      unScan()
    }
  }, [])

  const updateScanner = (updates: Partial<BarcodeScannerConfig>) => {
    barcodeScanner.saveConfig(updates)
    const updated = { ...scannerConfig, ...updates }
    setScannerConfig(updated)
    set('hw.scannerEnabled', updated.enabled ? 'true' : 'false')
    set('hw.scannerType', updated.connectionType)
    set('hw.scannerLatency', updated.latencyTolerance)
    set('hw.scannerAudio', updated.audioFeedback ? 'true' : 'false')
    set('hw.scannerAutoAdd', updated.autoAddToCart ? 'true' : 'false')
  }

  const loadPairedDevices = async () => {
    if (!bluetoothPrinter.isNative()) return
    setIsLoadingPaired(true)
    try {
      const res = await bluetoothPrinter.listPairedDevices()
      if (res.success && res.devices) {
        setPairedDevices(res.devices)
        if (res.devices.length > 0 && !selectedDeviceAddress) {
          setSelectedDeviceAddress(res.devices[0].address)
        }
      } else if (res.error) {
        setBtFeedback({ type: 'error', message: res.error })
      }
    } catch (e: any) {
      // ignore
    } finally {
      setIsLoadingPaired(false)
    }
  }

  useEffect(() => {
    return bluetoothPrinter.subscribe((status) => {
      setBtStatus(status)
      if (status.isConnected && status.deviceName) {
        set('hw.printerName', status.deviceName)
        set('hw.printerPort', 'Bluetooth')
      }
    })
  }, [])

  useEffect(() => {
    if (activeTab === 'hardware' && bluetoothPrinter.isNative()) {
      loadPairedDevices()
    }
  }, [activeTab])

  const handleConnectBt = async (address?: string) => {
    setIsConnectingBt(true)
    setBtFeedback(null)
    try {
      const target = address || selectedDeviceAddress || undefined
      const res = await bluetoothPrinter.connect(target)
      if (res.success) {
        setBtFeedback({ type: 'success', message: `Successfully connected to ${res.deviceName || 'Bluetooth Printer'}!` })
        set('hw.printerName', res.deviceName || 'Bluetooth Printer')
        set('hw.printerPort', 'Bluetooth')
      } else if (res.cancelled) {
        // User cancelled the device picker - don't show error feedback
        setBtFeedback(null)
      } else {
        // Actual error
        setBtFeedback({ type: 'error', message: res.error || 'Connection failed' })
      }
    } catch (e: any) {
      setBtFeedback({ type: 'error', message: e?.message || 'Connection failed' })
    } finally {
      setIsConnectingBt(false)
    }
  }

  const handleDisconnectBt = async () => {
    await bluetoothPrinter.disconnect()
    setBtFeedback({ type: 'success', message: 'Bluetooth printer disconnected.' })
  }

  const handleTestPrintBt = async () => {
    setBtFeedback(null)
    const res = await bluetoothPrinter.testPrint()
    if (res.success) {
      setBtFeedback({ type: 'success', message: 'Test receipt sent to Bluetooth printer!' })
    } else {
      setBtFeedback({ type: 'error', message: res.error || 'Failed to send test print' })
    }
  }

  const handleTestDrawerBt = async () => {
    setBtFeedback(null)
    const res = await bluetoothPrinter.openCashDrawer()
    if (res.success) {
      setBtFeedback({ type: 'success', message: 'Cash drawer trigger pulse sent to Bluetooth printer!' })
    } else {
      setBtFeedback({ type: 'error', message: res.error || 'Failed to trigger cash drawer' })
    }
  }

  const handleTestDrawer = async () => {
    try {
      const res = await api.openCashDrawer()
      if (res?.success) {
        alert('Cash drawer opened successfully!')
      } else {
        alert(res?.reason || res?.error || 'Failed to trigger cash drawer. Ensure drawer is connected and configured.')
      }
    } catch (e: any) {
      alert(e?.message || 'Cash drawer error')
    }
  }

  const handlePaperWidthChange = (width: PaperWidth) => {
    bluetoothPrinter.setPaperWidth(width)
  }

  useEffect(() => {
    if (stored && Object.keys(stored).length > 0) {
      setForm((prev) => ({ ...prev, ...stored }))
    }
  }, [stored])

  const saveMutation = useMutation({
    mutationFn: (updates: Record<string, string>) => window.api.setSetting(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }))
  const toggle = (key: string) => set(key, form[key] === 'true' ? 'false' : 'true')
  const bool = (key: string) => form[key] === 'true'

  const handleSave = () => saveMutation.mutate(form)

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'business', label: 'Business Info', icon: Building2 },
    { key: 'pos', label: 'POS Checkout', icon: ShoppingBag },
    { key: 'receipt', label: 'Receipt & Invoice', icon: Receipt },
    { key: 'hardware', label: 'Hardware Devices', icon: Cpu },
  ]


  return (
    <div className="h-full overflow-y-auto font-sans">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white px-6 pt-6 pb-0">
        <div className="flex items-start justify-between gap-4 pb-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600">
              <SettingsIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-600">
                System
              </p>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">Settings</h1>
            </div>
          </div>

          {/* Save button in header */}
          <Button
            id="settings-save-btn"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex-shrink-0 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
          >
            {saved ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              id={`settings-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-xs font-semibold transition-all border-b-2 ${activeTab === tab.key
                ? 'border-blue-600 text-blue-600 bg-blue-50/60'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-blue-500 border-t-transparent" />
        </div>
      ) : (
        <div className="p-6 max-w-3xl space-y-6">
          {/* ────────────────────────────────────────────────────────── */}
          {/* TAB: Business Info                                        */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeTab === 'business' && (
            <>
              {/* Identity */}
              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">Cold Store Identity</span>
                </div>
                <CardContent className="p-5 space-y-4">
                  <FieldRow label="Store Name" icon={Building2}>
                    <Input
                      id="biz-name"
                      value={form['biz.name']}
                      onChange={(e) => set('biz.name', e.target.value)}
                      placeholder="e.g. SOFIYEM Legacy Limited"
                      className="h-9 text-sm"
                    />
                  </FieldRow>
                  <FieldRow label="Business Type" icon={Building2}>
                    <Input
                      id="biz-type"
                      value={form['biz.type']}
                      onChange={(e) => set('biz.type', e.target.value)}
                      placeholder="e.g. Cold store"
                      className="h-9 text-sm"
                    />
                  </FieldRow>
                  <FieldRow label="Tagline" icon={AlignLeft}>
                    <Input
                      id="biz-tagline"
                      value={form['biz.tagline']}
                      onChange={(e) => set('biz.tagline', e.target.value)}
                      placeholder="e.g. Quality Frozen Foods & Cold Storage Services"
                      className="h-9 text-sm"
                    />
                  </FieldRow>
                  <FieldRow label="Tax / License ID" icon={Hash}>
                    <Input
                      id="biz-taxid"
                      value={form['biz.taxId']}
                      onChange={(e) => set('biz.taxId', e.target.value)}
                      placeholder="e.g. TIN-123456789"
                      className="h-9 text-sm"
                    />
                  </FieldRow>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Currency Code" icon={DollarSign}>
                      <select
                        id="biz-currency"
                        value={form['biz.currency']}
                        onChange={(e) => set('biz.currency', e.target.value)}
                        className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                      >
                        {[
                          ['GBP', 'British Pound (GBP)'],
                          ['GHS', 'Ghanaian Cedi (GHS)'],
                          ['NGN', 'Nigerian Naira (NGN)'],
                        ].map(([code, label]) => (
                          <option key={code} value={code}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </FieldRow>
                    <FieldRow label="Symbol" icon={DollarSign}>
                      <Input
                        id="biz-currency-symbol"
                        value={form['biz.currencySymbol']}
                        onChange={(e) => set('biz.currencySymbol', e.target.value)}
                        placeholder="$"
                        maxLength={4}
                        className="h-9 text-sm"
                      />
                    </FieldRow>
                  </div>
                </CardContent>
              </Card>

              {/* Contact & Location */}
              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">Contact & Location</span>
                </div>
                <CardContent className="p-5 space-y-4">
                  <FieldRow label="Business Phone" icon={Phone}>
                    <Input
                      id="biz-phone"
                      value={form['biz.phone']}
                      onChange={(e) => set('biz.phone', e.target.value)}
                      placeholder="+233 54 386 4610"
                      className="h-9 text-sm"
                    />
                  </FieldRow>
                  <FieldRow label="Business Email" icon={Mail}>
                    <Input
                      id="biz-email"
                      type="email"
                      value={form['biz.email']}
                      onChange={(e) => set('biz.email', e.target.value)}
                      placeholder="sorphygold@yahoo.com"
                      className="h-9 text-sm"
                    />
                  </FieldRow>
                  <FieldRow label="Street Address" icon={MapPin}>
                    <Input
                      id="biz-address"
                      value={form['biz.address']}
                      onChange={(e) => set('biz.address', e.target.value)}
                      placeholder="Cold Store Market Depot"
                      className="h-9 text-sm"
                    />
                  </FieldRow>
                  <FieldRow label="City / Region" icon={MapPin}>
                    <Input
                      id="biz-city"
                      value={form['biz.city']}
                      onChange={(e) => set('biz.city', e.target.value)}
                      placeholder="Kumasi, Ashanti Region"
                      className="h-9 text-sm"
                    />
                  </FieldRow>
                  <FieldRow label="Website" icon={Globe}>
                    <Input
                      id="biz-website"
                      value={form['biz.website']}
                      onChange={(e) => set('biz.website', e.target.value)}
                      placeholder="https://SOFIYEMlegacy.com"
                      className="h-9 text-sm"
                    />
                  </FieldRow>
                </CardContent>
              </Card>

              {/* Owner Profile */}
              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">Owner & Executive Profile</span>
                </div>
                <CardContent className="p-5 space-y-4">
                  <FieldRow label="Owner's Name" icon={FileText}>
                    <Input
                      id="biz-owner-name"
                      value={form['biz.ownerName']}
                      onChange={(e) => set('biz.ownerName', e.target.value)}
                      placeholder="Sofiyat Opeyemi Yusuf"
                      className="h-9 text-sm font-medium"
                    />
                  </FieldRow>
                  <FieldRow label="Owner Phone / WhatsApp" icon={Phone}>
                    <Input
                      id="biz-owner-phone"
                      value={form['biz.ownerPhone']}
                      onChange={(e) => set('biz.ownerPhone', e.target.value)}
                      placeholder="+447999007775"
                      className="h-9 text-sm"
                    />
                  </FieldRow>
                  <FieldRow label="Owner's Email" icon={Mail}>
                    <Input
                      id="biz-owner-email"
                      type="email"
                      value={form['biz.ownerEmail']}
                      onChange={(e) => set('biz.ownerEmail', e.target.value)}
                      placeholder="sorphygold@yahoo.com"
                      className="h-9 text-sm"
                    />
                  </FieldRow>
                </CardContent>
              </Card>
            </>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* TAB: POS Checkout & Tax/Discount                          */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeTab === 'pos' && (
            <>
              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
                  <ShoppingBag className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">POS Checkout Preferences</span>
                </div>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-4 divide-y divide-gray-100">
                    {/* Discount setting */}
                    <div className="flex items-center justify-between gap-4 pt-3 first:pt-0">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Enable Discount at POS</p>
                        <p className="text-xs text-gray-400">Allow staff to apply percentage discounts to current sales on the POS screen</p>
                      </div>
                      <Toggle
                        id="toggle-pos-enableDiscount"
                        checked={bool('pos.enableDiscount')}
                        onChange={() => toggle('pos.enableDiscount')}
                      />
                    </div>

                    {/* Tax setting */}
                    <div className="flex items-center justify-between gap-4 pt-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Enable Tax (VAT) at POS</p>
                        <p className="text-xs text-gray-400">Calculate tax on checkout and display tax breakdown on sales summaries</p>
                      </div>
                      <Toggle
                        id="toggle-pos-enableTax"
                        checked={bool('pos.enableTax')}
                        onChange={() => toggle('pos.enableTax')}
                      />
                    </div>

                    {/* Refund setting */}
                    <div className="flex items-center justify-between gap-4 pt-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Enable Refund</p>
                        <p className="text-xs text-gray-400">Allow staff to process transaction refunds and return items back to inventory</p>
                      </div>
                      <Toggle
                        id="toggle-pos-enableRefund"
                        checked={bool('pos.enableRefund')}
                        onChange={() => toggle('pos.enableRefund')}
                      />
                    </div>
                  </div>

                  {bool('pos.enableTax') && (
                    <div className="pt-3 border-t border-gray-100">
                      <FieldRow label="Default Tax Rate (%)" icon={Percent}>
                        <Input
                          id="pos-tax-rate"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={form['pos.taxRate'] || ''}
                          onChange={(e) => set('pos.taxRate', e.target.value)}
                          placeholder="e.g. 15.00"
                          className="h-9 text-sm max-w-xs"
                        />
                      </FieldRow>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* TAB: Receipt & Invoice                                    */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeTab === 'receipt' && (

            <>
              {/* Paper & Format */}
              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
                  <Printer className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">Paper & Format</span>
                </div>
                <CardContent className="p-5 space-y-4">
                  <FieldRow label="Paper Size" icon={FileText}>
                    <div className="flex gap-2">
                      {['58mm', '80mm', 'A4', 'A5'].map((size) => (
                        <button
                          key={size}
                          id={`receipt-paper-${size}`}
                          onClick={() => set('receipt.paperSize', size)}
                          className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all ${form['receipt.paperSize'] === size
                            ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </FieldRow>

                  <FieldRow label="Text Alignment" icon={AlignCenter}>
                    <div className="flex gap-2">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button
                          key={align}
                          id={`receipt-align-${align}`}
                          onClick={() => set('receipt.alignment', align)}
                          className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition-all ${form['receipt.alignment'] === align
                            ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                        >
                          {align}
                        </button>
                      ))}
                    </div>
                  </FieldRow>

                  <FieldRow label="Copies per Sale" icon={Printer}>
                    <select
                      id="receipt-copies"
                      value={form['receipt.copies']}
                      onChange={(e) => set('receipt.copies', e.target.value)}
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                    >
                      {['1', '2', '3'].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === '1' ? 'copy' : 'copies'}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                </CardContent>
              </Card>

              {/* Header & Footer Text */}
              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
                  <AlignLeft className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">Header & Footer Text</span>
                </div>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Receipt Header</Label>
                    <textarea
                      id="receipt-header"
                      value={form['receipt.headerText']}
                      onChange={(e) => set('receipt.headerText', e.target.value)}
                      rows={3}
                      placeholder="Optional header text printed below the store name..."
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600">Receipt Footer</Label>
                    <textarea
                      id="receipt-footer"
                      value={form['receipt.footerText']}
                      onChange={(e) => set('receipt.footerText', e.target.value)}
                      rows={3}
                      placeholder="e.g. Thank you for your purchase! Return policy: 7 days."
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-none"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Toggle Sections */}
              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
                  <Receipt className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">Fields to Print</span>
                </div>
                <CardContent className="p-5">
                  <div className="space-y-3 divide-y divide-gray-100">
                    {[
                      { key: 'receipt.showLogo', label: 'Show store logo', sub: 'Printed at the top of the receipt' },
                      { key: 'receipt.showAddress', label: 'Show store address', sub: 'Street address and city' },
                      { key: 'receipt.showPhone', label: 'Show phone number', sub: 'Contact number on receipt' },
                      { key: 'receipt.showTaxId', label: 'Show Tax / Business ID', sub: 'Tax identification number' },
                      { key: 'receipt.showBarcode', label: 'Show invoice barcode', sub: 'Barcode for invoice tracking' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-4 pt-3 first:pt-0">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{item.label}</p>
                          <p className="text-xs text-gray-400">{item.sub}</p>
                        </div>
                        <Toggle
                          id={`toggle-${item.key}`}
                          checked={bool(item.key)}
                          onChange={() => toggle(item.key)}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* TAB: Hardware Devices                                     */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeTab === 'hardware' && (
            <>
              {/* Receipt Printer */}
              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
                  <Printer className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">Receipt Printer</span>
                </div>
                <CardContent className="p-5 space-y-4">
                  {(() => {
                    const currentPrinterName = form['hw.printerName'] || ''
                    const isOneNoteSelected = currentPrinterName.toLowerCase().includes('onenote')
                    const defaultPrinter = installedPrinters.find((p: any) => p.isDefault)
                    const isOneNoteDefault = !currentPrinterName && defaultPrinter?.name?.toLowerCase().includes('onenote')

                    return (
                      <>
                        {(isOneNoteSelected || isOneNoteDefault) ? (
                          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600 mt-0.5" />
                            <p className="text-xs text-rose-700">
                              <strong>Microsoft OneNote Issue Detected:</strong> Microsoft OneNote is set as {isOneNoteSelected ? 'the configured printer' : 'your Windows default printer'}. This causes Microsoft OneNote to launch every time a sale receipt is printed. Select your thermal receipt printer below to fix this.
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
                            <p className="text-xs text-amber-700">
                              Select your installed receipt printer from the dropdown list below, or enter the printer name manually as shown in <strong>Control Panel → Devices and Printers</strong>.
                            </p>
                          </div>
                        )}

                        {installedPrinters.length > 0 && (
                          <FieldRow label="Select Printer" icon={Printer}>
                            <select
                              id="hw-printer-select"
                              value={installedPrinters.some((p: any) => p.name === form['hw.printerName']) ? form['hw.printerName'] : ''}
                              onChange={(e) => set('hw.printerName', e.target.value)}
                              className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                            >
                              <option value="">-- Select Installed Printer --</option>
                              {installedPrinters.map((p: any) => (
                                <option key={p.name} value={p.name}>
                                  {p.displayName || p.name} {p.isDefault ? '(Windows Default)' : ''}
                                </option>
                              ))}
                            </select>
                          </FieldRow>
                        )}

                        <FieldRow label="Printer Name" icon={Printer}>
                          <Input
                            id="hw-printer-name"
                            value={form['hw.printerName']}
                            onChange={(e) => set('hw.printerName', e.target.value)}
                            placeholder="e.g. XP-80C, EPSON TM-T88V"
                            className="h-9 text-sm"
                          />
                        </FieldRow>
                      </>
                    )
                  })()}
                  <FieldRow label="Connection Port" icon={Usb}>
                    <select
                      id="hw-printer-port"
                      value={form['hw.printerPort']}
                      onChange={(e) => set('hw.printerPort', e.target.value)}
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                    >
                      {['USB', 'Bluetooth', 'Network (IP)', 'COM1', 'COM2', 'COM3', 'COM4', 'LPT1'].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                </CardContent>
              </Card>

              {/* Bluetooth Thermal Receipt Printer (Android & Mobile) */}
              <Card className="border-blue-200 bg-gradient-to-b from-blue-50/30 to-white shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50/70 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Bluetooth className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-800">
                      Bluetooth Thermal Printer (Android & Mobile)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {btStatus.isConnected ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300">
                        <BluetoothConnected className="h-3.5 w-3.5 text-emerald-600" />
                        Connected: {btStatus.deviceName || 'BT Printer'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        <BluetoothOff className="h-3.5 w-3.5 text-slate-400" />
                        Disconnected
                      </span>
                    )}
                  </div>
                </div>

                <CardContent className="p-5 space-y-4">
                  {/* Android tablet guidance banner */}
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 flex items-start gap-3">
                    <Smartphone className="h-5 w-5 flex-shrink-0 text-blue-600 mt-0.5" />
                    <div className="text-xs text-blue-900 space-y-1">
                      <p className="font-semibold">
                        {btStatus.isNative
                          ? 'Android Native Bluetooth ESC/POS Printing'
                          : 'Bluetooth Thermal Receipt Printing'}
                      </p>
                      <p className="text-blue-700 leading-relaxed">
                        {btStatus.isNative
                          ? 'Works offline with portable 58mm and 80mm ESC/POS Bluetooth receipt printers (GOOJPRT, Xprinter, MPT-II, POS-58). Pair your printer in Android Settings first, then select it below.'
                          : 'Connect portable 58mm or 80mm ESC/POS Bluetooth receipt printers. Make sure your device Bluetooth is switched ON before scanning.'}
                      </p>
                    </div>
                  </div>

                  {!btStatus.isSupported && !btStatus.isNative && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
                      <p className="text-xs text-amber-800">
                        <strong>Browser Notice:</strong> Web Bluetooth is not supported in this browser environment. For direct Bluetooth thermal printing on Android, please use the installed <strong>SOFIYEM Cold Store Tablet App</strong>, or open Google Chrome.
                      </p>
                    </div>
                  )}

                  {btFeedback && (
                    <div
                      className={`rounded-xl border p-3 text-xs font-medium flex items-center justify-between ${btFeedback.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-red-200 bg-red-50 text-red-800'
                        }`}
                    >
                      <span>{btFeedback.message}</span>
                      <button
                        type="button"
                        onClick={() => setBtFeedback(null)}
                        className="text-xs underline ml-2 opacity-70 hover:opacity-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Native Paired Devices Selector (Android) */}
                  {btStatus.isNative && (
                    <div className="space-y-3 rounded-xl border border-blue-200/80 bg-white p-4 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <Bluetooth className="h-3.5 w-3.5 text-blue-600" />
                          Paired Android Bluetooth Printers
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isLoadingPaired}
                          onClick={loadPairedDevices}
                          className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingPaired ? 'animate-spin' : ''}`} />
                          Refresh Paired List
                        </Button>
                      </div>

                      {pairedDevices.length > 0 ? (
                        <div className="space-y-2">
                          <select
                            id="bt-paired-printer-select"
                            value={selectedDeviceAddress}
                            onChange={(e) => setSelectedDeviceAddress(e.target.value)}
                            className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-- Choose a Paired Printer --</option>
                            {pairedDevices.map((d) => (
                              <option key={d.address} value={d.address}>
                                {d.name} ({d.address})
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-slate-500">
                            Select your paired printer above. If your printer isn't in this list, pair it in Android Bluetooth Settings first, then tap Refresh.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-amber-50/70 border border-amber-200/80 p-3 text-xs text-amber-800 space-y-1.5">
                          <p className="font-semibold">No paired Bluetooth printers detected.</p>
                          <div className="text-[11px] text-amber-700 space-y-1">
                            <p>1. Turn on your thermal receipt printer.</p>
                            <p>2. Open Android <strong>Settings → Bluetooth (or Connected Devices)</strong> and pair your printer (PIN: <code>0000</code> or <code>1234</code>).</p>
                            <p>3. Tap <strong>Refresh Paired List</strong> above and tap Connect.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <FieldRow label="Thermal Paper Width" icon={Printer}>
                    <div className="grid grid-cols-2 gap-3 w-full">
                      <button
                        type="button"
                        onClick={() => handlePaperWidthChange('58mm')}
                        className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-all ${btStatus.paperWidth === '58mm'
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        <span>58mm (2-inch Portable)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePaperWidthChange('80mm')}
                        className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-all ${btStatus.paperWidth === '80mm'
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        <span>80mm (3-inch Desktop)</span>
                      </button>
                    </div>
                  </FieldRow>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button
                      type="button"
                      disabled={
                        isConnectingBt ||
                        (!btStatus.isNative && !btStatus.isSupported) ||
                        (btStatus.isNative && pairedDevices.length > 0 && !selectedDeviceAddress)
                      }
                      onClick={() => handleConnectBt()}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    >
                      <Bluetooth className={`h-4 w-4 ${isConnectingBt ? 'animate-spin' : ''}`} />
                      {isConnectingBt
                        ? 'Connecting...'
                        : btStatus.isConnected
                          ? 'Reconnect / Switch Printer'
                          : btStatus.isNative
                            ? 'Connect to Selected Printer'
                            : 'Scan & Connect Bluetooth Printer'}
                    </Button>

                    {btStatus.isConnected && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleTestPrintBt}
                          className="flex items-center gap-2 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        >
                          <Printer className="h-4 w-4 text-emerald-600" />
                          Test Print Receipt
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleTestDrawerBt}
                          className="flex items-center gap-2 border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100"
                        >
                          <Archive className="h-4 w-4 text-purple-600" />
                          Test Cash Drawer
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleDisconnectBt}
                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          Disconnect
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Barcode Scanner (Bluetooth & USB) */}
              <Card className="border-blue-200 bg-gradient-to-b from-blue-50/20 to-white shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50/60 px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                      <ScanBarcode className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">Barcode Scanner</span>
                        {scannerConfig.enabled ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${scannerConfig.connectionType.startsWith('bluetooth')
                            ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300'
                            : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                            }`}>
                            {scannerConfig.connectionType.startsWith('bluetooth') ? (
                              <>
                                <Bluetooth className="h-3 w-3 text-blue-600" />
                                Bluetooth Ready
                              </>
                            ) : (
                              <>
                                <Usb className="h-3 w-3 text-emerald-600" />
                                USB Ready
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Supports Bluetooth Wireless (HID/SPP) & USB Handheld Scanners
                      </p>
                    </div>
                  </div>
                  <Toggle
                    id="toggle-scanner"
                    checked={scannerConfig.enabled}
                    onChange={(checked) => updateScanner({ enabled: checked })}
                  />
                </div>

                <CardContent
                  className={`p-5 space-y-5 transition-opacity ${scannerConfig.enabled ? 'opacity-100' : 'opacity-35 pointer-events-none'
                    }`}
                >
                  {/* Scanner Connection Mode */}
                  <div>
                    <Label className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5 block">
                      Connection Method
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        {
                          id: 'bluetooth-hid' as ScannerConnectionType,
                          label: 'Bluetooth Wireless (HID Mode)',
                          badge: 'Recommended for Bluetooth',
                          sub: 'Standard wireless keyboard wedge. Works with Netum, Inateck, Eyoyo, Tera, Zebra, Honeywell, Symcode & ring scanners.',
                          icon: Bluetooth,
                        },
                        {
                          id: 'bluetooth-spp' as ScannerConnectionType,
                          label: 'Bluetooth SPP (Serial)',
                          badge: 'Direct Stream',
                          sub: 'Direct serial RFCOMM stream for dedicated Bluetooth barcode readers.',
                          icon: Radio,
                        },
                        {
                          id: 'usb-hid' as ScannerConnectionType,
                          label: 'USB Cable (HID Mode)',
                          badge: 'Plug & Play',
                          sub: 'Standard wired USB handheld or omnidirectional desktop laser barcode scanners.',
                          icon: Usb,
                        },
                        {
                          id: 'serial' as ScannerConnectionType,
                          label: 'USB Virtual COM / RS-232',
                          badge: 'Serial Port',
                          sub: 'Emulated virtual COM port connection for legacy retail POS barcode systems.',
                          icon: Cpu,
                        },
                      ].map((mode) => {
                        const Icon = mode.icon
                        const isSelected = scannerConfig.connectionType === mode.id
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => updateScanner({ connectionType: mode.id })}
                            className={`flex flex-col text-left p-3 rounded-xl border transition-all ${isSelected
                              ? 'border-blue-600 bg-blue-50/80 shadow-2xs ring-1 ring-blue-500'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60'
                              }`}
                          >
                            <div className="flex items-center justify-between gap-1 w-full mb-1">
                              <div className="flex items-center gap-1.5">
                                <Icon className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                                <span className="text-xs font-bold text-gray-800">{mode.label}</span>
                              </div>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                                  }`}
                              >
                                {mode.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 leading-snug">{mode.sub}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Bluetooth Android Guidance */}
                  {scannerConfig.connectionType.startsWith('bluetooth') && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <h4 className="text-xs font-bold text-blue-950">
                          How to connect your Bluetooth Scanner on Android Tablet:
                        </h4>
                      </div>
                      <ol className="text-[11px] text-blue-800 space-y-1 pl-5 list-decimal leading-relaxed">
                        <li>Turn on your Bluetooth barcode scanner.</li>
                        <li>
                          Scan the <strong>"Bluetooth HID Mode"</strong> or <strong>"Bluetooth Pairing"</strong> barcode from your scanner's user manual (usually page 1 or 2).
                        </li>
                        <li>
                          Open Android <strong>Settings → Bluetooth (Connected Devices)</strong> on this tablet and tap <strong>Pair new device</strong>.
                        </li>
                        <li>
                          Select your barcode scanner (e.g. <em>Netum-Scan, Eyoyo-BT, Barcode Scanner</em>). Once paired, scans will automatically beep and add items to cart!
                        </li>
                      </ol>

                      {btStatus.isNative && pairedDevices.length > 0 && (
                        <div className="pt-2 border-t border-blue-200/80">
                          <Label className="text-[11px] font-semibold text-blue-900 block mb-1">
                            Associated Paired Bluetooth Device (Optional):
                          </Label>
                          <select
                            value={scannerConfig.selectedDeviceAddress}
                            onChange={(e) => {
                              const dev = pairedDevices.find((d) => d.address === e.target.value)
                              updateScanner({
                                selectedDeviceAddress: e.target.value,
                                selectedDeviceName: dev?.name || '',
                              })
                            }}
                            className="h-8 w-full rounded-md border border-blue-200 bg-white px-2 text-xs text-blue-900"
                          >
                            <option value="">-- Any Paired Bluetooth Scanner (Default) --</option>
                            {pairedDevices.map((d) => (
                              <option key={d.address} value={d.address}>
                                {d.name} ({d.address})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Latency / Packet Speed Tolerance */}
                  <div>
                    <Label className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 block">
                      Bluetooth Wireless Latency Tolerance
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          id: 'relaxed' as LatencyTolerance,
                          label: 'Relaxed (240ms)',
                          rec: 'Recommended for Bluetooth',
                          desc: 'Handles Bluetooth RF packet timing jitter. Prevents dropped digits on tablets.',
                        },
                        {
                          id: 'standard' as LatencyTolerance,
                          label: 'Standard (140ms)',
                          rec: 'Balanced',
                          desc: 'Default tolerance for fast Bluetooth & wired barcode scanners.',
                        },
                        {
                          id: 'fast' as LatencyTolerance,
                          label: 'Fast (75ms)',
                          rec: 'High Speed',
                          desc: 'Optimized for high-speed wired USB presentation counter scanners.',
                        },
                      ].map((lat) => {
                        const isSelected = scannerConfig.latencyTolerance === lat.id
                        return (
                          <button
                            key={lat.id}
                            type="button"
                            onClick={() => updateScanner({ latencyTolerance: lat.id })}
                            className={`p-2.5 rounded-lg border text-left transition-all ${isSelected
                              ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-500'
                              : 'border-gray-200 bg-white hover:bg-gray-50'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-bold text-gray-800">{lat.label}</span>
                              {lat.rec && (
                                <span className={`text-[9px] font-bold px-1 rounded ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  {lat.rec}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-500">{lat.desc}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Audio & POS Automation Toggles */}
                  <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-xs font-semibold text-gray-800">Scanner Audio Feedback Beep</p>
                          <p className="text-[11px] text-gray-400">Crisp dual-tone POS beep on scan, low warning buzz on error</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => barcodeScanner.playFeedbackSound(true)}
                          className="h-7 text-[11px] px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          Test Beep
                        </Button>
                        <Toggle
                          id="toggle-scanner-audio"
                          checked={scannerConfig.audioFeedback}
                          onChange={(checked) => updateScanner({ audioFeedback: checked })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        <p className="text-xs font-semibold text-gray-800">Auto-Add Scanned Products to POS Cart</p>
                        <p className="text-[11px] text-gray-400">Automatically lookup SKU, Name, or Batch Number and add carton to cart</p>
                      </div>
                      <Toggle
                        id="toggle-scanner-autoadd"
                        checked={scannerConfig.autoAddToCart}
                        onChange={(checked) => updateScanner({ autoAddToCart: checked })}
                      />
                    </div>
                  </div>

                  {/* Live Scanner Interactive Test Console */}
                  <div className="rounded-xl border border-blue-200 bg-slate-900 p-4 text-white space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Live Scanner Test Console
                        </span>
                      </div>
                      {lastScanEvent && (
                        <button
                          type="button"
                          onClick={() => {
                            setLastScanEvent(null)
                            setScannerTestInput('')
                          }}
                          className="text-[11px] text-slate-400 hover:text-white underline"
                        >
                          Clear Test
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={scannerTestInput}
                        onChange={(e) => setScannerTestInput(e.target.value)}
                        placeholder="Scan any barcode with your Bluetooth scanner to test here..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs font-mono text-emerald-400 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>

                    {lastScanEvent ? (
                      <div className="rounded-lg bg-slate-800/80 p-3 border border-slate-700 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span className="text-xs font-bold text-slate-300">Scan Captured:</span>
                            <span className="font-mono text-sm font-extrabold text-emerald-400">
                              {lastScanEvent.barcode}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                            <span>Length: <strong>{lastScanEvent.rawLength} chars</strong></span>
                            <span>•</span>
                            <span>Speed: <strong>{lastScanEvent.durationMs} ms</strong></span>
                            <span>•</span>
                            <span>Source: <strong className="text-sky-300">{lastScanEvent.source === 'bluetooth' ? 'Bluetooth Wireless' : 'Keyboard/USB'}</strong></span>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/40">
                          <Check className="h-3.5 w-3.5" />
                          Ready for POS
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        Tip: Trigger your Bluetooth scanner on any product barcode. The scanned number will appear above with verification speed!
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Cash Drawer */}
              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <MonitorSpeaker className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">Cash Drawer</span>
                  </div>
                  <Toggle
                    id="toggle-drawer"
                    checked={bool('hw.drawerEnabled')}
                    onChange={() => toggle('hw.drawerEnabled')}
                  />
                </div>
                <CardContent
                  className={`p-5 space-y-4 transition-opacity ${bool('hw.drawerEnabled') ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}
                >
                  <FieldRow label="Drawer Port" icon={Usb}>
                    <select
                      id="hw-drawer-port"
                      value={form['hw.drawerPort']}
                      onChange={(e) => set('hw.drawerPort', e.target.value)}
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                      disabled={!bool('hw.drawerEnabled')}
                    >
                      {['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'Via Printer'].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="Pulse Duration (ms)" icon={ChevronRight}>
                    <Input
                      id="hw-drawer-pulse"
                      type="number"
                      min={100}
                      max={999}
                      value={form['hw.drawerPulseMs']}
                      onChange={(e) => set('hw.drawerPulseMs', e.target.value)}
                      className="h-9 text-sm"
                      disabled={!bool('hw.drawerEnabled')}
                    />
                  </FieldRow>
                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestDrawer}
                      className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 text-xs"
                    >
                      <Archive className="h-4 w-4" />
                      Test Open Cash Drawer
                    </Button>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">
                      The cash drawer will open automatically after each <strong>cash sale</strong> is completed at the POS. Pulse duration controls the open trigger length.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ── Floating Save Bar ────────────────────────────────────── */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-gray-400">
              {saved ? (
                <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <CheckCircle className="h-3.5 w-3.5" /> All changes saved successfully
                </span>
              ) : (
                'Changes are saved to the local database.'
              )}
            </p>
            <Button
              id="settings-save-bottom-btn"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
