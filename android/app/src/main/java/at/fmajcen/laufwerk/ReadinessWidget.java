package at.fmajcen.laufwerk;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget: the training week, Mon to Sun.
 *
 * The whole thing is one bitmap drawn at the widget's ACTUAL pixel size, read
 * from the AppWidgetManager options. That is what keeps it honest in a single
 * home-screen cell: a fixed-size bitmap stretched with fitXY either distorted
 * or left dead space, and RemoteViews cannot measure text for us. Drawing to
 * the real size also lets the extras (counters) appear only when the user has
 * actually made the widget tall enough for them.
 */
public class ReadinessWidget extends AppWidgetProvider {

    // The card gradient behind us is #232322 -> #161615, so tiles have to sit
    // clearly above that or the grid disappears (they did, at #1F1F1E).
    private static final int TILE_BG = Color.parseColor("#332F2C");
    private static final int TILE_BG_TODAY = Color.parseColor("#3D3833");
    private static final int INK = Color.parseColor("#FFFFFF");
    private static final int INK2 = Color.parseColor("#C3C2B7");
    private static final int REST_PLANNED = Color.parseColor("#9C9A93");
    private static final int REST_IMPLIED = Color.parseColor("#57544E");
    private static final int RUN_FILL = Color.parseColor("#4E96EE");
    /** workouts, matching the violet the app uses for calisthenics */
    private static final int CALI_FILL = Color.parseColor("#A89DF0");
    /** unfilled part of a progress bar */
    private static final int TRACK = Color.parseColor("#3A3733");

    private static final String[] WEEKDAYS = {"Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"};
    /** knocked out of a done stamp, so the mark colour carries the identity */
    private static final int STAMP_INK = Color.parseColor("#14130F");

    /** Both providers, since one payload feeds both. */
    public static void refreshAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        for (int id : mgr.getAppWidgetIds(new ComponentName(context, ReadinessWidget.class))) {
            render(context, mgr, id, false);
        }
        for (int id : mgr.getAppWidgetIds(new ComponentName(context, WeekWidget.class))) {
            render(context, mgr, id, true);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            render(context, mgr, id, false);
        }
    }

    /** Resizing changes what fits, so redraw at the new size. */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int id, Bundle newOptions) {
        render(context, mgr, id, false);
    }

    /** @param twoLine the taller variant: readiness and progress bars on top,
     *                 the week underneath. False is the one-cell week-only one. */
    static void render(Context context, AppWidgetManager mgr, int id, boolean twoLine) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_readiness);
        float density = context.getResources().getDisplayMetrics().density;

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String raw = prefs.getString("widgetData", null);

        JSONArray days = null;
        int runsDone = 0, runsPlanned = 2, caliDone = 0, caliPlanned = 3;
        String km = null;
        int score = -1;
        String verdict = null;
        int verdictColor = INK2;

        if (raw != null) {
            try {
                JSONObject data = new JSONObject(raw);
                days = data.optJSONArray("days");
                runsDone = data.optInt("done", 0);
                runsPlanned = Math.max(1, data.optInt("planned", 2));
                caliDone = data.optInt("caliDone", 0);
                caliPlanned = Math.max(1, data.optInt("caliPlanned", 3));
                km = data.optString("km", null);
                score = data.optInt("score", -1);
                verdict = data.optString("verdict", null);
                try {
                    verdictColor = Color.parseColor(data.optString("color", "#C3C2B7"));
                } catch (Exception ignored2) {
                    verdictColor = INK2;
                }
            } catch (Exception ignored) {
                // fall through and draw an empty week rather than nothing
            }
        }

        // The widget's real size, in dp. The four OPTION_* values are a RANGE, not
        // a size: portrait shows the narrow-but-tall end (MIN_WIDTH, MAX_HEIGHT)
        // and landscape the wide-but-short end. Reading MIN_HEIGHT in portrait
        // gave a bitmap far shorter than the view, which is what left a third of
        // the widget as dead space under the calendar.
        Bundle opts = mgr.getAppWidgetOptions(id);
        boolean portrait =
                context.getResources().getConfiguration().orientation != Configuration.ORIENTATION_LANDSCAPE;
        int wRaw = opts.getInt(portrait
                ? AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH
                : AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0);
        int hRaw = opts.getInt(portrait
                ? AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT
                : AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        // a launcher that reports only the other end of the range still works
        if (wRaw <= 0) wRaw = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 250);
        if (hRaw <= 0) hRaw = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, twoLine ? 110 : 56);
        int wDp = clamp(wRaw, 120, 640);
        int hDp = clamp(hRaw, 40, 400);

        views.setImageViewBitmap(
                R.id.widget_days,
                draw(context, density, wDp, hDp, days, runsDone, runsPlanned, caliDone, caliPlanned, km,
                        twoLine, score, verdict, verdictColor));

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(
                    context, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        }
        mgr.updateAppWidget(id, views);
    }

    private static int clamp(int v, int lo, int hi) {
        return v < lo ? lo : Math.min(v, hi);
    }

    private static Bitmap draw(Context ctx, float d, int wDp, int hDp, JSONArray days,
                               int runsDone, int runsPlanned, int caliDone, int caliPlanned, String km,
                               boolean twoLine, int score, String verdict, int verdictColor) {
        int w = (int) (wDp * d);
        int h = (int) (hDp * d);
        Bitmap bmp = Bitmap.createBitmap(Math.max(w, 1), Math.max(h, 1), Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);

        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint t = new Paint(Paint.ANTI_ALIAS_FLAG);
        t.setTextAlign(Paint.Align.CENTER);

        // Every measurement below scales with the real widget size. Fixed dp
        // constants looked right at one size and broke at the others: at half
        // width the weekday labels grew wider than their own tiles, and at the
        // 48dp minimum height the tiles ran flush off the bottom edge.
        float padX = Math.min(10 * d, w * 0.035f);
        float padY = Math.min(10 * d, Math.max(4 * d, h * 0.11f));
        float innerW = w - padX * 2;
        float labelH = Math.min(12 * d, h * 0.22f);
        float gapY = Math.min(3 * d, h * 0.05f);

        // The two-line variant spends its first line on readiness plus the two
        // progress bars, so it does not also want the compact counters row.
        // Capped hard: at two cells a 42% band left the tiles at 26dp and the
        // marks inside them unreadable, and the week is the point of the widget.
        // 32% keeps the top line legible while the tiles stay in the mid 30s.
        float topH = twoLine ? Math.min(46 * d, h * 0.30f) : 0;
        boolean withCounters = !twoLine && hDp >= 92;
        float countersH = withCounters ? 18 * d : 0;
        float avail = h - padY * 2 - topH - (twoLine ? gapY * 2 : 0)
                - labelH - gapY - countersH - (withCounters ? 6 * d : 0);
        // clamp the FLOOR against what is actually available, so a short widget
        // shrinks its tiles instead of overflowing
        float tileH = Math.min(Math.max(avail, Math.min(avail, 18 * d)), 68 * d);

        float gapX = Math.min(5 * d, innerW * 0.022f);
        float tileW = (innerW - gapX * 6) / 7f;
        // a tile taller than ~1.6x its width stops reading as a tile and starts
        // reading as a stretched pill; the leftover is centred, not dumped below
        tileH = Math.min(tileH, tileW * 1.25f);
        // Whatever is left over after the caps (tileH stops at 68dp) is split
        // above and below instead of all piling up under the calendar.
        float contentH = topH + (twoLine ? gapY * 2 : 0) + labelH + gapY + tileH
                + (withCounters ? 6 * d + countersH : 0);
        float originY = Math.max(padY, (h - contentH) / 2f);
        float gridTop = originY + (twoLine ? topH + gapY * 2 : 0);
        float top = gridTop + labelH + gapY;
        float r = Math.min(10 * d, tileW / 3f);
        // the label must fit its own tile, not just look right at one width
        float labelSize = Math.min(Math.min(11 * d, tileW * 0.52f), labelH * 0.92f);

        for (int i = 0; i < 7; i++) {
            JSONObject day = days != null ? days.optJSONObject(i) : null;
            float x = padX + i * (tileW + gapX);
            float cx = x + tileW / 2f;
            boolean today = day != null && day.optBoolean("t", false);

            t.setColor(today ? INK : INK2);
            t.setTextSize(labelSize);
            t.setFakeBoldText(today);
            String label = day != null ? day.optString("l", WEEKDAYS[i]) : WEEKDAYS[i];
            c.drawText(label, cx, gridTop + labelH - labelH * 0.16f, t);

            RectF tile = new RectF(x, top, x + tileW, top + tileH);
            p.setStyle(Paint.Style.FILL);
            p.setColor(today ? TILE_BG_TODAY : TILE_BG);
            c.drawRoundRect(tile, r, r, p);
            if (today) {
                p.setStyle(Paint.Style.STROKE);
                p.setStrokeWidth(2 * d);
                p.setColor(RUN_FILL);
                c.drawRoundRect(tile, r, r, p);
                p.setStyle(Paint.Style.FILL);
            }
            if (day != null) drawDayMarks(ctx, c, t, p, day, cx, top + tileH / 2f, tileW, tileH, d);
        }

        if (withCounters) {
            drawCounters(ctx, c, t, p, padX, top + tileH + 6 * d, innerW, countersH, d,
                    runsDone, runsPlanned, caliDone, caliPlanned, km);
        }
        if (twoLine) {
            drawTopLine(ctx, c, t, p, padX, originY, innerW, topH, d,
                    runsDone, runsPlanned, caliDone, caliPlanned, km, score, verdict, verdictColor);
        }
        return bmp;
    }

    /** Marks for one day, stacked and centred. Done is a FILLED stamp with the
     *  letter or run glyph knocked out of it; planned is the same disc as an
     *  outline. Fill versus outline is a shape difference, so unlike the alpha
     *  step it used to be it survives being 30dp wide on a bright screen. */
    private static void drawDayMarks(Context ctx, Canvas c, Paint t, Paint p, JSONObject day,
                                     float cx, float cy, float tileW, float tileH, float d) {
        JSONArray done = day.optJSONArray("w");
        JSONArray planned = day.optJSONArray("pw");
        boolean run = day.optBoolean("run", false);
        boolean plannedRun = day.optBoolean("pr", false);

        int nDone = done != null ? done.length() : 0;
        int nPlanned = planned != null ? planned.length() : 0;
        int total = nDone + nPlanned + (run ? 1 : 0) + (plannedRun ? 1 : 0);

        if (total == 0) {
            if (day.optBoolean("rest", false)) {
                p.setColor(day.optBoolean("restPlanned", false) ? REST_PLANNED : REST_IMPLIED);
                float halfW = 7 * d;
                float halfT = 1.5f * d;
                c.drawRoundRect(new RectF(cx - halfW, cy - halfT, cx + halfW, cy + halfT), halfT, halfT, p);
            }
            return;
        }

        float slotH = tileH / total;
        float disc = Math.min(Math.min(tileW * 0.90f, slotH * 0.86f), 34 * d);
        float startY = cy - (total - 1) * slotH / 2f;
        int idx = 0;

        for (int i = 0; i < nDone; i++, idx++) {
            stamp(ctx, c, t, p, planColor(done.optString(i, "?")), done.optString(i, "?"),
                    cx, startY + idx * slotH, disc, true, d);
        }
        if (run) {
            stamp(ctx, c, t, p, RUN_FILL, null, cx, startY + idx * slotH, disc, true, d);
            idx++;
        }
        for (int i = 0; i < nPlanned; i++, idx++) {
            stamp(ctx, c, t, p, planColor(planned.optString(i, "?")), planned.optString(i, "?"),
                    cx, startY + idx * slotH, disc, false, d);
        }
        if (plannedRun) {
            stamp(ctx, c, t, p, RUN_FILL, null, cx, startY + idx * slotH, disc, false, d);
        }
    }

    /** One mark. `letter` null means draw the run glyph instead. */
    private static void stamp(Context ctx, Canvas c, Paint t, Paint p, int color, String letter,
                              float cx, float cy, float disc, boolean isDone, float d) {
        if (isDone) {
            p.setStyle(Paint.Style.FILL);
            p.setColor(color);
            c.drawCircle(cx, cy, disc / 2f, p);
        } else {
            float stroke = Math.max(1.2f * d, disc * 0.075f);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(stroke);
            p.setColor(color);
            // dashes fragment into noise on a small disc, and the encoding is
            // fill versus outline; below that size keep the ring, drop the dash
            if (disc >= 16 * d) {
                float dash = (float) (Math.PI * disc / 14.0);
                p.setPathEffect(new DashPathEffect(new float[]{dash, dash}, 0));
            }
            c.drawCircle(cx, cy, disc / 2f - stroke / 2f, p);
            p.setPathEffect(null);
            p.setStyle(Paint.Style.FILL);
        }

        int ink = isDone ? STAMP_INK : color;
        if (letter != null) {
            t.setColor(ink);
            t.setTextSize(disc * 0.60f);
            t.setFakeBoldText(true);
            Paint.FontMetrics fm = t.getFontMetrics();
            c.drawText(letter, cx, cy - (fm.ascent + fm.descent) / 2f, t);
        } else {
            drawRunGlyph(ctx, c, cx, cy, disc * 0.62f, ink);
        }
    }

    private static void drawRunGlyph(Context ctx, Canvas c, float cx, float cy, float size, int color) {
        Drawable run = androidx.core.content.ContextCompat.getDrawable(ctx, R.drawable.ic_run);
        if (run == null) return;
        int sz = (int) size;
        run.setBounds((int) (cx - sz / 2f), (int) (cy - sz / 2f), (int) (cx + sz / 2f), (int) (cy + sz / 2f));
        run.setTint(color);
        run.setAlpha(255);
        run.draw(c);
    }

    /** The two-line variant's first line: the readiness ring on the left, then
     *  the two weekly progress bars SIDE BY SIDE, exactly as the app's week card
     *  arranges them. Stacking them was what forced a tall band and left the
     *  calendar squeezed into stretched pills underneath. */
    private static void drawTopLine(Context ctx, Canvas c, Paint t, Paint p, float x, float y,
                                    float innerW, float topH, float d,
                                    int runsDone, int runsPlanned, int caliDone, int caliPlanned,
                                    String km, int score, String verdict, int verdictColor) {
        float barsX = x;
        float barsW = innerW;

        if (score >= 0) {
            float wordH = Math.min(11 * d, topH * 0.26f);
            float ringD = Math.max(18 * d, topH - wordH - 2 * d);
            drawRing(c, t, p, x, y, ringD, d, score, verdictColor);

            float leftW = ringD;
            if (verdict != null && verdict.length() > 0) {
                t.setTextAlign(Paint.Align.CENTER);
                t.setFakeBoldText(false);
                t.setTextSize(wordH);
                t.setColor(INK2);
                c.drawText(verdict, x + ringD / 2f, y + topH - wordH * 0.14f, t);
                leftW = Math.max(leftW, t.measureText(verdict));
            }
            float used = Math.min(leftW + 12 * d, innerW * 0.40f);
            barsX = x + used;
            barsW = innerW - used;
        }

        // wide enough that the whitespace itself separates the two groups
        float gap = 18 * d;
        float half = (barsW - gap) / 2f;
        float barRowH = Math.min(30 * d, topH * 0.68f);
        float barY = y + (topH - barRowH) / 2f;
        drawBar(ctx, c, t, p, barsX, barY, half, barRowH, d, true, runsDone, runsPlanned, km, RUN_FILL);
        drawBar(ctx, c, t, p, barsX + half + gap, barY, half, barRowH, d, false,
                caliDone, caliPlanned, null, CALI_FILL);
    }

    /** The readiness gauge, same geometry as the app's ReadinessRing: a 260 degree
     *  sweep with the gap at the bottom, verdict colour over a neutral track, the
     *  score in the middle. Android arc angles run clockwise from 3 o'clock, so
     *  the app's ECharts 220..-40 becomes start 140 sweep 260. */
    private static void drawRing(Canvas c, Paint t, Paint p, float x, float y, float dia,
                                 float d, int score, int color) {
        float stroke = Math.max(2.5f * d, dia * 0.13f);
        RectF box = new RectF(x + stroke / 2f, y + stroke / 2f, x + dia - stroke / 2f, y + dia - stroke / 2f);

        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(stroke);
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setColor(TRACK);
        c.drawArc(box, 140, 260, false, p);
        if (score > 0) {
            p.setColor(color);
            c.drawArc(box, 140, 260 * Math.min(100, score) / 100f, false, p);
        }
        p.setStyle(Paint.Style.FILL);
        p.setStrokeCap(Paint.Cap.BUTT);

        t.setTextAlign(Paint.Align.CENTER);
        t.setFakeBoldText(true);
        t.setTextSize(dia * 0.42f);
        t.setColor(INK);
        Paint.FontMetrics fm = t.getFontMetrics();
        c.drawText(String.valueOf(score), x + dia / 2f, y + dia / 2f - (fm.ascent + fm.descent) / 2f, t);
    }

    /** One labelled progress bar: glyph, count, optional right-aligned extra,
     *  and the track underneath. */
    private static void drawBar(Context ctx, Canvas c, Paint t, Paint p, float x, float y,
                                float w, float rowH, float d, boolean isRun,
                                int done, int planned, String extra, int color) {
        float glyph = Math.min(13 * d, rowH * 0.46f);
        float textSize = Math.min(13 * d, rowH * 0.44f);
        float barH = Math.max(3 * d, rowH * 0.17f);
        float textCy = y + (rowH - barH - 3 * d) / 2f;

        t.setTextAlign(Paint.Align.LEFT);
        t.setTextSize(textSize);
        t.setFakeBoldText(true);
        Paint.FontMetrics fm = t.getFontMetrics();
        float baseline = textCy - (fm.ascent + fm.descent) / 2f;

        if (isRun) drawRunGlyph(ctx, c, x + glyph / 2f, textCy, glyph, color);
        else drawDumbbell(c, p, x + glyph / 2f, textCy, glyph, d, color);

        t.setColor(INK);
        String count = done + "/" + planned;
        c.drawText(count, x + glyph + 5 * d, baseline, t);

        // Grouped hard left, NOT right-aligned in this half. Right-aligned, the km
        // landed closer to the next bar's glyph than to its own count, and the two
        // bars read as one segmented bar with a run-on label.
        if (extra != null && extra.length() > 0) {
            float after = x + glyph + 5 * d + t.measureText(count) + 7 * d;
            t.setFakeBoldText(false);
            t.setColor(INK2);
            c.drawText(extra, after, baseline, t);
        }
        t.setTextAlign(Paint.Align.CENTER);

        float barTop = y + rowH - barH;
        float r = barH / 2f;
        p.setStyle(Paint.Style.FILL);
        p.setColor(TRACK);
        c.drawRoundRect(new RectF(x, barTop, x + w, barTop + barH), r, r, p);
        if (planned > 0 && done > 0) {
            float frac = Math.min(1f, done / (float) planned);
            p.setColor(color);
            c.drawRoundRect(new RectF(x, barTop, x + Math.max(barH, w * frac), barTop + barH), r, r, p);
        }
    }

    private static void drawCounters(Context ctx, Canvas c, Paint t, Paint p, float x, float y,
                                     float innerW, float rowH, float d,
                                     int runsDone, int runsPlanned, int caliDone, int caliPlanned, String km) {
        float cy = y + rowH / 2f;
        float glyph = 13 * d;
        t.setTextAlign(Paint.Align.LEFT);
        t.setTextSize(13 * d);
        t.setFakeBoldText(true);
        Paint.FontMetrics fm = t.getFontMetrics();
        float baseline = cy - (fm.ascent + fm.descent) / 2f;

        // runs on the left
        drawRunGlyph(ctx, c, x + glyph / 2f, cy, glyph, RUN_FILL);
        t.setColor(INK);
        String runs = runsDone + "/" + runsPlanned;
        c.drawText(runs, x + glyph + 5 * d, baseline, t);
        float used = glyph + 5 * d + t.measureText(runs);

        // workouts, pushed well clear of the runs group
        float cx2 = x + used + 22 * d;
        drawDumbbell(c, p, cx2 + glyph / 2f, cy, glyph, d, Color.parseColor("#A89DF0"));
        t.setColor(INK);
        c.drawText(caliDone + "/" + caliPlanned, cx2 + glyph + 5 * d, baseline, t);

        // km sits right, where it cannot be misread as part of either count
        if (km != null && km.length() > 0) {
            t.setTextAlign(Paint.Align.RIGHT);
            t.setFakeBoldText(false);
            t.setColor(INK2);
            c.drawText(km, x + innerW, baseline, t);
        }
        t.setTextAlign(Paint.Align.CENTER);
    }

    private static void drawDumbbell(Canvas c, Paint p, float cx, float cy, float size, float d, int color) {
        p.setColor(color);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(Math.max(1.6f * d, size * 0.13f));
        p.setStrokeCap(Paint.Cap.ROUND);
        float half = size / 2f;
        c.drawLine(cx - half * 0.55f, cy - half * 0.62f, cx - half * 0.55f, cy + half * 0.62f, p);
        c.drawLine(cx + half * 0.55f, cy - half * 0.62f, cx + half * 0.55f, cy + half * 0.62f, p);
        c.drawLine(cx - half, cy - half * 0.3f, cx - half, cy + half * 0.3f, p);
        c.drawLine(cx + half, cy - half * 0.3f, cx + half, cy + half * 0.3f, p);
        c.drawLine(cx - half * 0.55f, cy, cx + half * 0.55f, cy, p);
        p.setStyle(Paint.Style.FILL);
    }

    private static int planColor(String id) {
        if ("A".equals(id)) return Color.parseColor("#B4A9FF");
        if ("B".equals(id)) return Color.parseColor("#2FBF8F");
        if ("C".equals(id)) return Color.parseColor("#D68B4A");
        return INK2;
    }
}
