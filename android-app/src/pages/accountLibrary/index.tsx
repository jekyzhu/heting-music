import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import TrackPlayer, { useCurrentMusic } from "@/core/trackPlayer";
import { AccountPlaylist, AccountSong, MusicSource, SOURCE_NAMES, toMusicItem } from "@/core/accountLibrary/client";
import { playlistShelf } from "@/core/accountLibrary/playlistShelf";
import { getAccountBridge, logoutAccount } from "@/core/accountLibrary/native";
import HomeBody from "../home/components/homeBody";
import OfficialLogin from "./officialLogin";
import { classical as c } from "./palette";

const sources: MusicSource[] = ["netease", "qq"];
const accents = { netease: c.wine, qq: c.forest };
type Shelf = { connected: boolean; playlists: AccountPlaylist[]; busy: boolean; error: string; synced: string };
type Library = Record<MusicSource, Shelf>;
const emptyShelf = (): Shelf => ({ connected: false, playlists: [], busy: false, error: "", synced: "" });
const initialLibrary = (): Library => ({ netease: emptyShelf(), qq: emptyShelf() });
const message = (error: unknown) => error instanceof Error ? error.message : "暂时未能完成，请重试";

function RecordArt({ size = 112, small = false }: { size?: number; small?: boolean }) {
    return <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden>
        <Circle cx="60" cy="60" r="56" fill={small ? c.soft : "#102C26"} stroke={small ? c.line : "#6C7450"} strokeWidth="0.6" />
        {[47, 42, 37, 32].map(r => <Circle key={r} cx="60" cy="60" r={r} stroke={small ? c.line : "#355549"} strokeWidth="0.7" fill="none" />)}
        <Circle cx="60" cy="60" r="22" fill={small ? c.gold : "#C1A66F"} />
        <Path d="M56 48v20c-9-2-12 8-5 9 6 1 9-2 9-7V53l10-2v12c-9-2-12 8-5 9 6 1 9-2 9-7V44z" fill={small ? c.paper : "#243E31"} transform="translate(-5 -2)" />
        <Circle cx="60" cy="60" r="2" fill={c.paper} />
    </Svg>;
}
function Artwork({ uri }: { uri?: string }) {
    const [failed, setFailed] = useState(false);
    return uri && !failed ? <Image source={{ uri }} style={s.artwork} onError={() => setFailed(true)} /> : <View style={s.artwork}><RecordArt size={90} small /></View>;
}
function Action({ title, onPress, primary = false, disabled = false }: { title: string; onPress(): void; primary?: boolean; disabled?: boolean }) {
    return <Pressable hitSlop={6} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.action, primary && s.actionPrimary, disabled && s.disabled]}>
        <Text style={[s.actionText, primary && s.actionPrimaryText]}>{title}</Text>
    </Pressable>;
}

export default function AccountLibrary() {
    const [library, setLibrary] = useState<Library>(initialLibrary);
    const { width } = useWindowDimensions();
    const [tab, setTab] = useState<"folders" | "songs" | "local">("folders");
    const [filter, setFilter] = useState("");
    const [selected, setSelected] = useState<AccountPlaylist | null>(null);
    const [songs, setSongs] = useState<AccountSong[]>([]);
    const [loadingSongs, setLoadingSongs] = useState(false);
    const [songError, setSongError] = useState("");
    const [progress, setProgress] = useState("");
    const [initializing, setInitializing] = useState(true);
    const [engineError, setEngineError] = useState("");
    const [loginSource, setLoginSource] = useState<MusicSource | null>(null);
    const loginRef = useRef<MusicSource | null>(null);
    const generation = useRef(0);
    const libraryController = useRef<AbortController | null>(null);
    const songController = useRef<AbortController | null>(null);
    const currentMusic = useCurrentMusic();
    const total = sources.reduce((n, source) => n + library[source].playlists.length, 0);
    const connected = sources.filter(source => library[source].connected).length;
    loginRef.current = loginSource;

    const sync = useCallback(async () => {
        libraryController.current?.abort();
        const controller = new AbortController(); libraryController.current = controller;
        setEngineError("");
        try {
            const bridge = await getAccountBridge();
            const accounts = await bridge.status(controller.signal);
            await Promise.all(sources.map(async source => {
                if (controller.signal.aborted) { return; }
                if (!accounts[source]) { setLibrary(old => ({ ...old, [source]: emptyShelf() })); return; }
                setLibrary(old => ({ ...old, [source]: { ...old[source], connected: true, busy: true, error: "" } }));
                try {
                    const playlists = await bridge.playlists(source, controller.signal);
                    if (!controller.signal.aborted) { setLibrary(old => ({ ...old, [source]: { connected: true, playlists, busy: false, error: "", synced: new Date().toLocaleTimeString() } })); }
                } catch (error) {
                    if (!controller.signal.aborted) { setLibrary(old => ({ ...old, [source]: { ...old[source], busy: false, error: message(error) } })); }
                }
            }));
        } catch (error) { if (!controller.signal.aborted) { setEngineError(message(error)); } }
        finally { if (!controller.signal.aborted) { setInitializing(false); } }
    }, []);
    useEffect(() => {
        void sync();
        const listener = AppState.addEventListener("change", state => { if (state === "active" && !loginRef.current) { void sync(); } });
        return () => { libraryController.current?.abort(); songController.current?.abort(); listener.remove(); };
    }, [sync]);
    const clearSongs = () => { songController.current?.abort(); generation.current++; setSongs([]); setSelected(null); setLoadingSongs(false); setSongError(""); setProgress(""); };
    const openSongs = async (playlist: AccountPlaylist | null) => {
        if (!connected) { Alert.alert("先登录音乐账号", "在歌单目录中登录网易云音乐或 QQ 音乐，即可读取自己的收藏。"); setTab("folders"); return; }
        songController.current?.abort();
        const controller = new AbortController(); songController.current = controller;
        const version = ++generation.current;
        setSelected(playlist); setSongs([]); setSongError(""); setLoadingSongs(true); setFilter(""); setTab("songs");
        try {
            const bridge = await getAccountBridge();
            const targets = playlist ? [playlist] : sources.flatMap(source => library[source].playlists);
            const found = new Map<string, AccountSong>();
            const failures: string[] = sources.filter(source => library[source].error).map(source => `${SOURCE_NAMES[source]}的目录尚未同步完整`);
            let next = 0, completed = 0;
            await Promise.all([0, 1].map(async () => {
                while (next < targets.length && !controller.signal.aborted) {
                    const item = targets[next++];
                    try {
                        const data = await bridge.songs(item.source, item.id, controller.signal);
                        data.forEach(song => found.set(`${song.source}:${song.id}`, song));
                        if (data.length < item.track_count) { failures.push(`${item.name}：返回 ${data.length} / ${item.track_count} 首`); }
                    } catch (error) { failures.push(`${item.name}：${message(error)}`); }
                    completed++;
                    if (version === generation.current) { setProgress(`正在整理歌单 ${completed} / ${targets.length}`); }
                }
            }));
            if (version !== generation.current || controller.signal.aborted) { return; }
            setSongs([...found.values()]);
            setSongError(failures.length ? `有 ${failures.length} 项未完整同步：${failures.join("；")}` : "");
        } catch (error) { if (version === generation.current) { setSongError(message(error)); } }
        finally { if (version === generation.current) { setLoadingSongs(false); } }
    };
    const startLogin = async (source: MusicSource) => {
        try {
            await getAccountBridge();
            if (library[source].connected) { await logoutAccount(source); clearSongs(); await TrackPlayer.clearPlayList(); setLibrary(old => ({ ...old, [source]: emptyShelf() })); }
            setLoginSource(source);
        } catch (error) { Alert.alert("暂时无法打开登录", message(error)); }
    };
    const finishLogin = useCallback(() => {
        setLoginSource(null); setSongs([]); setSelected(null); setTab("folders");
        void TrackPlayer.clearPlayList().then(() => sync());
    }, [sync]);
    const logout = (source: MusicSource) => Alert.alert("退出音乐账号", `退出${SOURCE_NAMES[source]}并清空当前播放队列？`, [
        { text: "取消", style: "cancel" }, { text: "退出", style: "destructive", onPress: async () => {
            try { await logoutAccount(source); clearSongs(); await TrackPlayer.clearPlayList(); setLibrary(old => ({ ...old, [source]: emptyShelf() })); }
            catch (error) { Alert.alert("退出失败", message(error)); }
        } },
    ]);
    const visiblePlaylists = useMemo(() => playlistShelf(library, filter), [library, filter]);
    const manageAccount = (source: MusicSource) => {
        if (!library[source].connected) { void startLogin(source); return; }
        Alert.alert(SOURCE_NAMES[source], `已登录 · ${library[source].playlists.length} 张歌单。两个平台的登录状态独立保存。`, [
            { text: "取消", style: "cancel" },
            { text: "切换账号", onPress: () => { void startLogin(source); } },
            { text: "退出此账号", style: "destructive", onPress: () => logout(source) },
        ]);
    };
    const visibleSongs = useMemo(() => songs.filter(song => `${song.name} ${song.artist} ${SOURCE_NAMES[song.source]}`.toLowerCase().includes(filter.toLowerCase())), [songs, filter]);
    const play = async (song: AccountSong) => {
        if (song.is_invalid) { Alert.alert("这首歌暂时无法播放", "音乐平台当前未提供可用资源，请刷新或重新登录后重试。"); return; }
        await TrackPlayer.playWithReplacePlayList(toMusicItem(song), visibleSongs.filter(item => !item.is_invalid).map(toMusicItem));
    };
    const header = <View style={s.header}>
        <View style={s.previewNotice} accessibilityRole="text"><Text style={s.previewTitle}>开发体验版 · 仅限指定好友体验</Text><Text style={s.previewText}>请勿公开传播。音乐服务与播放权限以本人平台账号为准。</Text></View>
        <View style={s.hero}>
            <View style={s.heroTop}><Text style={s.heroLabel}>A PERSONAL MUSIC COLLECTION</Text><Text style={s.opus}>OP. 03</Text></View>
            <View style={[s.heroBody, connected > 0 && s.compactHeroBody]}><View style={s.heroCopy}><Text style={[s.heroTitle, connected > 0 && s.compactHeroTitle]}>{connected ? "让珍藏，在此相逢。" : "让每一首，\n在此相逢。"}</Text>{!connected && <View style={s.goldRule} />}<Text style={s.heroSubtitle}>两家的具体歌单，并列珍藏于此。</Text></View><View style={s.record}><RecordArt size={connected ? 65 : 112} /></View></View>
            <View style={s.heroFoot}><Text style={s.heroFootText}>{connected ? `${connected} 个账号已登录` : "从熟悉的账号，开始一段聆听"}</Text><Text style={s.heroFootCount}>{String(total).padStart(2, "0")}  COLLECTIONS</Text></View>
        </View>
        <View style={s.sectionHeading}><View><Text style={s.eyebrow}>THE LIBRARY</Text><Text style={s.sectionTitle}>我的音乐收藏</Text></View><Action title="↻ 刷新" onPress={() => { void sync(); }} disabled={initializing || sources.some(source => library[source].busy)} /></View>
        <View style={s.tabs}>{([["folders", "全部歌单"], ["songs", "全部歌曲"], ["local", "本地歌单"]] as const).map(([key, title]) =>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === key }} key={key} onPress={() => {
                if (key === "songs") { void openSongs(null); } else { songController.current?.abort(); generation.current++; setLoadingSongs(false); setTab(key); setSelected(null); setFilter(""); }
            }} style={[s.tab, tab === key && s.activeTab]}><Text style={[s.tabText, tab === key && s.activeTabText]}>{title}</Text></Pressable>)}</View>
        {tab !== "local" && <View style={s.accounts}>{sources.map(source => <Pressable key={source} accessibilityRole="button" accessibilityLabel={`${SOURCE_NAMES[source]}，${library[source].connected ? "已登录，管理账号" : "点击登录"}`} onPress={() => manageAccount(source)} style={s.accountChip}>
            <View style={s.chipTitle}><View style={[s.dot, library[source].connected && s.connectedDot]} /><Text style={s.chipName}>{SOURCE_NAMES[source]}</Text></View>
            <Text style={s.accountLabel}>{library[source].busy ? "正在同步…" : library[source].connected ? `已登录 · ${library[source].playlists.length} 张歌单  ›` : "点击登录  ›"}</Text>
        </Pressable>)}</View>}
        {tab !== "local" && sources.map(source => library[source].error ? <View key={source} style={s.notice}><Text style={s.error}>{SOURCE_NAMES[source]}：{library[source].error}</Text><Action title="重新登录此账号" onPress={() => { void startLogin(source); }} /></View> : null)}
        {initializing && <View style={s.loading}><ActivityIndicator color={c.gold} /><Text style={s.secondary}>正在整理音乐库…</Text></View>}
        {!!engineError && <View style={s.notice}><Text style={s.error}>{engineError}</Text><Action title="重新打开音乐库" onPress={() => { void sync(); }} /></View>}
        {tab !== "local" && <View style={s.search}><Text style={s.searchMark}>⌕</Text><TextInput value={filter} onChangeText={setFilter} placeholder={tab === "songs" ? "寻找一首歌、一位音乐家…" : "寻找你的歌单…"} placeholderTextColor={c.muted} style={s.searchInput} accessibilityLabel="筛选音乐收藏" /></View>}
        {tab === "folders" && <View style={s.shelfHeading}><Text style={s.shelfTitle}>全部歌单</Text><Text style={s.secondary}>{filter ? visiblePlaylists.length : total} 张 · 两个平台，同一层选择</Text></View>}
        {tab === "songs" && <View style={s.selection}>
            <Text style={s.selectionLabel}>{selected ? SOURCE_NAMES[selected.source] : "ALL YOUR MUSIC"}</Text>
            <Text style={s.selectionTitle}>{selected ? selected.name : "所有珍藏，同一处聆听"}</Text>
            <Text style={s.secondary}>{loadingSongs ? progress || "正在读取歌曲…" : `${songs.length} 首歌曲 · 保留每首歌的原平台来源`}</Text>
            {!loadingSongs && visibleSongs.length > 0 && <View style={s.playAll}><Action primary title="▶  播放当前列表" onPress={() => { void play(visibleSongs.find(song => !song.is_invalid) ?? visibleSongs[0]); }} /></View>}
            {!!songError && <Text style={s.error}>{songError}</Text>}
        </View>}
    </View>;

    return <View style={s.root}>
        {tab === "local" ? <View style={s.flex}>{header}<HomeBody /></View> : tab === "folders" ?
            <FlatList key="playlists" testID="shared-playlist-shelf" data={visiblePlaylists} numColumns={2} keyExtractor={item => `${item.source}:${item.id}`}
                ListHeaderComponent={header} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollBody} columnWrapperStyle={s.playlistRow}
                refreshControl={<RefreshControl tintColor={c.gold} colors={[c.forest]} refreshing={sources.some(source => library[source].busy)} onRefresh={() => { void sync(); }} />}
                ListEmptyComponent={<View style={s.emptyCollection}><RecordArt size={74} small /><Text style={s.emptyTitle}>{filter ? "没有找到这个歌单" : "让珍藏，在此相逢"}</Text><Text style={s.empty}>{filter ? "试试歌单名称或音乐平台名称。" : connected ? "同步后，两个账号的具体歌单会直接出现在这里。" : "点击上方账号登录，所有歌单将并列呈现。"}</Text></View>}
                ListFooterComponent={<View style={s.quote}><View style={s.quoteLine} /><Text style={s.quoteText}>留一段时间，给音乐。</Text><Text style={s.quoteEnglish}>MAKE ROOM FOR MUSIC.</Text></View>}
                renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`打开歌单 ${item.name}，${SOURCE_NAMES[item.source]}`} onPress={() => { void openSongs(item); }} style={[s.playlistCard, { width: (width - 56) / 2 }]}>
                    <Artwork uri={item.cover} /><View style={s.playlistCaption}><View style={[s.sourceBadge, s.playlistSource, { borderColor: `${accents[item.source]}35` }]}><Text style={[s.badgeText, { color: accents[item.source] }]}>{SOURCE_NAMES[item.source]}</Text></View>
                        <Text style={s.playlistTitle} numberOfLines={2}>{item.name}</Text><Text style={s.playlistMeta} numberOfLines={1}>{item.track_count} 首 · {item.creator || "我的收藏"}</Text>
                    </View>
                </Pressable>} /> : <FlatList key="songs" data={visibleSongs} keyExtractor={item => `${item.source}:${item.id}`} ListHeaderComponent={header} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollBody}
                ListEmptyComponent={loadingSongs ? <ActivityIndicator color={c.gold} style={s.emptySpinner} /> : <View style={s.emptyCollection}><RecordArt size={74} small /><Text style={s.emptyTitle}>让音乐慢慢铺开</Text><Text style={s.empty}>{songError ? "请刷新或重新登录后再试。" : "这里会显示两个平台的真实收藏。"}</Text></View>}
                renderItem={({ item, index }) => <Pressable accessibilityRole="button" accessibilityLabel={`播放 ${item.name}，${SOURCE_NAMES[item.source]}`} onPress={() => { void play(item); }} style={s.song}>
                    <Text style={s.number}>{String(index + 1).padStart(2, "0")}</Text><View style={s.flex}><Text style={s.songTitle} numberOfLines={1}>{item.name}</Text><Text style={s.playlistMeta} numberOfLines={1}>{item.artist}{item.album ? ` · ${item.album}` : ""}</Text></View>
                    <View style={s.songMeta}><View style={[s.sourceBadge, { borderColor: `${accents[item.source]}35` }]}><Text style={[s.badgeText, { color: accents[item.source] }]}>{SOURCE_NAMES[item.source]}</Text></View><Text style={s.duration}>{item.is_invalid ? "暂不可用" : item.duration ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, "0")}` : "—"}</Text></View>
                </Pressable>} />}
        {!currentMusic && <View style={s.idlePlayer}><RecordArt size={33} small /><View style={s.flex}><Text style={s.idleTitle}>合听 · 私人音乐馆</Text><Text style={s.idleHint}>选择一首歌，开始聆听</Text></View><Text style={s.idleNote}>♫</Text></View>}
        {loginSource && <OfficialLogin source={loginSource} onClose={() => setLoginSource(null)} onConnected={finishLogin} />}
    </View>;
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper }, flex: { flex: 1 }, header: { paddingHorizontal: 22 }, scrollBody: { paddingBottom: 28 },
    previewNotice: { marginTop: 10, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: c.gold, backgroundColor: "#EEE6D3" }, previewTitle: { color: "#705B33", fontSize: 12, fontWeight: "600", lineHeight: 19 }, previewText: { color: "#887653", fontSize: 10, lineHeight: 17, marginTop: 3 },
    compactHeroBody: { paddingVertical: 13 }, compactHeroTitle: { fontSize: 21, lineHeight: 35, letterSpacing: 1 },
    hero: { backgroundColor: c.forest, borderRadius: 20, paddingHorizontal: 23, paddingTop: 21, paddingBottom: 17, marginTop: 10, overflow: "hidden" }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroLabel: { color: "#BDCBBA", fontSize: 8, letterSpacing: 1.6 }, opus: { color: "#C8B484", fontFamily: c.serif, fontSize: 11, letterSpacing: 1.3 },
    heroBody: { flexDirection: "row", alignItems: "center", paddingVertical: 25 }, heroCopy: { flex: 1, zIndex: 1 }, heroTitle: { color: "#F8F1DF", fontFamily: c.serif, fontSize: 29, lineHeight: 43, letterSpacing: 2 }, goldRule: { width: 32, height: 1, backgroundColor: c.gold, marginTop: 15, marginBottom: 13 }, heroSubtitle: { fontSize: 10, color: "#C2CDBE", lineHeight: 17, maxWidth: 170 }, record: { marginRight: -27, marginLeft: -6, transform: [{ rotate: "-14deg" }] }, heroFoot: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#63734F", paddingTop: 13, alignItems: "center", justifyContent: "space-between", gap: 8 }, heroFootText: { color: "#C2CDBE", fontSize: 9, flexShrink: 1 }, heroFootCount: { color: "#C8B484", fontSize: 8, letterSpacing: 1.3 },
    sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 27, marginBottom: 15 }, eyebrow: { color: c.gold, letterSpacing: 2, fontSize: 8, marginBottom: 8 }, sectionTitle: { color: c.ink, fontSize: 23, fontFamily: c.serif, letterSpacing: 2 }, tabs: { flexDirection: "row", gap: 27, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line, marginBottom: 18 }, tab: { paddingTop: 6, paddingBottom: 13, borderBottomWidth: 2, borderBottomColor: "transparent" }, activeTab: { borderBottomColor: c.gold }, tabText: { color: c.muted, fontSize: 13 }, activeTabText: { color: c.ink, fontWeight: "600" },
    loading: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 12 }, secondary: { color: c.muted, fontSize: 12, lineHeight: 20 }, notice: { backgroundColor: c.soft, borderRadius: 12, padding: 12 }, search: { flexDirection: "row", alignItems: "center", backgroundColor: "#ECE6D9", borderRadius: 11, paddingHorizontal: 13, marginBottom: 19 }, searchMark: { fontSize: 24, color: c.muted, marginRight: 9 }, searchInput: { flex: 1, color: c.ink, fontSize: 12, paddingVertical: 11 },
    action: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, alignItems: "center", justifyContent: "center" }, actionPrimary: { backgroundColor: c.forest, borderColor: c.forest }, actionText: { color: c.ink, fontSize: 11 }, actionPrimaryText: { color: "#FAF4E5" }, disabled: { opacity: 0.5 },
    accounts: { flexDirection: "row", gap: 10, marginBottom: 18 }, accountChip: { flex: 1, backgroundColor: c.surface, borderRadius: 11, padding: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }, chipTitle: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 9 }, chipName: { fontSize: 12, color: c.ink }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#B3AD9C" }, connectedDot: { backgroundColor: "#59765B" }, accountLabel: { color: c.muted, fontSize: 10 },
    shelfHeading: { marginBottom: 16, gap: 5 }, shelfTitle: { color: c.ink, fontFamily: c.serif, fontSize: 19, letterSpacing: 1 },
    playlistRow: { paddingHorizontal: 22, gap: 12 }, playlistCard: { backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, borderRadius: 13, overflow: "hidden", marginBottom: 15 }, artwork: { width: "100%", aspectRatio: 1, overflow: "hidden", backgroundColor: c.soft, alignItems: "center", justifyContent: "center" }, playlistCaption: { padding: 12 }, playlistSource: { alignSelf: "flex-start", marginBottom: 8 }, playlistTitle: { color: c.ink, fontSize: 14, lineHeight: 21, minHeight: 42 }, playlistMeta: { color: c.muted, fontSize: 10, lineHeight: 17, marginTop: 5 }, error: { color: c.wine, fontSize: 11, lineHeight: 19, paddingVertical: 10 }, empty: { textAlign: "center", paddingVertical: 16, paddingHorizontal: 15, color: c.muted, fontSize: 12, lineHeight: 21 },
    quote: { alignItems: "center", paddingTop: 19, paddingBottom: 12 }, quoteLine: { height: 1, width: 29, backgroundColor: c.gold, marginBottom: 14 }, quoteText: { fontSize: 15, color: "#7D7C67", fontFamily: c.serif, letterSpacing: 3 }, quoteEnglish: { marginTop: 9, color: c.gold, fontSize: 7, letterSpacing: 2.1 },
    selection: { paddingBottom: 16 }, selectionLabel: { fontSize: 9, color: c.gold, letterSpacing: 1.5, marginTop: 5 }, selectionTitle: { color: c.ink, fontSize: 20, fontFamily: c.serif, marginVertical: 10, lineHeight: 29 }, playAll: { alignSelf: "flex-start", marginTop: 15 }, song: { flexDirection: "row", alignItems: "center", marginHorizontal: 22, paddingVertical: 17, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }, number: { fontFamily: c.serif, color: c.gold, width: 25, fontSize: 16 }, songTitle: { color: c.ink, fontSize: 14, lineHeight: 21 }, songMeta: { alignItems: "flex-end", maxWidth: 90 }, sourceBadge: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 }, badgeText: { fontSize: 8 }, duration: { color: c.muted, fontSize: 9, marginTop: 7 }, emptyCollection: { alignItems: "center", paddingTop: 16 }, emptyTitle: { fontFamily: c.serif, color: c.ink, fontSize: 20, marginTop: 18, letterSpacing: 2 }, emptySpinner: { margin: 30 },
    idlePlayer: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, paddingHorizontal: 24, paddingVertical: 13, gap: 12 }, idleTitle: { color: c.ink, fontFamily: c.serif, fontSize: 13, letterSpacing: 1 }, idleHint: { fontSize: 9, color: c.muted, marginTop: 5 }, idleNote: { fontSize: 26, color: c.gold },
});
