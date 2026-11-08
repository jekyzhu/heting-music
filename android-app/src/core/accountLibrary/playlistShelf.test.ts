import { AccountPlaylist, MusicSource } from "./client";
import { playlistShelf } from "./playlistShelf";
jest.mock("react-native-url-polyfill", () => ({ URL: jest.requireActual("url").URL }));
const list = (source: MusicSource, id: string, name: string): AccountPlaylist => ({ source, id, name, creator: "我", cover: "", track_count: 3 });
const library = {
    netease: { playlists: [list("netease", "same-id", "巴赫"), list("netease", "n2", "钢琴"), list("netease", "n3", "弦乐")] },
    qq: { playlists: [list("qq", "same-id", "巴赫"), list("qq", "q2", "夜曲")] },
};
test("shows both accounts' child playlists together, including equal names and IDs", () => {
    expect(playlistShelf(library).map(p => `${p.source}:${p.id}`)).toEqual(["netease:same-id", "qq:same-id", "netease:n2", "qq:q2", "netease:n3"]);
});
test("keeps the other account visible if QQ has not connected yet", () => {
    expect(playlistShelf({ ...library, qq: { playlists: [] } })).toEqual(library.netease.playlists);
});
test("searches the shared shelf across both sources", () => {
    expect(playlistShelf(library, "巴赫")).toHaveLength(2);
    expect(playlistShelf(library, " QQ 音乐 ").map(p => p.id)).toEqual(["same-id", "q2"]);
});
