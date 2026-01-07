package main

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// PharmaContract provides functions for managing pharma supply chain
type PharmaContract struct {
	contractapi.Contract
}

// DocType constants
const (
	DocTypeStrip    = "strip"
	DocTypeBox      = "box"
	DocTypeCarton   = "carton"
	DocTypeShipment = "shipment"
	DocTypeOrder    = "order"
)

// Status constants
const (
	StatusCreated    = "CREATED"
	StatusSealed     = "SEALED"
	StatusInOrder    = "IN_ORDER"
	StatusDispatched = "DISPATCHED"
	StatusShipped    = "SHIPPED"
	StatusDelivered  = "DELIVERED"
)

// Strip represents a single medicine strip (smallest unit)
type Strip struct {
	DocType      string    `json:"docType"`
	ID           string    `json:"id"`
	BatchNumber  string    `json:"batchNumber"`
	MedicineType string    `json:"medicineType"`
	MfgDate      string    `json:"mfgDate"`
	ExpDate      string    `json:"expDate"`
	Status       string    `json:"status"`
	BoxID        string    `json:"boxId"`
	CreationTxId string    `json:"creationTxId"` // The transaction ID when this strip was created (never changes)
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// Box contains multiple strips (10 strips per box)
type Box struct {
	DocType      string    `json:"docType"`
	ID           string    `json:"id"`
	Strips       []string  `json:"strips"`
	CartonID     string    `json:"cartonId"`
	Status       string    `json:"status"`
	CreationTxId string    `json:"creationTxId"` // The transaction ID when this box was created (never changes)
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// Carton contains multiple boxes (10 boxes per carton)
type Carton struct {
	DocType      string    `json:"docType"`
	ID           string    `json:"id"`
	Boxes        []string  `json:"boxes"`
	ShipmentID   string    `json:"shipmentId"`
	Status       string    `json:"status"`
	CreationTxId string    `json:"creationTxId"` // The transaction ID when this carton was created (never changes)
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// Shipment contains multiple cartons (10 cartons per shipment)
type Shipment struct {
	DocType       string    `json:"docType"`
	ID            string    `json:"id"`
	Cartons       []string  `json:"cartons"`
	OrderID       string    `json:"orderId"` // The order this shipment belongs to
	Status        string    `json:"status"`
	Distributor   string    `json:"distributor"`
	DistributedAt time.Time `json:"distributedAt"`
	CreationTxId  string    `json:"creationTxId"` // The transaction ID when this shipment was created (never changes)
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// Order represents a pharmaceutical order
type Order struct {
	DocType      string    `json:"docType"`
	ID           string    `json:"id"`
	ItemType     string    `json:"itemType"` // shipment (orders only contain shipments)
	ItemIDs      []string  `json:"itemIds"`
	SenderId     string    `json:"senderId"`    // User ID of the sender (who created the order)
	SenderOrg    string    `json:"senderOrg"`   // Organization of the sender
	ReceiverId   string    `json:"receiverId"`  // User ID of the receiver
	ReceiverOrg  string    `json:"receiverOrg"` // Organization of the receiver
	Recipient    string    `json:"recipient"`   // Legacy field - display name of recipient
	Status       string    `json:"status"`
	DispatchedAt time.Time `json:"dispatchedAt"`
	DeliveredAt  time.Time `json:"deliveredAt"`
	CreationTxId string    `json:"creationTxId"` // The transaction ID when this order was created (never changes)
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// TraceResult represents the complete trace hierarchy
type TraceResult struct {
	ItemType    string      `json:"itemType"`
	Item        interface{} `json:"item"`
	Parent      interface{} `json:"parent,omitempty"`
	GrandParent interface{} `json:"grandParent,omitempty"`
	Root        interface{} `json:"root,omitempty"`
	Children    interface{} `json:"children,omitempty"`
}

// InitLedger initializes the ledger with sample data
func (c *PharmaContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	fmt.Println("InitLedger called - Pharma Supply Chain initialized")
	return nil
}

// getTxTimestamp returns the transaction timestamp (deterministic across all peers)
func (c *PharmaContract) getTxTimestamp(ctx contractapi.TransactionContextInterface) time.Time {
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return time.Now() // fallback, should not happen
	}
	return txTimestamp.AsTime()
}

// CreateStrip creates a new medicine strip
func (c *PharmaContract) CreateStrip(ctx contractapi.TransactionContextInterface, id string, batchNumber string, medicineType string, mfgDate string, expDate string) (*Strip, error) {
	exists, err := c.assetExists(ctx, id)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("strip %s already exists", id)
	}

	// Get transaction ID - this uniquely identifies THIS strip's creation
	txId := ctx.GetStub().GetTxID()

	// Get transaction timestamp for consistency across peers
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction timestamp: %v", err)
	}
	now := txTimestamp.AsTime()
	strip := Strip{
		DocType:      DocTypeStrip,
		ID:           id,
		BatchNumber:  batchNumber,
		MedicineType: medicineType,
		MfgDate:      mfgDate,
		ExpDate:      expDate,
		Status:       StatusCreated,
		BoxID:        "",
		CreationTxId: txId, // Store the creation transaction ID (never changes)
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	stripJSON, err := json.Marshal(strip)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().PutState(id, stripJSON)
	if err != nil {
		return nil, err
	}

	return &strip, nil
}

// SealBox creates a box containing specified strips
func (c *PharmaContract) SealBox(ctx contractapi.TransactionContextInterface, boxID string, stripIDsJSON string) (*Box, error) {
	exists, err := c.assetExists(ctx, boxID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("box %s already exists", boxID)
	}

	var stripIDs []string
	err = json.Unmarshal([]byte(stripIDsJSON), &stripIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to parse strip IDs: %v", err)
	}

	// Validate and update each strip
	for _, stripID := range stripIDs {
		stripJSON, err := ctx.GetStub().GetState(stripID)
		if err != nil {
			return nil, fmt.Errorf("failed to get strip %s: %v", stripID, err)
		}
		if stripJSON == nil {
			return nil, fmt.Errorf("strip %s does not exist", stripID)
		}

		var strip Strip
		err = json.Unmarshal(stripJSON, &strip)
		if err != nil {
			return nil, err
		}

		if strip.BoxID != "" {
			return nil, fmt.Errorf("strip %s is already in box %s", stripID, strip.BoxID)
		}

		strip.BoxID = boxID
		strip.Status = StatusSealed
		strip.UpdatedAt = c.getTxTimestamp(ctx)

		updatedStripJSON, err := json.Marshal(strip)
		if err != nil {
			return nil, err
		}

		err = ctx.GetStub().PutState(stripID, updatedStripJSON)
		if err != nil {
			return nil, err
		}
	}

	// Get transaction ID - this uniquely identifies THIS box's creation
	txId := ctx.GetStub().GetTxID()

	// Get transaction timestamp for consistency across peers
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction timestamp: %v", err)
	}
	now := txTimestamp.AsTime()
	box := Box{
		DocType:      DocTypeBox,
		ID:           boxID,
		Strips:       stripIDs,
		CartonID:     "",
		Status:       StatusCreated,
		CreationTxId: txId, // Store the creation transaction ID (never changes)
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	boxJSON, err := json.Marshal(box)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().PutState(boxID, boxJSON)
	if err != nil {
		return nil, err
	}

	return &box, nil
}

// SealCarton creates a carton containing specified boxes
func (c *PharmaContract) SealCarton(ctx contractapi.TransactionContextInterface, cartonID string, boxIDsJSON string) (*Carton, error) {
	exists, err := c.assetExists(ctx, cartonID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("carton %s already exists", cartonID)
	}

	var boxIDs []string
	err = json.Unmarshal([]byte(boxIDsJSON), &boxIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to parse box IDs: %v", err)
	}

	// Validate and update each box
	for _, boxID := range boxIDs {
		boxJSON, err := ctx.GetStub().GetState(boxID)
		if err != nil {
			return nil, fmt.Errorf("failed to get box %s: %v", boxID, err)
		}
		if boxJSON == nil {
			return nil, fmt.Errorf("box %s does not exist", boxID)
		}

		var box Box
		err = json.Unmarshal(boxJSON, &box)
		if err != nil {
			return nil, err
		}

		if box.CartonID != "" {
			return nil, fmt.Errorf("box %s is already in carton %s", boxID, box.CartonID)
		}

		box.CartonID = cartonID
		box.Status = StatusSealed
		box.UpdatedAt = c.getTxTimestamp(ctx)

		updatedBoxJSON, err := json.Marshal(box)
		if err != nil {
			return nil, err
		}

		err = ctx.GetStub().PutState(boxID, updatedBoxJSON)
		if err != nil {
			return nil, err
		}
	}

	// Get transaction ID - this uniquely identifies THIS carton's creation
	txId := ctx.GetStub().GetTxID()

	// Get transaction timestamp for consistency across peers
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction timestamp: %v", err)
	}
	now := txTimestamp.AsTime()
	carton := Carton{
		DocType:      DocTypeCarton,
		ID:           cartonID,
		Boxes:        boxIDs,
		ShipmentID:   "",
		Status:       StatusCreated,
		CreationTxId: txId, // Store the creation transaction ID (never changes)
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	cartonJSON, err := json.Marshal(carton)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().PutState(cartonID, cartonJSON)
	if err != nil {
		return nil, err
	}

	return &carton, nil
}

// SealShipment creates a shipment containing specified cartons
func (c *PharmaContract) SealShipment(ctx contractapi.TransactionContextInterface, shipmentID string, cartonIDsJSON string) (*Shipment, error) {
	exists, err := c.assetExists(ctx, shipmentID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("shipment %s already exists", shipmentID)
	}

	var cartonIDs []string
	err = json.Unmarshal([]byte(cartonIDsJSON), &cartonIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to parse carton IDs: %v", err)
	}

	// Validate and update each carton
	for _, cartonID := range cartonIDs {
		cartonJSON, err := ctx.GetStub().GetState(cartonID)
		if err != nil {
			return nil, fmt.Errorf("failed to get carton %s: %v", cartonID, err)
		}
		if cartonJSON == nil {
			return nil, fmt.Errorf("carton %s does not exist", cartonID)
		}

		var carton Carton
		err = json.Unmarshal(cartonJSON, &carton)
		if err != nil {
			return nil, err
		}

		if carton.ShipmentID != "" {
			return nil, fmt.Errorf("carton %s is already in shipment %s", cartonID, carton.ShipmentID)
		}

		carton.ShipmentID = shipmentID
		carton.Status = StatusSealed
		carton.UpdatedAt = c.getTxTimestamp(ctx)

		updatedCartonJSON, err := json.Marshal(carton)
		if err != nil {
			return nil, err
		}

		err = ctx.GetStub().PutState(cartonID, updatedCartonJSON)
		if err != nil {
			return nil, err
		}
	}

	// Get transaction ID - this uniquely identifies THIS shipment's creation
	txId := ctx.GetStub().GetTxID()

	// Get transaction timestamp for consistency across peers
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction timestamp: %v", err)
	}
	now := txTimestamp.AsTime()
	shipment := Shipment{
		DocType:      DocTypeShipment,
		ID:           shipmentID,
		Cartons:      cartonIDs,
		Status:       StatusCreated,
		CreationTxId: txId, // Store the creation transaction ID (never changes)
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	shipmentJSON, err := json.Marshal(shipment)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().PutState(shipmentID, shipmentJSON)
	if err != nil {
		return nil, err
	}

	return &shipment, nil
}

// DistributeShipment updates shipment with distributor information
func (c *PharmaContract) DistributeShipment(ctx contractapi.TransactionContextInterface, shipmentID string, distributor string) (*Shipment, error) {
	shipmentJSON, err := ctx.GetStub().GetState(shipmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get shipment: %v", err)
	}
	if shipmentJSON == nil {
		return nil, fmt.Errorf("shipment %s does not exist", shipmentID)
	}

	var shipment Shipment
	err = json.Unmarshal(shipmentJSON, &shipment)
	if err != nil {
		return nil, err
	}

	// Get transaction timestamp for consistency across peers
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction timestamp: %v", err)
	}
	now := txTimestamp.AsTime()
	shipment.Status = StatusShipped
	shipment.Distributor = distributor
	shipment.DistributedAt = now
	shipment.UpdatedAt = now

	updatedJSON, err := json.Marshal(shipment)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().PutState(shipmentID, updatedJSON)
	if err != nil {
		return nil, err
	}

	return &shipment, nil
}

// ScanBarcode retrieves complete trace information for any item
func (c *PharmaContract) ScanBarcode(ctx contractapi.TransactionContextInterface, itemID string) (*TraceResult, error) {
	itemJSON, err := ctx.GetStub().GetState(itemID)
	if err != nil {
		return nil, fmt.Errorf("failed to get item: %v", err)
	}
	if itemJSON == nil {
		return nil, fmt.Errorf("item %s does not exist", itemID)
	}

	// Determine item type by parsing
	var rawItem map[string]interface{}
	err = json.Unmarshal(itemJSON, &rawItem)
	if err != nil {
		return nil, err
	}

	docType, ok := rawItem["docType"].(string)
	if !ok {
		return nil, fmt.Errorf("unable to determine item type")
	}

	result := &TraceResult{
		ItemType: docType,
	}

	switch docType {
	case DocTypeStrip:
		var strip Strip
		json.Unmarshal(itemJSON, &strip)
		result.Item = strip
		result.Parent, result.GrandParent, result.Root = c.getStripParents(ctx, strip)

	case DocTypeBox:
		var box Box
		json.Unmarshal(itemJSON, &box)
		result.Item = box
		result.Children = c.getBoxStrips(ctx, box)
		result.Parent, result.GrandParent = c.getBoxParents(ctx, box)

	case DocTypeCarton:
		var carton Carton
		json.Unmarshal(itemJSON, &carton)
		result.Item = carton
		result.Children = c.getCartonBoxes(ctx, carton)
		result.Parent = c.getCartonParent(ctx, carton)

	case DocTypeShipment:
		var shipment Shipment
		json.Unmarshal(itemJSON, &shipment)
		result.Item = shipment
		result.Children = c.getShipmentCartons(ctx, shipment)

	case DocTypeOrder:
		var order Order
		json.Unmarshal(itemJSON, &order)
		result.Item = order
		result.Children = c.getOrderItems(ctx, order)
	}

	return result, nil
}

// Helper functions for trace
func (c *PharmaContract) getStripParents(ctx contractapi.TransactionContextInterface, strip Strip) (interface{}, interface{}, interface{}) {
	if strip.BoxID == "" {
		return nil, nil, nil
	}

	boxJSON, _ := ctx.GetStub().GetState(strip.BoxID)
	if boxJSON == nil {
		return nil, nil, nil
	}

	var box Box
	json.Unmarshal(boxJSON, &box)

	if box.CartonID == "" {
		return box, nil, nil
	}

	cartonJSON, _ := ctx.GetStub().GetState(box.CartonID)
	if cartonJSON == nil {
		return box, nil, nil
	}

	var carton Carton
	json.Unmarshal(cartonJSON, &carton)

	if carton.ShipmentID == "" {
		return box, carton, nil
	}

	shipmentJSON, _ := ctx.GetStub().GetState(carton.ShipmentID)
	if shipmentJSON == nil {
		return box, carton, nil
	}

	var shipment Shipment
	json.Unmarshal(shipmentJSON, &shipment)

	return box, carton, shipment
}

func (c *PharmaContract) getBoxStrips(ctx contractapi.TransactionContextInterface, box Box) []Strip {
	var strips []Strip
	for _, stripID := range box.Strips {
		stripJSON, _ := ctx.GetStub().GetState(stripID)
		if stripJSON != nil {
			var strip Strip
			json.Unmarshal(stripJSON, &strip)
			strips = append(strips, strip)
		}
	}
	return strips
}

func (c *PharmaContract) getBoxParents(ctx contractapi.TransactionContextInterface, box Box) (interface{}, interface{}) {
	if box.CartonID == "" {
		return nil, nil
	}

	cartonJSON, _ := ctx.GetStub().GetState(box.CartonID)
	if cartonJSON == nil {
		return nil, nil
	}

	var carton Carton
	json.Unmarshal(cartonJSON, &carton)

	if carton.ShipmentID == "" {
		return carton, nil
	}

	shipmentJSON, _ := ctx.GetStub().GetState(carton.ShipmentID)
	if shipmentJSON == nil {
		return carton, nil
	}

	var shipment Shipment
	json.Unmarshal(shipmentJSON, &shipment)

	return carton, shipment
}

func (c *PharmaContract) getCartonBoxes(ctx contractapi.TransactionContextInterface, carton Carton) []Box {
	var boxes []Box
	for _, boxID := range carton.Boxes {
		boxJSON, _ := ctx.GetStub().GetState(boxID)
		if boxJSON != nil {
			var box Box
			json.Unmarshal(boxJSON, &box)
			boxes = append(boxes, box)
		}
	}
	return boxes
}

func (c *PharmaContract) getCartonParent(ctx contractapi.TransactionContextInterface, carton Carton) interface{} {
	if carton.ShipmentID == "" {
		return nil
	}

	shipmentJSON, _ := ctx.GetStub().GetState(carton.ShipmentID)
	if shipmentJSON == nil {
		return nil
	}

	var shipment Shipment
	json.Unmarshal(shipmentJSON, &shipment)

	return shipment
}

func (c *PharmaContract) getShipmentCartons(ctx contractapi.TransactionContextInterface, shipment Shipment) []Carton {
	var cartons []Carton
	for _, cartonID := range shipment.Cartons {
		cartonJSON, _ := ctx.GetStub().GetState(cartonID)
		if cartonJSON != nil {
			var carton Carton
			json.Unmarshal(cartonJSON, &carton)
			cartons = append(cartons, carton)
		}
	}
	return cartons
}

func (c *PharmaContract) getOrderItems(ctx contractapi.TransactionContextInterface, order Order) interface{} {
	var items []interface{}
	for _, itemID := range order.ItemIDs {
		itemJSON, _ := ctx.GetStub().GetState(itemID)
		if itemJSON != nil {
			var item map[string]interface{}
			json.Unmarshal(itemJSON, &item)
			items = append(items, item)
		}
	}
	return items
}

// GetAvailableStrips returns all strips not yet in a box
func (c *PharmaContract) GetAvailableStrips(ctx contractapi.TransactionContextInterface) ([]*Strip, error) {
	return c.queryStripsByStatus(ctx, "")
}

func (c *PharmaContract) queryStripsByStatus(ctx contractapi.TransactionContextInterface, boxID string) ([]*Strip, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"%s","boxId":"%s"}}`, DocTypeStrip, boxID)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var strips []*Strip
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var strip Strip
		err = json.Unmarshal(queryResult.Value, &strip)
		if err != nil {
			return nil, err
		}
		strips = append(strips, &strip)
	}

	return strips, nil
}

// GetAvailableBoxes returns all boxes not yet in a carton
func (c *PharmaContract) GetAvailableBoxes(ctx contractapi.TransactionContextInterface) ([]*Box, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"%s","cartonId":""}}`, DocTypeBox)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var boxes []*Box
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var box Box
		err = json.Unmarshal(queryResult.Value, &box)
		if err != nil {
			return nil, err
		}
		boxes = append(boxes, &box)
	}

	return boxes, nil
}

// GetAvailableCartons returns all cartons not yet in a shipment
func (c *PharmaContract) GetAvailableCartons(ctx contractapi.TransactionContextInterface) ([]*Carton, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"%s","shipmentId":""}}`, DocTypeCarton)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var cartons []*Carton
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var carton Carton
		err = json.Unmarshal(queryResult.Value, &carton)
		if err != nil {
			return nil, err
		}
		cartons = append(cartons, &carton)
	}

	return cartons, nil
}

// GetAvailableShipments returns all shipments not yet distributed
func (c *PharmaContract) GetAvailableShipments(ctx contractapi.TransactionContextInterface) ([]*Shipment, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"%s","status":"%s"}}`, DocTypeShipment, StatusCreated)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var shipments []*Shipment
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var shipment Shipment
		err = json.Unmarshal(queryResult.Value, &shipment)
		if err != nil {
			return nil, err
		}
		shipments = append(shipments, &shipment)
	}

	return shipments, nil
}

// CreateOrder creates a new order for shipments
// Parameters: orderID, itemIDsJSON (shipment IDs), senderId, senderOrg, receiverId, receiverOrg
func (c *PharmaContract) CreateOrder(ctx contractapi.TransactionContextInterface, orderID string, itemIDsJSON string, senderId string, senderOrg string, receiverId string, receiverOrg string) (*Order, error) {
	exists, err := c.assetExists(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("order %s already exists", orderID)
	}

	var itemIDs []string
	err = json.Unmarshal([]byte(itemIDsJSON), &itemIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to parse shipment IDs: %v", err)
	}

	if len(itemIDs) == 0 {
		return nil, fmt.Errorf("at least one shipment must be selected")
	}

	// Get transaction ID and timestamp early for consistency
	txId := ctx.GetStub().GetTxID()
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction timestamp: %v", err)
	}
	now := txTimestamp.AsTime()

	// Validate all items are shipments, exist, and update them with orderId
	for _, itemID := range itemIDs {
		itemJSON, err := ctx.GetStub().GetState(itemID)
		if err != nil {
			return nil, fmt.Errorf("failed to get shipment %s: %v", itemID, err)
		}
		if itemJSON == nil {
			return nil, fmt.Errorf("shipment %s does not exist", itemID)
		}

		// Verify it's a shipment
		var shipment Shipment
		err = json.Unmarshal(itemJSON, &shipment)
		if err != nil {
			return nil, fmt.Errorf("failed to parse shipment %s: %v", itemID, err)
		}
		if shipment.DocType != DocTypeShipment {
			return nil, fmt.Errorf("item %s is not a shipment", itemID)
		}

		// Update shipment with orderId for traceability
		shipment.OrderID = orderID
		shipment.Status = StatusInOrder
		shipment.UpdatedAt = now

		updatedShipmentJSON, err := json.Marshal(shipment)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal shipment %s: %v", itemID, err)
		}
		err = ctx.GetStub().PutState(itemID, updatedShipmentJSON)
		if err != nil {
			return nil, fmt.Errorf("failed to update shipment %s: %v", itemID, err)
		}
	}

	// Create recipient display name from receiver info
	recipient := fmt.Sprintf("%s (%s)", receiverId, receiverOrg)

	order := Order{
		DocType:      DocTypeOrder,
		ID:           orderID,
		ItemType:     "shipment", // Orders only contain shipments
		ItemIDs:      itemIDs,
		SenderId:     senderId,
		SenderOrg:    senderOrg,
		ReceiverId:   receiverId,
		ReceiverOrg:  receiverOrg,
		Recipient:    recipient,
		Status:       StatusCreated,
		CreationTxId: txId, // Store the creation transaction ID (never changes)
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	orderJSON, err := json.Marshal(order)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().PutState(orderID, orderJSON)
	if err != nil {
		return nil, err
	}

	return &order, nil
}

// DispatchOrder marks an order as dispatched
func (c *PharmaContract) DispatchOrder(ctx contractapi.TransactionContextInterface, orderID string) (*Order, error) {
	orderJSON, err := ctx.GetStub().GetState(orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to get order: %v", err)
	}
	if orderJSON == nil {
		return nil, fmt.Errorf("order %s does not exist", orderID)
	}

	var order Order
	err = json.Unmarshal(orderJSON, &order)
	if err != nil {
		return nil, err
	}

	// Get transaction timestamp for consistency across peers
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction timestamp: %v", err)
	}
	now := txTimestamp.AsTime()
	order.Status = StatusDispatched
	order.DispatchedAt = now
	order.UpdatedAt = now

	updatedJSON, err := json.Marshal(order)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().PutState(orderID, updatedJSON)
	if err != nil {
		return nil, err
	}

	return &order, nil
}

// DeliverOrder marks an order as delivered
func (c *PharmaContract) DeliverOrder(ctx contractapi.TransactionContextInterface, orderID string) (*Order, error) {
	orderJSON, err := ctx.GetStub().GetState(orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to get order: %v", err)
	}
	if orderJSON == nil {
		return nil, fmt.Errorf("order %s does not exist", orderID)
	}

	var order Order
	err = json.Unmarshal(orderJSON, &order)
	if err != nil {
		return nil, err
	}

	// Get transaction timestamp for consistency across peers
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction timestamp: %v", err)
	}
	now := txTimestamp.AsTime()
	order.Status = StatusDelivered
	order.DeliveredAt = now
	order.UpdatedAt = now

	updatedJSON, err := json.Marshal(order)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().PutState(orderID, updatedJSON)
	if err != nil {
		return nil, err
	}

	return &order, nil
}

// GetOrder retrieves a specific order
func (c *PharmaContract) GetOrder(ctx contractapi.TransactionContextInterface, orderID string) (*Order, error) {
	orderJSON, err := ctx.GetStub().GetState(orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to get order: %v", err)
	}
	if orderJSON == nil {
		return nil, fmt.Errorf("order %s does not exist", orderID)
	}

	var order Order
	err = json.Unmarshal(orderJSON, &order)
	if err != nil {
		return nil, err
	}

	return &order, nil
}

// GetAllOrders retrieves all orders
func (c *PharmaContract) GetAllOrders(ctx contractapi.TransactionContextInterface) ([]*Order, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"%s"}}`, DocTypeOrder)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var orders []*Order
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var order Order
		err = json.Unmarshal(queryResult.Value, &order)
		if err != nil {
			return nil, err
		}
		orders = append(orders, &order)
	}

	// Sort by creation time (newest first)
	sort.Slice(orders, func(i, j int) bool {
		return orders[i].CreatedAt.After(orders[j].CreatedAt)
	})

	return orders, nil
}

// GetOrdersByRecipient retrieves orders for a specific recipient
func (c *PharmaContract) GetOrdersByRecipient(ctx contractapi.TransactionContextInterface, recipient string) ([]*Order, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"%s","recipient":"%s"}}`, DocTypeOrder, recipient)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var orders []*Order
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var order Order
		err = json.Unmarshal(queryResult.Value, &order)
		if err != nil {
			return nil, err
		}
		orders = append(orders, &order)
	}

	return orders, nil
}

// GetTransactionHistory retrieves the transaction history for an item
func (c *PharmaContract) GetTransactionHistory(ctx contractapi.TransactionContextInterface, itemID string) ([]map[string]interface{}, error) {
	historyIterator, err := ctx.GetStub().GetHistoryForKey(itemID)
	if err != nil {
		return nil, fmt.Errorf("failed to get history: %v", err)
	}
	defer historyIterator.Close()

	var history []map[string]interface{}
	for historyIterator.HasNext() {
		queryResult, err := historyIterator.Next()
		if err != nil {
			return nil, err
		}

		var value interface{}
		if queryResult.Value != nil {
			json.Unmarshal(queryResult.Value, &value)
		}

		record := map[string]interface{}{
			"txId":      queryResult.TxId,
			"timestamp": queryResult.Timestamp.AsTime().Format(time.RFC3339),
			"isDelete":  queryResult.IsDelete,
			"value":     value,
		}
		history = append(history, record)
	}

	return history, nil
}

// GetAllItems returns all items of a specific type
func (c *PharmaContract) GetAllItems(ctx contractapi.TransactionContextInterface, docType string) ([]interface{}, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"%s"}}`, docType)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var items []interface{}
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var item interface{}
		err = json.Unmarshal(queryResult.Value, &item)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, nil
}

// GetStatistics returns counts for all item types
func (c *PharmaContract) GetStatistics(ctx contractapi.TransactionContextInterface) (map[string]int, error) {
	stats := map[string]int{
		"strips":    0,
		"boxes":     0,
		"cartons":   0,
		"shipments": 0,
		"orders":    0,
	}

	docTypes := []string{DocTypeStrip, DocTypeBox, DocTypeCarton, DocTypeShipment, DocTypeOrder}
	keys := []string{"strips", "boxes", "cartons", "shipments", "orders"}

	for i, docType := range docTypes {
		queryString := fmt.Sprintf(`{"selector":{"docType":"%s"}}`, docType)
		resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
		if err != nil {
			continue
		}

		count := 0
		for resultsIterator.HasNext() {
			_, err := resultsIterator.Next()
			if err != nil {
				break
			}
			count++
		}
		resultsIterator.Close()
		stats[keys[i]] = count
	}

	return stats, nil
}

// Helper function to check if an asset exists
func (c *PharmaContract) assetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}
	return assetJSON != nil, nil
}

// GetItem retrieves any item by ID
func (c *PharmaContract) GetItem(ctx contractapi.TransactionContextInterface, id string) (interface{}, error) {
	itemJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get item: %v", err)
	}
	if itemJSON == nil {
		return nil, fmt.Errorf("item %s does not exist", id)
	}

	var item interface{}
	err = json.Unmarshal(itemJSON, &item)
	if err != nil {
		return nil, err
	}

	return item, nil
}

// SearchItems searches items by partial ID match
func (c *PharmaContract) SearchItems(ctx contractapi.TransactionContextInterface, searchTerm string) ([]interface{}, error) {
	// Search across all doc types
	docTypes := []string{DocTypeStrip, DocTypeBox, DocTypeCarton, DocTypeShipment, DocTypeOrder}

	var results []interface{}
	searchLower := strings.ToLower(searchTerm)

	for _, docType := range docTypes {
		queryString := fmt.Sprintf(`{"selector":{"docType":"%s"}}`, docType)
		resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
		if err != nil {
			continue
		}

		for resultsIterator.HasNext() {
			queryResult, err := resultsIterator.Next()
			if err != nil {
				break
			}

			var item map[string]interface{}
			json.Unmarshal(queryResult.Value, &item)

			// Check if ID contains search term
			if id, ok := item["id"].(string); ok {
				if strings.Contains(strings.ToLower(id), searchLower) {
					results = append(results, item)
				}
			}
		}
		resultsIterator.Close()
	}

	return results, nil
}

// ============================================================================
// BLOCKCHAIN-ONLY TRACE FUNCTIONS (NEW)
// All data fetched from blockchain using GetHistoryForKey, not World State
// ============================================================================

// BlockchainItemData represents item data with its full transaction history
type BlockchainItemData struct {
	ItemID   string                   `json:"itemId"`
	ItemType string                   `json:"itemType"`
	Current  interface{}              `json:"current"`
	History  []map[string]interface{} `json:"history"`
}

// BlockchainTraceResult represents full traceability from blockchain
type BlockchainTraceResult struct {
	SearchedItem *BlockchainItemData   `json:"searchedItem"`
	Parents      []*BlockchainItemData `json:"parents"`
	Children     []*BlockchainItemData `json:"children"`
}

// TxHashTraceResult represents trace result when searching by TxHash
type TxHashTraceResult struct {
	TransactionInfo map[string]interface{} `json:"transactionInfo"`
	Traceability    *BlockchainTraceResult `json:"traceability"`
}

// getLatestFromBlockchain fetches the latest value for a key from blockchain history
// Note: Fabric's GetHistoryForKey returns records in REVERSE chronological order (newest first)
func (c *PharmaContract) getLatestFromBlockchain(ctx contractapi.TransactionContextInterface, itemID string) (map[string]interface{}, []map[string]interface{}, error) {
	historyIterator, err := ctx.GetStub().GetHistoryForKey(itemID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get history for %s: %v", itemID, err)
	}
	defer historyIterator.Close()

	var history []map[string]interface{}
	var latestValue map[string]interface{}
	isFirst := true

	for historyIterator.HasNext() {
		record, err := historyIterator.Next()
		if err != nil {
			return nil, nil, err
		}

		var value map[string]interface{}
		if record.Value != nil && !record.IsDelete {
			json.Unmarshal(record.Value, &value)
			// First non-deleted record is the latest (history is reverse chronological)
			if isFirst && value != nil {
				latestValue = value
				isFirst = false
			}
		}

		historyRecord := map[string]interface{}{
			"txId":      record.TxId,
			"timestamp": record.Timestamp.AsTime().Format(time.RFC3339),
			"isDelete":  record.IsDelete,
			"value":     value,
		}
		history = append(history, historyRecord)
	}

	if latestValue == nil {
		return nil, nil, fmt.Errorf("item %s not found in blockchain", itemID)
	}

	return latestValue, history, nil
}

// getBlockchainItemData fetches item data with history from blockchain
func (c *PharmaContract) getBlockchainItemData(ctx contractapi.TransactionContextInterface, itemID string) (*BlockchainItemData, error) {
	current, history, err := c.getLatestFromBlockchain(ctx, itemID)
	if err != nil {
		return nil, err
	}

	docType, _ := current["docType"].(string)

	return &BlockchainItemData{
		ItemID:   itemID,
		ItemType: docType,
		Current:  current,
		History:  history,
	}, nil
}

// getStripParentsFromBlockchain fetches strip's parents from blockchain
func (c *PharmaContract) getStripParentsFromBlockchain(ctx contractapi.TransactionContextInterface, stripData map[string]interface{}) ([]*BlockchainItemData, error) {
	parents := []*BlockchainItemData{}

	boxID, _ := stripData["boxId"].(string)
	if boxID == "" {
		return parents, nil
	}

	// Get Box
	boxData, err := c.getBlockchainItemData(ctx, boxID)
	if err != nil {
		return parents, nil
	}
	parents = append(parents, boxData)

	// Get Carton from Box
	boxCurrent, _ := boxData.Current.(map[string]interface{})
	cartonID, _ := boxCurrent["cartonId"].(string)
	if cartonID == "" {
		return parents, nil
	}

	cartonData, err := c.getBlockchainItemData(ctx, cartonID)
	if err != nil {
		return parents, nil
	}
	parents = append(parents, cartonData)

	// Get Shipment from Carton
	cartonCurrent, _ := cartonData.Current.(map[string]interface{})
	shipmentID, _ := cartonCurrent["shipmentId"].(string)
	if shipmentID == "" {
		return parents, nil
	}

	shipmentData, err := c.getBlockchainItemData(ctx, shipmentID)
	if err != nil {
		return parents, nil
	}
	parents = append(parents, shipmentData)

	// Get Order from Shipment
	shipmentCurrent, _ := shipmentData.Current.(map[string]interface{})
	orderID, _ := shipmentCurrent["orderId"].(string)
	if orderID != "" {
		orderData, err := c.getBlockchainItemData(ctx, orderID)
		if err == nil {
			parents = append(parents, orderData)
		}
	}

	return parents, nil
}

// getBoxChildrenFromBlockchain fetches box's children (strips) from blockchain
func (c *PharmaContract) getBoxChildrenFromBlockchain(ctx contractapi.TransactionContextInterface, boxData map[string]interface{}) ([]*BlockchainItemData, error) {
	children := []*BlockchainItemData{}

	stripsInterface, ok := boxData["strips"].([]interface{})
	if !ok {
		return children, nil
	}

	for _, stripIDInterface := range stripsInterface {
		stripID, ok := stripIDInterface.(string)
		if !ok {
			continue
		}
		stripData, err := c.getBlockchainItemData(ctx, stripID)
		if err != nil {
			continue
		}
		children = append(children, stripData)
	}

	return children, nil
}

// getBoxParentsFromBlockchain fetches box's parents from blockchain
func (c *PharmaContract) getBoxParentsFromBlockchain(ctx contractapi.TransactionContextInterface, boxData map[string]interface{}) ([]*BlockchainItemData, error) {
	parents := []*BlockchainItemData{}

	cartonID, _ := boxData["cartonId"].(string)
	if cartonID == "" {
		return parents, nil
	}

	cartonData, err := c.getBlockchainItemData(ctx, cartonID)
	if err != nil {
		return parents, nil
	}
	parents = append(parents, cartonData)

	cartonCurrent, _ := cartonData.Current.(map[string]interface{})
	shipmentID, _ := cartonCurrent["shipmentId"].(string)
	if shipmentID == "" {
		return parents, nil
	}

	shipmentData, err := c.getBlockchainItemData(ctx, shipmentID)
	if err != nil {
		return parents, nil
	}
	parents = append(parents, shipmentData)

	// Get Order from Shipment
	shipmentCurrent, _ := shipmentData.Current.(map[string]interface{})
	orderID, _ := shipmentCurrent["orderId"].(string)
	if orderID != "" {
		orderData, err := c.getBlockchainItemData(ctx, orderID)
		if err == nil {
			parents = append(parents, orderData)
		}
	}

	return parents, nil
}

// getCartonChildrenFromBlockchain fetches carton's children (boxes with their strips) from blockchain
func (c *PharmaContract) getCartonChildrenFromBlockchain(ctx contractapi.TransactionContextInterface, cartonData map[string]interface{}) ([]*BlockchainItemData, error) {
	children := []*BlockchainItemData{}

	boxesInterface, ok := cartonData["boxes"].([]interface{})
	if !ok {
		return children, nil
	}

	for _, boxIDInterface := range boxesInterface {
		boxID, ok := boxIDInterface.(string)
		if !ok {
			continue
		}
		boxData, err := c.getBlockchainItemData(ctx, boxID)
		if err != nil {
			continue
		}
		children = append(children, boxData)

		// Also get strips for this box
		boxCurrent, _ := boxData.Current.(map[string]interface{})
		stripChildren, _ := c.getBoxChildrenFromBlockchain(ctx, boxCurrent)
		children = append(children, stripChildren...)
	}

	return children, nil
}

// getCartonParentsFromBlockchain fetches carton's parents from blockchain
func (c *PharmaContract) getCartonParentsFromBlockchain(ctx contractapi.TransactionContextInterface, cartonData map[string]interface{}) ([]*BlockchainItemData, error) {
	parents := []*BlockchainItemData{}

	shipmentID, _ := cartonData["shipmentId"].(string)
	if shipmentID == "" {
		return parents, nil
	}

	shipmentData, err := c.getBlockchainItemData(ctx, shipmentID)
	if err != nil {
		return parents, nil
	}
	parents = append(parents, shipmentData)

	// Get Order from Shipment
	shipmentCurrent, _ := shipmentData.Current.(map[string]interface{})
	orderID, _ := shipmentCurrent["orderId"].(string)
	if orderID == "" {
		return parents, nil
	}

	orderData, err := c.getBlockchainItemData(ctx, orderID)
	if err != nil {
		return parents, nil
	}
	parents = append(parents, orderData)

	return parents, nil
}

// getShipmentParentsFromBlockchain fetches shipment's parents (order) from blockchain
func (c *PharmaContract) getShipmentParentsFromBlockchain(ctx contractapi.TransactionContextInterface, shipmentData map[string]interface{}) ([]*BlockchainItemData, error) {
	parents := []*BlockchainItemData{}

	orderID, _ := shipmentData["orderId"].(string)
	if orderID == "" {
		return parents, nil
	}

	orderData, err := c.getBlockchainItemData(ctx, orderID)
	if err != nil {
		return parents, nil
	}
	parents = append(parents, orderData)

	return parents, nil
}

// getShipmentChildrenFromBlockchain fetches shipment's children (cartons, boxes, strips) from blockchain
func (c *PharmaContract) getShipmentChildrenFromBlockchain(ctx contractapi.TransactionContextInterface, shipmentData map[string]interface{}) ([]*BlockchainItemData, error) {
	children := []*BlockchainItemData{}

	cartonsInterface, ok := shipmentData["cartons"].([]interface{})
	if !ok {
		return children, nil
	}

	for _, cartonIDInterface := range cartonsInterface {
		cartonID, ok := cartonIDInterface.(string)
		if !ok {
			continue
		}
		cartonData, err := c.getBlockchainItemData(ctx, cartonID)
		if err != nil {
			continue
		}
		children = append(children, cartonData)

		// Also get boxes and strips for this carton
		cartonCurrent, _ := cartonData.Current.(map[string]interface{})
		cartonChildren, _ := c.getCartonChildrenFromBlockchain(ctx, cartonCurrent)
		children = append(children, cartonChildren...)
	}

	return children, nil
}

// getOrderChildrenFromBlockchain fetches order's items (shipments) and their full hierarchy from blockchain
func (c *PharmaContract) getOrderChildrenFromBlockchain(ctx contractapi.TransactionContextInterface, orderData map[string]interface{}) ([]*BlockchainItemData, error) {
	children := []*BlockchainItemData{}

	itemIDsInterface, ok := orderData["itemIds"].([]interface{})
	if !ok {
		return children, nil
	}

	for _, itemIDInterface := range itemIDsInterface {
		itemID, ok := itemIDInterface.(string)
		if !ok {
			continue
		}
		itemData, err := c.getBlockchainItemData(ctx, itemID)
		if err != nil {
			continue
		}
		children = append(children, itemData)

		// If the item is a shipment, also get its full hierarchy (cartons, boxes, strips)
		itemCurrent, _ := itemData.Current.(map[string]interface{})
		docType, _ := itemCurrent["docType"].(string)

		if docType == DocTypeShipment {
			// Get all children of this shipment (cartons, boxes, strips)
			shipmentChildren, _ := c.getShipmentChildrenFromBlockchain(ctx, itemCurrent)
			children = append(children, shipmentChildren...)
		}
	}

	return children, nil
}

// GetFullTraceFromBlockchain fetches complete traceability from blockchain using ItemID
// All data comes from blockchain (LevelDB history index + block files), NOT from World State
func (c *PharmaContract) GetFullTraceFromBlockchain(ctx contractapi.TransactionContextInterface, itemID string) (*BlockchainTraceResult, error) {
	// Get the main item from blockchain
	itemData, err := c.getBlockchainItemData(ctx, itemID)
	if err != nil {
		return nil, err
	}

	result := &BlockchainTraceResult{
		SearchedItem: itemData,
		Parents:      []*BlockchainItemData{},
		Children:     []*BlockchainItemData{},
	}

	current, _ := itemData.Current.(map[string]interface{})
	docType := itemData.ItemType

	switch docType {
	case DocTypeStrip:
		// Strip has no children, only parents
		parents, _ := c.getStripParentsFromBlockchain(ctx, current)
		result.Parents = parents

	case DocTypeBox:
		// Box has strips as children, carton and shipment as parents
		children, _ := c.getBoxChildrenFromBlockchain(ctx, current)
		result.Children = children
		parents, _ := c.getBoxParentsFromBlockchain(ctx, current)
		result.Parents = parents

	case DocTypeCarton:
		// Carton has boxes (and their strips) as children, shipment as parent
		children, _ := c.getCartonChildrenFromBlockchain(ctx, current)
		result.Children = children
		parents, _ := c.getCartonParentsFromBlockchain(ctx, current)
		result.Parents = parents

	case DocTypeShipment:
		// Shipment has cartons (and their boxes, strips) as children, order as parent
		children, _ := c.getShipmentChildrenFromBlockchain(ctx, current)
		result.Children = children
		parents, _ := c.getShipmentParentsFromBlockchain(ctx, current)
		result.Parents = parents

	case DocTypeOrder:
		// Order has items as children
		children, _ := c.getOrderChildrenFromBlockchain(ctx, current)
		result.Children = children
	}

	return result, nil
}

// GetItemByCreationTxHash searches for an item by its creationTxId field
// This is the PRIMARY way to find items by their unique creation transaction hash
// Each item stores its own creationTxId when created, which never changes
func (c *PharmaContract) GetItemByCreationTxHash(ctx contractapi.TransactionContextInterface, txHash string) (map[string]interface{}, error) {
	// Search all item types for matching creationTxId
	docTypes := []string{DocTypeStrip, DocTypeBox, DocTypeCarton, DocTypeShipment, DocTypeOrder}

	for _, docType := range docTypes {
		// Query for items with this creationTxId
		queryString := fmt.Sprintf(`{"selector":{"docType":"%s","creationTxId":"%s"}}`, docType, txHash)
		resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
		if err != nil {
			continue
		}

		if resultsIterator.HasNext() {
			queryResult, err := resultsIterator.Next()
			resultsIterator.Close()
			if err != nil {
				continue
			}

			var item map[string]interface{}
			err = json.Unmarshal(queryResult.Value, &item)
			if err != nil {
				return nil, err
			}

			return item, nil
		}
		resultsIterator.Close()
	}

	return nil, fmt.Errorf("no item found with creationTxId %s", txHash)
}

// GetTraceByTxHash fetches traceability by searching for a specific transaction hash
// PRIORITY 1: Search by creationTxId field (unique to each item, never shared)
// PRIORITY 2: Fall back to history search (for backward compatibility with items created before creationTxId was added)
func (c *PharmaContract) GetTraceByTxHash(ctx contractapi.TransactionContextInterface, txHash string) (*TxHashTraceResult, error) {
	// FIRST: Try to find by creationTxId (this is the unique creation hash for each item)
	item, err := c.GetItemByCreationTxHash(ctx, txHash)
	if err == nil && item != nil {
		// Found the item by its creation transaction ID
		itemId, _ := item["id"].(string)
		docType, _ := item["docType"].(string)

		// Get the creation timestamp from history
		var creationTimestamp string
		historyIterator, err := ctx.GetStub().GetHistoryForKey(itemId)
		if err == nil {
			for historyIterator.HasNext() {
				record, err := historyIterator.Next()
				if err != nil {
					break
				}
				if record.TxId == txHash {
					creationTimestamp = record.Timestamp.AsTime().Format(time.RFC3339)
					break
				}
			}
			historyIterator.Close()
		}

		transactionInfo := map[string]interface{}{
			"txId":      txHash,
			"timestamp": creationTimestamp,
			"itemId":    itemId,
			"itemType":  docType,
			"isDelete":  false,
			"value":     item,
		}

		// Get full traceability from blockchain
		traceability, err := c.GetFullTraceFromBlockchain(ctx, itemId)
		if err != nil {
			return nil, err
		}

		return &TxHashTraceResult{
			TransactionInfo: transactionInfo,
			Traceability:    traceability,
		}, nil
	}

	// FALLBACK: Search transaction history (for items created before creationTxId was added)
	// Search from largest container to smallest to prioritize parent items
	docTypes := []string{DocTypeShipment, DocTypeCarton, DocTypeBox, DocTypeStrip, DocTypeOrder}

	for _, docType := range docTypes {
		queryString := fmt.Sprintf(`{"selector":{"docType":"%s"}}`, docType)
		resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
		if err != nil {
			continue
		}

		for resultsIterator.HasNext() {
			queryResult, err := resultsIterator.Next()
			if err != nil {
				break
			}

			// Check history of this item for the TxHash
			historyIterator, err := ctx.GetStub().GetHistoryForKey(queryResult.Key)
			if err != nil {
				continue
			}

			for historyIterator.HasNext() {
				record, err := historyIterator.Next()
				if err != nil {
					break
				}

				// Found the transaction!
				if record.TxId == txHash {
					historyIterator.Close()
					resultsIterator.Close()

					// Get transaction info
					var txValue interface{}
					if record.Value != nil {
						json.Unmarshal(record.Value, &txValue)
					}

					transactionInfo := map[string]interface{}{
						"txId":      record.TxId,
						"timestamp": record.Timestamp.AsTime().Format(time.RFC3339),
						"itemId":    queryResult.Key,
						"itemType":  docType,
						"isDelete":  record.IsDelete,
						"value":     txValue,
					}

					// Get full traceability from blockchain
					traceability, err := c.GetFullTraceFromBlockchain(ctx, queryResult.Key)
					if err != nil {
						return nil, err
					}

					return &TxHashTraceResult{
						TransactionInfo: transactionInfo,
						Traceability:    traceability,
					}, nil
				}
			}
			historyIterator.Close()
		}
		resultsIterator.Close()
	}

	return nil, fmt.Errorf("transaction %s not found", txHash)
}

// GetItemHistoryFromBlockchain fetches only the transaction history for an item from blockchain
// Useful when you just need audit trail without full parent-child traceability
func (c *PharmaContract) GetItemHistoryFromBlockchain(ctx contractapi.TransactionContextInterface, itemID string) (*BlockchainItemData, error) {
	return c.getBlockchainItemData(ctx, itemID)
}

func main() {
	pharmaChaincode, err := contractapi.NewChaincode(&PharmaContract{})
	if err != nil {
		fmt.Printf("Error creating pharma chaincode: %v\n", err)
		return
	}

	if err := pharmaChaincode.Start(); err != nil {
		fmt.Printf("Error starting pharma chaincode: %v\n", err)
	}
}
