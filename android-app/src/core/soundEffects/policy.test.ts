import { DEFAULT_SETTINGS, effectiveProfile, genrePreset, restoreSettings } from "./policy";

test("recognizes explicit rock and folk metadata in either language", () => {
    expect(genrePreset({ genre: "Rock" })).toBe("rock");
    expect(genrePreset({ genres: ["Indie Folk"] })).toBe("folk");
    expect(genrePreset({ style: "民谣" })).toBe("folk");
    expect(genrePreset({ genre: "rock / alternative rock" })).toBe("rock");
});
test("does not infer genres from titles or ambiguous metadata", () => {
    expect(genrePreset({ title: "Rock", artist: "民谣歌手" })).toBe("flat");
    expect(genrePreset({ genre: "rock, folk" })).toBe("flat");
    expect(genrePreset({ genre: 42 })).toBe("flat");
    expect(genrePreset(null)).toBe("flat");
});
test("automatic switching preserves the saved manual curve", () => {
    const settings = { ...DEFAULT_SETTINGS, mode: "auto" as const, preset: "custom" as const,
        custom: [1, 2, 3, 4, 5] };
    expect(effectiveProfile(settings, { genre: "rock" }).preset).toBe("rock");
    expect(effectiveProfile(settings, { genre: "folk" }).preset).toBe("folk");
    expect(effectiveProfile({ ...settings, mode: "manual" }, { genre: "rock" }).gains)
        .toEqual([1, 2, 3, 4, 5]);
    expect(effectiveProfile(settings, {}).preset).toBe("flat");
});
test("restores damaged or outdated settings safely", () => {
    expect(restoreSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(restoreSettings({ enabled: "yes", preset: "__proto__", custom: [1] }))
        .toEqual(DEFAULT_SETTINGS);
    expect(restoreSettings({ custom: [NaN, Infinity, -99, 99, "oops"] }).custom)
        .toEqual([0, 0, -6, 6, 0]);
});
