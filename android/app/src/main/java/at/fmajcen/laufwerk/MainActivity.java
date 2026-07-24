package at.fmajcen.laufwerk;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onPause() {
        super.onPause();
        // the web app refreshed its widget snapshot while in the foreground;
        // push it to any home-screen widgets as we leave
        ReadinessWidget.refreshAll(this);
    }
}
