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
import android.graphics.drawable.Drawable;
import android.graphics.RectF;
import android.widget.RemoteViews;

import org.json.JSONArray;
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
    private static final int TILE_BG = Color.parseColor("#1F1F1E");
    private static final int INK3 = Color.parseColor("#898781");

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
        JSONArray days = null;

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
                days = data.optJSONArray("days");
                try {
                    verdictColor = Color.parseColor(data.getString("color"));
                } catch (IllegalArgumentException ignored) {
                }
                views.setTextViewText(R.id.widget_verdict, data.getString("verdict") + "  " + score);
                views.setTextViewText(R.id.widget_week, data.getString("weekLine"));
                views.setTextColor(R.id.widget_verdict, verdictColor);
            } catch (Exception e) {
                views.setTextViewText(R.id.widget_verdict, "Open Laufwerk");
            }
        } else {
            views.setTextViewText(R.id.widget_verdict, "Open Laufwerk");
            views.setTextViewText(R.id.widget_week, "to load readiness");
        }

        views.setImageViewBitmap(R.id.widget_days, drawWeek(context, density, days));

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
    /** The week, Mon to Sun: the widget main content. Mirrors the app week strip
     *  - done marks solid, planned faded, a dash for rest, today ringed. */
    private static final String[] WEEKDAYS = {"Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"};

    private static Bitmap drawWeek(Context ctx, float density, JSONArray days) {
        int cols = 7;
        int labelH = (int) (12 * density);
        int gapY = (int) (3 * density);
        int tileH = (int) (31 * density);
        int gapX = (int) (5 * density);
        int w = (int) (320 * density);
        int h = labelH + gapY + tileH;

        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint t = new Paint(Paint.ANTI_ALIAS_FLAG);
        t.setTextAlign(Paint.Align.CENTER);

        float tileW = (w - gapX * (cols - 1)) / (float) cols;
        float r = 8 * density;

        for (int i = 0; i < cols; i++) {
            JSONObject d = days != null ? days.optJSONObject(i) : null;
            float x = i * (tileW + gapX);
            float cx = x + tileW / 2f;
            boolean today = d != null && d.optBoolean("t", false);

            t.setColor(today ? Color.WHITE : INK3);
            t.setTextSize(10 * density);
            t.setFakeBoldText(today);
            // fall back to static labels: a payload written before the week
            // grid existed has no days, and blank tiles would look broken
            String label = d != null ? d.optString("l", WEEKDAYS[i]) : WEEKDAYS[i];
            c.drawText(label, cx, labelH - 2 * density, t);

            float top = labelH + gapY;
            p.setStyle(Paint.Style.FILL);
            p.setColor(TILE_BG);
            c.drawRoundRect(new RectF(x, top, x + tileW, top + tileH), r, r, p);
            if (today) {
                p.setStyle(Paint.Style.STROKE);
                p.setStrokeWidth(1.5f * density);
                p.setColor(SLOT_FILL);
                c.drawRoundRect(new RectF(x, top, x + tileW, top + tileH), r, r, p);
                p.setStyle(Paint.Style.FILL);
            }
            if (d == null) continue;

            drawDayMarks(ctx, c, t, p, d, cx, top + tileH / 2f, density);
        }
        return bmp;
    }

    /** Up to a few marks per tile, stacked and vertically centred. */
    private static void drawDayMarks(Context ctx, Canvas c, Paint t, Paint p, JSONObject d,
                                     float cx, float cy, float density) {
        JSONArray done = d.optJSONArray("w");
        JSONArray planned = d.optJSONArray("pw");
        boolean run = d.optBoolean("run", false);
        boolean plannedRun = d.optBoolean("pr", false);
        boolean rest = d.optBoolean("rest", false);

        int nDone = done != null ? done.length() : 0;
        int nPlanned = planned != null ? planned.length() : 0;
        int total = nDone + nPlanned + (run ? 1 : 0) + (plannedRun ? 1 : 0);

        if (total == 0) {
            if (rest) {
                p.setColor(d.optBoolean("restPlanned", false) ? INK3 : TRACK);
                float halfW = 6 * density;
                c.drawRoundRect(new RectF(cx - halfW, cy - density, cx + halfW, cy + density),
                        density, density, p);
            }
            return;
        }

        float rowH = 15 * density;
        float startY = cy - (total - 1) * rowH / 2f;
        int idx = 0;

        for (int i = 0; i < nDone; i++, idx++) {
            drawLetter(c, t, done.optString(i, "?"), cx, startY + idx * rowH, density, 255);
        }
        if (run) {
            drawRunGlyph(ctx, c, cx, startY + idx * rowH, density, 255);
            idx++;
        }
        for (int i = 0; i < nPlanned; i++, idx++) {
            drawLetter(c, t, planned.optString(i, "?"), cx, startY + idx * rowH, density, 105);
        }
        if (plannedRun) {
            drawRunGlyph(ctx, c, cx, startY + idx * rowH, density, 105);
        }
    }

    private static void drawLetter(Canvas c, Paint t, String id, float cx, float cy, float density, int alpha) {
        t.setColor(planColor(id));
        t.setAlpha(alpha);
        t.setTextSize(13 * density);
        t.setFakeBoldText(true);
        // centre on the glyph middle rather than the baseline
        Paint.FontMetrics fm = t.getFontMetrics();
        c.drawText(id, cx, cy - (fm.ascent + fm.descent) / 2f, t);
        t.setAlpha(255);
    }

    private static void drawRunGlyph(Context ctx, Canvas c, float cx, float cy, float density, int alpha) {
        Drawable run = androidx.core.content.ContextCompat.getDrawable(ctx, R.drawable.ic_run);
        if (run == null) return;
        int size = (int) (15 * density);
        run.setBounds((int) (cx - size / 2f), (int) (cy - size / 2f),
                (int) (cx + size / 2f), (int) (cy + size / 2f));
        run.setTint(SLOT_FILL);
        run.setAlpha(alpha);
        run.draw(c);
    }

    private static int planColor(String id) {
        if ("A".equals(id)) return CALI_FILL;
        if ("B".equals(id)) return Color.parseColor("#199E70");
        if ("C".equals(id)) return Color.parseColor("#B5773F");
        return Color.parseColor("#C3C2B7");
    }
}
