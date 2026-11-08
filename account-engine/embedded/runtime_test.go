package embedded

import (
	"fmt"
	"net/http"
	"path/filepath"
	"testing"
)

func TestPhoneRuntime(t *testing.T) {
	file := filepath.Join(t.TempDir(), "私人会话.json")
	key := "private-unit-test-process-key-32-bytes"
	if Start("short", file) != -1 || Start(key, "relative.json") != -1 {
		t.Fatal("invalid runtime configuration accepted")
	}
	port := Start(key, file)
	if port <= 0 {
		t.Fatal("runtime did not start")
	}
	if Start(key, file) != port {
		t.Fatal("runtime is not idempotent")
	}
	if Start("different-private-unit-test-key-32", file) != -1 || Start(key, file+".other") != -1 {
		t.Fatal("runtime credentials or storage were replaced")
	}
	address := fmt.Sprintf("http://127.0.0.1:%d/api/v1/system/status", port)
	for _, item := range []struct {
		token  string
		status int
	}{{"", 403}, {key, 200}} {
		req, _ := http.NewRequest("GET", address, nil)
		req.Header.Set("Authorization", "Bearer "+item.token)
		response, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != item.status {
			t.Fatalf("HTTP status %d, want %d", response.StatusCode, item.status)
		}
	}
}
