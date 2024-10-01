// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Board {
    struct PixelPoint {
        uint48 Y;
        uint48 X;
        uint24 color;
    }

    struct Pixel {
        PixelPoint point;
        address owner;
    }

    mapping(uint48 => mapping(uint48 => uint256)) public pixelPositions; // Store index of allPixelPoints

    // Array to store all pixel coordinates and data for retrieval
    Pixel[] public pixels;

    // Events
    event PixelChanged(
        uint48 indexed Y,
        uint48 indexed X,
        address indexed owner,
        uint24 color
    );

    function setPixels(PixelPoint[] calldata inputPixels) external {
        uint48 len = uint48(inputPixels.length);

        for (uint48 i = 0; i < len; ) {
            PixelPoint calldata pixel = inputPixels[i];

            // Cache the pixel index
            uint256 pixelIndex = pixelPositions[pixel.Y][pixel.X];

            // Check if pixel is new or already exists
            if (pixelIndex == 0) {
                // New pixel
                pixels.push(Pixel(pixel, msg.sender));
                pixelPositions[pixel.Y][pixel.X] = pixels.length; // Use 1-based index for the mapping

                emit PixelChanged(pixel.Y, pixel.X, msg.sender, pixel.color);
            } else {
                // Existing pixel
                Pixel storage existingPixel = pixels[pixelIndex - 1];

                // Only emit event and write to storage if data changes
                if (
                    existingPixel.point.color != pixel.color ||
                    existingPixel.owner != msg.sender
                ) {
                    emit PixelChanged(
                        pixel.Y,
                        pixel.X,
                        msg.sender,
                        pixel.color
                    );

                    // Update existing pixel data
                    existingPixel.point.color = pixel.color;
                    existingPixel.owner = msg.sender;
                }
            }

            unchecked {
                ++i;
            } // No need for overflow checks
        }
    }

    // View function to return all pixels
    function getAllPixels() external view returns (Pixel[] memory) {
        return pixels; // Return the array of all pixel points
    }
}
