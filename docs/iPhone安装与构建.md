# 合听 iPhone 开发体验版

开发体验版，仅限指定好友体验，请勿公开传播。

## Windows 电脑也能参与开发与安装

编写和保存源码可以使用 Windows。生成 iPhone App 需要 macOS 上的 Xcode；本仓库准备了 GitHub Actions 云端 Mac 构建流程，因此不要求你购买 Mac。苹果安装包是 IPA，安卓 APK 不能安装到 iPhone。

仓库的 `Actions → Build iPhone app → Run workflow` 可启动云端构建。构建产物中的 `Heting-0.7.1-unsigned.ipa` 是**需要另外签名的 iPhone 包**。`simulator.zip` 仅供 Mac 上的模拟器检查，不能安装到真机。

源码配置支持 iOS 15.1 及以上、ARM64 iPhone。界面、两个平台的同层歌单、混合播放队列和体验版声明与安卓共用。每台设备独立保存登录状态，iPhone 上需要重新登录自己的音乐账号。

## 只有 Windows，如何安装到自己的 iPhone

IPA 需要以你自己的苹果账号签名。可在 Windows 上使用支持自有 IPA 的侧载工具，例如 [Sideloadly 官方网站](https://sideloadly.io/)（第三方工具）。

1. 云端构建成功后，在该次 Actions 运行页下载 `Heting-iPhone-0.7.1-unsigned` 产物 ZIP，解压取得 IPA。
2. 按工具官方说明安装所需苹果设备驱动，用数据线连接 iPhone，在手机上选择“信任此电脑”。
3. 在侧载工具中选择自己的 iPhone，把 IPA 拖进去，使用自己的苹果账号完成签名和安装。账号密码与验证码只在你自己的电脑或苹果官方验证界面输入，不要发给开发者。
4. 按 iPhone 实际提示完成开发者信任；如系统要求，在“设置 → 隐私与安全性”开启开发者模式并重启。
5. 打开“合听·体验版”，依次登录网易云和 QQ 音乐。两家的具体歌单在“全部歌单”页并列显示。

根据 Sideloadly 的[官方说明](https://sideloadly.io/faq)，免费苹果账号的签名通常有效 7 天，需要续签；工具支持自动刷新，具体条件以其说明为准。这不等于永久免签安装。苹果的免费 Personal Team 限制也可参考[官方开发者账号说明](https://developer.apple.com/help/account/basics/about-your-developer-account/)。

如果已经有付费苹果开发者账号，可另行用自己的证书与描述文件签名，或配置 TestFlight。当前构建流程不上传 App Store，也不索取或包含任何苹果签名秘密。

## Mac 或云端构建命令

需要 Xcode、Node.js 20、Go 1.25.1、CocoaPods。仓库中的内置 Go 模块会构建为静态 XCFramework，随 App 一起运行，不需要电脑服务、地址或密钥。

```bash
cd android-app
npm ci --legacy-peer-deps
bash scripts/build-account-engine-ios.sh
cd ios
pod install --repo-update
xcodebuild -workspace MusicFree.xcworkspace -scheme MusicFree \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -archivePath ./build/Heting.xcarchive CODE_SIGNING_ALLOWED=NO archive
```

有 Mac 时也可以用 Xcode 打开 `MusicFree.xcworkspace`，在 Signing & Capabilities 选择自己的 Team 与已连接的 iPhone，完成本机签名安装。

## 验证范围

是否完成 Xcode 编译，应以具体 Actions 运行结果为准。源码适配和共享逻辑测试不能代替真机验收。尚未在用户的 iPhone 上验证音乐平台账号密码/验证码、QQ 客户端跳转、后台持续播放与全部会员歌曲完整播放。

不要把 Cookie、sessions.json、苹果证书、描述文件或私钥提交到仓库。仅修改体验版声明不会限制谁能安装 App；本版按用户要求不设置邀请码。
