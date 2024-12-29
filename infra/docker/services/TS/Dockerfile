# Stage 1: Build the TypeScript application
FROM node:18-alpine AS ts-builder

# Set the working directory for the TypeScript app
WORKDIR /app

# Copy the package.json and package-lock.json to install dependencies
COPY ./ ./

# Install dependencies
RUN npm install

# Copy the backend/ms1 folder and install dependencies there as well
WORKDIR /app/backend/ms1/
RUN npm install

# Build the TypeScript application
RUN npm run build  # Ensure this command exists in your package.json to build TypeScript

# Stage 2: Final image for TypeScript
FROM node:18-alpine

# Install necessary dependencies
RUN apk --no-cache add ca-certificates

# Copy the built TypeScript app from the build stage
COPY --from=ts-builder /app/backend/ms1/dist /usr/local/lib/my-ts-app

# Expose the necessary port (adjust as needed)
EXPOSE 8090

# Set the entrypoint to the TypeScript application
ENTRYPOINT ["node", "/usr/local/lib/my-ts-app/index.js"]
