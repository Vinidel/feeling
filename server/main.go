package main

import (
	"context"
	"fmt"
	"github.com/gin-gonic/contrib/static"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
)

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

//

func main() {

	//Get env vars keys
	//port := os.Getenv("PORT")
	//dbConnectString := os.Getenv("DB_CONNECT")
	//

	//setup data base
	conString := ""
	_, err := SetupDB(conString)

	if err != nil {
		log.Print(err)
		log.Fatal("We exploded")
	}

	r := gin.Default()
	// Dont worry about this line just yet, it will make sense in the Dockerise bit!
	r.Use(static.Serve("/", static.LocalFile("./web", true)))

	//Add a get endpoint
	//Add a post endpoint
	//Wrap them with an auth middleware that will redirect to google
	r.GET("/api/weights", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"weight": "", "date": "", "comment": "",
		})
	})

	r.POST("/api/weights", func(c *gin.Context) {
		//var feeling models.Feeling
		//_ = json.NewDecoder(c.Request.Body).Decode(&weight)
		//collection := dbClient.Database("feeling").Collection("feelings")
		//
		//result, err := collection.InsertOne(context.TODO(), weight)
		//
		//if err != nil {
		//	log.Println("There was an error inserting weight {}", err.Error())
		//}
		//
		//log.Println("Inserted multiple documents: ", result.InsertedID)
		//
		//json.NewEncoder(w).Encode(weight)

		c.JSON(200, gin.H{
			"weight": "", "date": "", "comment": "",
		})
	})

	r.Run()
}
