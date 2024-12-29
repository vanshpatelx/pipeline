package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"github.com/joho/godotenv"
	"path/filepath"

	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq" // Import PostgreSQL driver
	"github.com/streadway/amqp"
)
func init() {
	// Declare the cwd variable
	pwd, err := os.Getwd() // Use := for variable declaration and assignment
	if err != nil {
		fmt.Println("Error getting current directory:", err)
	}	
	fmt.Println("Current working directory:", pwd)

	
	err = godotenv.Load(filepath.Join(pwd, ".dockerenv"))
    if err != nil {
        log.Fatal("Error loading .env file")
    }
    fmt.Println(fmt.Sprintf("MYVAR=%s", os.Getenv("MYVAR")))

}

  
var (
	redisClient *redis.Client
	postgresDB  *sql.DB
)

func main() {

	postgresUser := os.Getenv("POSTGRES_USER")
	postgresPass := os.Getenv("POSTGRES_PASS")
	postgresHost := os.Getenv("POSTGRES_HOST")
	postgresPort := os.Getenv("POSTGRES_PORT")
	postgresDBName := os.Getenv("POSTGRES_DB")
	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")
	rabbitMQURL := os.Getenv("RABBITMQ_URL")


	// Set up PostgreSQL
	var err error
	postgresDB, err = sql.Open("postgres", fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", postgresUser, postgresPass, postgresHost, postgresPort, postgresDBName))
	if err != nil {
		log.Fatalf("Error connecting to PostgreSQL: %v", err)
	}
	createPostgresTables()

	// Set up Redis
	redisClient = redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", redisHost, redisPort),
	})

	// Connect to RabbitMQ
	conn, err := amqp.Dial(rabbitMQURL)
	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("Failed to open a RabbitMQ channel: %v", err)
	}
	defer ch.Close()

	exchangeName := "userExchange"
	err = ch.ExchangeDeclare(
		exchangeName,
		"fanout",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to declare an exchange: %v", err)
	}

	queue, err := ch.QueueDeclare(
		"",
		false,
		false,
		true,
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to declare a queue: %v", err)
	}

	err = ch.QueueBind(
		queue.Name,
		"",
		exchangeName,
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to bind queue to exchange: %v", err)
	}

	msgs, err := ch.Consume(
		queue.Name,
		"",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to register a consumer: %v", err)
	}

	go func() {
		for msg := range msgs {
			log.Printf("Received a message: %s", msg.Body)
			handleReceivedMessage(string(msg.Body))
		}
	}()

	// Set up HTTP server
	http.HandleFunc("/addUser", addUserHandler)
	http.HandleFunc("/checkUser/", checkUserHandler)
	http.HandleFunc("/checkReceivedMsgs", checkReceivedMsgsHandler)

	log.Println("Golang Service running on port 8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func addUserHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	username := body.Username

	// Insert into PostgreSQL
	if _, err := postgresDB.Exec("INSERT INTO Dbusers(user_name) VALUES($1) ON CONFLICT DO NOTHING", username); err != nil {
		log.Printf("Error inserting into PostgreSQL: %v", err)
		http.Error(w, "Error inserting into PostgreSQL", http.StatusInternalServerError)
		return
	}

	// Add to Redis
	ctx := context.Background()
	if err := redisClient.Set(ctx, fmt.Sprintf("userCacheKey:%s", username), username, 0).Err(); err != nil {
		log.Printf("Error inserting into Redis: %v", err)
		http.Error(w, "Error inserting into Redis", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("User added successfully"))
}

func checkUserHandler(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Path[len("/checkUser/"):]

	ctx := context.Background()
	var response = make(map[string]interface{})

	cachedUsername, err := redisClient.Get(ctx, fmt.Sprintf("userCacheKey:%s", username)).Result()
	if err == nil {
		response["cache"] = cachedUsername
	}

	var dbUsername string
	err = postgresDB.QueryRow("SELECT user_name FROM Dbusers WHERE user_name = $1", username).Scan(&dbUsername)
	if err == nil {
		response["database"] = dbUsername
	} else if err == sql.ErrNoRows {
		response["database"] = "not found"
	} else {
		http.Error(w, "Error querying database", http.StatusInternalServerError)
		return
	}

	if len(response) == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(response)
}
func checkReceivedMsgsHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := postgresDB.Query("SELECT user_name FROM ReceivedUsers")
	if err != nil {
		http.Error(w, "Error querying received messages", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var receivedUsers []string
	for rows.Next() {
		var username string
		if err := rows.Scan(&username); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}
		receivedUsers = append(receivedUsers, username)
	}

	json.NewEncoder(w).Encode(receivedUsers)
}

func handleReceivedMessage(message string) {
	// Insert into ReceivedUsers table
	if _, err := postgresDB.Exec("INSERT INTO ReceivedUsers(user_name) VALUES($1) ON CONFLICT DO NOTHING", message); err != nil {
		log.Printf("Error inserting received message into PostgreSQL: %v", err)
	}
}

func createPostgresTables() {
	_, err := postgresDB.Exec(`
		CREATE TABLE IF NOT EXISTS Dbusers (
			user_name TEXT PRIMARY KEY
		);
		CREATE TABLE IF NOT EXISTS ReceivedUsers (
			user_name TEXT PRIMARY KEY
		);
	`)
	if err != nil {
		log.Fatalf("Error creating PostgreSQL tables: %v", err)
	}
}
