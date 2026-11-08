# 合听 · Heting

开发体验版，仅限指定好友体验，请勿公开传播。

把网易云音乐和 QQ 音乐账号中的具体歌单放在同一个界面，保留来源并使用本人账号的播放权限。界面采用象牙白、墨绿与金色。

- `android-app/`：React Native 应用，共用 Android / iPhone 界面；Android 0.7.1 已构建与签名检查。
- `account-engine/`：手机内置 Go 音乐模块，私有会话、自动本机连接，无需填写服务地址和密钥。
- `docs/`：使用说明、上游来源、构建与验证记录。

## 下载与构建状态

- [安卓 0.7.1 安装包及说明](releases/android/0.7.1/)：已构建、签名和完整性检查，可覆盖升级。
- [iPhone 云端构建](https://github.com/jekyzhu/heting-music/actions/workflows/ios-build.yml)：使用 GitHub 的 Mac 编译，产物需要苹果签名后才能装到手机。
- [只有 Windows 时的 iPhone 安装说明](docs/iPhone安装与构建.md)：包含签名、侧载、免费账号续签限制与 Mac 构建方法。

共享界面/登录流程的 22 项自动检查、TypeScript 与 Go 本机模块检查已通过。iPhone Xcode 编译状态以 Actions 具体运行结果为准；真实账号和 iPhone 真机尚未验收。

## 许可与上游

基于 [MusicFree](https://github.com/maotoumao/MusicFree)、[go-music-api](https://github.com/guohuiyuan/go-music-api) 和 music-lib。保留各目录许可证与作者说明，采用 AGPL-3.0。体验范围声明不修改上游开源许可证。

密码和验证码只在音乐平台官方页面中输入。不要向仓库提交 Cookie、会话文件、苹果证书、描述文件或其他账号秘密。
