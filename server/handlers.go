package main

import (
	"context"
	"fmt"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
)

func GetFeelings(c *gin.Context) {
	conString := GetConnectionString()
	dbClient, err := SetupDB(conString)
	if err != nil {
		log.Print(err)
		log.Fatal("We exploded")
	}

	collection := dbClient.Database("feeling").Collection("feelings")
	// Pass these options to the Find method
	findOptions := options.Find()
	var results []*Feeling

	// Get the user id from header
	userID := c.Request.Header.Get("x-user-id")
	//

	// Passing bson.D{{}} as the filter matches all documents in the collection
	cur, err := collection.Find(context.TODO(), bson.M{"userid": userID}, findOptions)
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
}
func PostFeeling(c *gin.Context) {
	conString := GetConnectionString()
	dbClient, dbErr := SetupDB(conString)
	if dbErr != nil {
		log.Print(dbErr)
		log.Fatal("We exploded")
	}

	var feeling Feeling
	err := c.BindJSON(&feeling)

	//get user id from header
	userID := c.Request.Header.Get("x-user-id")
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
}
