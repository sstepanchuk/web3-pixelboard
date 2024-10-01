import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import chai from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import deepEqualInAnyOrder from "deep-equal-in-any-order";

chai.use(deepEqualInAnyOrder);

const expect = chai.expect;

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

describe("Board", async function () {
  async function deployBoardFixture() {
    const [owner, otherAccount] = await hre.viem.getWalletClients();

    const board = await hre.viem.deployContract("Board");
    const publicClient = await hre.viem.getPublicClient();

    return {
      board,
      owner,
      otherAccount,
      publicClient,
    };
  }

  before("loadFixture", () => loadFixture(deployBoardFixture));

  it("Set pixels", async function () {
    const { board, owner } = await loadFixture(deployBoardFixture);

    const pixels = [
      { Y: 11, X: 22, color: 1 },
      { Y: 11, X: 23, color: 2 },
    ];

    await board.write.setPixels([pixels]);

    const pixelsInContract = await board.read.getAllPixels();

    expect(pixelsInContract.length).to.equal(pixels.length);
    pixelsInContract.forEach((pixel, i) => {
      const localPixel = pixels[i];

      expect(pixel).to.deep.equalInAnyOrder({
        point: localPixel,
        owner: getAddress(owner.account.address)
      });
    });
  });

  it("Change pixels", async function () {
    const { board, otherAccount } = await loadFixture(deployBoardFixture);

    const pixels = [
      { Y: 11, X: 22, color: 1 },
      { Y: 11, X: 23, color: 2 },
    ];

    const changePixels = [
      { Y: 11, X: 22, color: 15 },
      { Y: 11, X: 23, color: 11 },
    ];

    await board.write.setPixels([pixels]);
    await board.write.setPixels([changePixels], {
      account: otherAccount.account
    });

    const pixelsInContract = await board.read.getAllPixels();

    expect(pixelsInContract.length).to.equal(changePixels.length);
    pixelsInContract.forEach((pixel, i) => {
      const localPixel = changePixels[i];

      expect(pixel).to.deep.equalInAnyOrder({
        point: localPixel,
        owner: getAddress(otherAccount.account.address)
      });
    });
  });

  it("Emit events on change", async function () {
    const { board, owner, otherAccount, publicClient } = await loadFixture(deployBoardFixture);

    const pixels = [
      { Y: 11, X: 22, color: 1 },
      { Y: 11, X: 23, color: 2 },
    ];

    const changePixels = [
      { Y: 11, X: 22, color: 15 },
      { Y: 11, X: 23, color: 11 },
    ];

    await board.write.setPixels([pixels]);
    await board.write.setPixels([changePixels], {
      account: otherAccount.account
    });

    const eventsOwner2 = await publicClient.getContractEvents({
      abi: board.abi,
      address: board.address,
      args: {
        owner: getAddress(owner.account.address),
        X: null,
        Y: null
      }
    });
    expect(eventsOwner2.length).to.equal(pixels.length);

    const eventsOwner = await board.getEvents.PixelChanged({
      X: null,
      Y: null,
      owner: getAddress(owner.account.address)
    });
    /*const eventsOwner = await board.getEvents.PixelChanged({
      owner: otherAccount.account.address
    }); -- same result*/

    expect(eventsOwner.length).to.equal(pixels.length);
    eventsOwner.forEach((event, i) => {
      const localPixel = pixels[i];
      expect(event.args).to.deep.equalInAnyOrder({
        ...localPixel,
        owner: getAddress(owner.account.address)
      });
    });

    const eventsOther = await board.getEvents.PixelChanged({
      owner: getAddress(otherAccount.account.address)
    });
    expect(eventsOther.length).to.equal(changePixels.length);
    eventsOther.forEach((event, i) => {
      const localPixel = changePixels[i];
      expect(event.args).to.deep.equalInAnyOrder({
        ...localPixel,
        owner: getAddress(otherAccount.account.address)
      });
    });
  });
});
