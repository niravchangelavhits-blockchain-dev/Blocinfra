./network.sh down && ./network.sh up createChannel -ca -s couchdb

./network.sh deployCCAAS -ccn pharma -ccp ./chaincodeV2 -ccaasdocker true


cat organizations/peerOrganizations/org2.example.com/users/User1@org2.example.com/msp/signcerts/cert.pem

cat organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/cert.pem


lsof -ti:3001 | xargs kill -9