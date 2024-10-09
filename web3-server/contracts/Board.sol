// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Contract for a pixel-based board game where users can own and rent pixels
contract Board is ERC721, Ownable {
    uint32 public constant PIXEL_PRICE = 1 gwei;

    struct Pixel {
        uint24 color; // Color of the pixel (24 bits)
        uint256 rentPricePerSecond; // Rental price per second in wei
        address renter; // Address of the current renter
        uint256 rentEndTime; // End time of the rental period
    }

    mapping(uint96 => Pixel) public pixels;

    event PixelChanged(uint256 indexed tokenId, uint24 color);
    event PixelRented(
        uint256 indexed tokenId,
        address indexed renter,
        uint256 rentEndTime
    );

    constructor() ERC721("PixelBoard", "PIXEL") Ownable(msg.sender) {}

    // Modifiers
    modifier onlyPixelOwner(uint256 tokenId) {
        require(
            ownerOf(tokenId) == msg.sender,
            "Only the pixel owner can perform this action"
        );
        _;
    }

    modifier isPixelExist(uint256 tokenId) {
        require(_ownerOf(tokenId) != address(0), "Pixel does not exist");
        _;
    }

    // Pack (X, Y) coordinates into a single token ID
    function packCordsToToken(uint48 X, uint48 Y) public pure returns (uint96) {
        return (uint96(X) << 48) | uint96(Y);
    }

    // Unpack a token ID back into (X, Y) coordinates
    function unpackCordsFromToken(
        uint96 packed
    ) public pure returns (uint48 X, uint48 Y) {
        X = uint48(packed >> 48);
        Y = uint48(packed);
    }

    // Mint a new pixel with specified attributes
    function mintPixel(
        uint48 X,
        uint48 Y,
        uint24 color,
        uint256 rentPricePerSecond
    ) external payable {
        require(msg.value == PIXEL_PRICE, "Incorrect payment amount"); // Enforce static price
        uint96 tokenId = packCordsToToken(X, Y);
        require(_ownerOf(tokenId) == address(0), "Pixel already owned");
        _mint(msg.sender, tokenId);
        pixels[tokenId] = Pixel(color, rentPricePerSecond, address(0), 0); // Initialize pixel dataz
        emit PixelChanged(tokenId, color);
    }

    // Change the color of a pixel
    function setPixelColor(
        uint96 tokenId,
        uint24 color
    ) external isPixelExist(tokenId) {
        Pixel storage pixel = pixels[tokenId];
        require(
            (block.timestamp < pixel.rentEndTime &&
                pixel.renter == msg.sender) || ownerOf(tokenId) == msg.sender,
            "Not authorized to change color"
        );

        pixel.color = color;
        emit PixelChanged(tokenId, color);
    }

    // Update the rent price per second for a pixel
    function setPixelRentPricePerSecond(
        uint96 tokenId,
        uint256 newRentPricePerSecond
    ) external onlyPixelOwner(tokenId) isPixelExist(tokenId) {
        pixels[tokenId].rentPricePerSecond = newRentPricePerSecond; // Update the rent price
    }

    // Rent a pixel for a specified period
    function rentPixel(
        uint96 tokenId,
        uint256 rentTime
    ) external payable isPixelExist(tokenId) {
        Pixel storage pixel = pixels[tokenId];
        address pixelOwner = ownerOf(tokenId);
        require(pixelOwner != msg.sender, "Owner cannot rent");
        require(pixel.rentPricePerSecond > 0, "Pixel not for rent");
        require(block.timestamp > pixel.rentEndTime, "Pixel currently rented");
        require(rentTime > 0, "Invalid rent end time");

        uint256 totalRentalCost = rentTime * pixel.rentPricePerSecond;
        require(msg.value >= totalRentalCost, "Insufficient payment");

        // Send rent payment to the pixel owner
        (bool success, ) = pixelOwner.call{value: totalRentalCost}("");
        require(success, "Payment to owner failed");

        pixel.rentEndTime = block.timestamp + rentTime;
        pixel.renter = msg.sender;
        emit PixelRented(tokenId, msg.sender, pixel.rentEndTime);

        // Refund any excess payment
        if (msg.value > totalRentalCost) {
            (success, ) = msg.sender.call{value: msg.value - totalRentalCost}(
                ""
            );
            require(success, "Refund failed");
        }
    }

    // View function to retrieve multiple pixel data in one call
    function getPixelsData(
        uint96[] calldata tokenIds
    ) external view returns (uint24[] memory) {
        uint256 length = tokenIds.length;
        uint24[] memory pixelData = new uint24[](length);

        assembly {
            // Memory pointer to pixelData array (skipping the length part of the array)
            let pixelDataPtr := add(pixelData, 0x20)

            // Loop over tokenIds array
            for {
                let i := 0
            } lt(i, length) {
                i := add(i, 1)
            } {
                // Load the tokenId from calldata
                let tokenId := calldataload(add(tokenIds.offset, mul(i, 0x20)))

                // Compute the storage slot for the tokenId using keccak256
                mstore(0x00, tokenId)
                mstore(0x20, pixels.slot)
                let storageSlot := keccak256(0x00, 0x40)

                // Load the pixel color and mask it to 24 bits (as uint24)
                let color := and(sload(storageSlot), 0xFFFFFF)

                // Store the color directly into pixelData array
                mstore(pixelDataPtr, color)

                // Move the pointer to the next slot in the pixelData array
                pixelDataPtr := add(pixelDataPtr, 0x20)
            }
        }

        return pixelData;
    }

    // Withdraw contract balance (only owner can withdraw)
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Withdrawal failed");
    }
}
