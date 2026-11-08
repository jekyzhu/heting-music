//go:build ios

package main

/*
#include <stdlib.h>
*/
import "C"
import "github.com/guohuiyuan/go-music-api/embedded"

//export HetingEngineStart
func HetingEngineStart(keyText, fileText *C.char) C.int {
	if keyText == nil || fileText == nil {
		return -1
	}
	return C.int(embedded.Start(C.GoString(keyText), C.GoString(fileText)))
}
