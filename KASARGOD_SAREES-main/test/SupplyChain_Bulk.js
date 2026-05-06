import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("SupplyChain Bulk Registration", function () {
    let supplyChain;
    let weaver;
    const WEAVER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("WEAVER"));

    beforeEach(async function () {
        [weaver] = await ethers.getSigners();
        const SupplyChain = await ethers.getContractFactory("SupplyChain");
        supplyChain = await SupplyChain.deploy();
        await supplyChain.waitForDeployment();

        // Grant roles (Weaver is granted in constructor to msg.sender)
    });

    it("Should register multiple products in one transaction", async function () {
        const name = "Bulk Saree Batch";
        const loomLocation = "Unit A";
        const weaveDate = Math.floor(Date.now() / 1000);
        const handoverKey = "HK123";
        const handoverHash = ethers.keccak256(ethers.toUtf8Bytes(handoverKey));
        const certificate = "ipfs://Qm...";

        const secrets = ["S1", "S2", "S3"];
        const secretHashes = secrets.map(s => ethers.keccak256(ethers.toUtf8Bytes(s)));

        const tx = await supplyChain.connect(weaver).createProductsBulk(
            name,
            loomLocation,
            weaveDate,
            secretHashes,
            handoverHash,
            certificate
        );
        const receipt = await tx.wait();

        // Check for 3 ProductCreated events
        const events = receipt.logs.map(log => {
            try { return supplyChain.interface.parseLog(log); } catch (e) { return null; }
        }).filter(e => e && e.name === "ProductCreated");

        expect(events.length).to.equal(3);
        expect(events[0].args.id).to.equal(1n);
        expect(events[1].args.id).to.equal(2n);
        expect(events[2].args.id).to.equal(3n);

        // Verify product details on chain
        const p1 = await supplyChain.getProduct(1);
        expect(p1.name).to.equal(name);
        expect(p1.consumerSecretHash).to.equal(secretHashes[0]);
        expect(p1.currentHandoverHash).to.equal(handoverHash);
        expect(p1.state).to.equal(0n); // Created
    });

    it("Should fail if empty hashes array provided", async function () {
        const name = "Fail Batch";
        const loomLocation = "Unit A";
        const weaveDate = Math.floor(Date.now() / 1000);
        const handoverHash = ethers.zeroPadValue("0x01", 32);

        await expect(
            supplyChain.createProductsBulk(name, loomLocation, weaveDate, [], handoverHash, "")
        ).to.be.revertedWith("Bulk: empty hash list");
    });
});
