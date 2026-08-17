package main

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"io"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/form3tech-oss/jwt-go"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
)

const (
	testUserA = "auth0|characterization-user-a"
	testUserB = "auth0|characterization-user-b"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func requestJSON(t *testing.T, router http.Handler, method, target string, body []byte, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()

	request := httptest.NewRequest(method, target, bytes.NewReader(body))
	for name, value := range headers {
		request.Header.Set(name, value)
	}

	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func decodeJSON(t *testing.T, body io.Reader, destination any) {
	t.Helper()
	if err := json.NewDecoder(body).Decode(destination); err != nil {
		t.Fatalf("decode response JSON: %v", err)
	}
}

func routerAsUser(userID string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(context *gin.Context) {
		context.Set("authenticatedUserID", userID)
		context.Next()
	})
	return router
}

func TestJWTBoundaryCharacterization(t *testing.T) {
	gin.SetMode(gin.TestMode)
	privateKey, jwksJSON := testSigningKey(t)

	originalTransport := http.DefaultTransport
	http.DefaultTransport = roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.URL.String() != "https://dev-vin.au.auth0.com/.well-known/jwks.json" {
			t.Fatalf("unexpected outbound request: %s", request.URL.String())
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Header:     make(http.Header),
			Body:       io.NopCloser(bytes.NewReader(jwksJSON)),
			Request:    request,
		}, nil
	})
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
		jwksCacheMu.Lock()
		jwksCacheData = Jwks{}
		jwksCacheTime = time.Time{}
		jwksCacheMu.Unlock()
	})

	jwksCacheMu.Lock()
	jwksCacheData = Jwks{}
	jwksCacheTime = time.Time{}
	jwksCacheMu.Unlock()

	router := gin.New()
	router.GET("/api/feelings", checkJWT(), func(context *gin.Context) {
		context.JSON(http.StatusOK, gin.H{"userID": context.GetString("authenticatedUserID")})
	})

	validToken := signTestToken(t, privateKey, jwt.MapClaims{
		"aud": "https://stormy-cliffs-52671.herokuapp.com/api",
		"iss": "https://dev-vin.au.auth0.com/",
		"sub": testUserA,
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	tests := []struct {
		name       string
		token      string
		headerID   string
		wantStatus int
	}{
		{name: "missing bearer token", wantStatus: http.StatusUnauthorized},
		{name: "malformed bearer token", token: "not-a-jwt", wantStatus: http.StatusUnauthorized},
		{name: "valid token", token: validToken, wantStatus: http.StatusOK},
		{name: "matching compatibility header", token: validToken, headerID: testUserA, wantStatus: http.StatusOK},
		{name: "mismatched compatibility header", token: validToken, headerID: testUserB, wantStatus: http.StatusForbidden},
		{name: "expired token", token: signTestToken(t, privateKey, jwt.MapClaims{
			"aud": "https://stormy-cliffs-52671.herokuapp.com/api",
			"iss": "https://dev-vin.au.auth0.com/",
			"sub": testUserA,
			"exp": time.Now().Add(-time.Hour).Unix(),
		}), wantStatus: http.StatusUnauthorized},
		{name: "wrong audience", token: signTestToken(t, privateKey, jwt.MapClaims{
			"aud": "https://invalid.example/api",
			"iss": "https://dev-vin.au.auth0.com/",
			"sub": testUserA,
			"exp": time.Now().Add(time.Hour).Unix(),
		}), wantStatus: http.StatusUnauthorized},
		{name: "missing subject", token: signTestToken(t, privateKey, jwt.MapClaims{
			"aud": "https://stormy-cliffs-52671.herokuapp.com/api",
			"iss": "https://dev-vin.au.auth0.com/",
			"exp": time.Now().Add(time.Hour).Unix(),
		}), wantStatus: http.StatusUnauthorized},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			headers := map[string]string{}
			if test.token != "" {
				headers["Authorization"] = "Bearer " + test.token
			}
			if test.headerID != "" {
				headers["x-user-id"] = test.headerID
			}

			response := requestJSON(t, router, http.MethodGet, "/api/feelings", nil, headers)
			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d; body=%q", response.Code, test.wantStatus, response.Body.String())
			}
			if test.wantStatus == http.StatusOK && !strings.Contains(response.Body.String(), testUserA) {
				t.Fatalf("valid token did not establish verified subject: %q", response.Body.String())
			}
		})
	}
}

func testSigningKey(t *testing.T) (*rsa.PrivateKey, []byte) {
	t.Helper()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}

	now := time.Now()
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		NotBefore:    now.Add(-time.Hour),
		NotAfter:     now.Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}
	certificate, err := x509.CreateCertificate(rand.Reader, template, template, &privateKey.PublicKey, privateKey)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}

	jwksJSON, err := json.Marshal(Jwks{Keys: []JSONWebKeys{{
		Kty: "RSA",
		Kid: "characterization-key",
		Use: "sig",
		X5c: []string{base64.StdEncoding.EncodeToString(certificate)},
	}}})
	if err != nil {
		t.Fatalf("marshal JWKS: %v", err)
	}
	return privateKey, jwksJSON
}

func signTestToken(t *testing.T, privateKey *rsa.PrivateKey, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "characterization-key"
	signed, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("sign JWT: %v", err)
	}
	return signed
}

func TestFeelingsHandlerCharacterization(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))

	mt.Run("GET populated response and user filter", func(mt *mtest.T) {
		createdAt := time.Date(2026, time.January, 2, 3, 4, 5, 0, time.UTC)
		mt.AddMockResponses(mtest.CreateCursorResponse(0, "feeling.feelings", mtest.FirstBatch, bson.D{
			{Key: "activities", Value: bson.D{{Key: "bow", Value: true}, {Key: "lift", Value: false}, {Key: "run", Value: true}, {Key: "cycle", Value: false}, {Key: "swim", Value: false}}},
			{Key: "status", Value: "4"},
			{Key: "createdat", Value: createdAt},
			{Key: "comment", Value: "synthetic feeling"},
			{Key: "userid", Value: testUserA},
		}))

		router := routerAsUser(testUserA)
		router.GET("/api/feelings", GetFeelingsHandler(mt.Client))
		response := requestJSON(t, router, http.MethodGet, "/api/feelings", nil, nil)
		if response.Code != http.StatusOK {
			t.Fatalf("status = %d; body=%q", response.Code, response.Body.String())
		}

		var records []Feeling
		decodeJSON(t, response.Body, &records)
		if len(records) != 1 || records[0].Status != "4" || records[0].UserID != testUserA || records[0].Comment != "synthetic feeling" || !records[0].Activities.Bow {
			t.Fatalf("unexpected response records: %#v", records)
		}

		started := mt.GetStartedEvent()
		if started == nil || started.CommandName != "find" {
			t.Fatalf("expected find command, got %#v", started)
		}
		if got := started.Command.Lookup("filter").Document().Lookup("userid").StringValue(); got != testUserA {
			t.Fatalf("find userid = %q, want %q", got, testUserA)
		}
	})

	mt.Run("GET empty response is JSON null", func(mt *mtest.T) {
		mt.AddMockResponses(mtest.CreateCursorResponse(0, "feeling.feelings", mtest.FirstBatch))
		router := routerAsUser(testUserA)
		router.GET("/api/feelings", GetFeelingsHandler(mt.Client))

		response := requestJSON(t, router, http.MethodGet, "/api/feelings", nil, nil)
		if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != "null" {
			t.Fatalf("legacy empty response = status %d body %q, want 200 null", response.Code, response.Body.String())
		}
	})

	mt.Run("POST overrides client identity and returns persisted shape", func(mt *mtest.T) {
		mt.AddMockResponses(mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}))
		router := routerAsUser(testUserA)
		router.POST("/api/feelings", PostFeelingHandler(mt.Client))

		payload := []byte(`{"status":"3","createdAt":"2026-01-02T03:04:05Z","comment":"synthetic feeling","activities":{"bow":true},"userID":"auth0|characterization-user-b"}`)
		response := requestJSON(t, router, http.MethodPost, "/api/feelings", payload, map[string]string{"Content-Type": "application/json"})
		if response.Code != http.StatusOK {
			t.Fatalf("status = %d; body=%q", response.Code, response.Body.String())
		}

		var record Feeling
		decodeJSON(t, response.Body, &record)
		if record.UserID != testUserA || record.Status != "3" || record.Comment != "synthetic feeling" {
			t.Fatalf("unexpected response record: %#v", record)
		}
	})

	mt.Run("POST malformed JSON fails without a database command", func(mt *mtest.T) {
		router := routerAsUser(testUserA)
		router.POST("/api/feelings", PostFeelingHandler(mt.Client))
		response := requestJSON(t, router, http.MethodPost, "/api/feelings", []byte(`{"status":`), map[string]string{"Content-Type": "application/json"})

		if response.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400; body=%q", response.Code, response.Body.String())
		}
		if started := mt.GetStartedEvent(); started != nil {
			t.Fatalf("malformed request unexpectedly issued database command: %s", started.CommandName)
		}
	})
}

func TestWeeklyTrackerHandlerCharacterization(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))

	mt.Run("GET missing weekOf", func(mt *mtest.T) {
		router := routerAsUser(testUserA)
		router.GET("/api/weekly-tracker", GetWeeklyTrackerHandler(mt.Client))
		response := requestJSON(t, router, http.MethodGet, "/api/weekly-tracker", nil, nil)

		if response.Code != http.StatusBadRequest || !strings.Contains(response.Body.String(), "missing weekOf") {
			t.Fatalf("unexpected response: status=%d body=%q", response.Code, response.Body.String())
		}
		if started := mt.GetStartedEvent(); started != nil {
			t.Fatalf("missing week unexpectedly issued database command: %s", started.CommandName)
		}
	})

	mt.Run("GET no record", func(mt *mtest.T) {
		mt.AddMockResponses(mtest.CreateCursorResponse(0, "feeling.weekly_trackers", mtest.FirstBatch))
		router := routerAsUser(testUserA)
		router.GET("/api/weekly-tracker", GetWeeklyTrackerHandler(mt.Client))
		response := requestJSON(t, router, http.MethodGet, "/api/weekly-tracker?weekOf=2026-01-05", nil, nil)

		if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != `{"ok":true,"record":null}` {
			t.Fatalf("unexpected no-record response: status=%d body=%q", response.Code, response.Body.String())
		}
		started := mt.GetStartedEvent()
		filter := started.Command.Lookup("filter").Document()
		if filter.Lookup("userid").StringValue() != testUserA || filter.Lookup("weekof").StringValue() != "2026-01-05" {
			t.Fatalf("unexpected weekly filter: %s", filter)
		}
	})

	mt.Run("GET populated record", func(mt *mtest.T) {
		updatedAt := time.Date(2026, time.January, 6, 7, 8, 9, 0, time.UTC)
		mt.AddMockResponses(mtest.CreateCursorResponse(0, "feeling.weekly_trackers", mtest.FirstBatch, bson.D{
			{Key: "weekof", Value: "2026-01-05"},
			{Key: "mood", Value: "steady"},
			{Key: "trackerVersion", Value: 1},
			{Key: "checks", Value: bson.D{{Key: "cardio", Value: true}}},
			{Key: "notes", Value: bson.D{{Key: "win", Value: "synthetic win"}, {Key: "challenge", Value: ""}, {Key: "nextWeek", Value: "synthetic focus"}}},
			{Key: "userid", Value: testUserA},
			{Key: "updatedat", Value: updatedAt},
		}))

		router := routerAsUser(testUserA)
		router.GET("/api/weekly-tracker", GetWeeklyTrackerHandler(mt.Client))
		response := requestJSON(t, router, http.MethodGet, "/api/weekly-tracker?weekOf=2026-01-05", nil, nil)
		if response.Code != http.StatusOK {
			t.Fatalf("status = %d; body=%q", response.Code, response.Body.String())
		}
		var envelope struct {
			OK     bool          `json:"ok"`
			Record WeeklyTracker `json:"record"`
		}
		decodeJSON(t, response.Body, &envelope)
		if !envelope.OK || envelope.Record.UserID != testUserA || envelope.Record.Mood != "steady" || !envelope.Record.Checks.Cardio {
			t.Fatalf("unexpected weekly response: %#v", envelope)
		}
	})

	mt.Run("POST upserts by verified user and week", func(mt *mtest.T) {
		mt.AddMockResponses(mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}, bson.E{Key: "nModified", Value: 1}))
		router := routerAsUser(testUserA)
		router.POST("/api/weekly-tracker", PostWeeklyTrackerHandler(mt.Client))

		payload := []byte(`{"weekOf":"2026-01-05","mood":"good","trackerVersion":99,"checks":{"cardio":true,"strength":true},"notes":{"win":"synthetic win","challenge":"synthetic challenge","nextWeek":"synthetic focus"},"userID":"auth0|characterization-user-b"}`)
		response := requestJSON(t, router, http.MethodPost, "/api/weekly-tracker", payload, map[string]string{"Content-Type": "application/json"})
		if response.Code != http.StatusOK {
			t.Fatalf("status = %d; body=%q", response.Code, response.Body.String())
		}

		var envelope struct {
			OK     bool          `json:"ok"`
			Record WeeklyTracker `json:"record"`
		}
		decodeJSON(t, response.Body, &envelope)
		if !envelope.OK || envelope.Record.UserID != testUserA || envelope.Record.TrackerVersion != 1 || envelope.Record.UpdatedAt.IsZero() {
			t.Fatalf("unexpected upsert response: %#v", envelope)
		}

		started := mt.GetStartedEvent()
		if started == nil || started.CommandName != "update" {
			t.Fatalf("expected update command, got %#v", started)
		}
		updates, err := started.Command.Lookup("updates").Array().Values()
		if err != nil || len(updates) != 1 {
			t.Fatalf("decode updates command: values=%d err=%v", len(updates), err)
		}
		update := updates[0].Document()
		filter := update.Lookup("q").Document()
		if filter.Lookup("userid").StringValue() != testUserA || filter.Lookup("weekof").StringValue() != "2026-01-05" || !update.Lookup("upsert").Boolean() {
			t.Fatalf("unexpected upsert command: %s", update)
		}
	})
}

func TestLegacyRouteAndCORSCharacterization(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(corsMiddleware("https://allowed.example.com"))
	router.GET("/api/feelings", func(context *gin.Context) { context.JSON(http.StatusOK, gin.H{"ok": true}) })
	router.POST("/api/feelings", func(context *gin.Context) { context.JSON(http.StatusOK, gin.H{"ok": true}) })

	preflight := requestJSON(t, router, http.MethodOptions, "/api/feelings", nil, map[string]string{
		"Origin":                         "https://allowed.example.com",
		"Access-Control-Request-Method":  http.MethodPost,
		"Access-Control-Request-Headers": "Authorization, Content-Type, x-user-id",
	})
	if preflight.Code < 200 || preflight.Code >= 300 || preflight.Header().Get("Access-Control-Allow-Origin") != "https://allowed.example.com" {
		t.Fatalf("unexpected allowed preflight: status=%d headers=%v body=%q", preflight.Code, preflight.Header(), preflight.Body.String())
	}

	disallowed := requestJSON(t, router, http.MethodPost, "/api/feelings", []byte(`{}`), map[string]string{
		"Origin":       "https://disallowed.example.com",
		"Content-Type": "application/json",
	})
	if disallowed.Code != http.StatusOK || disallowed.Body.Len() != 0 {
		t.Fatalf("legacy disallowed CORS response changed: status=%d body=%q", disallowed.Code, disallowed.Body.String())
	}

	ping := requestJSON(t, router, http.MethodGet, "/api/ping", nil, nil)
	if ping.Code != http.StatusNotFound {
		t.Fatalf("unmatched /api/ping status = %d, want 404", ping.Code)
	}
}
