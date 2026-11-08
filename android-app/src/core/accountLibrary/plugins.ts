import { Plugin } from "../pluginManager/plugin";
import { ACCOUNT_PLATFORMS, fromMusicItem, MusicSource } from "./client";
import { getAccountBridge } from "./native";
function makePlugin(source: MusicSource) {
    return new Plugin(() => ({
        platform: ACCOUNT_PLATFORMS[source],
        version: "1.0.0",
        cacheControl: "no-store",
        primaryKey: ["id", "platform"],
        async getMediaSource(item, quality) {
            // Original account entitlement only; no replacement sources.
            if (quality !== "standard" || item.accountInvalid) { return null; }
            return (await getAccountBridge()).stream(fromMusicItem(item));
        },
        async getLyric(item) {
            const data = await (await getAccountBridge()).lyric(fromMusicItem(item));
            return { rawLrc: data.lyric };
        },
    }), `internal-plugin://account-${source}`);
}
export const accountPlugins = [makePlugin("netease"), makePlugin("qq")];
