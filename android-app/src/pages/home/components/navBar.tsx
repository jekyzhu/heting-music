import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import IconButton from "@/components/base/iconButton";
import { classical as c } from "@/pages/accountLibrary/palette";

export default function NavBar() {
    const navigation = useNavigation<any>();
    return <View style={s.bar}>
        <IconButton accessibilityLabel="打开侧边栏" name="bars-3" color={c.ink} style={s.menu} onPress={() => navigation.openDrawer()} />
        <View style={s.brand}><Text style={s.name}>合 听</Text><Text style={s.subtitle}>CLASSICAL LIBRARY</Text></View>
        <View style={s.seal}><Text style={s.sealText}>私 藏</Text></View>
    </View>;
}
const s = StyleSheet.create({
    bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, height: 66, backgroundColor: c.paper },
    menu: { width: 26, height: 24 }, brand: { alignItems: "center" }, name: { fontFamily: c.serif, fontSize: 23, color: c.ink, letterSpacing: 3 }, subtitle: { fontSize: 7, letterSpacing: 1.7, color: c.gold, marginTop: 5 },
    seal: { borderWidth: StyleSheet.hairlineWidth, borderColor: c.gold, paddingHorizontal: 6, paddingVertical: 5, borderRadius: 3 }, sealText: { color: c.gold, fontSize: 8 },
});
