package at.fmajcen.laufwerk;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BlurMaskFilter;
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
    /** --recency-hi: the same violet the app uses for calisthenics. */
    private static final int CALI_FILL = Color.parseColor("#A89DF0");

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
        int caliDone = 0;
        int caliPlanned = 0;

        if (raw != null) {
            try {
                JSONObject data = new JSONObject(raw);
                score = data.getInt("score");
                done = data.optInt("done", 0);
                planned = Math.max(1, data.optInt("planned", 2));
                // absent in payloads written before calisthenics existed, so
                // optInt(0) degrades to the old single-row look
                caliDone = data.optInt("caliDone", 0);
                caliPlanned = data.optInt("caliPlanned", 0);
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
        views.setImageViewBitmap(R.id.widget_slots, drawSlots(density, done, planned, caliDone, caliPlanned));
        views.setImageViewBitmap(R.id.widget_watermark, drawWatermark(density));

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            PendingIntent pi = PendingIntent.getActivity(
                    context, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        }

        mgr.updateAppWidget(id, views);
    }

    /** The app's hero gauge: 270° track from 135°, score sweep in verdict
     *  color with a soft glow underneath. */
    private static Bitmap drawRing(float density, int score, int color) {
        int size = (int) (80 * density);
        float stroke = 8f * density;
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);

        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(stroke);
        p.setStrokeCap(Paint.Cap.ROUND);

        float half = stroke / 2f + 4 * density;
        RectF box = new RectF(half, half, size - half, size - half);

        p.setColor(TRACK);
        c.drawArc(box, 135f, 270f, false, p);

        if (score >= 0) {
            float sweep = 270f * Math.min(score, 100) / 100f;

            // glow pass
            Paint glow = new Paint(p);
            glow.setColor(color);
            glow.setAlpha(110);
            glow.setMaskFilter(new BlurMaskFilter(5 * density, BlurMaskFilter.Blur.NORMAL));
            c.drawArc(box, 135f, sweep, false, glow);

            p.setColor(color);
            c.drawArc(box, 135f, sweep, false, p);
        }
        return bmp;
    }

    /** Faint brand watermark: the app icon's arc-and-dot motif. */
    private static Bitmap drawWatermark(float density) {
        int size = (int) (92 * density);
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);

        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeCap(Paint.Cap.ROUND);

        float cx = size * 0.62f;
        float cy = size / 2f;
        float rOuter = size * 0.40f;
        float rInner = size * 0.22f;

        // violet platter arc
        p.setStrokeWidth(6.5f * density);
        p.setColor(Color.parseColor("#7A6BD8"));
        p.setAlpha(34);
        c.drawArc(new RectF(cx - rOuter, cy - rOuter, cx + rOuter, cy + rOuter), -75f, 300f, false, p);

        // inner track
        p.setStrokeWidth(2.5f * density);
        p.setAlpha(22);
        c.drawArc(new RectF(cx - rInner, cy - rInner, cx + rInner, cy + rInner), 0f, 360f, false, p);

        // start dot
        p.setStyle(Paint.Style.FILL);
        p.setColor(Color.parseColor("#2CA02C"));
        p.setAlpha(40);
        c.drawCircle(cx, cy - rOuter, 4.5f * density, p);

        return bmp;
    }

    /** Two rows of pills: runs on top, calisthenics below, filled = done.
     *  Mirrors the week card in the app, and matches the "Runs x/y - Cali x/y"
     *  line the widget already prints above it. */
    private static Bitmap drawSlots(float density, int done, int planned, int caliDone, int caliPlanned) {
        int rowH = (int) (10 * density);
        int rowGap = (int) (6 * density);
        int w = (int) (200 * density);
        boolean twoRows = caliPlanned > 0 || caliDone > 0;
        int h = twoRows ? rowH * 2 + rowGap : rowH;

        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);

        drawRow(c, p, 0, w, rowH, done, Math.max(planned, done), SLOT_FILL);
        if (twoRows) {
            drawRow(c, p, rowH + rowGap, w, rowH, caliDone, Math.max(caliPlanned, caliDone), CALI_FILL);
        }
        return bmp;
    }

    private static void drawRow(Canvas c, Paint p, float top, int w, int rowH, int done, int slots, int fill) {
        if (slots < 1) return;
        float gap = rowH * 0.6f;
        float segW = (w - gap * (slots - 1)) / (float) slots;
        float r = rowH / 2f;
        for (int i = 0; i < slots; i++) {
            float x = i * (segW + gap);
            p.setColor(i < done ? fill : TRACK);
            c.drawRoundRect(new RectF(x, top, x + segW, top + rowH), r, r, p);
        }
    }
}
