package net.xxqw.siyu.keepalive

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** 开机后若用户仍处于登录状态（保活开关开着），自动把保活服务拉起来。 */
class KeepAliveBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (!KeepAlivePrefs.isEnabled(context)) return
        try {
            KeepAlivePlugin.startKeepAlive(context)
        } catch (e: Exception) {
            // Android 14+ 限制从开机广播直接启动 dataSync 前台服务，
            // 失败不崩溃：下次打开 App 时前端会再次拉起。
        }
    }
}
