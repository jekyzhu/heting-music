package router

import (
    "net/http/httptest"
    "strings"
    "testing"
    "github.com/guohuiyuan/go-music-api/service"
)

func TestPersonalBridgeRequiresKeyAndNeverReturnsCookies(t *testing.T) {
    t.Setenv("MUSIC_API_TOKEN", "test-key-with-at-least-16-characters")
    service.CM.SetAll(map[string]string{"qq": "secret-account-cookie", "netease": ""})
    defer service.CM.SetAll(map[string]string{"qq": ""})
    r := SetupRouter()
    req := httptest.NewRequest("GET", "/api/v1/system/status", nil)
    w := httptest.NewRecorder(); r.ServeHTTP(w, req)
    if w.Code != 403 { t.Fatalf("unauthenticated request returned %d", w.Code) }
    for _, path := range []string{"/api/v1/system/status", "/api/v1/system/cookies", "/music/cookies"} {
        req = httptest.NewRequest("GET", path, nil)
        req.Header.Set("Authorization", "Bearer test-key-with-at-least-16-characters")
        w = httptest.NewRecorder(); r.ServeHTTP(w, req)
        if w.Code != 200 || strings.Contains(w.Body.String(), "secret-account-cookie") { t.Fatalf("unsafe account status on %s", path) }
    }
}

func TestBridgeFailsClosedWithoutConfiguration(t *testing.T) {
    t.Setenv("MUSIC_API_TOKEN", "")
    w := httptest.NewRecorder()
    SetupRouter().ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/system/status", nil))
    if w.Code != 503 { t.Fatalf("expected 503, got %d", w.Code) }
}

func TestLogoutRemovesOnlySelectedAccount(t *testing.T) {
    t.Setenv("MUSIC_API_TOKEN", "test-key-with-at-least-16-characters")
    previous := service.CookieFile
    service.CookieFile = t.TempDir() + "/cookies.json"
    defer func() { service.CookieFile = previous; service.CM.SetAll(map[string]string{"qq": "", "netease": ""}) }()
    service.CM.SetAll(map[string]string{"qq": "qq-secret", "netease": "netease-secret"})
    req := httptest.NewRequest("DELETE", "/api/v1/system/accounts/qq", nil)
    req.Header.Set("Authorization", "Bearer test-key-with-at-least-16-characters")
    w := httptest.NewRecorder(); SetupRouter().ServeHTTP(w, req)
    if w.Code != 200 || service.CM.Get("qq") != "" || service.CM.Get("netease") != "netease-secret" { t.Fatal("logout did not isolate accounts") }
}
