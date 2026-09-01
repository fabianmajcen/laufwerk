package at.fmajcen.laufwerk;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

public class MainActivity extends BridgeActivity {

    /** last insets seen, in CSS px, so they can be re-published once the page exists */
    private float topDp = 0f;
    private float bottomDp = 0f;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // targetSdk 36 means Android lays us out edge to edge, behind the status
        // and navigation bars, and this WebView reports env(safe-area-inset-*)
        // as 0. So CSS has no way to learn how tall the nav bar is, and anything
        // pinned to the bottom of the h-dvh shell (the tab bar, the player dock,
        // a bottom sheet) ends up underneath it. Publish the real insets as
        // custom properties instead; every consumer keeps a hardcoded floor as
        // its fallback, so if this never arrives nothing gets worse.
        View root = findViewById(android.R.id.content);
        if (root != null) {
            ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
                Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                float density = getResources().getDisplayMetrics().density;
                topDp = bars.top / density;
                bottomDp = bars.bottom / density;
                publishInsets();
                return insets;
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // the first inset pass can land before the page is loaded, in which case
        // the script went nowhere. Ask for a re-dispatch, and publish what we
        // already know in case no new pass comes.
        View root = findViewById(android.R.id.content);
        if (root != null) ViewCompat.requestApplyInsets(root);
        publishInsets();
    }

    private void publishInsets() {
        if (getBridge() == null) return;
        final WebView web = getBridge().getWebView();
        if (web == null) return;
        final String js = String.format(
                Locale.US,
                "(function(){var s=document.documentElement.style;"
                        + "s.setProperty('--safe-top','%.1fpx');"
                        + "s.setProperty('--safe-bottom','%.1fpx');})()",
                topDp,
                bottomDp);
        web.post(() -> web.evaluateJavascript(js, null));
    }

    @Override
    public void onPause() {
        super.onPause();
        // the web app refreshed its widget snapshot while in the foreground;
        // push it to any home-screen widgets as we leave
        ReadinessWidget.refreshAll(this);
    }
}
