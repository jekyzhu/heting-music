jest.mock("@/components/dialogs/useDialog", () => ({ getCurrentDialog: jest.fn(), showDialog: jest.fn() }));
jest.mock("@/constants/commonConst", () => ({ sortIndexSymbol: Symbol("sort"), timeStampSymbol: Symbol("time") }));
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: "cover.png" } }));
jest.mock("@/utils/log", () => ({ trace: jest.fn(), errorLog: jest.fn() }));
jest.mock("@/utils/fileUtils", () => ({ resolveImportedAssetOrPath: (value: unknown) => value }));
jest.mock("@/utils/mediaUtils", () => ({
    getLocalPath: () => undefined,
    isSameMediaItem: (a: any, b: any) => !!a && !!b && a.id === b.id && a.platform === b.platform,
}));
jest.mock("@/utils/network", () => ({ __esModule: true, default: { isCellular: false } }));
jest.mock("@/utils/persistStatus", () => ({ __esModule: true, default: { get: jest.fn(), set: jest.fn() } }));
jest.mock("../localMusicSheet", () => ({ __esModule: true, default: { isLocalMusic: () => false } }));
jest.mock("../soundEffects", () => ({ SoundEffects: { trackChanged: jest.fn() } }));
jest.mock("react-native-track-player", () => {
    const queue: any[] = [];
    let state = "none";
    const listeners: Record<string, Function> = {};
    return { __esModule: true,
        State: { Playing: "playing", Paused: "paused", Stopped: "stopped", Error: "error", Ended: "ended" },
        Event: { PlaybackQueueEnded: "ended", PlaybackError: "error" },
        default: {
            listeners, queue, setState: (value: string) => { state = value; },
            addEventListener: jest.fn((event, callback) => { listeners[event] = callback; }),
            getActiveTrack: jest.fn(async () => queue[0]), getTrack: jest.fn(async () => queue[0]),
            getActiveTrackIndex: jest.fn(async () => queue.length ? 0 : undefined),
            getPlaybackState: jest.fn(async () => ({ state })),
            setQueue: jest.fn(async tracks => { queue.splice(0, queue.length, ...tracks); state = "paused"; }),
            play: jest.fn(async () => { state = "playing"; }), pause: jest.fn(async () => { state = "paused"; }),
            reset: jest.fn(async () => { queue.length = 0; state = "none"; }),
            seekTo: jest.fn(), updateMetadataForTrack: jest.fn(),
        },
    };
});
import NativePlayer from "react-native-track-player";
import Player from "./index";
import { showDialog } from "@/components/dialogs/useDialog";
const native = NativePlayer as any;
const song = (id = "one") => ({ id, platform: "我的网易云", title: id, artist: "artist", artwork: "" } as IMusic.IMusicItem);
const getMediaSource = jest.fn();
const plugin = { methods: { getMediaSource } };
beforeEach(async () => {
    await Player.clearPlayList();
    jest.clearAllMocks();
    getMediaSource.mockResolvedValue({ url: "http://127.0.0.1:43210/audio", headers: { Authorization: "Bearer test-only" } });
    Player.injectDependencies({ getConfig: () => undefined } as any,
        { addMusic: jest.fn() } as any, { getByName: () => plugin, getByMedia: () => plugin } as any);
    await Player.setupTrackPlayer();
});
test("only real sources enter the native queue and account authorization survives", async () => {
    await Player.play(song());
    expect(native.queue).toEqual([expect.objectContaining({ url: "http://127.0.0.1:43210/audio", headers: { Authorization: "Bearer test-only" } })]);
    expect(native.setQueue.mock.calls.flatMap(([tracks]: any) => tracks).some((track: any) => track.url.startsWith("musicfree://"))).toBe(false);
    expect(native.play).toHaveBeenCalledTimes(1);
});
test("native errors stop once, never skip through every song, and retry resolves a fresh URL", async () => {
    jest.useFakeTimers();
    try {
        await Player.playWithReplacePlayList(song(), [song(), song("two")]);
        await native.listeners.error({ code: "android-io-bad-http-status", message: "private-url" });
        await native.listeners.error({ code: "android-io-bad-http-status" });
        await jest.advanceTimersByTimeAsync(10000);
        expect(Player.currentMusic?.id).toBe("one");
        expect(getMediaSource).toHaveBeenCalledTimes(1);
        expect(showDialog).toHaveBeenCalledTimes(1);
        expect(JSON.stringify((showDialog as jest.Mock).mock.calls)).not.toContain("private-url");
        getMediaSource.mockResolvedValue({ url: "https://example.org/refreshed.mp3" });
        await Player.play();
        expect(native.queue[0].url).toBe("https://example.org/refreshed.mp3");
    } finally { jest.useRealTimers(); }
});
test("missing sources produce one visible failure without looping", async () => {
    getMediaSource.mockResolvedValue(null);
    await Player.playWithReplacePlayList(song(), [song(), song("two")]);
    expect(Player.currentMusic?.id).toBe("one");
    expect(native.play).not.toHaveBeenCalled();
    expect(showDialog).toHaveBeenCalledWith("SimpleDialog", expect.objectContaining({ content: expect.stringContaining("source-unavailable") }));
});
test("pausing during source resolution prevents a late request from starting audio", async () => {
    let resolve!: (value: any) => void;
    getMediaSource.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const playing = Player.play(song());
    while (!resolve) await Promise.resolve();
    await Player.pause();
    resolve({ url: "https://example.org/late.mp3" });
    await playing;
    expect(native.play).not.toHaveBeenCalled();
});
test("a real queue end advances once despite duplicate native notifications", async () => {
    await Player.playWithReplacePlayList(song(), [song(), song("two")]);
    native.setState("ended");
    await Promise.all([native.listeners.ended(), native.listeners.ended()]);
    expect(Player.currentMusic?.id).toBe("two");
    expect(native.play).toHaveBeenCalledTimes(2);
});
test("single repeat resolves the same song again when its real stream ends", async () => {
    await Player.playWithReplacePlayList(song(), [song(), song("two")]);
    Player.toggleRepeatMode(); // queue -> shuffle
    Player.toggleRepeatMode(); // shuffle -> single
    native.setState("ended");
    await native.listeners.ended();
    expect(Player.currentMusic?.id).toBe("one");
    expect(getMediaSource).toHaveBeenCalledTimes(2);
    Player.toggleRepeatMode(); // single -> queue
});
test("stored per-quality sources retain URL and headers when a plugin is unavailable", async () => {
    getMediaSource.mockResolvedValue(null);
    await Player.play({ ...song(), source: { standard: { url: "https://example.org/cached.mp3", headers: { Authorization: "Bearer cached-test" } } } });
    expect(native.queue[0]).toMatchObject({ url: "https://example.org/cached.mp3", headers: { Authorization: "Bearer cached-test" } });
});
