package fun.upup.musicfree.account;

final class EmbeddedMusicNative {
    static { System.loadLibrary("accountengine"); }
    private EmbeddedMusicNative() {}
    static native int start(String key, String cookieFile);
}
