# Kasaragod Handloom Supply Chain System
## Test Cases, Flow Diagrams & Anti-Counterfeiting Documentation

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Test Cases](#test-cases)
   - [Single Saree Registration](#single-saree-registration-test-case)
   - [Bulk Saree Registration](#bulk-saree-registration-test-case)
   - [Consumer Verification](#consumer-verification-test-case)
   - [B2B Custody Transfer](#b2b-custody-transfer-test-case)
3. [Flow Diagrams](#flow-diagrams)
4. [Anti-Counterfeiting Architecture](#anti-counterfeiting-architecture)
5. [Security Features](#security-features)
6. [System Features](#system-features)

---

## System Overview

The Kasaragod Handloom Supply Chain System is a blockchain-based authenticity and provenance tracking platform designed specifically for handwoven sarees. It provides end-to-end traceability from weaver to consumer while implementing multiple layers of anti-counterfeiting protection.

### Technology Stack
- **Blockchain**: Ethereum-compatible smart contracts (Solidity)
- **Frontend**: React.js with MetaMask integration
- **Backend**: Node.js with MongoDB
- **Storage**: IPFS for certificates, local storage for metadata

---

## Test Cases

### Single Saree Registration Test Case

#### Test Case ID: TC001
**Objective**: Verify that a manufacturer can successfully register a single saree with unique identifiers and security features.

#### Preconditions:
- MetaMask connected to localhost:8545 (Hardhat network)
- User wallet has MANUFACTURER_ROLE granted
- Backend server running on localhost:5000
- Valid certificate file (PDF/PNG/JPG) prepared

#### Test Steps:

1. **Navigate to Registration Page**
   - Go to `/create`
   - Verify "Single Mode" badge is displayed

2. **Fill Basic Information (Tab 1)**
   - **Saree Name**: "Kasaragod Traditional Silk #001"
   - **Loom Location**: "Kasaragod Unit 4, Loom 12"
   - **Date of Weaving**: "2026-03-14"
   - Click "Next" to proceed

3. **Add Materials Information (Tab 2)**
   - **Thread Supplier**: "Kerala Silk Threads Pvt Ltd"
   - **Thread Type**: "Pure Silk"
   - **Thread Colors**: "Golden Yellow, Deep Red"
   - **Dye Supplier**: "Natural Dyes Co."
   - **Dye Color Code**: "NYD-001"
   - Click "Next" to proceed

4. **Keys & Certificate (Tab 3)**
   - Verify auto-generated **Consumer Scratch Code**: Format `XXXX-XXXX-XXXX-XXXX`
   - Verify auto-generated **Handover Key**: Format `XXXXXXXX`
   - Upload certificate file
   - **First Recipient Email**: "cooperative@kasaragod.com"
   - Click "Register Saree on Blockchain"

5. **Blockchain Transaction**
   - Confirm MetaMask transaction
   - Wait for transaction confirmation
   - Verify transaction hash is displayed

#### Expected Results:

✅ **Success Overlay Displayed**
- Product ID assigned (e.g., #42)
- QR code generated with `{productId: 42, secretCode: "XXXX-XXXX-XXXX-XXXX"}`
- Consumer scratch code and handover key displayed
- Transaction hash shown

✅ **Blockchain Verification**
```javascript
// Smart contract state verification
await contract.getProduct(42);
// Returns: {
//   id: 42,
//   name: "Kasaragod Traditional Silk #001",
//   currentOwner: "0xf39F...2266",
//   state: 0, // Created
//   consumerSecretHash: "0xabc123...", // keccak256(scratchCode)
//   currentHandoverHash: "0xdef456...", // keccak256(handoverKey)
//   exists: true
// }
```

✅ **Email Sent**
- Handover key emailed to cooperative@kasaragod.com

✅ **Downloads Available**
- Product QR code PNG
- Waybill with handover key

#### Pass Criteria:
- Transaction successfully mined with gas < 500,000
- Product retrievable from blockchain with correct data
- QR code scannable and contains valid JSON
- All security hashes properly set on-chain

---

### Bulk Saree Registration Test Case

#### Test Case ID: TC002
**Objective**: Verify that a manufacturer can register multiple sarees in a single blockchain transaction with individual security features.

#### Preconditions:
- Same as TC001
- Sufficient gas limit for bulk transaction (estimated: 2M - 5M gas)

#### Test Steps:

1. **Navigate to Bulk Registration**
   - Go to `/create-bulk`
   - Verify "Bulk Registry — Blockchain Batch Mode" header

2. **Fill Batch Details**
   - **Batch Name**: "Kasaragod Cotton — April 2026 Batch A"
   - **Loom Location**: "Kasaragod Unit 4"
   - **Date of Weaving**: "2026-03-14"
   - **Quantity**: 5
   - Verify auto-generated **Batch Handover Key**: Format `XXXXXXXX`
   - Upload master certificate
   - **First Recipient Email**: "distributor@kasaragod.com"

3. **Submit Registration**
   - Click "Register 5 Sarees on Blockchain"
   - Confirm MetaMask transaction

4. **Monitor Loading Process**
   - Certificate upload: ✅
   - Generating 5 unique codes: ✅
   - Blockchain submission: ✅
   - Database sync: ✅

#### Expected Results:

✅ **Batch Successfully Created**
- **Batch ID**: #3
- **Product IDs**: [43, 44, 45, 46, 47]
- **Individual Names**: "Kasaragod Cotton — April 2026 Batch A #001" through "#005"

✅ **Security Verification**
```javascript
// Each product has unique consumer secret hash
await contract.getProduct(43); // consumerSecretHash: "0x111..."
await contract.getProduct(44); // consumerSecretHash: "0x222..." (different!)
await contract.getProduct(45); // consumerSecretHash: "0x333..." (different!)

// All products share the same batch handover hash
await contract.getProduct(43); // currentHandoverHash: "0xbatch123..."
await contract.getProduct(44); // currentHandoverHash: "0xbatch123..." (same)
await contract.getProduct(45); // currentHandoverHash: "0xbatch123..." (same)

// Batch exists and links to products
await contract.batches(3);
// Returns: { id: 3, currentOwner: "0xf39...", exists: true, isActive: true }
```

✅ **Results Panel**
- **Batch Waybill QR**: Contains `{type: "BATCH_WAYBILL", batchId: 3, handoverKey: "ABC12345", ...}`
- **Individual Product Grid**: 5 items, each with unique scratch-off code (hidden by default)
- **ZIP Download**: Contains batch_waybill_qr.png + 5 consumer QR codes + CSV + README

✅ **ZIP Contents Verification**
```
batch_3_export.zip
├── batch_waybill_qr.png          # B2B custody transfer QR
├── consumer_qrcodes/
│   ├── product_43_qr.png         # {"productId":43,"secretCode":"AAAA-BBBB-CCCC-DDDD"}
│   ├── product_44_qr.png         # {"productId":44,"secretCode":"EEEE-FFFF-GGGG-HHHH"}
│   └── ...
├── batch_data.csv                # All product IDs + scratch codes for printing
└── README.txt                    # Security instructions
```

#### Pass Criteria:
- Single transaction creates 5 unique products + 1 batch
- Each product has different `consumerSecretHash` (anti-counterfeiting)
- All products share same `currentHandoverHash` (batch logistics)
- ZIP contains correct number of individual QR codes
- CSV data matches blockchain records

---

### Consumer Verification Test Case

#### Test Case ID: TC003
**Objective**: Verify that a consumer can authenticate a saree using the scratch-off code without making a blockchain transaction.

#### Preconditions:
- Product registered (from TC001 or TC002)
- Consumer has physical saree with QR code and scratch-off label
- Consumer accesses `/verify` page (no MetaMask required)

#### Test Steps:

1. **Navigate to Verify Page**
   - Go to `/verify`
   - Note: No wallet connection required for verification

2. **Method 1: QR Code Scan**
   - Click "Identity Scan (QR)" tab
   - Upload product QR code image
   - System auto-extracts: `{productId: 42, secretCode: "XXXX-XXXX-XXXX-XXXX"}`

3. **Method 2: Manual Entry**
   - Click "Manual Audit" tab
   - Upload waybill QR (if available) to get product ID
   - Enter product ID: "42"
   - Enter scratch-off code found under label: "XXXX-XXXX-XXXX-XXXX"

4. **Verification Process**
   - Click "Verify Authenticity"
   - System computes: `keccak256("XXXX-XXXX-XXXX-XXXX")`
   - Blockchain lookup: `contract.getProduct(42).consumerSecretHash`
   - Hash comparison performed client-side

#### Expected Results:

✅ **Authentic Product**
```
Status: AUTHENTICITY VERIFIED ✓
Product ID: 42
Name: Kasaragod Traditional Silk #001
Weave Date: March 14, 2026
Loom: Kasaragod Unit 4, Loom 12
Manufacturer: 0xf39F...2266
```

✅ **Product Timeline**
- Created: March 14, 2026 by Manufacturer
- Current Status: Available for Purchase
- Chain of Custody: Manufacturer → (awaiting next step)

❌ **Counterfeit Detection**
- Wrong scratch code → "VERIFICATION FAILED ❌"
- Non-existent product ID → "Product not found"
- Already claimed product → "ALREADY CLAIMED by [CustomerName]"

#### Pass Criteria:
- Correct code → Instant verification success
- Incorrect code → Clear rejection message
- No gas costs for verification
- Product history accurately displayed

---

### B2B Custody Transfer Test Case

#### Test Case ID: TC004
**Objective**: Verify secure custody transfer between manufacturer and cooperative using rolling handover keys.

#### Preconditions:
- Product/batch registered by manufacturer
- Cooperative has received handover key via email or waybill QR
- Cooperative wallet has COOPERATIVE_ROLE granted

#### Test Steps:

1. **Cooperative Receives Handover**
   - Go to `/custody`
   - Switch to "Single Transfer" or "Bulk Transfer" tab

2. **QR Waybill Method**
   - Upload waybill QR code image
   - System auto-extracts: `{productId: 42, handoverKey: "ABC12345", senderAddress: "0xf39..."}`
   - Verify sender matches current owner on blockchain

3. **Manual Entry Method**
   - Enter Product ID: "42"
   - Enter current handover key: "ABC12345"
   - Enter location: "Kasaragod Cooperative Center"

4. **Transfer Execution**
   - System auto-generates new handover key: "XYZ98765"
   - Click "Transfer Custody"
   - Confirm MetaMask transaction

5. **Rolling Key Update**
   - Blockchain call: `transferCustody(42, "ABC12345", keccak256("XYZ98765"), "Kasaragod Cooperative Center")`
   - Old key "ABC12345" becomes invalid
   - New hash `keccak256("XYZ98765")` stored on-chain

#### Expected Results:

✅ **Successful Transfer**
```javascript
// Blockchain state after transfer
await contract.getProduct(42);
// Returns: {
//   currentOwner: "0xCooperative123...", // Updated
//   state: 1, // Verified (if cooperative calls verifyProduct)
//   currentHandoverHash: "0xnewHash789...", // Updated
//   history: [
//     {actor: "0xf39F...2266", state: 0, location: "Kasaragod Unit 4"},
//     {actor: "0xCooperative123...", state: 1, location: "Kasaragod Cooperative Center"}
//   ]
// }
```

✅ **Security Enforcement**
- Old key "ABC12345" can never be used again
- Only cooperative can initiate next transfer with "XYZ98765"
- Unauthorized party with old key → transaction reverts

✅ **New Waybill Generated**
- Download new waybill QR with latest handover key
- Email new key to next recipient (distributor)

#### Pass Criteria:
- Custody successfully transferred on-chain
- Product state updated (Created → Verified)
- Old handover key permanently invalidated
- New handover key ready for next transfer

---

## Flow Diagrams

### 1. Single Saree Registration Flow

```
[Manufacturer]
      ↓
[Fill Details: Name, Loom, Date]
      ↓
[Generate Scratch Code + Handover Key]
      ↓
[Upload Certificate → IPFS/Server]
      ↓
[Hash Secrets: keccak256(codes)]
      ↓
[📝 Smart Contract: createProduct()]
      ↓
[⛓️ Blockchain Transaction Mined]
      ↓
[💾 Save to MongoDB (optional)]
      ↓
[📧 Email Handover Key to Recipient]
      ↓
[📱 Generate QR Codes + Waybill]
      ↓
[✅ Product Ready for Chain of Custody]
```

### 2. Bulk Saree Registration Flow

```
[Manufacturer]
      ↓
[Batch Details: Name, Loom, Date, Quantity=N]
      ↓
[Generate N Unique Scratch Codes + 1 Shared Handover Key]
      ↓
[Upload Master Certificate]
      ↓
[Hash N Consumer Secrets + 1 Handover Key]
      ↓
[📝 Smart Contract: createProductsBulk()]
      ↓
[⛓️ Single Transaction: N Products + 1 Batch]
      ↓
[💾 Save Batch + Products to MongoDB]
      ↓
[📧 Email Shared Handover Key]
      ↓
[📦 Generate ZIP: N Consumer QRs + 1 Batch Waybill + CSV]
      ↓
[✅ N Products Ready for Chain of Custody]
```

### 3. Consumer Verification Flow

```
[Consumer Gets Physical Saree]
      ↓
[Scans Product QR Code OR Enters Manual Info]
      ↓
[Extract: productId + secretCode]
      ↓
[🧮 Client-side: hash = keccak256(secretCode)]
      ↓
[🔍 Blockchain Read: contract.getProduct(productId)]
      ↓
[Compare: hash === record.consumerSecretHash ?]
      ↓
╭─── YES: AUTHENTIC ✅               NO: COUNTERFEIT ❌ ───╮
│                                                        │
│ [Display: Product Details,         [Display: VERIFICATION │
│  Weave Date, Manufacturer,          FAILED - Invalid Code] │
│  Chain of Custody]                                     │
│         ↓                                              │
│ [Optional: Claim Ownership]                            │
│         ↓                                              │
│ [📝 Smart Contract: claimOwnership()]                  │
│         ↓                                              │
│ [State: Sold, Customer Recorded]                       │
╰────────────────────────────────────────────────────────╯
```

### 4. B2B Custody Transfer Flow

```
[Current Owner Has Product + Handover Key]
      ↓
[Generate Waybill QR: {productId, handoverKey, senderAddress}]
      ↓
[📧 Send Waybill to Next Recipient]
      ↓
[Recipient Scans QR on /custody Page]
      ↓
[System Auto-fills: Product ID + Incoming Key]
      ↓
[System Generates NEW Handover Key for Next Transfer]
      ↓
[📝 Smart Contract: transferCustody(id, oldKey, newKeyHash, location)]
      ↓
[⛓️ Blockchain Verification & State Update]
╭─────────────────────────────────────────╮
│ ✅ SUCCESS:                             │
│ • currentOwner → updated                │
│ • currentHandoverHash → newKeyHash      │
│ • state → updated (Created→Verified)    │
│ • history[] → new entry added           │
│ • oldKey → permanently invalidated      │
╰─────────────────────────────────────────╯
      ↓
[New Waybill Generated for Next Hop]
      ↓
[📧 Email New Key to Next Recipient]
```

---

## Anti-Counterfeiting Architecture

### Multi-Layer Security System

#### Layer 1: Unique Blockchain Identity
```
Each Saree Gets:
├── Unique Product ID (auto-incremented, immutable)
├── Unique Consumer Secret Hash (keccak256, stored on-chain)
├── Shared Batch Handover Hash (for bulk logistics)
└── Immutable Creation Timestamp
```

#### Layer 2: Cryptographic Verification
```
Consumer Verification Process:
┌─────────────────────────────────────────┐
│ Physical Saree                          │
│ ┌─────────────────┐  ┌─────────────────┐│
│ │    QR Code      │  │ Scratch-off     ││
│ │ {productId: 42, │  │ Label:          ││
│ │  secretCode:    │  │ "A1B2-C3D4-     ││
│ │  "A1B2-C3D4-    │  │  E5F6-G7H8"     ││
│ │   E5F6-G7H8"}   │  │ (Hidden)        ││
│ └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ Buyer Verification                      │
│ 1. Scan QR → Get Product ID + Secret   │
│ 2. hash = keccak256("A1B2-C3D4-E5F6-G7H8")│
│ 3. Blockchain: getProduct(42)          │
│ 4. Compare: hash === storedHash         │
│ 5. Result: AUTHENTIC ✅ or FAKE ❌      │
└─────────────────────────────────────────┘
```

#### Layer 3: Rolling Handover Keys (B2B Security)
```
B2B Chain of Custody:
Manufacturer → Cooperative → Distributor → Retailer

Step 1: Manufacturer has Key1
        └─ Blockchain: currentHandoverHash = keccak256(Key1)

Step 2: Transfer to Cooperative
        ├─ Cooperative provides Key1 to prove ownership
        ├─ Smart contract verifies: keccak256(Key1) === currentHandoverHash
        ├─ Generates Key2, stores keccak256(Key2) on-chain
        └─ Key1 becomes permanently invalid ❌

Step 3: Transfer to Distributor
        ├─ Cooperative provides Key2
        ├─ Generates Key3, invalidates Key2
        └─ Process repeats...

🛡️ Security: Old keys cannot be reused, preventing replay attacks
```

#### Layer 4: Immutable Audit Trail
```
Blockchain History (cannot be tampered):
┌──────────────────────────────────────────────────────────────┐
│ Product #42 Timeline                                         │
│ ┌─────────────┬─────────────────┬──────────────┬────────────┐│
│ │ Timestamp   │ Actor           │ State        │ Location   ││
│ ├─────────────┼─────────────────┼──────────────┼────────────┤│
│ │ 2026-03-14  │ 0xf39F...2266   │ Created      │ Unit 4     ││
│ │ 2026-03-15  │ 0xabc1...5678   │ Verified     │ Coop Center││
│ │ 2026-03-16  │ 0xdef9...4321   │ InTransit    │ Warehouse  ││
│ │ 2026-03-17  │ 0x123a...7890   │ AtShop       │ Retail     ││
│ │ 2026-03-18  │ 0xcustomer...   │ Sold         │ Bangalore  ││
│ └─────────────┴─────────────────┴──────────────┴────────────┘│
└──────────────────────────────────────────────────────────────┘

🛡️ Every state change is permanently recorded
🛡️ Cannot be deleted or modified after mining
🛡️ Full provenance from loom to customer
```

### Counterfeit Detection Mechanisms

#### 1. Fake QR Codes
```
❌ Attacker creates fake QR: {"productId": 999, "secretCode": "FAKE-CODE"}
└─ Consumer scans → Product 999 doesn't exist on blockchain → REJECTED
```

#### 2. Cloned QR Codes
```
❌ Attacker copies real QR from legitimate saree
├─ First buyer scans → AUTHENTIC, claims ownership
└─ Second buyer scans same QR → "ALREADY CLAIMED" → CAUGHT
```

#### 3. Modified Scratch Codes
```
❌ Attacker tries different scratch codes on real product
├─ Product 42 exists, but wrong secret
├─ keccak256("WRONG-CODE") ≠ storedHash
└─ "VERIFICATION FAILED" → CAUGHT
```

#### 4. Replay Attacks in B2B Chain
```
❌ Malicious actor intercepts old handover key
├─ Tries to use expired Key1 after Key2 is active
├─ Smart contract: keccak256(Key1) ≠ currentHandoverHash
└─ Transaction reverts → BLOCKED
```

#### 5. Counterfeit Batch Certification
```
❌ Fake manufacturer tries to register products
├─ Wallet lacks MANUFACTURER_ROLE
├─ Smart contract: hasRole(MANUFACTURER_ROLE, msg.sender) → false
└─ Transaction reverts → BLOCKED
```

---

## Security Features

### 1. Role-Based Access Control (RBAC)

```solidity
// Smart Contract Roles
bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER");
bytes32 public constant COOPERATIVE_ROLE  = keccak256("COOPERATIVE");
bytes32 public constant DISTRIBUTOR_ROLE  = keccak256("DISTRIBUTOR");
bytes32 public constant SHOP_ROLE         = keccak256("SHOP");

// Function Protection
function createProduct(...) public onlyRole(MANUFACTURER_ROLE) { ... }
function verifyProduct(...) public onlyRole(COOPERATIVE_ROLE) { ... }
function transferCustody(...) public {
    require(hasAnyRole(msg.sender)); // Only registered participants
}
```

### 2. Digital Signature Verification

```javascript
// Certificate Upload Process
1. User uploads PDF certificate
2. Backend validates digital signature:
   - extractSignature(pdfFile)
   - verifySignature(signature, publicKey, document)
   - Only proceeds if signature === VALID
3. Certificate stored with verified status
```

### 3. Geolocation Tracking

```javascript
// Customer Ownership Claim
function claimOwnership(uint productId, string memory secretCode,
                       string memory customerName, string memory location) {
    // location format: "lat,lng|City, State, Country"
    // Example: "12.9716,77.5946|Bangalore, Karnataka, India"
}
```

### 4. Gas Optimization & Rate Limiting

```javascript
// Bulk Registration Efficiency
Single Registration: ~400,000 gas
Bulk Registration (5 products): ~800,000 gas
Efficiency Gain: 60% gas reduction per product in bulk

// Smart Contract Gas Limits
createProduct()     : 500,000 gas limit
createProductsBulk(): 5,000,000 gas limit
transferCustody()   : 300,000 gas limit
```

---

## System Features

### 1. Web3 Integration

#### MetaMask Connection
- Automatic wallet detection
- Network switching (localhost:8545 for development)
- Transaction signing and confirmation
- Gas estimation and fee display

#### Smart Contract Interaction
- Read operations (no gas): Product verification, history lookup
- Write operations (gas required): Registration, custody transfer
- Event listening: Real-time updates on state changes

### 2. Backend Services

#### Certificate Management
```
POST /api/products/upload-certificate
├─ Multer file upload (5MB limit)
├─ Digital signature verification
├─ IPFS storage (future enhancement)
└─ Returns: { success: true, filename: "cert-123.pdf" }
```

#### Email Notifications
```
POST /api/email/send-handover-key
├─ SMTP configuration
├─ Handover key delivery
├─ Batch waybill distribution
└─ Chain of custody notifications
```

#### Database Synchronization
```
MongoDB Collections:
├─ users: Registered participants with roles
├─ products: Individual saree records
├─ batches: Bulk registration metadata
└─ certificates: Document verification records
```

### 3. Frontend Features

#### Responsive Design
- Mobile-optimized QR code scanning
- Touch-friendly custody transfer interface
- Progressive Web App capabilities

#### Real-time Updates
```javascript
// Live transaction monitoring
useEffect(() => {
    const filter = contract.filters.ProductCreated(null, account);
    contract.on(filter, (productId, manufacturer, event) => {
        toast.success(`Product #${productId} registered!`);
        updateProductList();
    });
}, [contract, account]);
```

#### Export Capabilities
```
ZIP Export Contents:
├─ batch_waybill_qr.png     # B2B logistics QR
├─ consumer_qrcodes/        # Individual product QRs
│   ├─ product_42_qr.png    # For customer verification
│   └─ product_43_qr.png
├─ batch_data.csv           # Label printing data
└─ README.txt               # Security instructions
```

### 4. Quality Assurance

#### Automated Testing
```bash
# Smart Contract Tests
npx hardhat test
├─ SupplyChain_FullFlow.js     # End-to-end workflow
├─ SupplyChain_Bulk.js         # Bulk registration tests
└─ VerifyEvent.js              # Event emission verification

# Frontend Tests
npm test
├─ Component unit tests
├─ Hook integration tests
└─ User interaction tests
```

#### Error Handling
```javascript
// Graceful Degradation
try {
    await contract.createProduct(...);
} catch (error) {
    if (error.code === 'INSUFFICIENT_FUNDS') {
        toast.error('Insufficient ETH for gas fees');
    } else if (error.reason?.includes('MANUFACTURER_ROLE')) {
        toast.error('Access denied - MANUFACTURER_ROLE required');
    } else {
        toast.error('Transaction failed - please try again');
    }
}
```

---

## Conclusion

The Kasaragod Handloom Supply Chain System implements a comprehensive anti-counterfeiting solution using blockchain technology. The multi-layer security approach ensures that:

1. **Each saree is unique** - Cryptographic hashes prevent duplication
2. **Chain of custody is secure** - Rolling keys prevent unauthorized transfers
3. **Consumers can verify authenticity** - Instant, gasless verification
4. **Audit trail is immutable** - Complete provenance tracking
5. **Access is controlled** - Role-based permissions prevent unauthorized operations

The system successfully addresses the primary counterfeiting challenges in the handloom industry while maintaining usability for all stakeholders in the supply chain.

---

**Document Version**: 1.0
**Generated**: March 14, 2026
**System Version**: Production Ready
**Smart Contract Address**: 0x5FbDB2315678afecb367f032d93F642f64180aa3