// Personal account bridge. Never put platform cookies or the bridge key in songs.
import { URL } from "react-native-url-polyfill";
export type MusicSource = "netease" | "qq";
export type LoginSource = MusicSource | "qq_wx";
export const SOURCE_NAMES: Record<MusicSource, string> = {
    netease: "网易云音乐",
    qq: "QQ 音乐",
};
export const ACCOUNT_PLATFORMS: Record<MusicSource, string> = {
    netease: "我的网易云",
    qq: "我的QQ音乐",
};
export interface BridgeSettings { baseUrl: string; token: string }
export interface AccountPlaylist {
    id: string; name: string; cover: string; track_count: number;
    creator: string; source: MusicSource;
}
export interface AccountSong {
    id: string; name: string; artist: string; album: string;
    duration: number; cover: string; source: MusicSource;
    extra?: Record<string, string>; is_invalid?: boolean; is_vip?: boolean;
}
export interface QRSession {
    key: string; url: string; image_url?: string; expires_at?: number;
}
export interface QRResult {
    status: "waiting" | "scanned" | "success" | "expired" | "failed";
    message?: string;
}
export class BridgeError extends Error {
    constructor(message: string, public status = 0) { super(message); }
}

export function normalizeSettings(settings: BridgeSettings): BridgeSettings {
    let url: URL;
    try { url = new URL(settings.baseUrl.trim()); } catch {
        throw new BridgeError("音乐模块暂时无法打开，请重新启动合听");
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new BridgeError("音乐模块配置异常，请更新合听");
    }
    if (url.protocol === "http:" && !/^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname)) {
        throw new BridgeError("音乐模块配置异常，请更新合听");
    }
    const token = settings.token.trim();
    if (token.length < 16) { throw new BridgeError("音乐模块暂时无法打开，请重新启动合听"); }
    return { baseUrl: url.toString().replace(/\/+$/, ""), token };
}

export class AccountBridge {
    readonly settings: BridgeSettings;
    constructor(settings: BridgeSettings, private transport: typeof fetch = fetch) {
        this.settings = normalizeSettings(settings);
    }
    async request<T>(path: string, options: RequestInit = {}, signal?: AbortSignal): Promise<T> {
        const controller = new AbortController();
        const cancel = () => controller.abort();
        if (signal?.aborted) { controller.abort(); }
        signal?.addEventListener("abort", cancel);
        const timer = setTimeout(cancel, 30000);
        try {
            const response = await this.transport(this.settings.baseUrl + path, {
                ...options,
                headers: { Accept: "application/json", Authorization: `Bearer ${this.settings.token}` },
                signal: controller.signal,
            });
            const body = await response.json();
            if (!response.ok || (body.code && body.code !== 200)) {
                const message = response.status === 401 ? "登录已失效，请重新登录音乐账号" :
                    response.status === 403 ? "音乐模块需要重新启动，请关闭后重新打开合听" : "暂时无法读取音乐平台的数据，请稍后刷新重试";
                throw new BridgeError(message, response.status);
            }
            return body.data as T;
        } catch (error) {
            if (error instanceof BridgeError) { throw error; }
            if (controller.signal.aborted) { throw new BridgeError("请求已取消或超时，请稍后刷新重试"); }
            throw new BridgeError("暂时无法读取音乐，请检查手机网络后重试");
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener("abort", cancel);
        }
    }
    status(signal?: AbortSignal) {
        return this.request<{ netease: boolean; qq: boolean }>("/api/v1/system/status", {}, signal);
    }
    createLogin(source: LoginSource, signal?: AbortSignal) {
        return this.request<QRSession>(`/api/v1/system/qr_login/${source}`, { method: "POST" }, signal);
    }
    checkLogin(source: LoginSource, key: string, signal?: AbortSignal) {
        return this.request<QRResult>(`/api/v1/system/qr_login/${source}?key=${encodeURIComponent(key)}`, {}, signal);
    }
    logout(source: MusicSource, signal?: AbortSignal) {
        return this.request(`/api/v1/system/accounts/${source}`, { method: "DELETE" }, signal);
    }
    async playlists(source: MusicSource, signal?: AbortSignal): Promise<AccountPlaylist[]> {
        const result = new Map<string, AccountPlaylist>();
        const limit = 30;
        // Several providers repeat page one. Detect this rather than looping forever.
        for (let page = 1; page <= 500; page++) {
            const data = await this.request<{ playlists: AccountPlaylist[] | null }>(
                `/api/v1/playlist/user?source=${source}&page=${page}&limit=${limit}`, {}, signal,
            );
            const items = data?.playlists ?? [];
            if (!Array.isArray(items)) { throw new BridgeError("同步服务返回了无效的歌单目录"); }
            const previousSize = result.size;
            items.forEach(item => { if (item.id) { result.set(String(item.id), { ...item, id: String(item.id), source }); } });
            if (items.length < limit || previousSize === result.size) { return [...result.values()]; }
        }
        throw new BridgeError("歌单目录超过同步上限，请检查服务分页接口");
    }
    async songs(source: MusicSource, id: string, signal?: AbortSignal): Promise<AccountSong[]> {
        const songs = await this.request<AccountSong[] | null>(
            `/api/v1/playlist/detail?source=${source}&id=${encodeURIComponent(id)}`, {}, signal,
        );
        if (songs !== null && !Array.isArray(songs)) { throw new BridgeError("同步服务返回了无效的歌曲列表"); }
        return (songs ?? []).filter(song => song.id).map(song => ({ ...song, source }));
    }
    songQuery(song: Pick<AccountSong, "id" | "source" | "name" | "artist" | "album" | "duration" | "extra">) {
        return Object.entries({ id: song.id, source: song.source, name: song.name, artist: song.artist,
            album: song.album, duration: String(song.duration || 0), extra: JSON.stringify(song.extra ?? {}) })
            .map(([key, value]) => `${key}=${encodeURIComponent(value || "")}`).join("&");
    }
    stream(song: AccountSong): { url: string; headers: Record<string, string> } {
        return { url: `${this.settings.baseUrl}/api/v1/music/stream?${this.songQuery(song)}`,
            headers: { Authorization: `Bearer ${this.settings.token}` } };
    }
    lyric(song: AccountSong) {
        return this.request<{ lyric: string }>(`/api/v1/music/lyric?${this.songQuery(song)}`);
    }
}

export function toMusicItem(song: AccountSong): IMusic.IMusicItem {
    return {
        id: String(song.id), platform: ACCOUNT_PLATFORMS[song.source], title: song.name,
        artist: song.artist || "未知歌手", album: song.album || "", duration: song.duration || 0,
        artwork: song.cover || "", accountSource: song.source, accountExtra: song.extra ?? {},
        accountInvalid: song.is_invalid ?? false, accountVIP: song.is_vip ?? false,
    };
}

export function fromMusicItem(item: IMusic.IMusicItemBase): AccountSong {
    const source = item.platform === ACCOUNT_PLATFORMS.netease ? "netease" : "qq";
    return { id: item.id, source, name: item.title, artist: item.artist, album: item.album,
        duration: item.duration, cover: item.artwork, extra: item.accountExtra };
}
