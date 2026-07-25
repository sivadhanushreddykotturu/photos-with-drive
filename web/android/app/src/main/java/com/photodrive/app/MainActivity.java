package com.photodrive.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Disable the WebView's native pinch-to-zoom so the app's own
    // pinch-to-zoom grid gesture owns the two-finger touch.
    WebView webView = getBridge().getWebView();
    if (webView != null) {
      webView.getSettings().setSupportZoom(false);
      webView.getSettings().setBuiltInZoomControls(false);
    }
  }
}
