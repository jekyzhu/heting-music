# 合听 0.7.1 源码与构建

本版在合听首版基础上修改。上游来源与许可证保留于各目录：

- android-app：maotoumao/MusicFree，基准提交 d118b18b3d0c904400f7eea7bf99c0ceec6c1aee，AGPL-3.0。
- account-engine：guohuiyuan/go-music-api，基准提交 bacdfbe6cf6a5ba7331463d2039e3aac915c627f，AGPL-3.0。
- account-engine/third_party/music-lib：v1.1.1-0.20260814153305-59dd7753bbc8，保留 AGPL-3.0。

## 架构变化

安卓 App 内置 Go c-shared 原生库，通过 JNI 启动仅绑定 127.0.0.1 的模块，随机分配端口并自动生成进程内凭据；用户不输入地址、密钥，也不依赖电脑。退出整个 App 后模块随进程结束，后台播放沿用原播放器的前台服务。

官方登录页面通过 WebView 加载。域名及 HTTPS 受限制，页面密码和验证码由平台处理；Android CookieManager 读取此 App 内的官方网页会话。网易云会话验证后存入 App 私有目录；QQ 官方回调校验 state，并完成 QQ 音乐网页会话交换。账号会话通过原子替换写入权限 0600 的文件。账号退出按平台隔离。

界面采用象牙白、深墨绿、香槟金、衬线标题与唱片纹理，重做同层歌单网格、混合曲目列表、空状态和登录窗口。保留原播放器队列、后台播放与本地歌单功能。

## 0.7.1 修改

两个账号的具体歌单交替排列在同一个 FlatList 两列网格，使用 source:id 保留跨平台同名或同 ID 歌单。平台账号按钮只管理登录。新增体验范围声明，不设置邀请码验证。

QQ 默认提供独立网页版账号密码流程（官方桌面网页），并保留手机版网页授权。WebView 的非 HTTP 导航经过显式判断；仅把官方 wtloginmqq://ptlogin/qlogin 的可信目标交给 com.tencent.mobileqq。Android 声明 QQ 包可见性与 heting://qq-login 返回路由，不采用任意 intent URL。回调保留至同步检查结束，state 仍在原生层验证。原会话存储路径和测试签名保持不变。

## 构建

需要 Node.js 18+、完整 JDK 17、Go 1.25.1+、Android SDK 35、Build Tools 34/35、NDK 26.1.10909125。

```bash
cd android-app
npm ci --legacy-peer-deps
# ANDROID_HOME 指向 SDK，按需要设置 ANDROID_NDK_HOME
bash scripts/build-account-engine.sh
npx tsc --noEmit
npx jest src/core/accountLibrary src/pages/accountLibrary --runInBand
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

源码包不包含生成的原生 .so，需要先构建内置模块。它的源文件、JNI 入口、固定版本依赖和修改后的 music-lib 都包含在源码包内。应用 ID 为 fun.upup.musicfree.personal，版本代码 400013；个人测试签名与首版一致。正式分发请自行配置签名并遵守上游许可证。

后端检查：在 account-engine 中运行 `go test ./...`。`jni_smoke.go` 默认不参与 Linux 或 Android 构建，只在设置 `jni_smoke` 标签并提供 JDK JNI 头文件时用于桌面 JNI 启动检查。

## 验证边界

真实手机、真实密码/验证码登录、平台风控及会员全曲播放仍需用户在本机测试。不能根据类型检查、单元测试或原生库构建成功，推断所有歌曲都可完整播放。
