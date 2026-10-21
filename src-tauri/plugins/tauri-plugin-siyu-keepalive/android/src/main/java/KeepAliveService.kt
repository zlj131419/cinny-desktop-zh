package net.xxqw.siyu.keepalive

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder

/**
 * 前台保活服务：本身不做网络请求，只负责把进程维持在前台级优先级，
 * 让 WebView 里的 Matrix sync 长连接切后台后继续工作；
 * 新消息仍由前端原有的通知逻辑（tauri-plugin-notification 垫片）弹出。
 */
class KeepAliveService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startInForeground()
        return START_STICKY
    }

    private fun startInForeground() {
        val channelId = "siyu_keepalive"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            if (manager != null && manager.getNotificationChannel(channelId) == null) {
                val channel = NotificationChannel(
                    channelId,
                    "消息保活",
                    NotificationManager.IMPORTANCE_LOW
                )
                channel.description = "保持私语在后台接收消息提醒"
                channel.setShowBadge(false)
                manager.createNotificationChannel(channel)
            }
            // 消息横幅渠道必须在原生层建：安卓渠道重要程度首次创建即锁死、覆盖
            // 安装改不动——JS 垫片建的旧 siyu_messages 渠道在用户机器上已被锁成
            // 低重要程度、救不回来。换全新 ID 在这里建，首次创建就是高重要程度；
            // 前端垫片也用这个 ID 发通知，并保留同 ID 的 JS 建渠道作兜底。
            val msgChannelId = "siyu_msg_high"
            if (manager != null && manager.getNotificationChannel(msgChannelId) == null) {
                val msgChannel = NotificationChannel(
                    msgChannelId,
                    "消息提醒",
                    NotificationManager.IMPORTANCE_HIGH
                )
                msgChannel.description = "新消息通知（横幅弹出）"
                msgChannel.setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                msgChannel.enableVibration(true)
                msgChannel.setShowBadge(true)
                msgChannel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                manager.createNotificationChannel(msgChannel)
            }
        }

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = launchIntent?.let {
            PendingIntent.getActivity(
                this,
                0,
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        @Suppress("DEPRECATION")
        val builder =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                Notification.Builder(this, channelId)
            else Notification.Builder(this)
        val notification = builder
            .setContentTitle("私语 Siyu")
            .setContentText("消息提醒运行中")
            .setSmallIcon(applicationInfo.icon)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    companion object {
        private const val NOTIFICATION_ID = 44549
    }
}
