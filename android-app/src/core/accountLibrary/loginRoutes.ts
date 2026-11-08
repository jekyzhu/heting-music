import { URL } from "react-native-url-polyfill";
import { MusicSource } from "./client";

const hosts: Record<MusicSource, string[]> = {
    netease: ["163.com", "126.com", "126.net", "163yun.com", "netease.com"],
    qq: ["qq.com"],
};
export function isOfficialLoginNavigation(source: MusicSource, address: string): boolean {
    if (address === "about:blank") { return true; }
    try {
        const url = new URL(address);
        return url.protocol === "https:" && hosts[source].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
    } catch { return false; }
}
export function officialHost(address: string): string {
    try { return new URL(address).hostname; } catch { return "官方账号登录"; }
}
export function isQQMusicCallback(address: string): boolean {
    try {
        const url = new URL(address);
        return url.protocol === "https:" && url.hostname === "y.qq.com" && url.pathname === "/portal/wx_redirect.html" && !!url.searchParams.get("code");
    } catch { return false; }
}

export function isQQAppLogin(address: string): boolean {
    try {
        const url = new URL(address);
        if (url.protocol !== "wtloginmqq:" || url.hostname !== "ptlogin" || url.pathname !== "/qlogin") { return false; }
        const ticket = url.searchParams.get("p") || url.searchParams.get("qrcode");
        if (!ticket) { return false; }
        const target = new URL(ticket);
        return target.protocol === "https:" && ["ssl.ptlogin2.qq.com", "xui.ptlogin2.qq.com"].includes(target.hostname);
    } catch { return false; }
}

export function qqLoginReturn(address: string): { returned: boolean; url?: string } {
    try {
        const url = new URL(address);
        if (url.protocol !== "heting:" || url.hostname !== "qq-login") { return { returned: false }; }
        const next = url.searchParams.get("url") || url.searchParams.get("target");
        return { returned: true, url: next && isOfficialLoginNavigation("qq", next) && next !== "about:blank" ? next : undefined };
    } catch { return { returned: false }; }
}

export const QQ_PASSWORD_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
