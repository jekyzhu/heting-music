// Five reference points are interpolated onto the device's actual EQ bands.
export const FREQUENCIES = [60, 230, 910, 3600, 14000] as const;
export const PRESETS = {
    flat: { name: "原声", gains: [0, 0, 0, 0, 0] },
    rock: { name: "摇滚", gains: [3, 1, -1, 2, 3] },
    folk: { name: "民谣", gains: [-1, 1, 2, 1, 0] },
    pop: { name: "流行", gains: [1, 0, 1, 2, 1] },
    classical: { name: "古典", gains: [1, 0, 0, 1, 2] },
    electronic: { name: "电子", gains: [4, 2, -1, 1, 3] },
} as const;
export type Preset = keyof typeof PRESETS;
export type Mode = "auto" | "manual";
export const STRENGTHS = {
    gentle: { name: "自然", scale: 0.65 },
    standard: { name: "标准", scale: 1 },
    vivid: { name: "鲜明", scale: 1.7 },
} as const;
export type Strength = keyof typeof STRENGTHS;
export interface Settings {
    enabled: boolean;
    mode: Mode;
    preset: Preset | "custom";
    custom: number[];
    strength: Strength;
}
export const DEFAULT_SETTINGS: Settings = {
    enabled: false, mode: "manual", preset: "flat", custom: [0, 0, 0, 0, 0], strength: "vivid",
};
export function clampGain(value: number) {
    return Number.isFinite(value) ? Math.max(-6, Math.min(6, value)) : 0;
}
export function restoreSettings(value: unknown): Settings {
    const v = value as Partial<Settings> | null;
    return {
        enabled: v?.enabled === true,
        mode: v?.mode === "auto" ? "auto" : "manual",
        strength: v?.strength === "gentle" || v?.strength === "standard" ? v.strength : "vivid",
        preset: v?.preset === "custom" || (typeof v?.preset === "string" &&
            Object.prototype.hasOwnProperty.call(PRESETS, v.preset)) ? v.preset : "flat",
        custom: Array.isArray(v?.custom) && v.custom.length === 5
            ? v.custom.map(n => typeof n === "number" ? clampGain(n) : 0)
            : [0, 0, 0, 0, 0],
    };
}
const GENRES: Record<string, Preset> = {
    rock: "rock", "摇滚": "rock", "搖滾": "rock", "alternative rock": "rock",
    "indie rock": "rock", "hard rock": "rock", metal: "rock", punk: "rock",
    folk: "folk", "民谣": "folk", "民謠": "folk", "indie folk": "folk",
    "folk rock": "folk", acoustic: "folk", "singer-songwriter": "folk",
    pop: "pop", "流行": "pop", classical: "classical", "古典": "classical",
    electronic: "electronic", "电子": "electronic", "電子": "electronic", edm: "electronic",
};
// Only explicit genre metadata is evidence. Titles/artists/playlist names are not.
// Conflicting styles deliberately fall back to flat rather than guessing.
export function genrePreset(track: unknown): Preset {
    const t = track as Record<string, unknown> | null;
    const labels = [t?.genre, t?.genres, t?.style, t?.styles].flatMap(value =>
        Array.isArray(value) ? value : [value]);
    const matches = new Set<Preset>();
    for (const label of labels) {
        if (typeof label !== "string") continue;
        for (const part of label.toLowerCase().split(/[,;，；/|]/)) {
            const preset = GENRES[part.trim()];
            if (preset) matches.add(preset);
        }
    }
    return matches.size === 1 ? [...matches][0] : "flat";
}
export function presetGains(preset: Preset, strength: Strength) {
    // Stronger bass/kick for wired headphones; other strengths keep the original contour.
    if (preset === "rock" && strength === "vivid") return [6, 4, -2, 2, 4];
    return PRESETS[preset].gains.map(gain => clampGain(Math.round(gain * STRENGTHS[strength].scale * 2) / 2));
}
export function effectiveProfile(settings: Settings, track: unknown) {
    const preset = settings.mode === "auto" ? genrePreset(track) : settings.preset;
    return {
        preset,
        gains: preset === "custom" ? settings.custom.map(clampGain) : presetGains(preset, settings.strength),
    };
}
