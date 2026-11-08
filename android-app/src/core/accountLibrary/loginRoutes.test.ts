import { isOfficialLoginNavigation, isQQAppLogin, isQQMusicCallback, officialHost, qqLoginReturn } from "./loginRoutes";
jest.mock("react-native-url-polyfill", () => ({ URL: jest.requireActual("url").URL }));

test("allows the platform's HTTPS login and captcha domains", () => {
    expect(isOfficialLoginNavigation("netease", "https://music.163.com/m/login")).toBe(true);
    expect(isOfficialLoginNavigation("netease", "https://ac.dun.163yun.com/check")).toBe(true);
    expect(isOfficialLoginNavigation("qq", "https://xui.ptlogin2.qq.com/cgi-bin/xlogin")).toBe(true);
    expect(isOfficialLoginNavigation("qq", "https://graph.qq.com/oauth2.0/authorize")).toBe(true);
});

test("recognizes the real official H5 one-key QQ scheme, without allowing arbitrary app links", () => {
    expect(isQQAppLogin("wtloginmqq://ptlogin/qlogin?p=" + encodeURIComponent("https://ssl.ptlogin2.qq.com/jump?u1=test"))).toBe(true);
    for (const address of ["wtloginmqq://ptlogin/qlogin", "wtloginmqq://ptlogin/chat?p=https://ssl.ptlogin2.qq.com/", "intent://evil/#Intent;scheme=wtloginmqq;end", "wtloginmqq://ptlogin/qlogin?p=" + encodeURIComponent("https://ssl.ptlogin2.qq.com.evil.example/jump")]) {
        expect(isQQAppLogin(address)).toBe(false);
    }
});
test("accepts only the app's QQ return route and official follow-up pages", () => {
    expect(qqLoginReturn("heting://qq-login")).toEqual({ returned: true, url: undefined });
    const callback = "https://y.qq.com/portal/wx_redirect.html?code=example&state=nonce";
    expect(qqLoginReturn("heting://qq-login?url=" + encodeURIComponent(callback))).toEqual({ returned: true, url: callback });
    expect(qqLoginReturn("heting://qq-login?url=https://evil.example")).toEqual({ returned: true, url: undefined });
    expect(qqLoginReturn("heting://unrelated?url=" + encodeURIComponent(callback))).toEqual({ returned: false });
});
test("blocks lookalike domains and non-HTTPS credential pages", () => {
    for (const address of ["https://qq.com.evil.example/login", "https://evilqq.com", "http://y.qq.com/", "file:///sdcard/login.html", "javascript:alert(1)"]) {
        expect(isOfficialLoginNavigation("qq", address)).toBe(false);
    }
    expect(isOfficialLoginNavigation("netease", "https://music.163.com.evil.example/")).toBe(false);
});
test("only displays the official host, without login tickets or codes", () => {
    expect(officialHost("https://y.qq.com/portal/wx_redirect.html?code=private-code&state=private-state")).toBe("y.qq.com");
});
test("intercepts only the exact QQ Music callback so a one-use code is not consumed twice", () => {
    expect(isQQMusicCallback("https://y.qq.com/portal/wx_redirect.html?code=test&state=nonce")).toBe(true);
    expect(isQQMusicCallback("https://y.qq.com/portal/profile.html?code=test")).toBe(false);
    expect(isQQMusicCallback("https://y.qq.com.evil.example/portal/wx_redirect.html?code=test")).toBe(false);
    expect(isQQMusicCallback("https://y.qq.com/portal/wx_redirect.html")).toBe(false);
});
