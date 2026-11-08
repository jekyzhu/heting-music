#!/usr/bin/env bash
set -euo pipefail
task_app_root="$(cd -- "$(dirname -- "$0")/.." && pwd)"
task_engine_root="${ACCOUNT_ENGINE_SOURCE:-$task_app_root/../account-engine}"
task_ndk_root="${ANDROID_NDK_HOME:-${ANDROID_HOME:?Set ANDROID_HOME}/ndk/26.1.10909125}"
case "$(uname -s)" in
    Linux) task_host_tag=linux-x86_64 ;;
    Darwin) task_host_tag=darwin-x86_64 ;;
    *) echo 'Build the Android engine using Linux, macOS, or WSL.' >&2; exit 1 ;;
esac
task_compiler="$task_ndk_root/toolchains/llvm/prebuilt/$task_host_tag/bin/aarch64-linux-android24-clang"
test -x "$task_compiler"
mkdir -p "$task_app_root/android/app/src/main/jniLibs/arm64-v8a"
CGO_ENABLED=1 GOOS=android GOARCH=arm64 CC="$task_compiler" go -C "$task_engine_root" build \
    -buildmode=c-shared -trimpath -ldflags='-s -w' \
    -o "$task_app_root/android/app/src/main/jniLibs/arm64-v8a/libaccountengine.so" .
