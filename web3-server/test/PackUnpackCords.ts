import { expect } from "chai";
import { packCordsToToken, unpackTokenToCords } from "../../shared"; // Adjust the import path as necessary

describe("LocalCoordinate Packing and Unpacking", function () {

  describe("packCordsToToken", function () {
    it("should pack coordinates correctly", function () {
      const X = 1;
      const Y = 2;
      const token = packCordsToToken(X, Y);

      // Expected token calculation
      const expectedToken = (BigInt(X) << 48n) + BigInt(Y);
      expect(token).to.equal(expectedToken, "Packed token does not match expected value.");
    });

    it("should handle maximum values for X and Y", function () {
      const X = 2 ** 48 - 1; // Max for 48 bits
      const Y = 2 ** 48 - 1; // Max for 48 bits
      const token = packCordsToToken(X, Y);

      const expectedToken = (BigInt(X) << 48n) + BigInt(Y);
      expect(token).to.equal(expectedToken, "Packed token does not match expected value for max coordinates.");
    });

    it("should handle zero values", function () {
      const X = 0;
      const Y = 0;
      const token = packCordsToToken(X, Y);

      expect(token).to.equal(0n, "Packed token for zero coordinates should be zero.");
    });
  });

  describe("unpackTokenToCords", function () {
    it("should unpack a token correctly", function () {
      const X = 1;
      const Y = 2;
      const token = packCordsToToken(X, Y);

      const coords = unpackTokenToCords(token);
      expect(coords).to.deep.equal({ X, Y }, "Unpacked coordinates do not match expected values.");
    });

    it("should handle maximum values for X and Y", function () {
      const X = 2 ** 48 - 1; // Max for 48 bits
      const Y = 2 ** 48 - 1; // Max for 48 bits
      const token = packCordsToToken(X, Y);

      const coords = unpackTokenToCords(token);
      expect(coords).to.deep.equal({ X, Y }, "Unpacked coordinates do not match expected values for max coordinates.");
    });

    it("should handle zero values", function () {
      const token = packCordsToToken(0, 0);
      const coords = unpackTokenToCords(token);

      expect(coords).to.deep.equal({ X: 0, Y: 0 }, "Unpacked coordinates for zero token should be zero.");
    });
  });
});
