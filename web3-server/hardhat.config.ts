import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24"
      },
      {
        version: "0.8.12"
      }
    ]
  },
  gasReporter: {
    enabled: true,
    coinmarketcap: "f215d1f9-3ff3-4a69-882b-d310612896df",
    L1Etherscan: "4GXADTNJ2GD3RTKPSW7DXHR4NDDWR8WU2R",
  },
  /*networks: {
    hardhat: {
      blockGasLimit: 4000000000000 // whatever you want here
    },
  }*/
};

export default config;
