package at.fmajcen.laufwerk;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Home-screen widget: readiness score + verdict + week progress. Reads the
 * snapshot the web app writes into Capacitor's SharedPreferences; refreshed
 * whenever the app pauses (MainActivity) and on the periodic widget cycle.
 */
public class ReadinessWidget extends AppWidgetProvider {

    public static void refreshAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(context, ReadinessWidget.class));
        for (int id : ids) {
            update(context, mgr, id);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            update(context, mgr, id);
        }
    }

    private static void update(Context context, AppWidgetManager mgr, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_readiness);

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String raw = prefs.getString("widgetData", null);

        if (raw != null) {
            try {
                JSONObject data = new JSONObject(raw);
                views.setTextViewText(R.id.widget_score, String.valueOf(data.getInt("score")));
                views.setTextViewText(R.id.widget_verdict, data.getString("verdict"));
                views.setTextViewText(R.id.widget_week, data.getString("weekLine"));
                try {
                    views.setTextColor(R.id.widget_verdict, Color.parseColor(data.getString("color")));
                } catch (IllegalArgumentException ignored) {
                }
            } catch (Exception e) {
                views.setTextViewText(R.id.widget_verdict, "Open Laufwerk");
            }
        } else {
            views.setTextViewText(R.id.widget_score, "—");
            views.setTextViewText(R.id.widget_verdict, "Open Laufwerk");
            views.setTextViewText(R.id.widget_week, "to load readiness");
        }

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            PendingIntent pi = PendingIntent.getActivity(
                    context, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        }

        mgr.updateAppWidget(id, views);
    }
}
