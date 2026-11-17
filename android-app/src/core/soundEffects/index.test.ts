jest.mock("react-native", () => ({
    Platform: { OS: "android" },
    NativeModules: { HetingSoundEffects: {
        configure: jest.fn(async () => ({ active: true, bandCount: 5, waitingForPlayback: false })),
        setBypass: jest.fn(async bypassed => ({ active: !bypassed, bypassed, bandCount: 5, waitingForPlayback: false })),
        getStatus: jest.fn(async () => ({ active: true, bandCount: 5, waitingForPlayback: false })),
    } },
}));
jest.mock("react-native-mmkv", () => ({ MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(), set: jest.fn(),
})) }));
import { NativeModules } from "react-native";
import { MMKV } from "react-native-mmkv";
import { SoundEffects } from "./index";

const engine = NativeModules.HetingSoundEffects;
beforeEach(() => {
    SoundEffects.update({ enabled: true, mode: "manual", preset: "flat", custom: [0, 0, 0, 0, 0], strength: "standard" });
    engine.configure.mockClear();
});
test("automatic track changes apply different profiles and unknown tracks reset to flat", () => {
    SoundEffects.update({ mode: "auto" });
    SoundEffects.trackChanged({ genre: "rock" });
    expect(engine.configure).toHaveBeenLastCalledWith(true, [3, 1, -1, 2, 3], true, expect.any(String), 'rock', 1);
    SoundEffects.trackChanged({ genre: "folk" });
    expect(engine.configure).toHaveBeenLastCalledWith(true, [-1, 1, 2, 1, 0], true, expect.any(String), 'folk', 1);
    SoundEffects.trackChanged(null);
    expect(engine.configure).toHaveBeenLastCalledWith(true, [0, 0, 0, 0, 0], false, '', 'flat', 1);
});
test("manual adjustment exits automatic mode, persists and survives track changes", () => {
    SoundEffects.update({ mode: "auto" });
    SoundEffects.trackChanged({ genre: "rock" });
    SoundEffects.setBand(0, 5);
    SoundEffects.trackChanged({ genre: "folk" });
    expect(engine.configure).toHaveBeenLastCalledWith(true, [5, 1, -1, 2, 3], false, expect.any(String), 'custom', 1);
    const db = (MMKV as unknown as jest.Mock).mock.results[0].value;
    expect(JSON.parse(db.set.mock.calls.at(-1)[1])).toMatchObject({ mode: "manual", preset: "custom" });
});
test("disabling effects reaches the native engine", () => {
    SoundEffects.update({ enabled: false });
    expect(engine.configure).toHaveBeenLastCalledWith(false, [0, 0, 0, 0, 0], false, expect.any(String), 'flat', 1);
});
test("stronger automatic/manual presets match and manual edits retain the audible curve", () => {
    SoundEffects.update({ mode: "auto", strength: "vivid" });
    SoundEffects.trackChanged({ genre: "rock" });
    expect(engine.configure).toHaveBeenLastCalledWith(true, [5, 1.5, -1.5, 3.5, 5], true, expect.any(String), "rock", 1.7);
    SoundEffects.setBand(1, 2);
    expect(engine.configure).toHaveBeenLastCalledWith(true, [5, 2, -1.5, 3.5, 5], false, expect.any(String), "custom", 1.7);
    SoundEffects.update({ strength: "gentle" });
    expect(engine.configure).toHaveBeenLastCalledWith(true, [5, 2, -1.5, 3.5, 5], false, expect.any(String), "custom", 0.65);
});
test("original comparison bypasses EQ without persisting settings or stopping analysis", async () => {
    SoundEffects.update({ mode: "auto", strength: "vivid" });
    const db = (MMKV as unknown as jest.Mock).mock.results[0].value;
    const writes = db.set.mock.calls.length;
    const configureCalls = engine.configure.mock.calls.length;
    await SoundEffects.previewOriginal(true);
    expect(engine.setBypass).toHaveBeenLastCalledWith(true);
    await SoundEffects.previewOriginal(false);
    expect(engine.setBypass).toHaveBeenLastCalledWith(false);
    expect(engine.configure).toHaveBeenCalledTimes(configureCalls);
    expect(db.set).toHaveBeenCalledTimes(writes);
});
