package main

import (
	"net/http"

	`github.com/gin-gonic/gin`
)

// Define a struct for POST data
type Person struct {
	Name string `json:"name" binding:"required"`
	Age  int    `json:"age" binding:"required"`
}

func main() {
	// Create a new Gin router
	r := gin.Default()

	// GET endpoint
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Hello, Go with Gin!"})
	})

	// POST endpoint
	r.POST("/data", func(c *gin.Context) {
		var person Person

		// Bind JSON input to the Person struct
		if err := c.ShouldBindJSON(&person); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Create a response message
		response := gin.H{"message": "Hello " + person.Name + ", you are " + string(rune(person.Age)) + " years old."}
		c.JSON(http.StatusOK, response)
	})

	// Start the server on port 8090
	r.Run(":8090")
}
