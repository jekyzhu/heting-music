package service

import (
    "os"
    "path/filepath"
    "testing"
)

func TestSessionCommitPreservesOtherPlatformAndUsesPrivateFile(t *testing.T) {
    previous := CookieFile; CookieFile = filepath.Join(t.TempDir(), "sessions.json")
    defer func() { CookieFile = previous }()
    manager := &CookieManager{cookies: map[string]string{"qq":"existing-qq"}}
    if err := manager.SetSession("netease", "new-netease"); err != nil { t.Fatal(err) }
    if manager.Get("qq") != "existing-qq" || manager.Get("netease") != "new-netease" { t.Fatal("account sessions mixed") }
    info, err := os.Stat(CookieFile)
    if err != nil || info.Mode().Perm() != 0600 { t.Fatal("session file must be private") }
    if err := manager.SetSession("netease", ""); err != nil { t.Fatal(err) }
    if manager.Get("qq") != "existing-qq" || manager.Get("netease") != "" { t.Fatal("logout affected another platform") }
}

func TestFailedSessionSaveDoesNotChangeLoggedInAccount(t *testing.T) {
    previous := CookieFile; CookieFile = filepath.Join(t.TempDir(), "missing", "sessions.json")
    defer func() { CookieFile = previous }()
    manager := &CookieManager{cookies: map[string]string{"qq":"existing-qq"}}
    if err := manager.SetSession("qq", "replacement"); err == nil { t.Fatal("expected failed write") }
    if manager.Get("qq") != "existing-qq" { t.Fatal("failed persistence changed active account") }
}
