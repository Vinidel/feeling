package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
)

type feelingsContractFixtures struct {
	SyntheticUsers struct {
		Owner string `json:"owner"`
		Other string `json:"other"`
	} `json:"syntheticUsers"`
	Feeling Feeling `json:"feeling"`
}

func TestReusableFeelingsContractAgainstGoHTTP(t *testing.T) {
	fixtureBytes, err := os.ReadFile("../tests/contract/fixtures.json")
	if err != nil {
		t.Fatalf("read shared contract fixtures: %v", err)
	}
	var fixtures feelingsContractFixtures
	if err := json.Unmarshal(fixtureBytes, &fixtures); err != nil {
		t.Fatalf("decode shared contract fixtures: %v", err)
	}

	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	mt.Run("source URL contract", func(mt *mtest.T) {
		mt.AddMockResponses(
			mtest.CreateCursorResponse(0, "feeling.feelings", mtest.FirstBatch),
			mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}),
			mtest.CreateCursorResponse(0, "feeling.feelings", mtest.FirstBatch, bson.D{
				{Key: "activities", Value: bson.D{{Key: "bow", Value: true}, {Key: "lift", Value: false}, {Key: "run", Value: true}, {Key: "cycle", Value: false}, {Key: "swim", Value: false}}},
				{Key: "status", Value: fixtures.Feeling.Status},
				{Key: "createdat", Value: fixtures.Feeling.CreatedAt},
				{Key: "comment", Value: fixtures.Feeling.Comment},
				{Key: "userid", Value: fixtures.SyntheticUsers.Owner},
			}),
			mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}),
			mtest.CreateCursorResponse(0, "feeling.feelings", mtest.FirstBatch),
		)

		gin.SetMode(gin.TestMode)
		router := gin.New()
		router.Use(func(context *gin.Context) {
			token := context.GetHeader("Authorization")
			userID := ""
			switch token {
			case "Bearer stage7-token-a":
				userID = fixtures.SyntheticUsers.Owner
			case "Bearer stage7-token-b":
				userID = fixtures.SyntheticUsers.Other
			default:
				context.AbortWithStatus(http.StatusUnauthorized)
				return
			}
			if headerID := context.GetHeader("x-user-id"); headerID != "" && headerID != userID {
				context.AbortWithStatus(http.StatusForbidden)
				return
			}
			context.Set("authenticatedUserID", userID)
			context.Next()
		})
		router.GET("/api/feelings", GetFeelingsHandler(mt.Client))
		router.POST("/api/feelings", PostFeelingHandler(mt.Client))
		server := httptest.NewServer(router)
		defer server.Close()

		request := func(method, token, userID string, body any) (*http.Response, []byte) {
			t.Helper()
			var reader io.Reader
			if body != nil {
				encoded, marshalErr := json.Marshal(body)
				if marshalErr != nil {
					t.Fatalf("encode request: %v", marshalErr)
				}
				reader = bytes.NewReader(encoded)
			}
			req, requestErr := http.NewRequest(method, server.URL+"/api/feelings", reader)
			if requestErr != nil {
				t.Fatalf("create request: %v", requestErr)
			}
			if token != "" {
				req.Header.Set("Authorization", "Bearer "+token)
			}
			if userID != "" {
				req.Header.Set("x-user-id", userID)
			}
			response, requestErr := http.DefaultClient.Do(req)
			if requestErr != nil {
				t.Fatalf("execute request: %v", requestErr)
			}
			defer response.Body.Close()
			responseBody, readErr := io.ReadAll(response.Body)
			if readErr != nil {
				t.Fatalf("read response: %v", readErr)
			}
			return response, responseBody
		}

		if response, _ := request(http.MethodGet, "", "", nil); response.StatusCode != http.StatusUnauthorized {
			t.Fatalf("missing token status = %d", response.StatusCode)
		}
		if response, _ := request(http.MethodGet, "not-a-token", "", nil); response.StatusCode != http.StatusUnauthorized {
			t.Fatalf("malformed token status = %d", response.StatusCode)
		}
		response, body := request(http.MethodGet, "stage7-token-a", fixtures.SyntheticUsers.Owner, nil)
		if response.StatusCode != http.StatusOK || string(body) != "null" {
			t.Fatalf("source empty response = %d %q", response.StatusCode, body)
		}

		response, body = request(http.MethodPost, "stage7-token-a", fixtures.SyntheticUsers.Owner, fixtures.Feeling)
		if response.StatusCode != http.StatusOK {
			t.Fatalf("create status = %d body=%q", response.StatusCode, body)
		}
		var created Feeling
		if err := json.Unmarshal(body, &created); err != nil || created.UserID != fixtures.SyntheticUsers.Owner || created.Status != fixtures.Feeling.Status {
			t.Fatalf("unexpected created feeling: %#v error=%v", created, err)
		}

		response, body = request(http.MethodGet, "stage7-token-a", fixtures.SyntheticUsers.Owner, nil)
		var history []Feeling
		if response.StatusCode != http.StatusOK || json.Unmarshal(body, &history) != nil || len(history) != 1 || history[0].UserID != fixtures.SyntheticUsers.Owner {
			t.Fatalf("unexpected owner history: status=%d body=%q", response.StatusCode, body)
		}
		if response, _ := request(http.MethodGet, "stage7-token-a", fixtures.SyntheticUsers.Other, nil); response.StatusCode != http.StatusForbidden {
			t.Fatalf("mismatch status = %d", response.StatusCode)
		}

		invalid := fixtures.Feeling
		invalid.Status = "5"
		if response, _ := request(http.MethodPost, "stage7-token-a", fixtures.SyntheticUsers.Owner, invalid); response.StatusCode != http.StatusOK {
			t.Fatalf("source permissive status = %d", response.StatusCode)
		}
		if response, body := request(http.MethodGet, "stage7-token-b", fixtures.SyntheticUsers.Other, nil); response.StatusCode != http.StatusOK || string(body) != "null" {
			t.Fatalf("other-user history = %d %q", response.StatusCode, body)
		}

		if !fixtures.Feeling.CreatedAt.Equal(time.Date(2026, time.January, 2, 3, 4, 5, 0, time.UTC)) {
			t.Fatalf("shared fixture timestamp changed: %s", fixtures.Feeling.CreatedAt)
		}
	})
}
