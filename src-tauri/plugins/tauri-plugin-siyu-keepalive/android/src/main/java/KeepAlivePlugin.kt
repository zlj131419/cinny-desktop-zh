package net.xxqw.siyu.keepalive

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

/**
 * 私语后台保活插件：登录后启动前台服务，让进程保持前台级优先级，
 * 切后台/锁屏时 sync 长连接不被系统和厂商省电杀掉，新消息能正常通知。
 */
@TauriPlugin
class KeepAlivePlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun startService(invoke: Invoke) {
        val context = activity.applicationContext
        KeepAlivePrefs.setEnabled(context, true)
        startKeepAlive(context)
        invoke.resolve()
    }

    /**
     * 量 WebView 顶部被系统状态栏挡住的真实高度（返回 CSS px/dp）。
     * 老安卓 WebView 的 env(safe-area-inset-top) 报的是刘海高度（无刘海=0），
     * 前端拿不到状态栏真值：这里用系统资源里的状态栏高度减去 WebView 在屏幕
     * 上的实际 y 坐标——WebView 已被系统让开时结果为 0，不会重复让位。
     */
    @Command
    fun topInset(invoke: Invoke) {
        val result = JSObject()
        result.put("height", computeTopInsetDp())
        invoke.resolve(result)
    }

    private fun computeTopInsetDp(): Double {
        val res = activity.resources
        val density = res.displayMetrics.density
        val sbId = res.getIdentifier("status_bar_height", "dimen", "android")
        val sbPx = if (sbId > 0) res.getDimensionPixelSize(sbId) else 0
        if (sbPx <= 0) return 0.0
        val webView = findWebView(activity.window.decorView)
        var covered = sbPx
        if (webView != null) {
            val loc = IntArray(2)
            webView.getLocationOnScreen(loc)
            covered = (sbPx - loc[1]).coerceAtLeast(0)
        }
        return if (density > 0) covered / density.toDouble() else covered.toDouble()
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                val found = findWebView(view.getChildAt(i))
                if (found != null) return found
            }
        }
        return null
    }

    @Command
    fun stopService(invoke: Invoke) {
        val context = activity.applicationContext
        KeepAlivePrefs.setEnabled(context, false)
        context.stopService(Intent(context, KeepAliveService::class.java))
        invoke.resolve()
    }

    companion object {
        fun startKeepAlive(context: Context) {
            val intent = Intent(context, KeepAliveService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}

/** 保活开关持久化：开机自启时据此决定要不要拉起服务（退出登录后不再自启）。 */
object KeepAlivePrefs {
    private const val PREFS_NAME = "siyu_keepalive"
    private const val KEY_ENABLED = "enabled"

    fun setEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_ENABLED, enabled)
            .apply()
    }

    fun isEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_ENABLED, false)
}
