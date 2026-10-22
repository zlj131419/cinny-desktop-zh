package net.xxqw.siyu.keepalive

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
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

    /**
     * 录音权限：WebView 里 getUserMedia 需要 App 先持有 RECORD_AUDIO 运行时权限，
     * 否则请求会被直接拒绝且不弹系统授权框。未授权时在此拉起系统授权框，
     * 返回调用前的授权状态（刚授权完前端重试一次录音即可）。
     */
    @Command
    fun requestMicrophone(invoke: Invoke) {
        val granted =
            activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        if (!granted) {
            activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 9401)
        }
        val result = JSObject()
        result.put("granted", granted)
        invoke.resolve(result)
    }

    @Command
    fun stopService(invoke: Invoke) {
        val context = activity.applicationContext
        KeepAlivePrefs.setEnabled(context, false)
        context.stopService(Intent(context, KeepAliveService::class.java))
        invoke.resolve()
    }

    /**
     * 桌面图标未读角标：安卓没有统一角标 API，按厂商接口逐个尝试——
     * 华为走官方 content provider（change_badge，需清单声明
     * com.huawei.android.launcher.permission.CHANGE_BADGE）；再补一条通用
     * BADGE_COUNT_UPDATE 广播（三星/HTC 等老桌面认）。count=0 清除角标。
     */
    @Command
    fun setBadge(invoke: Invoke) {
        val rawCount = invoke.getArgs().optInt("count", 0)
        val count = if (rawCount < 0) 0 else rawCount
        val context = activity.applicationContext
        var ok = false
        try {
            val bundle = Bundle()
            bundle.putString("package", context.packageName)
            bundle.putString("class", launcherClassName(context))
            bundle.putInt("badgenumber", count)
            context.contentResolver.call(
                Uri.parse("content://com.huawei.android.launcher.settings/badge/"),
                "change_badge",
                null,
                bundle
            )
            ok = true
        } catch (e: Exception) {
            // 非华为桌面没有这个 provider，忽略，靠下面的广播兜底
        }
        try {
            val intent = Intent("android.intent.action.BADGE_COUNT_UPDATE")
            intent.putExtra("badge_count", count)
            intent.putExtra("badge_count_package_name", context.packageName)
            intent.putExtra("badge_count_class_name", launcherClassName(context))
            context.sendBroadcast(intent)
        } catch (e: Exception) {
            // 无桌面认领这条广播时静默
        }
        val result = JSObject()
        result.put("ok", ok)
        invoke.resolve(result)
    }

    private fun launcherClassName(context: Context): String {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val component = launchIntent?.component
        return component?.className ?: (context.packageName + ".MainActivity")
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
