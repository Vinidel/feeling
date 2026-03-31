# Build the Go API
FROM golang:1.22 AS go_builder
WORKDIR /app
COPY server/go.mod server/go.sum ./server/
WORKDIR /app/server
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "-w -s" -o /main .

# Build the React application
FROM node:20-alpine AS node_builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Final runtime image
FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=go_builder /main ./main
COPY --from=node_builder /app/client/build ./web
RUN chmod +x ./main
EXPOSE 8080
ENV PORT=8080
CMD ["./main"]
