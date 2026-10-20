package net.xxqw.siyu.keepalive

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
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
