# Multi-stage build
FROM golang:1.21-alpine AS builder

# Set the working directory
WORKDIR /chaincode

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the chaincode source
COPY *.go ./

# Build the chaincode
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o chaincode .

# Final stage using fabric base image
FROM hyperledger/fabric-baseos:2.5.10

LABEL version="1.0"
LABEL description="Pharma Supply Chain Chaincode"

# Set the working directory
WORKDIR /chaincode

# Copy the built binary from builder stage
COPY --from=builder /chaincode/chaincode .

# Expose the chaincode port
EXPOSE 9999

# Command to run the chaincode
CMD ["./chaincode"]
