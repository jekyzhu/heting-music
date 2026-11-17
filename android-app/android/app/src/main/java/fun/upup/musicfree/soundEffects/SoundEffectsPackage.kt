package `fun`.upup.musicfree.soundEffects

import android.os.Handler
import android.os.Looper
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager

class SoundEffectsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val handler = Handler(Looper.getMainLooper())
    override fun getName() = "HetingSoundEffects"

    @ReactMethod
    fun configure(enabled: Boolean, gains: ReadableArray, promise: Promise) {
        try {
            val values = DoubleArray(gains.size()) { gains.getDouble(it) }
            handler.post {
                try {
                    SoundEffectsEngine.configure(enabled, values)
                    promise.resolve(Arguments.makeNativeMap(SoundEffectsEngine.status()))
                } catch (e: RuntimeException) { promise.reject("EQ_CONFIG", e) }
            }
        } catch (e: RuntimeException) { promise.reject("EQ_CONFIG", e) }
    }
    @ReactMethod
    fun getStatus(promise: Promise) {
        handler.post {
            try { promise.resolve(Arguments.makeNativeMap(SoundEffectsEngine.status())) }
            catch (e: RuntimeException) { promise.reject("EQ_STATUS", e) }
        }
    }
}

class SoundEffectsPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(SoundEffectsModule(context))
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
