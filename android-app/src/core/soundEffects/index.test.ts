jest.mock("react-native", () => ({
    Platform: { OS: "android" },
    NativeModules: { HetingSoundEffects: {
        configure: jest.fn(async () => ({ active: true, bandCount: 5, waitingForPlayback: false })),
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
    SoundEffects.update({ enabled: true, mode: "manual", preset: "flat", custom: [0, 0, 0, 0, 0] });
    engine.configure.mockClear();
});
test("automatic track changes apply different profiles and unknown tracks reset to flat", () => {
    SoundEffects.update({ mode: "auto" });
    SoundEffects.trackChanged({ genre: "rock" });
    expect(engine.configure).toHaveBeenLastCalledWith(true, [3, 1, -1, 2, 3]);
    SoundEffects.trackChanged({ genre: "folk" });
    expect(engine.configure).toHaveBeenLastCalledWith(true, [-1, 1, 2, 1, 0]);
    SoundEffects.trackChanged(null);
    expect(engine.configure).toHaveBeenLastCalledWith(true, [0, 0, 0, 0, 0]);
});
test("manual adjustment exits automatic mode, persists and survives track changes", () => {
    SoundEffects.update({ mode: "auto" });
    SoundEffects.trackChanged({ genre: "rock" });
    SoundEffects.setBand(0, 5);
    SoundEffects.trackChanged({ genre: "folk" });
    expect(engine.configure).toHaveBeenLastCalledWith(true, [5, 1, -1, 2, 3]);
    const db = (MMKV as unknown as jest.Mock).mock.results[0].value;
    expect(JSON.parse(db.set.mock.calls.at(-1)[1])).toMatchObject({ mode: "manual", preset: "custom" });
});
test("disabling effects reaches the native engine", () => {
    SoundEffects.update({ enabled: false });
    expect(engine.configure).toHaveBeenLastCalledWith(false, [0, 0, 0, 0, 0]);
});
