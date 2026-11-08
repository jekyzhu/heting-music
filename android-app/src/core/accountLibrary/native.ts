import { NativeModules } from "react-native";
import { AccountBridge, BridgeSettings, MusicSource } from "./client";

interface PersonalMusicModule {
    connection(): Promise<BridgeSettings>;
    beginLogin(source: MusicSource, webPassword: boolean): Promise<{ url: string }>;
    captureSession(source: MusicSource, url: string): Promise<{ connected: boolean }>;
    cancelLogin(source: MusicSource): void;
    logout(source: MusicSource): Promise<void>;
    openQQLoginApp(url: string, origin: string): Promise<void>;
}
function personalMusic(): PersonalMusicModule {
    const native = NativeModules.PersonalMusic;
    if (!native) { throw new Error("请安装新版合听，以使用直接账号登录"); }
    return native;
}
export async function getAccountBridge() {
    return new AccountBridge(await personalMusic().connection());
}
export const beginOfficialLogin = (source: MusicSource, mode: "web" | "app" = "web") => personalMusic().beginLogin(source, source === "qq" && mode === "web");
export const captureOfficialSession = (source: MusicSource, url: string) => personalMusic().captureSession(source, url);
export const cancelOfficialLogin = (source: MusicSource) => personalMusic().cancelLogin(source);
export const logoutAccount = (source: MusicSource) => personalMusic().logout(source);
export const openQQLoginApp = (url: string, origin: string) => personalMusic().openQQLoginApp(url, origin);
