package qq

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ExchangeWebLoginCode completes the QQ Music website's own QQ login callback.
// Account passwords and verification codes are handled by the official web page.
func ExchangeWebLoginCode(code, priorCookie string) (string, error) {
	if len(code) < 8 || len(code) > 512 {
		return "", fmt.Errorf("invalid login code")
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"comm": map[string]interface{}{"g_tk": 5381, "platform": "yqq", "ct": 24, "cv": 0},
		"req":  map[string]interface{}{"module": "QQConnectLogin.LoginServer", "method": "QQLogin", "param": map[string]string{"code": code}},
	})
	client := &http.Client{Timeout: 20 * time.Second}
	// The code is one-use. Do not retry it across endpoints after an API response.
	req, err := http.NewRequest("POST", "https://u.y.qq.com/cgi-bin/musicu.fcg", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Referer", "https://y.qq.com/")
	req.Header.Set("Origin", "https://y.qq.com")
	req.Header.Set("User-Agent", UserAgent)
	req.Header.Set("Cookie", "login_type=1")
	response, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("music login network error")
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 1024*1024))
	if err != nil {
		return "", err
	}
	var result struct {
		Code int `json:"code"`
		Req  struct {
			Code int                    `json:"code"`
			Data map[string]interface{} `json:"data"`
		} `json:"req"`
	}
	if response.StatusCode != 200 || json.Unmarshal(body, &result) != nil || result.Code != 0 || result.Req.Code != 0 {
		return "", fmt.Errorf("music login not completed")
	}
	cookies := responseCookies(response)
	for key, value := range qqWXLoginDataCookies(result.Req.Data) {
		cookies[key] = value
	}
	if firstNonEmptyQQ(cookies["qm_keyst"], cookies["qqmusic_key"], cookies["music_key"], cookies["musickey"]) == "" {
		return "", fmt.Errorf("music session not returned")
	}
	// Preserve useful platform metadata without replacing newly issued credentials.
	for _, item := range strings.Split(priorCookie, ";") {
		pair := strings.SplitN(strings.TrimSpace(item), "=", 2)
		if len(pair) == 2 && cookies[pair[0]] == "" {
			cookies[pair[0]] = pair[1]
		}
	}
	cookies["login_type"] = "1"
	return joinCookieMap(normalizeQQMusicCookies(cookies)), nil
}
