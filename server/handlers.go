package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
	"net/http"
	"strconv"
	"time"
)

type ChatFeelingPayload struct {
	Status     int      `json:"status"`
	Activities Activity `json:"activities"`
	Comment    string   `json:"comment"`
	CreatedAt  string   `json:"createdAt"`
	Source     string   `json:"source"`
}

func GetFeelingsHandler(dbClient *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		collection := dbClient.Database("feeling").Collection("feelings")
		findOptions := options.Find()
		var results []*Feeling

		userID := c.Request.Header.Get("x-user-id")

		cur, err := collection.Find(context.TODO(), bson.M{"userid": userID}, findOptions)
		if err != nil {
			log.Print(err)
			errorMessage, _ := json.Marshal([]byte(`{message: something went wrong}`))
			c.JSON(500, errorMessage)
			return
		}

		for cur.Next(context.TODO()) {
			var elem Feeling
			err := cur.Decode(&elem)
			if err != nil {
				log.Print("There was an error decoding element")
				log.Fatal(err)
			}

			results = append(results, &elem)
		}

		if err := cur.Err(); err != nil {
			log.Print(err)
			errorMessage, _ := json.Marshal([]byte(`{message: something went wrong}`))
			c.JSON(500, errorMessage)
			return
		}

		cur.Close(context.TODO())
		c.JSON(200, results)
	}
}

func GetAgentFeelingsHandler(dbClient *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		collection := dbClient.Database("feeling").Collection("feelings")
		findOptions := options.Find()
		findOptions.SetSort(bson.D{{Key: "createdat", Value: -1}})

		if limitParam := c.Query("limit"); limitParam != "" {
			if limit, err := strconv.ParseInt(limitParam, 10, 64); err == nil && limit > 0 {
				findOptions.SetLimit(limit)
			}
		}

		userID := c.Request.Header.Get("x-user-id")
		if userID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "missing x-user-id header"})
			return
		}

		cur, err := collection.Find(context.TODO(), bson.M{"userid": userID}, findOptions)
		if err != nil {
			log.Print(err)
			c.JSON(http.StatusInternalServerError, gin.H{"message": "could not fetch feelings"})
			return
		}
		defer cur.Close(context.TODO())

		var results []*Feeling
		for cur.Next(context.TODO()) {
			var elem Feeling
			if err := cur.Decode(&elem); err != nil {
				log.Print("There was an error decoding element")
				c.JSON(http.StatusInternalServerError, gin.H{"message": "could not decode feelings"})
				return
			}
			results = append(results, &elem)
		}

		if err := cur.Err(); err != nil {
			log.Print(err)
			c.JSON(http.StatusInternalServerError, gin.H{"message": "could not fetch feelings"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ok":      true,
			"count":   len(results),
			"records": results,
		})
	}
}

func PostFeelingHandler(dbClient *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var feeling Feeling
		err := c.BindJSON(&feeling)

		userID := c.Request.Header.Get("x-user-id")
		feeling.UserID = userID

		if err != nil {
			log.Println("There was an error inserting feeling {}", err.Error())
			c.JSON(400, err.Error())
			return
		}

		fmt.Println(feeling)
		collection := dbClient.Database("feeling").Collection("feelings")
		result, dbErr := collection.InsertOne(context.TODO(), &feeling)

		if dbErr != nil {
			log.Println("There was an error inserting feeling {}", dbErr.Error())
			c.JSON(500, gin.H{"message": "could not save feeling"})
			return
		}

		log.Println("Inserted multiple documents: ", result.InsertedID)
		c.JSON(200, feeling)
	}
}

func GetChatCapabilitiesHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"actions": gin.H{
				"log_feeling": gin.H{
					"description": "Save a feeling entry from chat",
					"fields": gin.H{
						"status": gin.H{
							"type":          "integer",
							"required":      true,
							"allowedValues": []int{0, 1, 2, 3, 4},
						},
						"activities": gin.H{
							"type":        "object",
							"required":    false,
							"allowedKeys": []string{"bow", "run", "lift", "swim", "cycle"},
						},
						"comment": gin.H{
							"type":     "string",
							"required": false,
						},
						"createdAt": gin.H{
							"type":     "string",
							"format":   "date-time",
							"required": false,
							"default":  "now",
						},
					},
					"examples": []string{
						"mood 4 run lift feeling great",
						"status 2 swim tired",
						"I’m 3 today, did a run, feeling okay",
					},
				},
			},
		})
	}
}

func PostChatFeelingHandler(dbClient *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload ChatFeelingPayload
		if err := c.BindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
			return
		}

		if payload.Status < 0 || payload.Status > 4 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "status must be between 0 and 4"})
			return
		}

		userID := c.Request.Header.Get("x-user-id")
		if userID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "missing x-user-id header"})
			return
		}

		createdAt := time.Now().UTC()
		if payload.CreatedAt != "" {
			parsed, err := time.Parse(time.RFC3339, payload.CreatedAt)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "createdAt must be a valid RFC3339 timestamp"})
				return
			}
			createdAt = parsed
		}

		feeling := Feeling{
			Activities: payload.Activities,
			Status:     fmt.Sprintf("%d", payload.Status),
			CreatedAt:  createdAt,
			Comment:    payload.Comment,
			UserID:     userID,
		}

		collection := dbClient.Database("feeling").Collection("feelings")
		result, dbErr := collection.InsertOne(context.TODO(), &feeling)
		if dbErr != nil {
			log.Println("There was an error inserting chat feeling {}", dbErr.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"message": "could not save feeling"})
			return
		}

		log.Println("Inserted chat feeling: ", result.InsertedID)
		c.JSON(http.StatusOK, gin.H{
			"ok": true,
			"saved": gin.H{
				"status":    payload.Status,
				"createdAt": createdAt,
				"comment":   payload.Comment,
				"source":    payload.Source,
			},
		})
	}
}
