import { DEFAULT_SETTINGS, effectiveProfile, genrePreset, restoreSettings, presetGains } from "./policy";

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
test("vivid defaults apply to old presets while saved custom bands stay exact", () => {
    const oldPreset = restoreSettings({ enabled: true, mode: "manual", preset: "rock" });
    expect(effectiveProfile(oldPreset, null).gains).toEqual([5, 1.5, -1.5, 3.5, 5]);
    expect(presetGains("rock", "standard")).toEqual([3, 1, -1, 2, 3]);
    expect(presetGains("folk", "vivid")).toEqual([-1.5, 1.5, 3.5, 1.5, 0]);
    expect(presetGains("flat", "vivid")).toEqual([0, 0, 0, 0, 0]);
    const custom = [1, -2, 3, 0.5, 6];
    expect(effectiveProfile(restoreSettings({ preset: "custom", custom, strength: "vivid" }), null).gains).toEqual(custom);
});
