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

type weeklyContractFixtures struct {
	SyntheticUsers struct {
		Owner string `json:"owner"`
		Other string `json:"other"`
	} `json:"syntheticUsers"`
	WeeklyTracker WeeklyTracker `json:"weeklyTracker"`
}

func TestReusableWeeklyContractAgainstGoHTTP(t *testing.T) {
	fixtureBytes, err := os.ReadFile("../tests/contract/fixtures.json")
	if err != nil {
		t.Fatalf("read shared contract fixtures: %v", err)
	}
	var fixtures weeklyContractFixtures
	if err := json.Unmarshal(fixtureBytes, &fixtures); err != nil {
		t.Fatalf("decode shared contract fixtures: %v", err)
	}

	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	mt.Run("source URL contract", func(mt *mtest.T) {
		observations := make(map[string]any)
		updatedAt := time.Date(2026, time.January, 6, 7, 8, 9, 0, time.UTC)
		edited := fixtures.WeeklyTracker
		edited.Mood = "great"
		edited.Checks.Mobility = true
		edited.Notes.NextWeek = "edited synthetic focus"
		weeklyDocument := func(tracker WeeklyTracker) bson.D {
			return bson.D{
				{Key: "weekof", Value: tracker.WeekOf},
				{Key: "mood", Value: tracker.Mood},
				{Key: "trackerVersion", Value: 1},
				{Key: "checks", Value: tracker.Checks},
				{Key: "notes", Value: tracker.Notes},
				{Key: "userid", Value: fixtures.SyntheticUsers.Owner},
				{Key: "updatedat", Value: updatedAt},
			}
		}
		mt.AddMockResponses(
			mtest.CreateCursorResponse(0, "feeling.weekly_trackers", mtest.FirstBatch),
			mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}),
			mtest.CreateCursorResponse(0, "feeling.weekly_trackers", mtest.FirstBatch, weeklyDocument(fixtures.WeeklyTracker)),
			mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}),
			mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}),
			mtest.CreateCursorResponse(0, "feeling.weekly_trackers", mtest.FirstBatch),
		)

		gin.SetMode(gin.TestMode)
		router := gin.New()
		router.Use(func(context *gin.Context) {
			token := context.GetHeader("Authorization")
			userID := ""
			switch token {
			case "Bearer stage9-token-a":
				userID = fixtures.SyntheticUsers.Owner
			case "Bearer stage9-token-b":
				userID = fixtures.SyntheticUsers.Other
			default:
				context.AbortWithStatus(http.StatusUnauthorized)
				return
			}
			if claimed := context.GetHeader("x-user-id"); claimed != "" && claimed != userID {
				context.AbortWithStatus(http.StatusForbidden)
				return
			}
			context.Set("authenticatedUserID", userID)
			context.Next()
		})
		router.GET("/api/weekly-tracker", GetWeeklyTrackerHandler(mt.Client))
		router.POST("/api/weekly-tracker", PostWeeklyTrackerHandler(mt.Client))
		server := httptest.NewServer(router)
		defer server.Close()

		request := func(method, token, userID string, tracker any) (*http.Response, []byte) {
			t.Helper()
			url := server.URL + "/api/weekly-tracker"
			var reader io.Reader
			if method == http.MethodGet {
				url += "?weekOf=" + fixtures.WeeklyTracker.WeekOf
			} else if tracker != nil {
				encoded, marshalErr := json.Marshal(tracker)
				if marshalErr != nil {
					t.Fatalf("encode request: %v", marshalErr)
				}
				reader = bytes.NewReader(encoded)
			}
			req, requestErr := http.NewRequest(method, url, reader)
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
			body, readErr := io.ReadAll(response.Body)
			if readErr != nil {
				t.Fatalf("read response: %v", readErr)
			}
			return response, body
		}

		if response, _ := request(http.MethodGet, "", "", nil); response.StatusCode != http.StatusUnauthorized {
			t.Fatalf("missing token status = %d", response.StatusCode)
		} else {
			observations["missingStatus"] = response.StatusCode
		}
		if response, _ := request(http.MethodGet, "not-a-token", "", nil); response.StatusCode != http.StatusUnauthorized {
			t.Fatalf("malformed token status = %d", response.StatusCode)
		} else {
			observations["malformedStatus"] = response.StatusCode
		}
		if response, body := request(http.MethodGet, "stage9-token-a", fixtures.SyntheticUsers.Owner, nil); response.StatusCode != http.StatusOK || string(body) != `{"ok":true,"record":null}` {
			t.Fatalf("empty response = %d %q", response.StatusCode, body)
		} else {
			var emptyBody any
			if err := json.Unmarshal(body, &emptyBody); err != nil {
				t.Fatalf("decode empty observation: %v", err)
			}
			observations["emptyBody"] = emptyBody
		}

		response, body := request(http.MethodPost, "stage9-token-a", fixtures.SyntheticUsers.Owner, fixtures.WeeklyTracker)
		var created struct {
			OK     bool          `json:"ok"`
			Record WeeklyTracker `json:"record"`
		}
		if response.StatusCode != http.StatusOK || json.Unmarshal(body, &created) != nil || !created.OK || created.Record.UserID != fixtures.SyntheticUsers.Owner || created.Record.TrackerVersion != 1 || created.Record.UpdatedAt.IsZero() {
			t.Fatalf("unexpected created tracker: status=%d body=%q", response.StatusCode, body)
		}
		var createdBody any
		if err := json.Unmarshal(body, &createdBody); err != nil {
			t.Fatalf("decode created observation: %v", err)
		}
		observations["createdBody"] = createdBody

		response, body = request(http.MethodGet, "stage9-token-a", fixtures.SyntheticUsers.Owner, nil)
		var populated struct {
			OK     bool          `json:"ok"`
			Record WeeklyTracker `json:"record"`
		}
		if response.StatusCode != http.StatusOK || json.Unmarshal(body, &populated) != nil || populated.Record.Mood != fixtures.WeeklyTracker.Mood || populated.Record.UserID != fixtures.SyntheticUsers.Owner {
			t.Fatalf("unexpected populated tracker: status=%d body=%q", response.StatusCode, body)
		}
		var populatedBody any
		if err := json.Unmarshal(body, &populatedBody); err != nil {
			t.Fatalf("decode populated observation: %v", err)
		}
		observations["populatedBody"] = populatedBody

		if response, body := request(http.MethodPost, "stage9-token-a", fixtures.SyntheticUsers.Owner, edited); response.StatusCode != http.StatusOK {
			t.Fatalf("edit status = %d", response.StatusCode)
		} else {
			var editedBody any
			if err := json.Unmarshal(body, &editedBody); err != nil {
				t.Fatalf("decode edited observation: %v", err)
			}
			observations["editedBody"] = editedBody
		}
		if response, _ := request(http.MethodGet, "stage9-token-a", fixtures.SyntheticUsers.Other, nil); response.StatusCode != http.StatusForbidden {
			t.Fatalf("mismatch status = %d", response.StatusCode)
		} else {
			observations["mismatchStatus"] = response.StatusCode
		}

		invalid := fixtures.WeeklyTracker
		invalid.Mood = "amazing"
		if response, _ := request(http.MethodPost, "stage9-token-a", fixtures.SyntheticUsers.Owner, invalid); response.StatusCode != http.StatusOK {
			t.Fatalf("source permissive mood status = %d", response.StatusCode)
		} else {
			observations["invalidMoodStatus"] = response.StatusCode
		}
		if response, body := request(http.MethodGet, "stage9-token-b", fixtures.SyntheticUsers.Other, nil); response.StatusCode != http.StatusOK || string(body) != `{"ok":true,"record":null}` {
			t.Fatalf("other-user response = %d %q", response.StatusCode, body)
		} else {
			var otherBody any
			if err := json.Unmarshal(body, &otherBody); err != nil {
				t.Fatalf("decode other-user observation: %v", err)
			}
			observations["otherBody"] = otherBody
		}

		if snapshotPath := os.Getenv("WEEKLY_CONTRACT_SNAPSHOT"); snapshotPath != "" {
			encoded, err := json.MarshalIndent(observations, "", "  ")
			if err != nil {
				t.Fatalf("encode weekly observations: %v", err)
			}
			encoded = append(encoded, '\n')
			if err := os.WriteFile(snapshotPath, encoded, 0o600); err != nil {
				t.Fatalf("write weekly observations: %v", err)
			}
		}
	})
}
