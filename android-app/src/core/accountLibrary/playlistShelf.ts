import { AccountPlaylist, MusicSource, SOURCE_NAMES } from "./client";

// One shelf for actual playlists. A source is metadata, never a parent folder.
export function playlistShelf(library: Record<MusicSource, { playlists: AccountPlaylist[] }>, query = ""): AccountPlaylist[] {
    const all: AccountPlaylist[] = [];
    const seen = new Set<string>();
    const { netease, qq } = library;
    for (let index = 0; index < Math.max(netease.playlists.length, qq.playlists.length); index++) {
        for (const source of ["netease", "qq"] as const) {
            const playlist = library[source].playlists[index];
            if (!playlist) { continue; }
            const key = `${source}:${playlist.id}`;
            if (seen.has(key)) { continue; }
            seen.add(key); all.push({ ...playlist, source });
        }
    }
    const search = query.trim().toLocaleLowerCase();
    return search ? all.filter(item => `${item.name} ${item.creator} ${SOURCE_NAMES[item.source]}`.toLocaleLowerCase().includes(search)) : all;
}
