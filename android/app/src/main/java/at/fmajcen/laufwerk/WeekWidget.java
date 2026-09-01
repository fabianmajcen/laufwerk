package at.fmajcen.laufwerk;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/**
 * The taller widget: readiness and the two weekly progress bars on the first
 * line, the Mon-Sun week on the second.
 *
 * A separate provider purely so both sizes show up as separate choices in the
 * launcher's widget picker. All of the drawing lives in ReadinessWidget, which
 * takes a twoLine flag, so the two can never drift apart.
 */
public class WeekWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            ReadinessWidget.render(context, mgr, id, true);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int id, Bundle newOptions) {
        ReadinessWidget.render(context, mgr, id, true);
    }
}
