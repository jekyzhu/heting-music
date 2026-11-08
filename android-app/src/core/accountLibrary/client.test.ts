import { AccountBridge, BridgeError, normalizeSettings, toMusicItem } from "./client";
jest.mock("react-native-url-polyfill", () => ({ URL: jest.requireActual("url").URL }));
const settings = { baseUrl: "http://192.168.1.2:8080/", token: "personal-test-key-12345" };
const response = (data: unknown, status = 200) => ({ ok: status === 200, status, json: async () => ({ code: status, data }) });

test("keeps account credentials out of playlist items", () => {
    const song = toMusicItem({ id: "1", source: "qq", name: "歌", artist: "人", album: "", duration: 240, cover: "", extra: { songmid: "abc" } });
    expect(song.platform).toBe("我的QQ音乐");
    expect(song.accountExtra.songmid).toBe("abc");
    expect(JSON.stringify(song)).not.toMatch(/token|cookie|personal-test-key|https?:/);
});
test("requires HTTPS on public endpoints and a private connection key", () => {
    expect(() => normalizeSettings({ ...settings, baseUrl: "http://example.com" })).toThrow(BridgeError);
    expect(() => normalizeSettings({ ...settings, token: "short" })).toThrow(BridgeError);
    expect(() => normalizeSettings({ ...settings, baseUrl: "https://u:password@example.com" })).toThrow(BridgeError);
    expect(normalizeSettings(settings).baseUrl).toBe("http://192.168.1.2:8080");
});
test("reads all pages and keeps overlapping provider IDs separate", async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(response({ playlists: Array.from({ length: 30 }, (_, id) => ({ id: String(id + 1), name: "歌单" })) }))
        .mockResolvedValueOnce(response({ playlists: [{ id: "31", name: "第三十一张歌单" }] }));
    const playlists = await new AccountBridge(settings, fetcher).playlists("qq");
    expect(playlists).toHaveLength(31);
    expect(fetcher.mock.calls[1][0]).toContain("page=2");
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${settings.token}`);
    expect(playlists[30].source).toBe("qq");
});
test("stops providers that repeat their first page", async () => {
    const fetcher = jest.fn().mockResolvedValue(response({ playlists: Array.from({ length: 31 }, (_, id) => ({ id: String(id + 1) })) }));
    expect(await new AccountBridge(settings, fetcher).playlists("qq")).toHaveLength(31);
    expect(fetcher).toHaveBeenCalledTimes(2);
});
test("does not report backend failures as an empty successful library", async () => {
    const fetcher = jest.fn().mockResolvedValue(response(null, 401));
    await expect(new AccountBridge(settings, fetcher).playlists("netease")).rejects.toThrow("登录已失效");
});
test("encodes private directory IDs and preserves source metadata for playback", async () => {
    const fetcher = jest.fn().mockResolvedValue(response([]));
    const bridge = new AccountBridge(settings, fetcher);
    await bridge.songs("qq", "profile:dir:7");
    expect(fetcher.mock.calls[0][0]).toContain("id=profile%3Adir%3A7");
    const stream = bridge.stream({ id: "1", source: "qq", name: "A & B", artist: "C", album: "", duration: 241, cover: "", extra: { songmid: "real-mid" } });
    expect(stream.url).toContain("source=qq");
    expect(stream.url).toContain("real-mid");
    expect(stream.url).not.toContain(settings.token);
    expect(stream.headers.Authorization).toContain(settings.token);
});
