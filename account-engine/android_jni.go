//go:build android

package main

/*
#include <jni.h>
#include <stdlib.h>
static const char* accountUTF(JNIEnv *env, jstring value) { return (*env)->GetStringUTFChars(env, value, 0); }
static void accountReleaseUTF(JNIEnv *env, jstring value, const char *text) { (*env)->ReleaseStringUTFChars(env, value, text); }
*/
import "C"

import "github.com/guohuiyuan/go-music-api/embedded"

//export Java_fun_upup_musicfree_account_EmbeddedMusicNative_start
func Java_fun_upup_musicfree_account_EmbeddedMusicNative_start(env *C.JNIEnv, clazz C.jclass, keyValue C.jstring, fileValue C.jstring) (result C.jint) {
	defer func() {
		if recover() != nil {
			result = -1
		}
	}()
	keyText := C.accountUTF(env, keyValue)
	defer C.accountReleaseUTF(env, keyValue, keyText)
	fileText := C.accountUTF(env, fileValue)
	defer C.accountReleaseUTF(env, fileValue, fileText)
	key, file := C.GoString(keyText), C.GoString(fileText)
	return C.jint(embedded.Start(key, file))
}
