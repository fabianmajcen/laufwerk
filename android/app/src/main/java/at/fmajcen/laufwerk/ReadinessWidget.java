package at.fmajcen.laufwerk;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Home-screen widget: readiness ring + verdict + week slot pills, matching
 * the app's hero card. RemoteViews can't draw, so the ring and slots are
 * rendered into bitmaps here.
 */
public class ReadinessWidget extends AppWidgetProvider {

    private static final int TRACK = Color.parseColor("#2C2C2A");
    private static final int SLOT_FILL = Color.parseColor("#3987E5");

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
        float density = context.getResources().getDisplayMetrics().density;

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String raw = prefs.getString("widgetData", null);

        int score = -1;
        int verdictColor = Color.WHITE;
        int done = 0;
        int planned = 2;

        if (raw != null) {
            try {
                JSONObject data = new JSONObject(raw);
                score = data.getInt("score");
                done = data.optInt("done", 0);
                planned = Math.max(1, data.optInt("planned", 2));
                try {
                    verdictColor = Color.parseColor(data.getString("color"));
                } catch (IllegalArgumentException ignored) {
                }
                views.setTextViewText(R.id.widget_score, String.valueOf(score));
                views.setTextViewText(R.id.widget_verdict, data.getString("verdict"));
                views.setTextViewText(R.id.widget_week, data.getString("weekLine"));
                views.setTextColor(R.id.widget_verdict, verdictColor);
            } catch (Exception e) {
                views.setTextViewText(R.id.widget_verdict, "Open Laufwerk");
            }
        } else {
            views.setTextViewText(R.id.widget_score, "—");
            views.setTextViewText(R.id.widget_verdict, "Open Laufwerk");
            views.setTextViewText(R.id.widget_week, "to load readiness");
        }

        views.setImageViewBitmap(R.id.widget_ring, drawRing(density, score, verdictColor));
        views.setImageViewBitmap(R.id.widget_slots, drawSlots(density, done, planned));

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            PendingIntent pi = PendingIntent.getActivity(
                    context, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        }

        mgr.updateAppWidget(id, views);
    }

    /** The app's hero gauge: 270° track from 135°, score sweep in verdict color. */
    private static Bitmap drawRing(float density, int score, int color) {
        int size = (int) (76 * density);
        float stroke = 7.5f * density;
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);

        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(stroke);
        p.setStrokeCap(Paint.Cap.ROUND);

        float half = stroke / 2f + 1;
        RectF box = new RectF(half, half, size - half, size - half);

        p.setColor(TRACK);
        c.drawArc(box, 135f, 270f, false, p);

        if (score >= 0) {
            p.setColor(color);
            c.drawArc(box, 135f, 270f * Math.min(score, 100) / 100f, false, p);
        }
        return bmp;
    }

    /** The week's run slots as rounded pills, filled = done. */
    private static Bitmap drawSlots(float density, int done, int planned) {
        int slots = Math.max(planned, done);
        int h = (int) (10 * density);
        int gap = (int) (6 * density);
        int w = (int) (200 * density);
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);

        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        float segW = (w - gap * (slots - 1)) / (float) slots;
        float r = h / 2f;

        for (int i = 0; i < slots; i++) {
            float x = i * (segW + gap);
            p.setColor(i < done ? SLOT_FILL : TRACK);
            c.drawRoundRect(new RectF(x, 0, x + segW, h), r, r, p);
        }
        return bmp;
    }
}
