./network.sh down && ./network.sh up createChannel -ca -s couchdb

./network.sh deployCCAAS -ccn pharma -ccp ./chaincodeV2 -ccaasdocker true


cat /home/vhits/Downloads/artifacts/fabric-operations-console/fabric-samples/test-network/organizations/peerOrganizations/org2.example.com/users/User1@org2.example.com/msp/signcerts/cert.pem

cat /home/vhits/Downloads/artifacts/fabric-operations-console/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/cert.pem


lsof -ti:3001 | xargs kill -9