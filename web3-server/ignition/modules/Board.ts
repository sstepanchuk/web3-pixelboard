import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BoardModule = buildModule("BoardModule", (m) => {
  const board = m.contract("Board");

  return { board };
});

export default BoardModule;
