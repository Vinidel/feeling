package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	jwtmiddleware "github.com/auth0/go-jwt-middleware"
	"github.com/form3tech-oss/jwt-go"
	"github.com/gin-gonic/contrib/static"
	"github.com/gin-gonic/gin"
	cors "github.com/itsjamie/gin-cors"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Activity struct {
	Bow   bool `json:"bow"`
	Lift  bool `json:"lift"`
	Run   bool `json:"run"`
	Cycle bool `json:"cycle"`
	Swim  bool `json:"swim"`
}

type WeeklyTrackerChecks struct {
	Cardio   bool `json:"cardio" bson:"cardio"`
	Strength bool `json:"strength" bson:"strength"`
	Mobility bool `json:"mobility" bson:"mobility"`
	Build    bool `json:"build" bson:"build"`
	Archery  bool `json:"archery" bson:"archery"`
	Hunt     bool `json:"hunt" bson:"hunt"`
}

type WeeklyTrackerNotes struct {
	Win       string `json:"win" bson:"win"`
	Challenge string `json:"challenge" bson:"challenge"`
	NextWeek  string `json:"nextWeek" bson:"nextWeek"`
}

type WeeklyTracker struct {
	WeekOf         string              `json:"weekOf" bson:"weekof"`
	Mood           string              `json:"mood" bson:"mood"`
	TrackerVersion int                 `json:"trackerVersion" bson:"trackerVersion"`
	Checks         WeeklyTrackerChecks `json:"checks" bson:"checks"`
	Notes          WeeklyTrackerNotes  `json:"notes" bson:"notes"`
	UserID         string              `json:"userID" bson:"userid"`
	UpdatedAt      time.Time           `json:"updatedAt" bson:"updatedat"`
}

// Feeling struct
type Feeling struct {
	Activities Activity  `json:"activities"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
	Comment    string    `json:"comment"`
	UserID     string    `json:"userID"`
}

type Jwks struct {
	Keys []JSONWebKeys `json:"keys"`
}

type JSONWebKeys struct {
	Kty string   `json:"kty"`
	Kid string   `json:"kid"`
	Use string   `json:"use"`
	N   string   `json:"n"`
	E   string   `json:"e"`
	X5c []string `json:"x5c"`
}

func GetConnectionString() string {
	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASS")
	return "mongodb+srv://" + dbUser + ":" + dbPass + "@cluster0.8pqgj.mongodb.net/prod?retryWrites=true&w=majority"
}

func SetupDB(connectionString string) (*mongo.Client, error) {
	clientOptions := options.Client().ApplyURI(connectionString)
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		return nil, err
	}

	err = client.Ping(context.TODO(), nil)
	if err != nil {
		return nil, err
	}

	fmt.Println("Connected to MongoDB!")
	return client, nil
}

const jwksCacheTTL = time.Hour

var (
	jwksCacheMu   sync.RWMutex
	jwksCacheData Jwks
	jwksCacheTime time.Time
)

func fetchJWKS() (Jwks, error) {
	jwksCacheMu.RLock()
	if time.Since(jwksCacheTime) < jwksCacheTTL && len(jwksCacheData.Keys) > 0 {
		cached := jwksCacheData
		jwksCacheMu.RUnlock()
		return cached, nil
	}
	jwksCacheMu.RUnlock()

	jwksCacheMu.Lock()
	defer jwksCacheMu.Unlock()

	if time.Since(jwksCacheTime) < jwksCacheTTL && len(jwksCacheData.Keys) > 0 {
		return jwksCacheData, nil
	}

	resp, err := http.Get("https://dev-vin.au.auth0.com/.well-known/jwks.json")
	if err != nil {
		return Jwks{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Jwks{}, fmt.Errorf("unexpected JWKS status: %s", resp.Status)
	}

	var jwks Jwks
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return Jwks{}, err
	}

	jwksCacheData = jwks
	jwksCacheTime = time.Now()
	return jwks, nil
}

func getPemCert(token *jwt.Token) (string, error) {
	jwks, err := fetchJWKS()
	if err != nil {
		return "", err
	}

	kid, ok := token.Header["kid"].(string)
	if !ok || kid == "" {
		return "", errors.New("token is missing kid header")
	}

	for _, key := range jwks.Keys {
		if kid == key.Kid {
			if len(key.X5c) == 0 {
				return "", errors.New("JWKS key is missing certificate chain")
			}
			return "-----BEGIN CERTIFICATE-----\n" + key.X5c[0] + "\n-----END CERTIFICATE-----", nil
		}
	}

	return "", errors.New("unable to find appropriate key")
}

var jwtMiddleware = jwtmiddleware.New(jwtmiddleware.Options{
	ValidationKeyGetter: func(token *jwt.Token) (interface{}, error) {
		aud := "https://stormy-cliffs-52671.herokuapp.com/api"
		checkAud := token.Claims.(jwt.MapClaims).VerifyAudience(aud, false)
		if !checkAud {
			return token, errors.New("invalid audience")
		}

		iss := "https://dev-vin.au.auth0.com/"
		checkIss := token.Claims.(jwt.MapClaims).VerifyIssuer(iss, false)
		if !checkIss {
			return token, errors.New("invalid issuer")
		}

		cert, err := getPemCert(token)
		if err != nil {
			return nil, err
		}

		result, err := jwt.ParseRSAPublicKeyFromPEM([]byte(cert))
		if err != nil {
			return nil, err
		}
		return result, nil
	},
	SigningMethod: jwt.SigningMethodRS256,
})

func userIDFromRequestContext(c *gin.Context) (string, bool) {
	tokenValue := c.Request.Context().Value("user")
	token, ok := tokenValue.(*jwt.Token)
	if !ok || token == nil || !token.Valid {
		return "", false
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", false
	}

	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return "", false
	}

	return sub, true
}

func checkJWT() gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtMid := *jwtMiddleware
		if err := jwtMid.CheckJWT(c.Writer, c.Request); err != nil {
			c.AbortWithStatus(401)
			return
		}

		userID, ok := userIDFromRequestContext(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "invalid token claims"})
			return
		}

		if headerID := c.GetHeader("x-user-id"); headerID != "" && headerID != userID {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "x-user-id does not match authenticated user"})
			return
		}

		c.Set("authenticatedUserID", userID)
		c.Next()
	}
}

func checkChatIngestToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		expectedToken := os.Getenv("CHAT_INGEST_TOKEN")
		providedToken := c.GetHeader("x-ingest-token")

		if expectedToken == "" {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"message": "chat ingest token is not configured"})
			return
		}

		if providedToken == "" || providedToken != expectedToken {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "invalid ingest token"})
			return
		}

		c.Next()
	}
}

func checkAgentToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		expectedToken := os.Getenv("AGENT_API_TOKEN")
		providedToken := c.GetHeader("x-agent-token")

		if expectedToken == "" {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"message": "agent api token is not configured"})
			return
		}

		if providedToken == "" || providedToken != expectedToken {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "invalid agent token"})
			return
		}

		c.Next()
	}
}

func corsOrigins() string {
	if origins := os.Getenv("CORS_ORIGINS"); origins != "" {
		return origins
	}

	return "http://localhost:3000, https://stormy-cliffs-52671.herokuapp.com"
}

func main() {
	r := gin.Default()

	r.Use(cors.Middleware(cors.Config{
		Origins:         corsOrigins(),
		Methods:         "GET, PUT, POST, DELETE",
		RequestHeaders:  "Origin, Authorization, Content-Type, x-user-id, x-ingest-token, x-agent-token",
		ExposedHeaders:  "",
		MaxAge:          50 * time.Second,
		Credentials:     true,
		ValidateHeaders: false,
	}))

	conString := GetConnectionString()
	dbClient, dbErr := SetupDB(conString)
	if dbErr != nil {
		log.Fatal(dbErr)
	}

	r.Use(static.Serve("/", static.LocalFile("./web", true)))
	r.GET("/api/feelings", checkJWT(), GetFeelingsHandler(dbClient))
	r.POST("/api/feelings", checkJWT(), PostFeelingHandler(dbClient))
	r.GET("/api/weekly-tracker", checkJWT(), GetWeeklyTrackerHandler(dbClient))
	r.POST("/api/weekly-tracker", checkJWT(), PostWeeklyTrackerHandler(dbClient))

	chat := r.Group("/api/chat")
	chat.Use(checkChatIngestToken())
	chat.GET("/capabilities", GetChatCapabilitiesHandler())
	chat.POST("/feeling", PostChatFeelingHandler(dbClient))

	agent := r.Group("/api/agent")
	agent.Use(checkAgentToken())
	agent.GET("/feelings", GetAgentFeelingsHandler(dbClient))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	err := r.Run(":" + port)
	if err != nil {
		log.Fatal("Could not run server", err.Error())
		return
	}
}
