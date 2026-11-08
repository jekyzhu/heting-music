import React from "react";
import renderer, { act } from "react-test-renderer";
import OfficialLogin from "./officialLogin";
import { beginOfficialLogin, captureOfficialSession, openQQLoginApp } from "@/core/accountLibrary/native";
import { QQ_PASSWORD_USER_AGENT } from "@/core/accountLibrary/loginRoutes";

jest.mock("react-native", () => ({
    View: "View", Text: "Text", Pressable: "Pressable", Modal: "Modal", ActivityIndicator: "ActivityIndicator",
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
    Linking: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("react-native-webview", () => "WebView");
jest.mock("react-native-url-polyfill", () => ({ URL: jest.requireActual("url").URL }));
jest.mock("@/core/accountLibrary/native", () => ({
    beginOfficialLogin: jest.fn(), cancelOfficialLogin: jest.fn(), captureOfficialSession: jest.fn(), openQQLoginApp: jest.fn(),
}));
const begin = beginOfficialLogin as jest.Mock, capture = captureOfficialSession as jest.Mock, open = openQQLoginApp as jest.Mock;
let tree: renderer.ReactTestRenderer;
const connected = jest.fn();
const page = () => tree.root.findByType("WebView" as any);
beforeEach(async () => {
    jest.useFakeTimers(); jest.clearAllMocks();
    begin.mockResolvedValue({ url: "https://graph.qq.com/oauth2.0/authorize?state=nonce" });
    capture.mockResolvedValue({ connected: false }); open.mockResolvedValue(undefined);
    await act(async () => { tree = renderer.create(<OfficialLogin source="qq" onClose={jest.fn()} onConnected={connected} />); });
});
afterEach(() => { act(() => tree.unmount()); jest.clearAllTimers(); jest.useRealTimers(); });
test("defaults to an independent web password flow and keeps the native option available", async () => {
    expect(begin).toHaveBeenCalledWith("qq", "web");
    expect(page().props.userAgent).toBe(QQ_PASSWORD_USER_AGENT);
    await act(async () => { tree.root.findAllByProps({ accessibilityRole: "tab" })[1].props.onPress(); });
    expect(begin).toHaveBeenLastCalledWith("qq", "app");
    expect(page().props.userAgent).toBeUndefined();
});
test("dispatches the official one-key scheme to QQ without treating app launch as login success", async () => {
    const url = "wtloginmqq://ptlogin/qlogin?p=" + encodeURIComponent("https://ssl.ptlogin2.qq.com/jump?u1=example");
    let result: boolean | undefined;
    await act(async () => { result = page().props.onShouldStartLoadWithRequest({ url, isTopFrame: true }); });
    expect(result).toBe(false);
    expect(open).toHaveBeenCalledWith(url, "https://graph.qq.com/oauth2.0/authorize?state=nonce");
    expect(connected).not.toHaveBeenCalled();
    act(() => { expect(page().props.onShouldStartLoadWithRequest({ url: "intent://untrusted/", isTopFrame: true })).toBe(false); });
});
test("retains a callback arriving during cookie polling until it can be exchanged", async () => {
    let resolvePoll!: (value: { connected: boolean }) => void;
    capture.mockImplementationOnce(() => new Promise(resolve => { resolvePoll = resolve; }));
    act(() => { page().props.onLoadEnd(); });
    const callback = "https://y.qq.com/portal/wx_redirect.html?code=one-use-code&state=nonce";
    act(() => {
        expect(page().props.onShouldStartLoadWithRequest({ url: callback, isTopFrame: true })).toBe(false);
        page().props.onNavigationStateChange({ url: "https://xui.ptlogin2.qq.com/cgi-bin/xlogin" });
    });
    capture.mockResolvedValueOnce({ connected: true });
    await act(async () => { resolvePoll({ connected: false }); });
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(capture).toHaveBeenLastCalledWith("qq", callback);
    expect(connected).toHaveBeenCalledTimes(1);
});
