package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	cors "github.com/itsjamie/gin-cors"
)

func corsMiddleware(origins string) gin.HandlerFunc {
	return cors.Middleware(cors.Config{
		Origins:         origins,
		Methods:         "GET, PUT, POST, DELETE",
		RequestHeaders:  "Origin, Authorization, Content-Type, x-user-id",
		Credentials:     true,
		ValidateHeaders: false,
	})
}

func TestCORSRejectsUnknownOriginWithEmptyBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(corsMiddleware("https://allowed.example.com"))

	var runs int
	r.POST("/api/feelings", func(c *gin.Context) {
		runs++
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodPost, "/api/feelings", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Origin", "https://evil.example.com")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if runs != 0 || w.Code != http.StatusOK || w.Body.Len() != 0 {
		t.Fatalf("unexpected cors rejection behavior: runs=%d status=%d body=%q", runs, w.Code, w.Body.String())
	}
}

func TestCORSAllowsProductionOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(corsMiddleware(corsOrigins()))

	var runs int
	r.POST("/api/feelings", func(c *gin.Context) {
		runs++
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodPost, "/api/feelings", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Origin", "https://www.delasc.io")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if runs != 1 || w.Body.String() != `{"ok":true}` {
		t.Fatalf("expected handler to run for production origin, runs=%d status=%d body=%q", runs, w.Code, w.Body.String())
	}
}

func TestNormalizeCORSOriginsSupportsCommaSeparatedEnv(t *testing.T) {
	got := normalizeCORSOrigins("http://localhost:3000,https://www.delasc.io")
	want := "http://localhost:3000, https://www.delasc.io"
	if got != want {
		t.Fatalf("normalizeCORSOrigins() = %q, want %q", got, want)
	}
}
