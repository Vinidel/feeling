package main

import (
	"context"
	"fmt"
	"github.com/gin-gonic/contrib/static"
	"github.com/gin-gonic/gin"
	"github.com/itsjamie/gin-cors"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"os"
	"time"
)
// Feeling struct
type Feeling struct {
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	Comment   string    `json:"comment"`
	UserID    string    `json:"userID"`
}


func GetConnectionString() string {
	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASS")
	return "mongodb+srv://" + dbUser + ":" + dbPass + "@cluster0.8pqgj.mongodb.net/prod?retryWrites=true&w=majority"
}

func SetupDB(connectionString string) (*mongo.Client, error) {
	// Set client options
	// clientOptions := options.Client().ApplyURI("mongodb://localhost:27017")
	clientOptions := options.Client().ApplyURI(connectionString)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		//log.Fatal(err)
		return nil, err
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		//log.Fatal(err)
		return nil, err
	}

	fmt.Println("Connected to MongoDB!")
	return client, nil
}

func main() {
	r := gin.Default()

	r.Use(cors.Middleware(cors.Config{
		Origins:        "*",
		Methods:        "GET, PUT, POST, DELETE",
		RequestHeaders: "Origin, Authorization, Content-Type, x-user-id",
		ExposedHeaders: "",
		MaxAge: 50 * time.Second,
		Credentials: true,
		ValidateHeaders: false,
	}))

	// Dont worry about this line just yet, it will make sense in the Dockerise bit!
	r.Use(static.Serve("/", static.LocalFile("./web", true)))
	r.GET("/api/feelings", GetFeelings)
	r.POST("/api/feelings", PostFeeling)

	err := r.Run()
	if err != nil {
		return 
	}
}
