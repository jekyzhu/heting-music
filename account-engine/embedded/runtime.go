// Package embedded starts the private, in-process music module on either phone OS.
package embedded

import (
	"github.com/gin-gonic/gin"
	"github.com/guohuiyuan/go-music-api/router"
	"github.com/guohuiyuan/go-music-api/service"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

var engine struct {
	sync.Mutex
	port      int
	key, file string
}

// Start returns an automatically allocated loopback port, or -1 on failure.
// The process owns one instance. Credentials and storage cannot be replaced.
func Start(key, file string) (result int) {
	defer func() {
		if recover() != nil {
			result = -1
		}
	}()
	if len(key) < 32 || !filepath.IsAbs(file) {
		return -1
	}
	engine.Lock()
	defer engine.Unlock()
	if engine.port != 0 {
		if engine.key != key || engine.file != file {
			return -1
		}
		return engine.port
	}
	service.CookieFile = file
	service.CM.Load()
	if os.Setenv("MUSIC_API_TOKEN", key) != nil {
		return -1
	}
	gin.SetMode(gin.ReleaseMode)
	handler := router.SetupRouter()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return -1
	}
	server := &http.Server{Handler: handler, ReadHeaderTimeout: 10 * time.Second}
	engine.port = listener.Addr().(*net.TCPAddr).Port
	engine.key, engine.file = key, file
	go server.Serve(listener)
	return engine.port
}
