package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	cors "github.com/itsjamie/gin-cors"
)

func legacyCORS() gin.HandlerFunc {
	return cors.Middleware(cors.Config{
		Origins:         "http://localhost:3000, https://stormy-cliffs-52671.herokuapp.com",
		Methods:         "GET, PUT, POST, DELETE",
		RequestHeaders:  "Origin, Authorization, Content-Type, x-user-id",
		Credentials:     true,
		ValidateHeaders: false,
	})
}

func TestLegacyCORSGetWithoutOriginStillHitsHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(legacyCORS())
	var getRuns, postRuns int
	r.GET("/api/feelings", func(c *gin.Context) { getRuns++; c.JSON(200, gin.H{"ok": true}) })
	r.POST("/api/feelings", func(c *gin.Context) { postRuns++; c.JSON(200, gin.H{"ok": true}) })

	getReq := httptest.NewRequest(http.MethodGet, "/api/feelings", nil)
	getReq.Header.Set("Authorization", "Bearer x")
	getW := httptest.NewRecorder()
	r.ServeHTTP(getW, getReq)

	postReq := httptest.NewRequest(http.MethodPost, "/api/feelings", bytes.NewReader([]byte(`{}`)))
	postReq.Header.Set("Authorization", "Bearer x")
	postReq.Header.Set("Content-Type", "application/json")
	postReq.Header.Set("Origin", "https://www.delasc.io")
	postW := httptest.NewRecorder()
	r.ServeHTTP(postW, postReq)

	t.Logf("GET no Origin: runs=%d status=%d body=%q", getRuns, getW.Code, getW.Body.String())
	t.Logf("POST with Origin: runs=%d status=%d body=%q", postRuns, postW.Code, postW.Body.String())

	if getRuns != 1 {
		t.Fatalf("expected GET handler to run without Origin header")
	}
	if postRuns != 0 || postW.Body.Len() != 0 {
		t.Fatalf("expected POST to be blocked for delasc.io on legacy allowlist")
	}
}
