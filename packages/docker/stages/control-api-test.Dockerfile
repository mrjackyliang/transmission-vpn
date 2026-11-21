##########################
#### Control API Test ####
##########################
FROM control-api-dependencies AS control-api-test

COPY apps/transmission/control-api/ ./

RUN go test ./...
