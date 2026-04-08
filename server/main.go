package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
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

func getPemCert(token *jwt.Token) (string, error) {
	cert := ""
	resp, err := http.Get("https://dev-vin.au.auth0.com/.well-known/jwks.json")

	if err != nil {
		return cert, err
	}
	defer resp.Body.Close()

	var jwks = Jwks{}
	err = json.NewDecoder(resp.Body).Decode(&jwks)

	if err != nil {
		return cert, err
	}

	for k := range jwks.Keys {
		if token.Header["kid"] == jwks.Keys[k].Kid {
			cert = "-----BEGIN CERTIFICATE-----\n" + jwks.Keys[k].X5c[0] + "\n-----END CERTIFICATE-----"
		}
	}

	if cert == "" {
		err := errors.New("Unable to find appropriate key.")
		return cert, err
	}

	return cert, nil
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
			fmt.Println(err.Error())
			return nil, err
		}

		result, _ := jwt.ParseRSAPublicKeyFromPEM([]byte(cert))
		return result, nil
	},
	SigningMethod: jwt.SigningMethodRS256,
})

func checkJWT() gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtMid := *jwtMiddleware
		if err := jwtMid.CheckJWT(c.Writer, c.Request); err != nil {
			c.AbortWithStatus(401)
			return
		}
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

func main() {
	r := gin.Default()

	r.Use(cors.Middleware(cors.Config{
		Origins:         "*",
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
