package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRetiredMachineRoutesFailClosedWithoutTokens(t *testing.T) {
	t.Setenv("CHAT_INGEST_TOKEN", "")
	t.Setenv("AGENT_API_TOKEN", "")
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		path       string
		middleware gin.HandlerFunc
	}{
		{name: "chat", path: "/api/chat/capabilities", middleware: checkChatIngestToken()},
		{name: "agent", path: "/api/agent/feelings", middleware: checkAgentToken()},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			handlerRuns := 0
			router := gin.New()
			router.GET(test.path, test.middleware, func(context *gin.Context) {
				handlerRuns++
				context.Status(http.StatusNoContent)
			})

			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			if response.Code != http.StatusInternalServerError {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusInternalServerError)
			}
			if handlerRuns != 0 {
				t.Fatalf("retired handler ran %d times", handlerRuns)
			}
		})
	}
}

func TestBrowserRoutesRemainIndependentOfRetiredTokens(t *testing.T) {
	t.Setenv("CHAT_INGEST_TOKEN", "")
	t.Setenv("AGENT_API_TOKEN", "")
	gin.SetMode(gin.TestMode)

	router := gin.New()
	browserAuth := func(context *gin.Context) {
		if context.GetHeader("Authorization") != "Bearer browser-fixture" {
			context.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		context.Set("authenticatedUserID", testUserA)
		context.Next()
	}
	for _, route := range []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/api/feelings"},
		{method: http.MethodPost, path: "/api/feelings"},
		{method: http.MethodGet, path: "/api/weekly-tracker"},
		{method: http.MethodPost, path: "/api/weekly-tracker"},
	} {
		router.Handle(route.method, route.path, browserAuth, func(context *gin.Context) {
			context.Status(http.StatusNoContent)
		})
	}

	for _, route := range router.Routes() {
		request := httptest.NewRequest(route.Method, route.Path, nil)
		request.Header.Set("Authorization", "Bearer browser-fixture")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		if response.Code != http.StatusNoContent {
			t.Fatalf("%s %s status = %d, want %d", route.Method, route.Path, response.Code, http.StatusNoContent)
		}
	}
}
