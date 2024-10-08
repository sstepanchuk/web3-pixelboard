import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import chai from "chai";
import hre from "hardhat";
import { getAddress, Hex, parseGwei, parseEventLogs } from "viem";
import deepEqualInAnyOrder from "deep-equal-in-any-order";
import { createTokensForRange, packCordsToToken } from "../../shared";

chai.use(deepEqualInAnyOrder);
const expect = chai.expect;

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

type PixelData = { X: number; Y: number; color: number };

describe("Board Contract Tests", async function () {

  async function deployBoardFixture() {
    const [owner, otherAccount] = await hre.viem.getWalletClients();
    const board = await hre.viem.deployContract("Board");
    const publicClient = await hre.viem.getPublicClient();

    async function getTransactionGasCost(txHash: Hex) {
      const txReceipt = await publicClient.getTransactionReceipt({ hash: txHash });
      const txTransaction = await publicClient.getTransaction({ hash: txHash });
      return txReceipt.gasUsed * txTransaction.gasPrice!;
    }

    async function getTransactionBlockTimestamp(txHash: Hex) {
      const txReceipt = await publicClient.getTransactionReceipt({ hash: txHash });
      const txBlock = await publicClient.getBlock({ blockHash: txReceipt.blockHash });
      return txBlock.timestamp;
    }

    return { board, owner, otherAccount, publicClient, getTransactionGasCost, getTransactionBlockTimestamp };
  }

  before(() => loadFixture(deployBoardFixture));

  // Mint Pixel Tests
  describe("Pixel Minting", function () {

    it("Mint a pixel correctly with static price and account for gas", async function () {
      const { board, owner, publicClient, getTransactionGasCost } = await loadFixture(deployBoardFixture);
      const initialOwnerBalance = await publicClient.getBalance({
        address: owner.account.address,
      });

      // Mint a pixel with static price (1 gwei)
      const tx = await board.write.mintPixel([1, 2, 0xFF0000, 1000n], { value: parseGwei('1') });

      // Get transaction gas cost
      const gasCost = await getTransactionGasCost(tx);

      // Verify pixel data
      const [color, rentPricePerSecond] = await board.read.pixels([packCordsToToken(1, 2)]);
      expect(color).to.equal(0xFF0000, "Pixel color did not match expected value.");
      expect(rentPricePerSecond).to.equal(1000n, "Rent price per second did not match expected value.");

      // Capture the owner's balance after minting and compare, accounting for gas
      const finalOwnerBalance = await publicClient.getBalance({
        address: owner.account.address,
      });

      // Ensure balance takes into account the gas cost and sent value
      expect(finalOwnerBalance).to.equal(initialOwnerBalance - gasCost - parseGwei('1'), "Owner's final balance did not match expected value after minting.");
    });

    it("Not allow non-owners to mint a pixel", async function () {
      const { board, otherAccount } = await loadFixture(deployBoardFixture);

      await board.write.mintPixel([1, 2, 0xFF0000, 1000n], { account: otherAccount.account, value: parseGwei('1') });

      // Attempt to mint pixel as a non-owner
      await expect(
        board.write.mintPixel([1, 2, 0xFF0000, 1000n], { account: otherAccount.account, value: parseGwei('1') })
      ).to.be.rejectedWith("Pixel already owned", "Non-owner was able to mint a pixel.");
    });

    it("Not allow minting a pixel without sufficient payment", async function () {
      const { board, otherAccount } = await loadFixture(deployBoardFixture);
      await expect(
        board.write.mintPixel([1, 2, 0xFF0000, 1000n], {
          account: otherAccount.account,
          value: parseGwei('0'),
        })
      ).to.be.rejectedWith("Incorrect payment amount", "Minting succeeded without sufficient payment.");
    });

    it("Not allow minting a pixel with invalid coordinates", async function () {
      const { board, otherAccount } = await loadFixture(deployBoardFixture);
      const invalidX = 2 ** 48; // Assuming X cannot exceed 2^48
      await expect(
        board.write.mintPixel([invalidX, 2, 0xFF0000, 1000n], {
          account: otherAccount.account,
          value: parseGwei('1'),
        })
      ).to.be.rejected;

      const invalidY = 2 ** 48; // Assuming Y cannot exceed 2^48
      await expect(
        board.write.mintPixel([1, invalidY, 0xFF0000, 1000n], {
          account: otherAccount.account,
          value: parseGwei('1'),
        })
      ).to.be.rejected;
    });

    it("Mint a pixel correctly and emit PixelMinted event", async function () {
      const { board, owner, publicClient } = await loadFixture(deployBoardFixture);

      const tx = await board.write.mintPixel([1, 2, 0xFF0000, 1000n], { value: parseGwei('1') });

      // Check event emission
      const receipt = await publicClient.getTransactionReceipt({ hash: tx });
      const logs = parseEventLogs({
        abi: board.abi,
        logs: receipt.logs
      });

      const event = logs.filter(e => e.eventName === 'PixelChanged')[0];
      expect(event).to.not.be.undefined;
      expect(event.args.tokenId).to.equal(packCordsToToken(1, 2));
      expect(event.args.color).to.equal(0xFF0000);
    });

  });

  // Rent Pixel Tests
  describe("Pixel Renting", function () {

    it("Allow renting a pixel, pay rent to pixel owner, and account for gas", async function () {
      const { board, owner, otherAccount, publicClient, getTransactionGasCost, getTransactionBlockTimestamp } = await loadFixture(deployBoardFixture);

      // Mint a pixel
      await board.write.mintPixel([1, 2, 0xFF0000, 1000n], { value: parseGwei('1') });

      // Capture balances before renting
      const initialOwnerBalance = await publicClient.getBalance({
        address: owner.account.address,
      });
      const initialRenterBalance = await publicClient.getBalance({
        address: otherAccount.account.address,
      });

      // Rent the pixel
      const mintTx = await board.write.rentPixel([packCordsToToken(1, 2), 60n], {
        value: parseGwei('60000'),
        account: otherAccount.account,
      });

      const mintTimestamp = await getTransactionBlockTimestamp(mintTx);

      // Get transaction gas cost
      const mintGasCost = await getTransactionGasCost(mintTx);

      // Verify rent details
      const [, , renter, erentEndTime] = await board.read.pixels([packCordsToToken(1, 2)]);
      expect(renter).to.equal(getAddress(otherAccount.account.address), "Renter address did not match expected value.");
      expect(erentEndTime).to.equal(mintTimestamp + 60n, "Rent end time did not match expected value.");

      // Capture balances after renting and compare
      const finalOwnerBalance = await publicClient.getBalance({
        address: owner.account.address,
      });
      const finalRenterBalance = await publicClient.getBalance({
        address: otherAccount.account.address,
      });

      // Ensure balances account for rent payment and gas cost
      expect(finalOwnerBalance).to.equal(initialOwnerBalance + 60000n, "Owner's final balance did not account for rent payment.");
      expect(finalRenterBalance).to.equal(initialRenterBalance - 60000n - mintGasCost, "Renter's final balance did not account for rent payment and gas cost.");
    });

    it("Not allow owners to rent their own pixel", async function () {
      const { board, owner } = await loadFixture(deployBoardFixture);

      // Mint a pixel
      await board.write.mintPixel([1, 2, 0xFF0000, 1000n], { value: parseGwei('1') });

      // Attempt to rent pixel as the owner
      await expect(
        board.write.rentPixel([packCordsToToken(1, 2), 60n], {
          value: parseGwei('60000'),
        })
      ).to.be.rejectedWith("Owner cannot rent");
    });

    it("Not allow renting a pixel that is already rented", async function () {
      const { board, owner, otherAccount } = await loadFixture(deployBoardFixture);

      // Mint a pixel
      await board.write.mintPixel([1, 2, 0xFF0000, 1000n], { value: parseGwei('1') });

      // Rent the pixel
      await board.write.rentPixel([packCordsToToken(1, 2), 60n], {
        value: parseGwei('60000'),
        account: otherAccount.account,
      });

      // Attempt to rent the same pixel again
      await expect(
        board.write.rentPixel([packCordsToToken(1, 2), 60n], {
          value: parseGwei('60000'),
          account: otherAccount.account,
        })
      ).to.be.rejectedWith("Pixel currently rented", "Rented pixel was able to be rented again.");
    });

    it("Not allow renting a pixel with insufficient funds", async function () {
      const { board, owner, otherAccount } = await loadFixture(deployBoardFixture);

      // Mint a pixel
      await board.write.mintPixel([1, 2, 0xFF0000, 1000n], { value: parseGwei('1') });

      // Attempt to rent the pixel without sufficient funds
      await expect(
        board.write.rentPixel([packCordsToToken(1, 2), 60n], {
          value: 1000n, // Less than required
          account: otherAccount.account,
        })
      ).to.be.rejectedWith("Insufficient payment", "Pixel rented without sufficient funds.");
    });

    it("Allow renting a pixel and emit PixelRented event", async function () {
      const { board, owner, otherAccount, publicClient, getTransactionBlockTimestamp } = await loadFixture(deployBoardFixture);

      // Mint a pixel
      await board.write.mintPixel([1, 2, 0xFF0000, 1000n], { value: parseGwei('1') });

      const tx = await board.write.rentPixel([packCordsToToken(1, 2), 60n], {
        value: parseGwei('60000'),
        account: otherAccount.account,
      });
      const txTimestamp = await getTransactionBlockTimestamp(tx);
      // Check event emission
      const receipt = await publicClient.getTransactionReceipt({ hash: tx });

      const logs = parseEventLogs({
        abi: board.abi,
        logs: receipt.logs
      });

      const event = logs.filter(e => e.eventName === 'PixelRented')[0];

      expect(event).to.not.be.undefined;
      expect(event.args.tokenId).to.equal(packCordsToToken(1, 2));
      expect(event.args.renter).to.equal(getAddress(otherAccount.account.address));
      expect(event.args.rentEndTime).to.equal(txTimestamp + 60n); // You can add more specific assertions based on your logic
    });
  });

  // Pixel Data Retrieval Tests
  describe("Pixel Data Retrieval", function () {

    it("Correctly retrieve pixel data between specified coordinates", async function () {
      const { board, owner } = await loadFixture(deployBoardFixture);

      const pixels: PixelData[] = [
        { X: 1, Y: 2, color: 0xFF0000 },
        { X: 1, Y: 3, color: 0x00FF00 },
        { X: 2, Y: 200, color: 0x0000FF },
      ];

      // Mint multiple pixels
      for (const p of pixels) {
        await board.write.mintPixel([p.X, p.Y, p.color, 1000n], { value: parseGwei('1') });
      }

      const tokens = createTokensForRange(0, 102, 0, 102);

      const pixelsOut = await board.read.getPixelsData([tokens]);

      //console.log(JSON.stringify(pixelsOut, null, '   '));

      // Further assertions on pixel data can be added here
    });

    it("Handle retrieval of pixel data for non-existent tokens gracefully", async function () {
      const { board } = await loadFixture(deployBoardFixture);

      const tokens = [packCordsToToken(999, 999)]; // Assuming this pixel doesn't exist
      const pixelsOut = await board.read.getPixelsData([tokens]);

      expect(pixelsOut).to.deep.equal([0], "Non-existent pixel should return default color.");
    });

  });

  describe("Coordinate Packing", function () {

    it("Correctly pack X and Y coordinates into a token", async function () {
      const { board } = await loadFixture(deployBoardFixture);

      const X = 1;
      const Y = 2;

      // Use the local utility function to pack the coordinates
      const expectedToken = await board.read.packCordsToToken([X, Y]);
      const packedToken = packCordsToToken(X, Y);

      // Compare the packed token from the contract with the one from the local function
      expect(expectedToken).to.equal(packedToken, "Packed token from contract did not match expected value.");
    });

    it("Throw an error if coordinates are out of bounds", async function () {
      const { board } = await loadFixture(deployBoardFixture);

      const outOfBoundsX = 2 ** 48; // Assuming X cannot exceed 2^48
      const outOfBoundsY = 2 ** 48;

      await expect(board.read.packCordsToToken([outOfBoundsX, 1])).to.be.rejected;
      await expect(board.read.packCordsToToken([1, outOfBoundsY])).to.be.rejected;
    });

    it("Correctly unpack a packed token into coordinates", async function () {
      const { board } = await loadFixture(deployBoardFixture);

      const X = 1;
      const Y = 2;

      const packedToken = packCordsToToken(X, Y);
      const [unpackedX, unpackedY] = await board.read.unpackCordsFromToken([packedToken]);

      expect(unpackedX).to.equal(X, "Unpacked X coordinate did not match expected value.");
      expect(unpackedY).to.equal(Y, "Unpacked Y coordinate did not match expected value.");
    });
  });

});
