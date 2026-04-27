package com.farmaplus.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String SCAN_ACTION = "com.farmaplus.SCAN";
    private static final String DATA_STRING = "com.symbol.datawedge.data_string";

    private final BroadcastReceiver scanReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (SCAN_ACTION.equals(action)) {
                String barcode = intent.getStringExtra(DATA_STRING);
                if (barcode != null) {
                    // Disparar evento a la capa de JavaScript con JSON válido
                    bridge.triggerWindowJSEvent("zebraScan", "{ \"detail\": { \"code\": \"" + barcode + "\" } }");
                }
            }
        }
    };

    @Override
    public void onResume() {
        super.onResume();
        IntentFilter filter = new IntentFilter(SCAN_ACTION);
        
        // Usar ContextCompat para manejar flags de exportación en Android 13+ (API 33+)
        // RECEIVER_EXPORTED permite recibir intents de otras apps como DataWedge
        ContextCompat.registerReceiver(this, scanReceiver, filter, ContextCompat.RECEIVER_EXPORTED);
    }

    @Override
    public void onPause() {
        super.onPause();
        unregisterReceiver(scanReceiver);
    }
}
