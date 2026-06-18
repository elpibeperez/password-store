package com.passmanager.app;

import android.os.Bundle;
import android.os.Environment;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        try {
            WebView wv = bridge.getWebView();
            if (wv != null) {
                // Store path: app's internal files directory
                String storePath = getFilesDir().getAbsolutePath() + "/password-store";

                // Register native bridges
                wv.addJavascriptInterface(new FileBridge(storePath), "FileBridge");
                wv.addJavascriptInterface(new GitBridge(storePath), "GitBridge");
            }
        } catch (Exception ignored) {}
    }
}
