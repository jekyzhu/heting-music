package `fun`.upup.musicfree.account

import android.net.Uri
import android.content.Intent
import android.content.ActivityNotFoundException
import android.util.Base64
import android.webkit.CookieManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

class PersonalMusicModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "PersonalMusic"

    companion object {
        private val io = Executors.newSingleThreadExecutor()
        private val sessionKey = randomKey()
        @Volatile private var port = 0
        private val states = ConcurrentHashMap<String, String>()
        private val fingerprints = ConcurrentHashMap<String, String>()
        private val epochs = ConcurrentHashMap<String, Int>()
        private fun randomKey(): String {
            val bytes = ByteArray(32); SecureRandom().nextBytes(bytes)
            return Base64.encodeToString(bytes, Base64.NO_WRAP or Base64.URL_SAFE)
        }
        private fun urls(source: String): List<String> = when (source) {
            "netease" -> listOf("https://music.163.com/", "https://y.music.163.com/")
            "qq" -> listOf("https://y.qq.com/", "https://graph.qq.com/", "https://xui.ptlogin2.qq.com/", "https://c.y.qq.com/")
            else -> emptyList()
        }
    }

    private fun ensureEngine(): Int {
        if (port == 0) {
            val directory = File(context.filesDir, "personal-music").apply { mkdirs() }
            val value = EmbeddedMusicNative.start(sessionKey, File(directory, "sessions.json").absolutePath)
            if (value <= 0) throw IllegalStateException("内置音乐模块启动失败，请重新打开合听")
            port = value
        }
        return port
    }

    private fun request(path: String, method: String = "GET", body: JSONObject? = null): Int {
        val connection = URL("http://127.0.0.1:${ensureEngine()}$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 10000; connection.readTimeout = 35000
            connection.setRequestProperty("Authorization", "Bearer $sessionKey")
            connection.setRequestProperty("Content-Type", "application/json")
            if (body != null) {
                connection.doOutput = true
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            return connection.responseCode
        } finally { connection.disconnect() }
    }

    @ReactMethod fun connection(promise: Promise) {
        io.execute {
            try {
                val value = ensureEngine()
                promise.resolve(Arguments.createMap().apply {
                    putString("baseUrl", "http://127.0.0.1:$value")
                    putString("token", sessionKey)
                })
            } catch (error: Throwable) { promise.reject("ENGINE_UNAVAILABLE", "内置音乐模块未能启动，请重新打开合听或更新安装包") }
        }
    }

    @ReactMethod fun beginLogin(source: String, webPassword: Boolean, promise: Promise) {
        if (urls(source).isEmpty()) { promise.reject("PLATFORM", "不支持的音乐平台"); return }
        epochs[source] = (epochs[source] ?: 0) + 1
        val state = randomKey(); states[source] = state
        val address = if (source == "netease") "https://music.163.com/m/login" else {
            val redirect = "https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https%3A%2F%2Fy.qq.com%2F"
            "https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=100497308&redirect_uri=" +
                URLEncoder.encode(redirect, "UTF-8") + "&state=" + state + "&display=" +
                (if (webPassword) "pc" else "mobile") + "&scope=get_user_info"
        }
        promise.resolve(Arguments.createMap().apply { putString("url", address) })
    }

    // QQ's official H5 one-key flow uses wtloginmqq, not an HTTPS navigation.
    // Only allow its login endpoint, opened explicitly in the installed QQ package.
    @ReactMethod fun openQQLoginApp(address: String, origin: String, promise: Promise) {
        try {
            val page = Uri.parse(origin)
            val uri = Uri.parse(address)
            val host = page.host ?: ""
            val ticket = uri.getQueryParameter("p") ?: uri.getQueryParameter("qrcode") ?: ""
            val target = Uri.parse(ticket)
            if (page.scheme != "https" || !(host == "qq.com" || host.endsWith(".qq.com")) ||
                states["qq"] == null || uri.scheme != "wtloginmqq" || uri.host != "ptlogin" || uri.path != "/qlogin" ||
                target.scheme != "https" || target.host !in listOf("ssl.ptlogin2.qq.com", "xui.ptlogin2.qq.com")) {
                promise.reject("QQ_LINK", "请从当前 QQ 官方登录页面发起授权"); return
            }
            val builder = uri.buildUpon().clearQuery()
            uri.queryParameterNames.filter { it != "schemacallback" }.forEach { name ->
                uri.getQueryParameters(name).forEach { value -> builder.appendQueryParameter(name, value) }
            }
            builder.appendQueryParameter("schemacallback", "heting://qq-login")
            val intent = Intent(Intent.ACTION_VIEW, builder.build()).apply {
                setPackage("com.tencent.mobileqq")
                addCategory(Intent.CATEGORY_BROWSABLE)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            UiThreadUtil.runOnUiThread {
                try { context.startActivity(intent); promise.resolve(null) }
                catch (error: ActivityNotFoundException) { promise.reject("QQ_UNAVAILABLE", "未能打开手机 QQ，请使用网页账号密码登录") }
                catch (error: SecurityException) { promise.reject("QQ_RESTRICTED", "手机系统限制了唤起 QQ，可检查应用间跳转权限，或使用网页账号密码登录") }
                catch (error: Throwable) { promise.reject("QQ_OPEN", "暂时无法唤起 QQ，请使用网页账号密码登录") }
            }
        } catch (error: Throwable) { promise.reject("QQ_LINK", "QQ 授权链接无效，请重新载入登录页") }
    }

    // Reads only this App's official-platform WebView session. Never reads form fields.
    @ReactMethod fun captureSession(source: String, navigationURL: String, promise: Promise) {
        val allowed = urls(source)
        if (allowed.isEmpty()) { promise.reject("PLATFORM", "不支持的音乐平台"); return }
        val epoch = epochs[source] ?: 0
        val callback = Uri.parse(navigationURL)
        val isQQCallback = source == "qq" && callback.scheme == "https" && callback.host == "y.qq.com" && callback.path == "/portal/wx_redirect.html"
        val code = if (isQQCallback) callback.getQueryParameter("code") ?: "" else ""
        if (code.isNotEmpty() && callback.getQueryParameter("state") != states[source]) {
            promise.reject("LOGIN_STATE", "登录已过期，请关闭后重新打开登录页"); return
        }
        UiThreadUtil.runOnUiThread {
            val manager = CookieManager.getInstance()
            val values = LinkedHashMap<String, String>()
            allowed.forEach { address ->
                (manager.getCookie(address) ?: "").split(';').forEach { item ->
                    val pair = item.trim().split('=', limit = 2)
                    if (pair.size == 2 && pair[0].isNotBlank()) values[pair[0]] = pair[1]
                }
            }
            val ready = if (source == "netease") !values["MUSIC_U"].isNullOrBlank() else
                code.isNotEmpty() || listOf("qm_keyst", "qqmusic_key", "music_key", "musickey").any { !values[it].isNullOrBlank() }
            if (!ready) { promise.resolve(Arguments.createMap().apply { putBoolean("connected", false) }); return@runOnUiThread }
            val cookie = values.entries.joinToString("; ") { "${it.key}=${it.value}" }
            val fingerprint = MessageDigest.getInstance("SHA-256").digest((cookie + code).toByteArray()).joinToString("") { "%02x".format(it) }
            io.execute {
                try {
                    if (epoch != (epochs[source] ?: 0)) { promise.resolve(Arguments.createMap().apply { putBoolean("connected", false) }); return@execute }
                    val status = if (fingerprints[source] == fingerprint) 200 else request(
                        "/api/v1/system/accounts/$source/session", "POST", JSONObject().put("cookie", cookie).put("code", code)
                    )
                    if (epoch != (epochs[source] ?: 0)) {
                        if (status == 200) request("/api/v1/system/accounts/$source", "DELETE")
                        promise.resolve(Arguments.createMap().apply { putBoolean("connected", false) }); return@execute
                    }
                    if (status == 200) {
                        fingerprints[source] = fingerprint
                        promise.resolve(Arguments.createMap().apply { putBoolean("connected", true) })
                    } else if (status == 401) {
                        promise.resolve(Arguments.createMap().apply { putBoolean("connected", false) })
                    } else { promise.reject("ACCOUNT_SYNC", "登录信息未能保存，请稍后重试") }
                } catch (error: Throwable) { promise.reject("ACCOUNT_NETWORK", "暂时无法连接音乐平台，请检查手机网络后重试") }
            }
        }
    }

    @ReactMethod fun cancelLogin(source: String) {
        epochs[source] = (epochs[source] ?: 0) + 1
        states.remove(source)
    }

    @ReactMethod fun logout(source: String, promise: Promise) {
        val addresses = urls(source)
        if (addresses.isEmpty()) { promise.reject("PLATFORM", "不支持的音乐平台"); return }
        epochs[source] = (epochs[source] ?: 0) + 1
        states.remove(source); fingerprints.remove(source)
        io.execute {
            try {
                if (request("/api/v1/system/accounts/$source", "DELETE") != 200) throw IllegalStateException()
                UiThreadUtil.runOnUiThread {
                    val manager = CookieManager.getInstance()
                    val removals = mutableListOf<Pair<String, String>>()
                    addresses.forEach { address ->
                        val domain = if (source == "netease") ".music.163.com" else ".qq.com"
                        (manager.getCookie(address) ?: "").split(';').forEach { item ->
                            val name = item.substringBefore('=').trim()
                            if (name.isNotEmpty()) {
                                removals.add(address to "$name=; Max-Age=0; Path=/; Secure")
                                removals.add(address to "$name=; Max-Age=0; Domain=$domain; Path=/; Secure")
                            }
                        }
                    }
                    if (removals.isEmpty()) { promise.resolve(null); return@runOnUiThread }
                    val remaining = AtomicInteger(removals.size)
                    removals.forEach { (address, value) -> manager.setCookie(address, value) {
                        if (remaining.decrementAndGet() == 0) { manager.flush(); promise.resolve(null) }
                    } }
                }
            } catch (error: Throwable) { promise.reject("LOGOUT", "退出登录失败，请重试") }
        }
    }
}
