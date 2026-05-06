// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title SupplyChain
 * @dev Kasaragod Saree Authenticity & Supply Chain Tracking Smart Contract.
 * Allows tracking from Weaver -> Cooperative -> Distributor -> Shop -> Customer.
 */
contract SupplyChain is AccessControl {
    
    // --- Phase 1: Access Control (RBAC) ---
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER");
    bytes32 public constant COOPERATIVE_ROLE = keccak256("COOPERATIVE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR");
    bytes32 public constant SHOP_ROLE        = keccak256("SHOP");

    // --- Phase 2: State Machine ---
    enum State { 
        Created,        // 0: Created by Weaver
        Verified,       // 1: Verified by Cooperative
        InTransit,      // 2: Moving between nodes (Distributor/Shop)
        AtShop,         // 3: Available at Shop (Retailer)
        Sold,           // 4: Owned by Customer
        InTransit_P2P   // 5: Secondary market resale flow
    }

    // --- Historical Audit Trail ---
    struct HistoryEntry {
        address actor;
        State state;
        uint256 timestamp;
        string location;
    }

    struct VerificationLog {
        address verifier;
        uint256 timestamp;
        string location;
        string remarks;
    }

    struct CustomerClaim {
        string customerName;
        string location;
        uint256 timestamp;
        address claimedBy;
        bool isClaimed;
    }

    struct Product {
        uint256 id;
        string name;            // Saree Name/Identifier
        string loomLocation;   // New: Specific Loom Location
        uint256 weaveDate;     // New: Date of Weaving
        address currentOwner; 
        State state;
        bytes32 consumerSecretHash;  // Scratch-off code hash
        bytes32 currentHandoverHash; // Rolling handover key hash
        bool isConsumed;             
        bool exists;
        VerificationLog[] verificationHistory; // Cooperative/Others verification
        CustomerClaim customerClaim;
        string productCertificate;  // IPFS Hash of Certificate
        uint256 batchId;            // New: Link to a batch (0 if none)
    }

    struct Batch {
        uint256 id;
        uint256[] productIds;
        address currentOwner;
        State state;
        bytes32 currentHandoverHash;
        bool exists;
        bool isActive; // True until broken up
    }

    uint256 private _productCounter = 0;        // For single products only
    uint256 private _batchCounter = 0;          // For batch numbering (A, B, C...)
    uint256 private _bulkProductCounter = 0;    // For products within batches

    mapping(uint256 => Product) public products;
    mapping(uint256 => HistoryEntry[]) public productHistory;
    mapping(uint256 => Batch) public batches;

    // User authorization certificates stored on IPFS
    mapping(address => string) public userCertificateIPFS;

    // --- Events ---
    event ProductCreated(uint256 indexed id, address indexed weaver, string name, string loomLocation);
    event ProductVerified(uint256 indexed id, address indexed verifier, uint256 timestamp);
    event CustodyTransferred(uint256 indexed id, address indexed from, address indexed to, string location);
    event OwnershipTransferred(uint indexed id, address indexed from, address indexed to);
    event CustomerOwnershipClaimed(uint256 indexed id, address indexed customer, string customerName, string location, uint256 timestamp);
    event UserCertificateRegistered(address indexed user, string ipfsHash);
    
    event BatchCreated(uint256 indexed batchId, uint256[] productIds, address indexed creator);
    event CustodyTransferredBatch(uint256 indexed batchId, address indexed from, address indexed to, string location);

    // --- Modifiers ---
    modifier onlyCurrentOwner(uint256 _id) {
        require(products[_id].currentOwner == msg.sender, "Access: Caller is not the current owner");
        _;
    }

    modifier inState(uint256 _id, State _state) {
        require(products[_id].state == _state, "Logic: Invalid state for this action");
        _;
    }

    modifier productExists(uint256 _id) {
        require(products[_id].exists, "Lookup: Product ID does not exist");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANUFACTURER_ROLE, msg.sender);
    }

    /**
     * @notice Manufacturer Registers Saree
     * @param _name Saree Name
     * @param _loomLocation Location of the Loom
     * @param _weaveDate Timestamp of weaving completion
     * @param _consumerSecretHash Static scratch-off code hash
     * @param _firstHandoverHash Initial handover key hash
     * @param _productCertificate Certificate/warranty document filename (IPFS)
     */
    function createProduct(
        string calldata _name, 
        string calldata _loomLocation,
        uint256 _weaveDate,
        bytes32 _consumerSecretHash,
        bytes32 _firstHandoverHash,
        string calldata _productCertificate
    ) 
        external 
        onlyRole(MANUFACTURER_ROLE)
        returns (uint256) 
    {
        _productCounter++;
        uint256 newId = _productCounter;

        Product storage newProduct = products[newId];
        newProduct.id = newId;
        newProduct.name = _name;
        newProduct.loomLocation = _loomLocation;
        newProduct.weaveDate = _weaveDate;
        newProduct.currentOwner = msg.sender;
        newProduct.state = State.Created;
        newProduct.consumerSecretHash = _consumerSecretHash;
        newProduct.currentHandoverHash = _firstHandoverHash;
        newProduct.isConsumed = false;
        newProduct.exists = true;
        newProduct.productCertificate = _productCertificate;
        newProduct.batchId = 0;

        _pushHistory(newId, State.Created, _loomLocation);
        emit ProductCreated(newId, msg.sender, _name, _loomLocation);
        return newId;
    }

    /**
     * @notice Bulk registration of sarees sharing a handover key.
     * @dev Creates multiple Product entries in a single transaction.
     * @param _name Saree name (shared)
     * @param _loomLocation Loom location (shared)
     * @param _weaveDate Weave date (shared)
     * @param _consumerSecretHashes Array of unique scratch‑off code hashes
     * @param _firstHandoverHash Hash of the shared handover key
     * @param _productCertificate IPFS hash of the certificate (shared)
     * @return batchId The newly created Batch ID
     * @return ids Array of newly created product IDs
     */
    function createProductsBulk(
        string calldata _name,
        string calldata _loomLocation,
        uint256 _weaveDate,
        bytes32[] calldata _consumerSecretHashes,
        bytes32 _firstHandoverHash,
        string calldata _productCertificate
    ) external onlyRole(MANUFACTURER_ROLE) returns (uint256 batchId, uint256[] memory ids) {
        require(_consumerSecretHashes.length > 0, "Bulk: empty hash list");
        
        _batchCounter++;
        batchId = _batchCounter;
        ids = new uint256[](_consumerSecretHashes.length);
        
        for (uint256 i = 0; i < _consumerSecretHashes.length; ++i) {
            _bulkProductCounter++;
            uint256 newId = _bulkProductCounter + 1000000; // Offset to avoid conflicts
            Product storage newProduct = products[newId];
            newProduct.id = newId;
            newProduct.name = _name;
            newProduct.loomLocation = _loomLocation;
            newProduct.weaveDate = _weaveDate;
            newProduct.currentOwner = msg.sender;
            newProduct.state = State.Created;
            newProduct.consumerSecretHash = _consumerSecretHashes[i];
            newProduct.currentHandoverHash = _firstHandoverHash;
            newProduct.isConsumed = false;
            newProduct.exists = true;
            newProduct.productCertificate = _productCertificate;
            newProduct.batchId = batchId;
            
            _pushHistory(newId, State.Created, _loomLocation);
            emit ProductCreated(newId, msg.sender, _name, _loomLocation);
            ids[i] = newId;
        }

        Batch storage newBatch = batches[batchId];
        newBatch.id = batchId;
        newBatch.productIds = ids;
        newBatch.currentOwner = msg.sender;
        newBatch.state = State.Created;
        newBatch.currentHandoverHash = _firstHandoverHash;
        newBatch.exists = true;
        newBatch.isActive = true;

        emit BatchCreated(batchId, ids, msg.sender);
    }

    /**
     * @notice Cooperative Verifies Saree
     * @dev Cooperative verifies the Saree details and physical existence before distribution.
     * @param _id Product ID
     * @param _location Cooperative Location
     * @param _remarks Verification remarks
     */
    function verifyProduct(uint256 _id, string calldata _location, string calldata _remarks)
        external
        productExists(_id)
        onlyRole(COOPERATIVE_ROLE)
    {
        // Ideally, verification happens when it's still with Weaver or just handed over. 
        // We'll enforce it must be in Created state (or Verified if re-verifying, but let's keep it simple).
        require(products[_id].state == State.Created, "Logic: Product must be in Created state to verify");

        products[_id].state = State.Verified;

        products[_id].verificationHistory.push(VerificationLog({
            verifier: msg.sender,
            timestamp: block.timestamp,
            location: _location,
            remarks: _remarks
        }));

        _pushHistory(_id, State.Verified, _location); // Optional: Do we track verification in history as a state change? Yes.
        emit ProductVerified(_id, msg.sender, block.timestamp);
    }

    /**
     * @notice B2B Custody Transfer
     * @dev Weaver -> Distributor -> Shop
     */
    function transferCustody(
        uint256 _id, 
        string memory _incomingKey, 
        bytes32 _nextKeyHash, 
        string memory _location
    ) 
        external 
        productExists(_id) 
    {
        require(products[_id].state != State.Sold, "Security: Product already sold");

        // Verify: incoming key must match current handover hash
        require(
            keccak256(abi.encodePacked(_incomingKey)) == products[_id].currentHandoverHash, 
            "Security: Invalid handover key provided"
        );
        
        address prevOwner = products[_id].currentOwner;
        products[_id].currentOwner = msg.sender;
        
        // Update state logic
        if (hasRole(SHOP_ROLE, msg.sender)) {
            products[_id].state = State.AtShop;
        } else if (hasRole(DISTRIBUTOR_ROLE, msg.sender)) {
            products[_id].state = State.InTransit; 
        } else {
             // Fallback or intermediate
            products[_id].state = State.InTransit;
        }

        // ROLL THE KEY
        products[_id].currentHandoverHash = _nextKeyHash;
        
        _pushHistory(_id, products[_id].state, _location);
        emit CustodyTransferred(_id, prevOwner, msg.sender, _location);
    }

    /**
     * @notice Bulk B2B Custody Transfer via Batch ID
     * @dev Transfer custody of an entire active batch using its Batch ID.
     * @param _batchId The ID of the batch to transfer
     * @param _incomingKey The shared handover key (plaintext)
     * @param _nextKeyHash Hash of the new handover key for post-transfer
     * @param _location Transfer location
     */
    function transferBatchCustody(
        uint256 _batchId,
        string calldata _incomingKey,
        bytes32 _nextKeyHash,
        string calldata _location
    ) external {
        Batch storage batch = batches[_batchId];
        require(batch.exists, "Lookup: Batch ID does not exist");
        require(batch.isActive, "Logic: Batch is no longer active");
        require(batch.state != State.Sold, "Security: Batch already sold");

        bytes32 incomingHash = keccak256(abi.encodePacked(_incomingKey));
        require(
            incomingHash == batch.currentHandoverHash,
            "Security: Invalid handover key for batch"
        );

        address prevOwner = batch.currentOwner;
        batch.currentOwner = msg.sender;

        // Determine new state based on role
        State newState;
        if (hasRole(SHOP_ROLE, msg.sender)) {
            newState = State.AtShop;
        } else {
            newState = State.InTransit;
        }
        
        batch.state = newState;
        batch.currentHandoverHash = _nextKeyHash;

        // Transfer all constituent products
        for (uint256 i = 0; i < batch.productIds.length; ++i) {
            uint256 _id = batch.productIds[i];
            Product storage product = products[_id];
            
            // Safety checks per product
            if (product.exists && product.state != State.Sold) {
                product.currentOwner = msg.sender;
                product.state = newState;
                product.currentHandoverHash = _nextKeyHash;
                
                _pushHistory(_id, newState, _location);
                emit CustodyTransferred(_id, prevOwner, msg.sender, _location);
            }
        }

        emit CustodyTransferredBatch(_batchId, prevOwner, msg.sender, _location);
    }

    /**
     * @notice Customer Claims Ownership
     */
    function claimOwnership(
        uint256 _id, 
        string memory _scratchCode, 
        string memory _customerName, 
        string memory _location
    ) 
        external 
        productExists(_id)
    {
        require(
            keccak256(abi.encodePacked(_scratchCode)) == products[_id].consumerSecretHash, 
            "Security: Invalid scratch-off code provided"
        );
        
        require(!products[_id].isConsumed, "Product: Already claimed");
        
        address prevOwner = products[_id].currentOwner;
        products[_id].currentOwner = msg.sender;
        products[_id].state = State.Sold;
        products[_id].isConsumed = true;
        
        products[_id].customerClaim = CustomerClaim({
            customerName: _customerName,
            location: _location,
            timestamp: block.timestamp,
            claimedBy: msg.sender,
            isClaimed: true
        });
        
        _pushHistory(_id, State.Sold, _location);
        emit CustomerOwnershipClaimed(_id, msg.sender, _customerName, _location, block.timestamp);
        emit OwnershipTransferred(_id, prevOwner, msg.sender);
    }

    // --- Helpers & Views ---

    function _pushHistory(uint256 _id, State _state, string memory _location) internal {
        productHistory[_id].push(HistoryEntry({
            actor: msg.sender,
            state: _state,
            timestamp: block.timestamp,
            location: _location
        }));
    }

    function getHistory(uint256 _id) external view productExists(_id) returns (HistoryEntry[] memory) {
        return productHistory[_id];
    }

    function getVerificationHistory(uint256 _id) external view productExists(_id) returns (VerificationLog[] memory) {
        return products[_id].verificationHistory;
    }

    function getProduct(uint256 _id) external view returns (Product memory) {
        return products[_id];
    }
    
    function registerUserCertificate(string calldata _ipfsHash) external {
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        userCertificateIPFS[msg.sender] = _ipfsHash;
        emit UserCertificateRegistered(msg.sender, _ipfsHash);
    }

    function getUserCertificate(address _userAddress) external view returns (string memory) {
        return userCertificateIPFS[_userAddress];
    }

    // --- ID Formatting Utilities ---

    /**
     * @notice Convert number to letter format (1->A, 2->B, 27->AA, 28->AB...)
     * @param _num The number to convert (1-based)
     * @return The letter representation
     */
    function numberToLetters(uint256 _num) public pure returns (string memory) {
        require(_num > 0, "Number must be greater than 0");

        bytes memory result;
        uint256 num = _num - 1; // Convert to 0-based for calculation

        do {
            result = abi.encodePacked(result, bytes1(uint8(65 + (num % 26))));
            num = num / 26;
        } while (num > 0);

        // Reverse the string
        bytes memory reversed = new bytes(result.length);
        for (uint256 i = 0; i < result.length; i++) {
            reversed[i] = result[result.length - 1 - i];
        }

        return string(reversed);
    }

    /**
     * @notice Get formatted ID for display purposes
     * @param _id The numeric product ID
     * @return Formatted ID string
     */
    function getFormattedProductId(uint256 _id) public view productExists(_id) returns (string memory) {
        Product memory product = products[_id];

        if (product.batchId == 0) {
            // Single product: return #1, #2, #3...
            return string(abi.encodePacked("#", _uint2str(_id)));
        } else {
            // Bulk product: return A1, A2, B1, B2...
            string memory batchLetter = numberToLetters(product.batchId);
            // Calculate position within batch (1-based)
            uint256 positionInBatch = _getPositionInBatch(_id, product.batchId);
            return string(abi.encodePacked(batchLetter, _uint2str(positionInBatch)));
        }
    }

    /**
     * @notice Get formatted batch ID (A, B, C, AA...)
     * @param _batchId The numeric batch ID
     * @return Formatted batch ID string
     */
    function getFormattedBatchId(uint256 _batchId) public pure returns (string memory) {
        require(_batchId > 0, "Invalid batch ID");
        return numberToLetters(_batchId);
    }

    /**
     * @notice Helper to find position of product within its batch
     */
    function _getPositionInBatch(uint256 _productId, uint256 _batchId) internal view returns (uint256) {
        Batch memory batch = batches[_batchId];
        for (uint256 i = 0; i < batch.productIds.length; i++) {
            if (batch.productIds[i] == _productId) {
                return i + 1; // 1-based position
            }
        }
        return 1; // Fallback
    }

    /**
     * @notice Convert uint256 to string
     */
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i % 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
