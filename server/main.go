package main

import (
	"context"
	"fmt"
	"github.com/gin-gonic/contrib/static"
	"github.com/gin-gonic/gin"
	"github.com/itsjamie/gin-cors"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
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
	//Get env vars keys
	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASS")
	//

	//setup data base
	conString := "mongodb+srv://" + dbUser + ":" + dbPass + "@cluster0.8pqgj.mongodb.net/prod?retryWrites=true&w=majority"
	dbClient, err := SetupDB(conString)

	if err != nil {
		log.Print(err)
		log.Fatal("We exploded")
	}

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


	r.GET("/api/feelings", func(c *gin.Context) {
		collection := dbClient.Database("feeling").Collection("feelings")

		// Pass these options to the Find method
		findOptions := options.Find()
		var results []*Feeling

		// Get the user id from header

		//

		// Passing bson.D{{}} as the filter matches all documents in the collection
		cur, err := collection.Find(context.TODO(), bson.M{"userid": "99936053-a2dc-449d-9020-0682c9bc7f36"}, findOptions)
		if err != nil {
			log.Fatal(err)
		}

		// Finding multiple documents returns a cursor
		// Iterating through the cursor allows us to decode documents one at a time
		for cur.Next(context.TODO()) {

			// create a value into which the single document can be decoded
			var elem Feeling
			err := cur.Decode(&elem)
			if err != nil {
				log.Print("There was an error decoding element")
				log.Fatal(err)
			}

			results = append(results, &elem)
		}

		if err := cur.Err(); err != nil {
			log.Fatal(err)
		}

		// Close the cursor once finished
		cur.Close(context.TODO())

		log.Printf("Found multiple documents (array of pointers): %+v\n", results)
		c.JSON(200, results)
	})

	r.POST("/api/feelings", func(c *gin.Context) {
		var feeling Feeling
		err := c.BindJSON(&feeling)

		//get user id from header
		userID := c.Request.Header.Get("x-user-id")
		log.Println("userId is", userID)
		feeling.UserID = userID

		if err != nil {
			log.Println("There was an error inserting feeling {}", err.Error())
			c.JSON(400, err.Error())

		}

		fmt.Println(feeling)
		collection := dbClient.Database("feeling").Collection("feelings")
		result, dbErr := collection.InsertOne(context.TODO(), &feeling)

		if dbErr != nil {
			log.Println("There was an error inserting feeling {}", err.Error())
		}

		log.Println("Inserted multiple documents: ", result.InsertedID)
		c.JSON(200, feeling)
	})

	r.Run()
}
