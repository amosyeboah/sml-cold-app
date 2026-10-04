package com.smllegacy.coldstore;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Base64;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "NativeBluetoothPrinter",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        )
    }
)
public class BluetoothPrinterPlugin extends Plugin {

    // Standard Serial Port Profile (SPP) UUID for ESC/POS Thermal Receipt Printers
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothAdapter bluetoothAdapter;
    private BluetoothSocket currentSocket;
    private OutputStream currentOutputStream;
    private String connectedAddress = null;
    private String connectedName = null;

    @Override
    public void load() {
        super.load();
        try {
            bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        } catch (Exception e) {
            bluetoothAdapter = null;
        }
    }

    private boolean checkBluetoothPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        if (bluetoothAdapter == null) {
            ret.put("available", false);
            ret.put("enabled", false);
        } else {
            ret.put("available", true);
            ret.put("enabled", bluetoothAdapter.isEnabled());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        if (bluetoothAdapter == null) {
            call.reject("Bluetooth adapter not available on this device.");
            return;
        }

        if (!bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is currently turned OFF. Please turn ON Bluetooth in Android device settings.");
            return;
        }

        if (!checkBluetoothPermission()) {
            requestPermissionForAlias("bluetooth", call, "listPairedDevicesCallback");
            return;
        }

        fetchPairedDevices(call);
    }

    @PermissionCallback
    private void listPairedDevicesCallback(PluginCall call) {
        if (checkBluetoothPermission()) {
            fetchPairedDevices(call);
        } else {
            call.reject("Bluetooth permission denied. Please grant Bluetooth permission in Android App settings.");
        }
    }

    private void fetchPairedDevices(PluginCall call) {
        try {
            Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
            JSArray devices = new JSArray();

            if (pairedDevices != null) {
                for (BluetoothDevice device : pairedDevices) {
                    JSObject d = new JSObject();
                    String name = null;
                    try {
                        name = device.getName();
                    } catch (SecurityException ignored) {}
                    d.put("name", name != null ? name : "Unknown Bluetooth Device");
                    d.put("address", device.getAddress());
                    devices.put(d);
                }
            }

            JSObject ret = new JSObject();
            ret.put("devices", devices);
            call.resolve(ret);
        } catch (SecurityException se) {
            call.reject("Bluetooth permission required: " + se.getMessage());
        } catch (Exception e) {
            call.reject("Failed to list paired devices: " + e.getMessage());
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.trim().isEmpty()) {
            call.reject("Device Bluetooth MAC address is required.");
            return;
        }

        if (bluetoothAdapter == null) {
            call.reject("Bluetooth adapter not available on this device.");
            return;
        }

        if (!bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is turned OFF. Please turn it ON in Android settings.");
            return;
        }

        if (!checkBluetoothPermission()) {
            requestPermissionForAlias("bluetooth", call, "connectCallback");
            return;
        }

        doConnect(address.trim(), call);
    }

    @PermissionCallback
    private void connectCallback(PluginCall call) {
        if (checkBluetoothPermission()) {
            String address = call.getString("address");
            if (address != null && !address.trim().isEmpty()) {
                doConnect(address.trim(), call);
            } else {
                call.reject("Device Bluetooth MAC address is required.");
            }
        } else {
            call.reject("Bluetooth permission denied.");
        }
    }

    private void doConnect(String address, PluginCall call) {
        new Thread(() -> {
            try {
                disconnectInternal();

                try {
                    bluetoothAdapter.cancelDiscovery();
                } catch (SecurityException ignored) {}

                BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
                BluetoothSocket socket = null;

                // 1. Try standard SPP RFCOMM socket
                try {
                    socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                } catch (Exception e1) {
                    // 2. Reflection fallback for POS printers that require hidden RFCOMM port
                    try {
                        Method m = device.getClass().getMethod("createRfcommSocket", new Class[]{int.class});
                        socket = (BluetoothSocket) m.invoke(device, 1);
                        if (socket != null) {
                            socket.connect();
                        } else {
                            throw new IOException("Socket creation returned null");
                        }
                    } catch (Exception e2) {
                        if (socket != null) {
                            try { socket.close(); } catch (Exception ignored) {}
                        }
                        throw new IOException("Could not connect to " + address + ": " + (e1.getMessage() != null ? e1.getMessage() : e2.getMessage()));
                    }
                }

                currentSocket = socket;
                currentOutputStream = socket.getOutputStream();
                connectedAddress = address;

                String deviceName = "Bluetooth Printer";
                try {
                    if (device.getName() != null) {
                        deviceName = device.getName();
                    }
                } catch (SecurityException ignored) {}
                connectedName = deviceName;

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("name", connectedName);
                ret.put("address", connectedAddress);
                call.resolve(ret);
            } catch (SecurityException se) {
                disconnectInternal();
                call.reject("Bluetooth permission required: " + se.getMessage());
            } catch (Exception e) {
                disconnectInternal();
                call.reject("Failed to connect to printer: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        disconnectInternal();
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    private synchronized void disconnectInternal() {
        try {
            if (currentOutputStream != null) {
                currentOutputStream.close();
            }
        } catch (Exception ignored) {}

        try {
            if (currentSocket != null) {
                currentSocket.close();
            }
        } catch (Exception ignored) {}

        currentOutputStream = null;
        currentSocket = null;
        connectedAddress = null;
        connectedName = null;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        boolean connected = currentSocket != null && currentSocket.isConnected();
        JSObject ret = new JSObject();
        ret.put("isConnected", connected);
        ret.put("deviceName", connected ? connectedName : null);
        ret.put("deviceId", connected ? connectedAddress : null);
        call.resolve(ret);
    }

    @PluginMethod
    public void printRaw(PluginCall call) {
        String base64Data = call.getString("data");
        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("No print data provided.");
            return;
        }

        if (currentSocket == null || !currentSocket.isConnected() || currentOutputStream == null) {
            call.reject("Bluetooth printer is not connected.");
            return;
        }

        new Thread(() -> {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                currentOutputStream.write(bytes);
                currentOutputStream.flush();
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (IOException ioe) {
                disconnectInternal();
                call.reject("Printer communication lost: " + ioe.getMessage());
            } catch (Exception e) {
                call.reject("Print error: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void openCashDrawer(PluginCall call) {
        if (currentSocket == null || !currentSocket.isConnected() || currentOutputStream == null) {
            call.reject("Bluetooth printer is not connected.");
            return;
        }

        new Thread(() -> {
            try {
                // ESC/POS Pulse Codes: Pin 2, Pin 5, Real-time kick, BEL
                byte[] kickBytes = new byte[] {
                    0x1b, 0x70, 0x00, 0x19, (byte) 0xfa,
                    0x1b, 0x70, 0x01, 0x19, (byte) 0xfa,
                    0x10, 0x14, 0x01, 0x00, 0x05,
                    0x07
                };
                currentOutputStream.write(kickBytes);
                currentOutputStream.flush();
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (IOException ioe) {
                disconnectInternal();
                call.reject("Drawer kick failed: " + ioe.getMessage());
            } catch (Exception e) {
                call.reject("Cash drawer error: " + e.getMessage());
            }
        }).start();
    }

    @Override
    protected void handleOnDestroy() {
        disconnectInternal();
        super.handleOnDestroy();
    }
}
