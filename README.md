# 合听 · Heting

开发体验版，仅限指定好友体验，请勿公开传播。

把网易云音乐和 QQ 音乐账号中的具体歌单放在同一个界面，保留来源并使用本人账号的播放权限。界面采用象牙白、墨绿与金色。

- `android-app/`：当前安卓版 React Native 应用源码；Android 0.7.1 已构建与签名检查。
- `account-engine/`：手机内置 Go 音乐模块，私有会话、自动本机连接，无需填写服务地址和密钥。
- `docs/`：使用说明、上游来源、构建与验证记录。

## 当前可用版本

[安卓 0.7.1 安装包及说明](releases/android/0.7.1/)已保存，可直接下载并覆盖安装。

iPhone 开发已按用户要求停止，未发布 iOS 安装包；云端构建已禁用。苹果版草稿保留在 `archive/ios-prototype-20261108` 分支，主分支保持当前可用的安卓版源码。

## 许可与上游

基于 [MusicFree](https://github.com/maotoumao/MusicFree)、[go-music-api](https://github.com/guohuiyuan/go-music-api) 和 music-lib。保留各目录许可证与作者说明，采用 AGPL-3.0。

密码和验证码只在音乐平台官方页面中输入。不要向仓库提交 Cookie、会话文件、苹果证书、描述文件或其他账号秘密。
