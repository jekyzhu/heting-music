import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { beginOfficialLogin, cancelOfficialLogin, captureOfficialSession, openQQLoginApp } from "@/core/accountLibrary/native";
import { MusicSource, SOURCE_NAMES } from "@/core/accountLibrary/client";
import { isOfficialLoginNavigation, isQQAppLogin, isQQMusicCallback, officialHost, qqLoginReturn, QQ_PASSWORD_USER_AGENT } from "@/core/accountLibrary/loginRoutes";
import { classical as c } from "./palette";

export default function OfficialLogin({ source, onClose, onConnected }: {
    source: MusicSource; onClose(): void; onConnected(): void;
}) {
    const [mode, setMode] = useState<"web" | "app">("web");
    const [address, setAddress] = useState("");
    const [host, setHost] = useState("");
    const [status, setStatus] = useState("正在打开官方登录页…");
    const [busy, setBusy] = useState(false);
    const [pageError, setPageError] = useState(false);
    const currentURL = useRef("");
    // Keep the one-use callback even when a cookie poll is already in flight.
    const pendingCallback = useRef("");
    const checking = useRef(false);
    const finished = useRef(false);
    const mounted = useRef(true);
    const generation = useRef(0);
    const launching = useRef(false);
    const handedOff = useRef(false);
    const start = useCallback(async () => {
        const version = ++generation.current;
        finished.current = false; pendingCallback.current = ""; currentURL.current = ""; handedOff.current = false;
        setBusy(false); setPageError(false); setAddress("");
        try {
            const value = await beginOfficialLogin(source, mode);
            if (!mounted.current || version !== generation.current) { return; }
            currentURL.current = value.url; setAddress(value.url); setHost(officialHost(value.url));
            setStatus(source === "netease" ? "请选择官方页面上的手机号验证码或账号密码登录。" : mode === "web" ? "使用 QQ 账号密码登录。若先显示二维码，请选择官方页面中的“账号密码登录”。" : "点击官方页面的“一键登录”，授权后返回合听。若唤起受限，可切换网页账号密码登录。");
        } catch (error) { if (mounted.current && version === generation.current) { setPageError(true); setStatus(error instanceof Error ? error.message : "登录页暂时无法打开"); } }
    }, [source, mode]);
    const capture = useCallback(async (manual = false) => {
        const url = pendingCallback.current || currentURL.current;
        if (checking.current || finished.current || !url) { return; }
        const version = generation.current;
        checking.current = true;
        if (manual) { setBusy(true); setStatus("正在确认账号并读取歌单…"); }
        try {
            const result = await captureOfficialSession(source, url);
            if (!mounted.current || version !== generation.current) { return; }
            if (result.connected) { finished.current = true; onConnected(); }
            else if (manual || pendingCallback.current === url) { setStatus("尚未完成音乐账号登录。可以继续官方验证，或重新载入网页账号密码登录。"); }
        } catch (error) { if (mounted.current && version === generation.current && (manual || pendingCallback.current === url)) { setStatus(error instanceof Error ? error.message : "账号连接失败，请重试"); } }
        finally { checking.current = false; if (mounted.current && version === generation.current) { setBusy(false); } }
    }, [source, onConnected]);
    const handleReturn = useCallback((url: string) => {
        const result = qqLoginReturn(url);
        if (source !== "qq" || !result.returned) { return; }
        if (result.url && isQQMusicCallback(result.url)) { pendingCallback.current = result.url; }
        else if (result.url) { currentURL.current = result.url; setAddress(result.url); }
        setStatus("已返回合听，正在检查授权。若尚未完成，可使用网页账号密码登录。");
        void capture();
    }, [source, capture]);
    useEffect(() => { mounted.current = true; void start(); return () => { mounted.current = false; generation.current++; if (!finished.current) { cancelOfficialLogin(source); } }; }, [source, start]);
    useEffect(() => { const timer = setInterval(() => { void capture(); }, 3000); return () => clearInterval(timer); }, [capture]);
    useEffect(() => {
        const links = Linking.addEventListener("url", event => handleReturn(event.url));
        const app = AppState.addEventListener("change", state => {
            if (state === "active" && handedOff.current) {
                setStatus("已回到合听，正在检查授权。如仍未登录，请切换网页账号密码登录。");
                void capture();
            }
        });
        return () => { links.remove(); app.remove(); };
    }, [capture, handleReturn]);
    const navigate = (url: string, topFrame = true) => {
        if (source === "qq" && isQQAppLogin(url)) {
            if (!launching.current) {
                launching.current = true; handedOff.current = true;
                setStatus("正在打开已安装的手机 QQ…授权后请返回合听。");
                void openQQLoginApp(url, currentURL.current).catch(error => {
                    if (mounted.current) { setStatus(error instanceof Error ? error.message : "未能唤起 QQ，请改用网页账号密码登录。"); }
                }).finally(() => { launching.current = false; });
            }
            return false;
        }
        if (source === "qq" && qqLoginReturn(url).returned) { handleReturn(url); return false; }
        const allowed = isOfficialLoginNavigation(source, url);
        if (allowed && source === "qq" && isQQMusicCallback(url)) {
            pendingCallback.current = url; setHost("y.qq.com");
            setStatus("已完成 QQ 身份验证，正在连接音乐账号…"); void capture();
            return false;
        }
        if (!allowed && topFrame) { setStatus("此跳转未能打开，请继续官方网页验证，或切换网页账号密码登录。"); }
        return allowed;
    };
    return <Modal visible animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={s.root} edges={["top", "bottom"]}>
            <View style={s.bar}><Pressable accessibilityRole="button" accessibilityLabel="关闭登录" onPress={onClose} style={s.close}><Text style={s.closeText}>‹</Text></Pressable>
                <View style={s.flex}><Text style={s.title}>{SOURCE_NAMES[source]}登录</Text><Text style={s.host}>官方网页 · {host || "正在连接"}</Text></View>
                <Pressable accessibilityRole="button" onPress={() => { void start(); }} style={s.reload}><Text style={s.reloadText}>重新载入</Text></Pressable>
            </View>
            {source === "qq" && <View style={s.modes}>{([["web", "网页账号密码"], ["app", "手机 QQ 授权"]] as const).map(([key, label]) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === key }} key={key} style={[s.mode, mode === key && s.modeSelected]} onPress={() => setMode(key)}><Text style={[s.modeText, mode === key && s.modeTextSelected]}>{label}</Text></Pressable>)}</View>}
            <View style={s.info}><Text style={s.infoText}>{source === "qq" ? "已装最新版 QQ 仍提示安装，通常是唤起超时；可直接用左侧网页账号密码登录。" : "账号密码或手机验证码在平台官方页面中输入，合听不读取密码输入框。"}</Text></View>
            {address && !pageError ? <WebView source={{ uri: address }} style={s.flex}
                userAgent={source === "qq" && mode === "web" ? QQ_PASSWORD_USER_AGENT : undefined}
                originWhitelist={["*"]}
                javaScriptEnabled domStorageEnabled thirdPartyCookiesEnabled sharedCookiesEnabled
                setSupportMultipleWindows={false} saveFormDataDisabled
                allowFileAccess={false} allowUniversalAccessFromFileURLs={false} mixedContentMode="never"
                startInLoadingState renderLoading={() => <ActivityIndicator style={s.loading} color={c.gold} />}
                onShouldStartLoadWithRequest={request => navigate(request.url, request.isTopFrame !== false)}
                onNavigationStateChange={navigation => {
                    if (source === "qq" && isQQMusicCallback(navigation.url)) { navigate(navigation.url); }
                    else if (isOfficialLoginNavigation(source, navigation.url) && !pendingCallback.current) {
                        currentURL.current = navigation.url; setHost(officialHost(navigation.url)); void capture();
                    }
                }}
                onLoadEnd={() => { void capture(); }}
                onError={() => { setPageError(true); setStatus("官方登录页暂时未能加载，请检查网络后重新载入，或切换登录方式。"); }}
            /> : <View style={s.wait}><Text style={s.note}>{pageError ? "登录页面暂时无法打开" : "正在连接官方账号页面"}</Text>{!pageError && <ActivityIndicator color={c.gold} />}</View>}
            <View style={s.bottom}><Text style={s.status} accessibilityLiveRegion="polite">{status}</Text>
                <Pressable disabled={busy} accessibilityRole="button" onPress={() => { void capture(true); }} style={[s.button, busy && s.disabled]}>
                    {busy ? <ActivityIndicator color={c.paper} /> : <Text style={s.buttonText}>已完成登录，读取我的歌单</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    </Modal>;
}
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper }, flex: { flex: 1 }, bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.line },
    close: { width: 36, paddingVertical: 6 }, closeText: { fontSize: 32, color: c.ink }, title: { fontSize: 18, fontFamily: c.serif, color: c.ink }, host: { color: c.muted, fontSize: 10, marginTop: 4 }, reload: { padding: 10 }, reloadText: { color: c.ink, fontSize: 12 },
    modes: { flexDirection: "row", gap: 8, margin: 12 }, mode: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }, modeSelected: { backgroundColor: c.forest, borderColor: c.forest }, modeText: { color: c.ink, fontSize: 12 }, modeTextSelected: { color: c.paper },
    info: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: c.soft }, infoText: { fontSize: 11, lineHeight: 18, color: c.muted }, loading: { position: "absolute", top: 24, left: "48%" }, wait: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 }, note: { color: c.muted, fontSize: 14 },
    bottom: { borderTopWidth: 1, borderColor: c.line, padding: 18 }, status: { color: c.muted, fontSize: 12, lineHeight: 19, marginBottom: 12 }, button: { backgroundColor: c.forest, paddingVertical: 16, borderRadius: 12, alignItems: "center" }, buttonText: { color: c.paper, fontSize: 14, fontWeight: "600" }, disabled: { opacity: 0.6 },
});
