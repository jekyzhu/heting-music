import React from "react";
import renderer, { act } from "react-test-renderer";
import AccountLibrary from "./index";
import { getAccountBridge, logoutAccount } from "@/core/accountLibrary/native";
jest.mock("react-native", () => ({
    View: "View", Text: "Text", Pressable: "Pressable", Image: "Image", TextInput: "TextInput", RefreshControl: "RefreshControl", FlatList: "FlatList", ActivityIndicator: "ActivityIndicator",
    Alert: { alert: jest.fn() }, AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 }, useWindowDimensions: () => ({ width: 400, height: 850 }),
}));
jest.mock("react-native-svg", () => ({ __esModule: true, default: "Svg", Circle: "Circle", Path: "Path" }));
jest.mock("react-native-url-polyfill", () => ({ URL: jest.requireActual("url").URL }));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { clearPlayList: jest.fn(async () => {}), playWithReplacePlayList: jest.fn() }, useCurrentMusic: () => null }));
jest.mock("@/core/accountLibrary/native", () => ({ getAccountBridge: jest.fn(), logoutAccount: jest.fn() }));
jest.mock("../home/components/homeBody", () => "HomeBody");
jest.mock("./officialLogin", () => "OfficialLogin");
const playlists = (source: string) => [{ id: "same-id", source, name: source === "qq" ? "QQ 夜曲" : "网易云巴赫", track_count: 7, creator: "我", cover: "" }];
let tree: renderer.ReactTestRenderer;
let both: boolean;
const bridge = {
    status: jest.fn(async () => ({ netease: true, qq: both })),
    playlists: jest.fn(async source => playlists(source)),
    songs: jest.fn(async () => []),
};
beforeEach(() => { jest.clearAllMocks(); (getAccountBridge as jest.Mock).mockResolvedValue(bridge); both = true; });
afterEach(() => { if (tree) act(() => tree.unmount()); });
const shelf = () => tree.root.findByProps({ testID: "shared-playlist-shelf" });
const header = () => renderer.create(shelf().props.ListHeaderComponent);
test("renders the actual child playlists in one grid and shows the preview disclaimer", async () => {
    await act(async () => { tree = renderer.create(<AccountLibrary />); });
    expect(shelf().props.numColumns).toBe(2);
    expect(shelf().props.data.map(p => `${p.source}:${p.name}`)).toEqual(["netease:网易云巴赫", "qq:QQ 夜曲"]);
    const top = header();
    expect(JSON.stringify(top.toJSON())).toContain("开发体验版 · 仅限指定好友体验");
    expect(JSON.stringify(top.toJSON())).not.toContain('expanded');
    act(() => top.unmount());
});
test("connecting QQ leaves the already connected NetEase account on the same shelf", async () => {
    both = false;
    await act(async () => { tree = renderer.create(<AccountLibrary />); });
    expect(shelf().props.data.map(p => p.source)).toEqual(["netease"]);
    const top = header();
    await act(async () => { top.root.findByProps({ accessibilityLabel: "QQ 音乐，点击登录" }).props.onPress(); });
    expect(logoutAccount).not.toHaveBeenCalled();
    const login = tree.root.findByType("OfficialLogin" as any);
    expect(login.props.source).toBe("qq");
    both = true;
    await act(async () => { login.props.onConnected(); });
    expect(shelf().props.data.map(p => p.source)).toEqual(["netease", "qq"]);
    expect(logoutAccount).not.toHaveBeenCalled();
    act(() => top.unmount());
});
