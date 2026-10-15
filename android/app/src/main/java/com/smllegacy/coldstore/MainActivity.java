package com.smllegacy.coldstore;

import android.os.Bundle;
import android.view.View;
import androidx.core.view.ViewCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BluetoothPrinterPlugin.class);
        super.onCreate(savedInstanceState);

        // Ensure the WebView parent layout does not apply double-padding when the software keyboard opens
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> {
                View parent = (View) getBridge().getWebView().getParent();
                if (parent != null) {
                    ViewCompat.setOnApplyWindowInsetsListener(parent, (v, insets) -> {
                        v.setPadding(0, 0, 0, 0);
                        return insets;
                    });
                }
            });
        }
    }
}

