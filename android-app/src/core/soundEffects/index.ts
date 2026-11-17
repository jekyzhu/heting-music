import { NativeModules, Platform } from "react-native";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { MMKV } from "react-native-mmkv";
import { clampGain, effectiveProfile, restoreSettings, Settings, Preset, PRESETS } from "./policy";

interface EngineStatus {
    active: boolean;
    waitingForPlayback: boolean;
    bandCount: number;
    error?: string | null;
    headroomDb?: number;
    detectionState?: "off" | "sampling" | "detected" | "uncertain" | "unavailable";
    detectedPreset?: Preset | null;
    confidence?: number;
}
const storage = new MMKV({ id: "heting-sound-effects-v1" });
function load() {
    try { return restoreSettings(JSON.parse(storage.getString("settings") || "null")); }
    catch { return restoreSettings(null); }
}
const settingsAtom = atom(load());
const profileAtom = atom(effectiveProfile(getDefaultStore().get(settingsAtom), null));
const statusAtom = atom<EngineStatus>({ active: false, waitingForPlayback: false, bandCount: 0 });
const store = getDefaultStore();
let currentTrack: unknown = null;
let revision = 0;
const bridge = Platform.OS === "android" ? NativeModules.HetingSoundEffects : undefined;

async function apply() {
    const request = ++revision;
    const settings = store.get(settingsAtom);
    const profile = effectiveProfile(settings, currentTrack);
    store.set(profileAtom, profile);
    try {
        if (!bridge) throw new Error("当前安装版本未包含安卓音效模块，请安装新版合听");
        const track = currentTrack as Record<string, unknown> | null;
        const key = track ? JSON.stringify([track.platform, track.id ?? track.title]) : "";
        const status: EngineStatus = await bridge.configure(settings.enabled, profile.gains,
            settings.mode === "auto" && !!track, key, profile.preset);
        if (request === revision) store.set(statusAtom, status);
    } catch (error) {
        if (request === revision) store.set(statusAtom, { active: false, waitingForPlayback: false,
            bandCount: 0, error: error instanceof Error ? error.message : "音效暂不可用" });
    }
}
export const SoundEffects = {
    update(patch: Partial<Settings>) {
        const settings = restoreSettings({ ...store.get(settingsAtom), ...patch });
        storage.set("settings", JSON.stringify(settings));
        store.set(settingsAtom, settings);
        void apply();
    },
    setBand(index: number, value: number) {
        if (!Number.isInteger(index) || index < 0 || index >= 5) return;
        const settings = store.get(settingsAtom);
        const detected = store.get(statusAtom).detectedPreset;
        const custom = settings.mode === "auto" && detected && PRESETS[detected]
            ? [...PRESETS[detected].gains] : [...store.get(profileAtom).gains];
        custom[index] = clampGain(value);
        this.update({ mode: "manual", preset: "custom", custom });
    },
    trackChanged(track: unknown) {
        currentTrack = track;
        void apply();
    },
    async refreshStatus() {
        const request = revision;
        try {
            if (bridge) {
                const status = await bridge.getStatus();
                if (request === revision) store.set(statusAtom, status);
            }
        } catch { /* A temporary bridge failure must not interrupt playback. */ }
    },
};
export function useSoundEffects() {
    return { settings: useAtomValue(settingsAtom), profile: useAtomValue(profileAtom),
        status: useAtomValue(statusAtom) };
}
// Restore settings even if the audio settings screen is never opened.
void apply();
