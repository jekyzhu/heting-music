package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/guohuiyuan/go-music-api/service"
	"github.com/guohuiyuan/music-lib/qq"
	"net/http"
	"strings"
)

func ImportWebSession(c *gin.Context) {
	source := c.Param("source")
	if source != "netease" && source != "qq" {
		c.AbortWithStatus(400)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 32768)
	var request struct {
		Cookie string `json:"cookie"`
		Code   string `json:"code"`
	}
	if c.ShouldBindJSON(&request) != nil {
		c.AbortWithStatusJSON(400, gin.H{"code": 400})
		return
	}
	cookie := strings.TrimSpace(request.Cookie)
	authenticated := false
	if source == "qq" && request.Code != "" {
		var err error
		cookie, err = qq.ExchangeWebLoginCode(request.Code, cookie)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"code": 401, "msg": "请在官方页面完成登录后重试"})
			return
		}
		authenticated = true
	}
	if cookie == "" || (!authenticated && service.ValidateWebSession(source, cookie) != nil) {
		c.AbortWithStatusJSON(401, gin.H{"code": 401, "msg": "登录尚未完成或已过期"})
		return
	}
	if service.CM.SetSession(source, cookie) != nil {
		c.AbortWithStatusJSON(500, gin.H{"code": 500, "msg": "无法保存本机登录状态"})
		return
	}
	c.JSON(200, gin.H{"code": 200, "data": gin.H{"connected": true}})
}
