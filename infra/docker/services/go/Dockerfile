# Stage 1: Build the Go application
FROM golang:1.23 AS build-stage

# Set the working directory inside the container
WORKDIR /app

# Copy the Go module files and download dependencies
COPY backend/goproject/go.mod backend/goproject/go.sum ./
RUN go mod tidy

# Copy the entire application source code into the container
COPY backend/goproject/ .

# Build the Go binary
RUN CGO_ENABLED=0 GOOS=linux go build -o /my-go-app


# Stage 2: Create a lightweight production image
FROM gcr.io/distroless/base-debian11 AS build-release-stage

# Set the working directory inside the container
WORKDIR /

# Copy the Go binary from the builder stage
COPY --from=build-stage /my-go-app /my-go-app

# Expose the application port
EXPOSE 8080

# Use a non-root user for better security
USER nonroot:nonroot

# Set the entrypoint to run the Go application
ENTRYPOINT ["/my-go-app"]
