package com.gharmitra.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

public class MainActivity extends Activity {

    private static final String APP_URL = "https://atharvamali54-sudo.github.io/gharmita-in/gharkam/index.html";
    private static final int PERMISSION_REQUEST_CODE = 101;
    private static final int FILE_CHOOSER_REQUEST_CODE = 102;

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileUploadCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // =========================================================
        // BLOCK SCREENSHOTS & SCREEN RECORDING (FLAG_SECURE)
        // Hard-blocks hardware buttons (Power + Volume) & 3-finger swipe
        // =========================================================
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
        );

        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progressBar);

        requestAppPermissions();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);

        String defaultUA = settings.getUserAgentString();
        // Remove '; wv' and 'Version/X.X' so Razorpay and web gateways recognize standard Chrome Mobile and display UPI
        String cleanedUA = defaultUA.replace("; wv", "").replaceAll("Version\\/\\d+\\.\\d+\\s*", "");
        settings.setUserAgentString(cleanedUA);

        // Enable third-party cookies for payment gateways and banking authentication
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    return handleCustomUrl(view, request.getUrl().toString());
                }
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleCustomUrl(view, url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    return false;
                }
                return true;
            }
        });

        webView.loadUrl(APP_URL);
    }

    /**
     * Intercepts and dispatches custom URI schemes (UPI payments, intents, calls, whatsapp, maps)
     */
    private boolean handleCustomUrl(WebView view, String url) {
        if (url == null || url.trim().isEmpty()) {
            return false;
        }

        // 1. Direct UPI / Payment app schemes (Google Pay, PhonePe, Paytm, BHIM, Cred, etc.)
        if (url.startsWith("upi://") || url.startsWith("tez://") ||
            url.startsWith("phonepe://") || url.startsWith("paytmmp://") ||
            url.startsWith("bhim://") || url.startsWith("credpay://") ||
            url.startsWith("gpay://")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
                return true;
            } catch (ActivityNotFoundException e) {
                Toast.makeText(MainActivity.this, "मोबाईलमध्ये कोणतेही UPI ॲप (GPay / PhonePe / Paytm) सापडले नाही.", Toast.LENGTH_LONG).show();
                return true;
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "पेमेंट उघडताना त्रुटी: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                return true;
            }
        }

        // 2. Android Intent schemes (e.g. intent://...#Intent;scheme=upi;package=...;end)
        if (url.startsWith("intent://")) {
            try {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                if (intent != null) {
                    PackageManager pm = getPackageManager();
                    if (intent.resolveActivity(pm) != null) {
                        startActivity(intent);
                        return true;
                    }
                    // Try fallback URL if available
                    String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                    if (fallbackUrl != null && !fallbackUrl.isEmpty()) {
                        view.loadUrl(fallbackUrl);
                        return true;
                    }
                    // Try opening Google Play Store if package is specified
                    String packageName = intent.getPackage();
                    if (packageName != null && !packageName.isEmpty()) {
                        try {
                            Intent marketIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + packageName));
                            startActivity(marketIntent);
                            return true;
                        } catch (ActivityNotFoundException ignored) {}
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            return true;
        }

        // 3. Communications & Maps schemes
        if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("sms:") ||
            url.startsWith("whatsapp:") || url.contains("api.whatsapp.com") || url.contains("wa.me") ||
            url.contains("maps.google.com") || url.contains("goo.gl/maps")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
                return true;
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "ॲप उघडता आले नाही", Toast.LENGTH_SHORT).show();
                return true;
            }
        }

        // 4. Default: Standard HTTP / HTTPS navigation remains within WebView
        return false;
    }

    private void requestAppPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String[] permissions = new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            };
            boolean need = false;
            for (String perm : permissions) {
                if (checkSelfPermission(perm) != PackageManager.PERMISSION_GRANTED) {
                    need = true;
                    break;
                }
            }
            if (need) {
                requestPermissions(permissions, PERMISSION_REQUEST_CODE);
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    }
                }
                fileUploadCallback.onReceiveValue(results);
                fileUploadCallback = null;
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
