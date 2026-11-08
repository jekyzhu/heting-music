import { NativeModules } from "react-native";
import { getAccountBridge, beginOfficialLogin } from "./native";
jest.mock("react-native-url-polyfill", () => ({ URL: jest.requireActual("url").URL }));
jest.mock("react-native", () => ({ NativeModules: { PersonalMusic: {
    connection: jest.fn(async () => ({ baseUrl: "http://127.0.0.1:43123", token: "app-private-random-session-key" })),
    beginLogin: jest.fn(async () => ({ url: "https://music.163.com/m/login" })),
} } }));
test("starts the in-app runtime automatically without user configuration", async () => {
    const client = await getAccountBridge();
    expect(client.settings.baseUrl).toBe("http://127.0.0.1:43123");
    expect(NativeModules.PersonalMusic.connection).toHaveBeenCalled();
    expect(await beginOfficialLogin("netease")).toEqual({ url: "https://music.163.com/m/login" });
});
test("offers a separate QQ web-password flow without launching the QQ app", async () => {
    await beginOfficialLogin("qq");
    expect(NativeModules.PersonalMusic.beginLogin).toHaveBeenLastCalledWith("qq", true);
    await beginOfficialLogin("qq", "app");
    expect(NativeModules.PersonalMusic.beginLogin).toHaveBeenLastCalledWith("qq", false);
    await beginOfficialLogin("netease");
    expect(NativeModules.PersonalMusic.beginLogin).toHaveBeenLastCalledWith("netease", false);
});
