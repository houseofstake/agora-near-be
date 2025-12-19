import {
  decodeProposalDescription,
  encodeProposalDescription,
  DESCRIPTION_VERSION_V0,
  DESCRIPTION_VERSION_V1,
  ProposalMetadataV1,
} from "../descriptionDecoder";

describe("descriptionDecoder", () => {
  describe("decodeProposalDescription", () => {
    describe("v0 (legacy) descriptions", () => {
      it("should return v0 for regular text without prefix", () => {
        const description = "This is a regular proposal description";
        const result = decodeProposalDescription(description);

        expect(result.version).toBe(DESCRIPTION_VERSION_V0);
        expect(result.description).toBe(description);
        expect(result.metadata).toBeNull();
        expect(result.rawDescription).toBe(description);
      });

      it("should return v0 for empty string", () => {
        const result = decodeProposalDescription("");

        expect(result.version).toBe(DESCRIPTION_VERSION_V0);
        expect(result.description).toBe("");
        expect(result.metadata).toBeNull();
      });

      it("should return v0 for null", () => {
        const result = decodeProposalDescription(null);

        expect(result.version).toBe(DESCRIPTION_VERSION_V0);
        expect(result.description).toBe("");
        expect(result.metadata).toBeNull();
      });

      it("should return v0 for undefined", () => {
        const result = decodeProposalDescription(undefined);

        expect(result.version).toBe(DESCRIPTION_VERSION_V0);
        expect(result.description).toBe("");
        expect(result.metadata).toBeNull();
      });

      it("should return v0 for text with pipe but no null prefix", () => {
        const description = "Proposal text|approval_threshold=1000";
        const result = decodeProposalDescription(description);

        expect(result.version).toBe(DESCRIPTION_VERSION_V0);
        expect(result.description).toBe(description);
        expect(result.metadata).toBeNull();
      });

      it("should return v0 for text too short to have header", () => {
        const description = "Hi";
        const result = decodeProposalDescription(description);

        expect(result.version).toBe(DESCRIPTION_VERSION_V0);
        expect(result.description).toBe(description);
        expect(result.metadata).toBeNull();
      });
    });

    describe("v1 encoded descriptions", () => {
      it("should decode v1 with full metadata", () => {
        const encoded = encodeProposalDescription("Proposal text", {
          approval_threshold: "1000000000000000000000000",
          quorum: "500000000000000000000000",
        });

        const result = decodeProposalDescription(encoded);

        expect(result.version).toBe(DESCRIPTION_VERSION_V1);
        expect(result.description).toBe("Proposal text");
        expect(result.metadata).toEqual({
          approval_threshold: "1000000000000000000000000",
          quorum: "500000000000000000000000",
        });
      });

      it("should decode v1 with only approval_threshold", () => {
        const encoded = encodeProposalDescription("Proposal text", {
          approval_threshold: "1000",
        });

        const result = decodeProposalDescription(encoded);

        expect(result.version).toBe(DESCRIPTION_VERSION_V1);
        expect(result.description).toBe("Proposal text");
        expect(result.metadata).toEqual({
          approval_threshold: "1000",
        });
      });

      it("should decode v1 with only quorum", () => {
        const encoded = encodeProposalDescription("Proposal text", {
          quorum: "500",
        });

        const result = decodeProposalDescription(encoded);

        expect(result.version).toBe(DESCRIPTION_VERSION_V1);
        expect(result.description).toBe("Proposal text");
        expect(result.metadata).toEqual({
          quorum: "500",
        });
      });

      it("should decode v1 without metadata section", () => {
        // Manually create v1 encoded string without metadata
        const prefix =
          "\x00\x00\x00\x00" + // 4 null bytes
          "\x00\x01"; // version 1 (big-endian)
        const encoded = prefix + "Proposal text without metadata";

        const result = decodeProposalDescription(encoded);

        expect(result.version).toBe(DESCRIPTION_VERSION_V1);
        expect(result.description).toBe("Proposal text without metadata");
        expect(result.metadata).toBeNull();
      });

      it("should handle description with pipe in text", () => {
        // Text contains pipe character, metadata after last pipe
        const encoded = encodeProposalDescription(
          "Text with | pipe character",
          { quorum: "1000" }
        );

        const result = decodeProposalDescription(encoded);

        expect(result.version).toBe(DESCRIPTION_VERSION_V1);
        expect(result.description).toBe("Text with | pipe character");
        expect(result.metadata).toEqual({ quorum: "1000" });
      });

      it("should handle empty metadata after pipe", () => {
        const prefix = "\x00\x00\x00\x00\x00\x01";
        const encoded = prefix + "Proposal text|";

        const result = decodeProposalDescription(encoded);

        expect(result.version).toBe(DESCRIPTION_VERSION_V1);
        expect(result.description).toBe("Proposal text");
        expect(result.metadata).toBeNull();
      });

      it("should trim whitespace from description", () => {
        const encoded = encodeProposalDescription("  Proposal text  ", {
          quorum: "1000",
        });

        const result = decodeProposalDescription(encoded);

        expect(result.description).toBe("Proposal text");
      });

      it("should preserve rawDescription", () => {
        const encoded = encodeProposalDescription("Proposal text", {
          quorum: "1000",
        });

        const result = decodeProposalDescription(encoded);

        expect(result.rawDescription).toBe(encoded);
      });
    });

    describe("metadata parsing edge cases", () => {
      it("should ignore unknown keys", () => {
        const prefix = "\x00\x00\x00\x00\x00\x01";
        const encoded = prefix + "Proposal text|quorum=1000,unknown_key=value";

        const consoleSpy = jest
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        const result = decodeProposalDescription(encoded);

        expect(result.metadata).toEqual({ quorum: "1000" });
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown metadata key: "unknown_key"')
        );

        consoleSpy.mockRestore();
      });

      it("should handle malformed pairs without equals sign", () => {
        const prefix = "\x00\x00\x00\x00\x00\x01";
        const encoded = prefix + "Proposal text|quorum=1000,malformed";

        const consoleSpy = jest
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        const result = decodeProposalDescription(encoded);

        expect(result.metadata).toEqual({ quorum: "1000" });
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Malformed metadata pair")
        );

        consoleSpy.mockRestore();
      });

      it("should reject non-numeric values", () => {
        const prefix = "\x00\x00\x00\x00\x00\x01";
        const encoded = prefix + "Proposal text|quorum=abc";

        const consoleSpy = jest
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        const result = decodeProposalDescription(encoded);

        expect(result.metadata).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Invalid bigint value")
        );

        consoleSpy.mockRestore();
      });

      it("should reject empty values", () => {
        const prefix = "\x00\x00\x00\x00\x00\x01";
        const encoded = prefix + "Proposal text|quorum=";

        const consoleSpy = jest
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        const result = decodeProposalDescription(encoded);

        expect(result.metadata).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Invalid bigint value")
        );

        consoleSpy.mockRestore();
      });

      it("should reject negative values", () => {
        const prefix = "\x00\x00\x00\x00\x00\x01";
        const encoded = prefix + "Proposal text|quorum=-1000";

        const consoleSpy = jest
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        const result = decodeProposalDescription(encoded);

        expect(result.metadata).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Invalid bigint value")
        );

        consoleSpy.mockRestore();
      });

      it("should handle whitespace in metadata pairs", () => {
        const prefix = "\x00\x00\x00\x00\x00\x01";
        const encoded =
          prefix + "Proposal text| quorum = 1000 , approval_threshold = 500 ";

        const result = decodeProposalDescription(encoded);

        expect(result.metadata).toEqual({
          quorum: "1000",
          approval_threshold: "500",
        });
      });

      it("should handle very large bigint values", () => {
        const largeValue = "999999999999999999999999999999999999";
        const encoded = encodeProposalDescription("Proposal text", {
          quorum: largeValue,
        });

        const result = decodeProposalDescription(encoded);

        expect(result.metadata?.quorum).toBe(largeValue);
      });
    });

    describe("unknown version handling", () => {
      it("should fall back to v0 for unknown version", () => {
        // Create header with version 99
        const prefix = "\x00\x00\x00\x00\x00\x63"; // version 99
        const encoded = prefix + "Proposal text|quorum=1000";

        const consoleSpy = jest
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        const result = decodeProposalDescription(encoded);

        expect(result.version).toBe(DESCRIPTION_VERSION_V0);
        expect(result.description).toBe(encoded);
        expect(result.metadata).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Unknown description version: 99")
        );

        consoleSpy.mockRestore();
      });
    });

    describe("partial null byte prefix", () => {
      it("should return v0 when only some null bytes present", () => {
        const description = "\x00\x00Hello world";
        const result = decodeProposalDescription(description);

        expect(result.version).toBe(DESCRIPTION_VERSION_V0);
        expect(result.description).toBe(description);
      });

      it("should return v0 when null bytes are not at start", () => {
        const description = "Hello\x00\x00\x00\x00\x00\x01world";
        const result = decodeProposalDescription(description);

        expect(result.version).toBe(DESCRIPTION_VERSION_V0);
        expect(result.description).toBe(description);
      });
    });
  });

  describe("encodeProposalDescription", () => {
    it("should encode with full metadata", () => {
      const metadata: ProposalMetadataV1 = {
        approval_threshold: "1000",
        quorum: "500",
      };

      const encoded = encodeProposalDescription("Test proposal", metadata);

      // Verify structure
      expect(encoded.charCodeAt(0)).toBe(0); // null byte 1
      expect(encoded.charCodeAt(1)).toBe(0); // null byte 2
      expect(encoded.charCodeAt(2)).toBe(0); // null byte 3
      expect(encoded.charCodeAt(3)).toBe(0); // null byte 4
      expect(encoded.charCodeAt(4)).toBe(0); // version high byte
      expect(encoded.charCodeAt(5)).toBe(1); // version low byte (v1)

      // Verify decoding roundtrip
      const decoded = decodeProposalDescription(encoded);
      expect(decoded.description).toBe("Test proposal");
      expect(decoded.metadata).toEqual(metadata);
    });

    it("should encode without metadata", () => {
      const encoded = encodeProposalDescription("Test proposal");

      // Should still be v1 encoded but without metadata suffix
      expect(encoded.charCodeAt(0)).toBe(0);
      expect(encoded.charCodeAt(5)).toBe(1);

      const decoded = decodeProposalDescription(encoded);
      expect(decoded.version).toBe(DESCRIPTION_VERSION_V1);
      expect(decoded.description).toBe("Test proposal");
      expect(decoded.metadata).toBeNull();
    });

    it("should encode with empty metadata object", () => {
      const encoded = encodeProposalDescription("Test proposal", {});

      const decoded = decodeProposalDescription(encoded);
      expect(decoded.description).toBe("Test proposal");
      expect(decoded.metadata).toBeNull();
    });

    it("should encode with partial metadata", () => {
      const encoded = encodeProposalDescription("Test proposal", {
        quorum: "1000",
      });

      const decoded = decodeProposalDescription(encoded);
      expect(decoded.metadata).toEqual({ quorum: "1000" });
    });

    it("should produce consistent encoding for same input", () => {
      const metadata: ProposalMetadataV1 = {
        approval_threshold: "1000",
        quorum: "500",
      };

      const encoded1 = encodeProposalDescription("Test", metadata);
      const encoded2 = encodeProposalDescription("Test", metadata);

      expect(encoded1).toBe(encoded2);
    });

    it("should handle special characters in description", () => {
      const description = "Proposal with special chars: !@#$%^&*()";
      const encoded = encodeProposalDescription(description, { quorum: "100" });

      const decoded = decodeProposalDescription(encoded);
      expect(decoded.description).toBe(description);
    });

    it("should handle newlines in description", () => {
      const description = "Line 1\nLine 2\nLine 3";
      const encoded = encodeProposalDescription(description, { quorum: "100" });

      const decoded = decodeProposalDescription(encoded);
      expect(decoded.description).toBe(description);
    });

    it("should handle unicode in description", () => {
      const description = "Proposal with unicode: 日本語 🎉";
      const encoded = encodeProposalDescription(description, { quorum: "100" });

      const decoded = decodeProposalDescription(encoded);
      expect(decoded.description).toBe(description);
    });
  });

  describe("roundtrip encoding/decoding", () => {
    it("should preserve description and metadata through roundtrip", () => {
      const testCases: Array<{
        description: string;
        metadata: ProposalMetadataV1;
      }> = [
        {
          description: "Simple proposal",
          metadata: { approval_threshold: "1000", quorum: "500" },
        },
        {
          description: "Proposal with | pipe in text",
          metadata: { quorum: "999" },
        },
        {
          description:
            "Long proposal with many words and lots of text to make it longer",
          metadata: { approval_threshold: "123456789012345678901234567890" },
        },
        {
          description: "",
          metadata: { quorum: "1" },
        },
      ];

      for (const testCase of testCases) {
        const encoded = encodeProposalDescription(
          testCase.description,
          testCase.metadata
        );
        const decoded = decodeProposalDescription(encoded);

        expect(decoded.description).toBe(testCase.description);
        expect(decoded.metadata).toEqual(testCase.metadata);
        expect(decoded.version).toBe(DESCRIPTION_VERSION_V1);
      }
    });
  });
});
