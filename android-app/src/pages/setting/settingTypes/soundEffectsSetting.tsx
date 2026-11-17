import React, { useEffect, useState } from "react";
import { AppState, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import Slider from "@react-native-community/slider";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import { SoundEffects, useSoundEffects } from "@/core/soundEffects";
import { FREQUENCIES, PRESETS, Preset, presetGains, STRENGTHS, Strength } from "@/core/soundEffects/policy";

function Band({ index, value, disabled }: { index: number; value: number; disabled: boolean }) {
    const colors = useColors();
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);
    const frequency = FREQUENCIES[index];
    const label = frequency >= 1000 ? `${frequency / 1000} kHz` : `${frequency} Hz`;
    return <View style={styles.band}>
        <View style={styles.row}>
            <ThemeText>{label}</ThemeText>
            <ThemeText>{draft > 0 ? "+" : ""}{draft.toFixed(1)} dB</ThemeText>
        </View>
        <Slider accessibilityLabel={`${label} 增益`} disabled={disabled}
            minimumValue={-6} maximumValue={6} step={0.5} value={value}
            minimumTrackTintColor={colors.primary} thumbTintColor={colors.primary}
            onValueChange={setDraft} onSlidingComplete={v => SoundEffects.setBand(index, v)} />
    </View>;
}
export default function SoundEffectsSetting() {
    const { settings, profile, status, previewingOriginal } = useSoundEffects();
    const colors = useColors();
    useEffect(() => {
        void SoundEffects.refreshStatus();
        const timer = setInterval(() => { void SoundEffects.refreshStatus(); }, 1500);
        const listener = AppState.addEventListener("change", state => {
            if (state !== "active") void SoundEffects.previewOriginal(false);
        });
        return () => {
            clearInterval(timer); listener.remove();
            void SoundEffects.previewOriginal(false);
        };
    }, []);
    const shownPreset = settings.mode === "auto" ? status.detectedPreset ?? profile.preset : profile.preset;
    const shownGains = settings.mode === "auto" && status.detectedPreset
        ? presetGains(status.detectedPreset, settings.strength) : profile.gains;
    const currentName = shownPreset === "custom" ? "我的音效" : PRESETS[shownPreset].name;
    const strengthLabel = shownPreset === "custom" ? "手动曲线" : STRENGTHS[settings.strength].name;
    return <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.row}>
            <ThemeText fontWeight="bold">开启音效</ThemeText>
            <Switch accessibilityLabel="开启音效" value={settings.enabled}
                onValueChange={enabled => SoundEffects.update({ enabled })} />
        </View>
        <ThemeText style={styles.description}>
            {!settings.enabled ? "音效已关闭" : previewingOriginal ? "正在对比原声 · 点击下方按钮返回音效" : status.error ? `音效不可用：${status.error}` :
                status.waitingForPlayback ? "播放歌曲后生效" : status.active ?
                    `正在使用：${currentName} · ${strengthLabel} · ${status.bandCount} 个设备频段` : "音效暂未生效，设备音效可能未就绪或被其他均衡器占用"}
        </ThemeText>
        <TouchableOpacity accessibilityRole="button" disabled={!settings.enabled}
            accessibilityLabel={previewingOriginal ? "返回音效" : "对比原声"}
            style={[styles.preset, { borderColor: colors.primary, opacity: settings.enabled ? 1 : 0.4 }]}
            onPress={() => { void SoundEffects.previewOriginal(!previewingOriginal); }}>
            <ThemeText>{previewingOriginal ? "返回音效" : "对比原声"}</ThemeText>
        </TouchableOpacity>
        <ThemeText style={styles.description}>播放同一首歌时来回对比，更容易听出变化。离开此页面会自动返回音效。</ThemeText>
        <View style={styles.row}>
            <ThemeText>根据歌曲风格自动切换</ThemeText>
            <Switch accessibilityLabel="根据歌曲风格自动切换" value={settings.mode === "auto"}
                onValueChange={automatic => SoundEffects.update({ mode: automatic ? "auto" : "manual" })} />
        </View>
        <ThemeText style={styles.description}>
            {settings.mode === "auto" ?
                "优先使用歌曲风格标签；没有标签时，在手机本地分析播放音频，连续多次识别一致后切换。不确定时保持原声。手动调节将退出自动模式。" :
                "选择预设，或拖动滑杆定制。调节结果自动保存为“我的音效”，切歌后继续保留。"}
        </ThemeText>
        {settings.enabled && settings.mode === "auto" && status.detectionState !== "off" &&
            <ThemeText style={styles.description}>
                {status.detectionState === "detected" ? `音频识别：${currentName}` :
                    status.detectionState === "uncertain" ? "风格尚不确定，继续使用原声" :
                    status.detectionState === "unavailable" ? "本机音频识别暂不可用，可手动选择音效" :
                    "正在分析音频，通常需要约 10–40 秒有效播放"}
            </ThemeText>}
        <View style={styles.presets}>
            {(Object.keys(PRESETS) as Preset[]).map(preset =>
                <TouchableOpacity key={preset} accessibilityRole="button"
                    accessibilityState={{ selected: shownPreset === preset }}
                    style={[styles.preset, { borderColor: shownPreset === preset ? colors.primary : colors.textSecondary }]}
                    onPress={() => SoundEffects.update({ mode: "manual", preset })}>
                    <ThemeText>{PRESETS[preset].name}</ThemeText>
                </TouchableOpacity>)}
            <TouchableOpacity accessibilityRole="button" style={[styles.preset, { borderColor: colors.textSecondary }]}
                onPress={() => SoundEffects.update({ mode: "manual", preset: "custom" })}>
                <ThemeText>我的音效</ThemeText>
            </TouchableOpacity>
        </View>
        <ThemeText fontWeight="bold">预设音效强度</ThemeText>
        <View style={[styles.presets, { marginTop: 12 }]}>
            {(Object.keys(STRENGTHS) as Strength[]).map(strength =>
                <TouchableOpacity key={strength} accessibilityRole="button"
                    accessibilityState={{ selected: settings.strength === strength, disabled: settings.mode === "manual" && settings.preset === "custom" }}
                    disabled={settings.mode === "manual" && settings.preset === "custom"}
                    style={[styles.preset, { borderColor: settings.strength === strength ? colors.primary : colors.textSecondary }]}
                    onPress={() => SoundEffects.update({ strength })}>
                    <ThemeText>{STRENGTHS[strength].name}</ThemeText>
                </TouchableOpacity>)}
        </View>
        <ThemeText style={styles.description}>{settings.mode === "manual" && settings.preset === "custom" ? "我的音效按滑杆值生效，不受预设强度影响。" : "鲜明会拉开低音、人声和高频的差别；喜欢细腻听感可选自然。"}</ThemeText>
        {FREQUENCIES.map((_, index) => <Band key={index} index={index}
            value={shownGains[index]} disabled={!settings.enabled} />)}
        <ThemeText style={styles.description}>
            音效平滑过渡，并预留增益余量以减少削波，开启后音量可能稍低。预设是听感起点，可按耳机和个人喜好修改。
        </ThemeText>
    </ScrollView>;
}
const styles = StyleSheet.create({
    page: { padding: 20, paddingBottom: 40 },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    description: { marginTop: 10, marginBottom: 22, lineHeight: 22 },
    presets: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
    preset: { paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderRadius: 22 },
    band: { marginVertical: 10 },
});
