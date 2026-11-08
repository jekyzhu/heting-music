//go:build linux && jni_smoke

package main

/*
#include <jni.h>
#include <stdlib.h>
static const char* accountUTF(JNIEnv *env, jstring value) { return (*env)->GetStringUTFChars(env, value, 0); }
static void accountReleaseUTF(JNIEnv *env, jstring value, const char *text) { (*env)->ReleaseStringUTFChars(env, value, text); }
*/
import "C"

import (
	"github.com/gin-gonic/gin"
	"github.com/guohuiyuan/go-music-api/router"
	"github.com/guohuiyuan/go-music-api/service"
	"net"
	"net/http"
	"os"
	"sync"
	"time"
)

var androidEngine struct {
	sync.Mutex
	port int
	key  string
}

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
	if len(key) < 32 || file == "" {
		return -1
	}
	androidEngine.Lock()
	defer androidEngine.Unlock()
	if androidEngine.port != 0 {
		if androidEngine.key != key {
			return -1
		}
		return C.jint(androidEngine.port)
	}
	service.CookieFile = file
	service.CM.Load()
	os.Setenv("MUSIC_API_TOKEN", key)
	gin.SetMode(gin.ReleaseMode)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return -1
	}
	androidEngine.port = listener.Addr().(*net.TCPAddr).Port
	androidEngine.key = key
	server := &http.Server{Handler: router.SetupRouter(), ReadHeaderTimeout: 10 * time.Second}
	go server.Serve(listener)
	return C.jint(androidEngine.port)
}
