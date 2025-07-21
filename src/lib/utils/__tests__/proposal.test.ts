import { getDerivedProposalStatus } from "../proposal";
import { convertNanoSecondsToMs } from "../time";
import { Decimal } from "@prisma/client/runtime/client";

// Mock the time utility
jest.mock("../time");
const mockConvertNanoSecondsToMs =
  convertNanoSecondsToMs as jest.MockedFunction<typeof convertNanoSecondsToMs>;

describe("getDerivedProposalStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset system time to a known value
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("when proposal is rejected", () => {
    it("should return 'Rejected'", () => {
      const proposal = {
        id: "1",
        isRejected: true,
        isApproved: false,
        votingStartAt: new Date("2024-01-10T10:00:00.000Z"),
        votingDurationNs: new Decimal("86400000000000"), // 1 day in ns
      } as any;

      mockConvertNanoSecondsToMs.mockReturnValue(86400000);

      const result = getDerivedProposalStatus(proposal);

      expect(result).toBe("Rejected");
      // Function still calls convertNanoSecondsToMs at the beginning
      expect(mockConvertNanoSecondsToMs).toHaveBeenCalledWith("86400000000000");
    });
  });

  describe("when proposal is not approved", () => {
    it("should return 'Created'", () => {
      const proposal = {
        id: "1",
        isRejected: false,
        isApproved: false,
        votingStartAt: new Date("2024-01-10T10:00:00.000Z"),
        votingDurationNs: new Decimal("86400000000000"), // 1 day in ns
      } as any;

      mockConvertNanoSecondsToMs.mockReturnValue(86400000);

      const result = getDerivedProposalStatus(proposal);

      expect(result).toBe("Created");
      // Function still calls convertNanoSecondsToMs at the beginning
      expect(mockConvertNanoSecondsToMs).toHaveBeenCalledWith("86400000000000");
    });
  });

  describe("when proposal is approved", () => {
    describe("with valid timing data", () => {
      it("should return 'Voting' when current time is before voting end", () => {
        const votingStartAt = new Date("2024-01-10T10:00:00.000Z");
        const votingDurationNs = new Decimal("86400000000000"); // 1 day in ns
        const votingDurationMs = 86400000; // 1 day in ms

        const proposal = {
          id: "1",
          isRejected: false,
          isApproved: true,
          votingStartAt: votingStartAt,
          votingDurationNs: votingDurationNs,
        } as any;

        mockConvertNanoSecondsToMs.mockReturnValue(votingDurationMs);

        // Set current time to be before voting end
        // Voting start: 2024-01-10T10:00:00.000Z
        // Voting end: 2024-01-11T10:00:00.000Z (start + 1 day)
        // Current time: 2024-01-10T15:00:00.000Z (5 hours after start)
        jest.setSystemTime(new Date("2024-01-10T15:00:00.000Z"));

        const result = getDerivedProposalStatus(proposal);

        expect(result).toBe("Voting");
        expect(mockConvertNanoSecondsToMs).toHaveBeenCalledWith(
          "86400000000000"
        );
      });

      it("should return 'Finished' when current time is after voting end", () => {
        const votingStartAt = new Date("2024-01-10T10:00:00.000Z");
        const votingDurationNs = new Decimal("86400000000000"); // 1 day in ns
        const votingDurationMs = 86400000; // 1 day in ms

        const proposal = {
          id: "1",
          isRejected: false,
          isApproved: true,
          votingStartAt: votingStartAt,
          votingDurationNs: votingDurationNs,
        } as any;

        mockConvertNanoSecondsToMs.mockReturnValue(votingDurationMs);

        // Set current time to be after voting end
        // Voting start: 2024-01-10T10:00:00.000Z
        // Voting end: 2024-01-11T10:00:00.000Z (start + 1 day)
        // Current time: 2024-01-12T10:00:00.000Z (1 day after end)
        jest.setSystemTime(new Date("2024-01-12T10:00:00.000Z"));

        const result = getDerivedProposalStatus(proposal);

        expect(result).toBe("Finished");
        expect(mockConvertNanoSecondsToMs).toHaveBeenCalledWith(
          "86400000000000"
        );
      });

      it("should return 'Finished' when current time is exactly at voting end", () => {
        const votingStartAt = new Date("2024-01-10T10:00:00.000Z");
        const votingDurationNs = new Decimal("86400000000000"); // 1 day in ns
        const votingDurationMs = 86400000; // 1 day in ms

        const proposal = {
          id: "1",
          isRejected: false,
          isApproved: true,
          votingStartAt: votingStartAt,
          votingDurationNs: votingDurationNs,
        } as any;

        mockConvertNanoSecondsToMs.mockReturnValue(votingDurationMs);

        // Set current time to be exactly at voting end
        // Voting start: 2024-01-10T10:00:00.000Z
        // Voting end: 2024-01-11T10:00:00.000Z (start + 1 day)
        // Current time: 2024-01-11T10:00:00.000Z (exactly at end)
        jest.setSystemTime(new Date("2024-01-11T10:00:00.000Z"));

        const result = getDerivedProposalStatus(proposal);

        expect(result).toBe("Finished");
        expect(mockConvertNanoSecondsToMs).toHaveBeenCalledWith(
          "86400000000000"
        );
      });
    });

    describe("with missing timing data", () => {
      it("should return 'Unknown' when voting_start_at is null", () => {
        const proposal = {
          id: "1",
          isRejected: false,
          isApproved: true,
          votingStartAt: null,
          votingDurationNs: new Decimal("86400000000000"),
        } as any;

        mockConvertNanoSecondsToMs.mockReturnValue(86400000);

        const result = getDerivedProposalStatus(proposal);

        expect(result).toBe("Unknown");
        // Should still call convertNanoSecondsToMs but won't use the result
        expect(mockConvertNanoSecondsToMs).toHaveBeenCalledWith(
          "86400000000000"
        );
      });

      it("should return 'Unknown' when voting_start_at is undefined", () => {
        const proposal = {
          id: "1",
          isRejected: false,
          isApproved: true,
          votingStartAt: undefined,
          votingDurationNs: new Decimal("86400000000000"),
        } as any;

        mockConvertNanoSecondsToMs.mockReturnValue(86400000);

        const result = getDerivedProposalStatus(proposal);

        expect(result).toBe("Unknown");
        expect(mockConvertNanoSecondsToMs).toHaveBeenCalledWith(
          "86400000000000"
        );
      });

      it("should return 'Unknown' when voting_duration_ns is null", () => {
        const proposal = {
          id: "1",
          isRejected: false,
          isApproved: true,
          votingStartAt: new Date("2024-01-10T10:00:00.000Z"),
          votingDurationNs: null,
        } as any;

        mockConvertNanoSecondsToMs.mockReturnValue(0);

        const result = getDerivedProposalStatus(proposal);

        expect(result).toBe("Unknown");
        // When voting_duration_ns is null, .toFixed() returns undefined
        expect(mockConvertNanoSecondsToMs).toHaveBeenCalledWith(undefined);
      });

      it("should return 'Unknown' when voting_duration_ns is undefined", () => {
        const proposal = {
          id: "1",
          isRejected: false,
          isApproved: true,
          votingStartAt: new Date("2024-01-10T10:00:00.000Z"),
          votingDurationNs: undefined,
        } as any;

        mockConvertNanoSecondsToMs.mockReturnValue(0);

        const result = getDerivedProposalStatus(proposal);

        expect(result).toBe("Unknown");
        expect(mockConvertNanoSecondsToMs).toHaveBeenCalledWith(undefined);
      });

      it("should return 'Unknown' when convertNanoSecondsToMs returns 0", () => {
        const proposal = {
          id: "1",
          isRejected: false,
          isApproved: true,
          votingStartAt: new Date("2024-01-10T10:00:00.000Z"),
          votingDurationNs: new Decimal("0"),
        } as any;

        mockConvertNanoSecondsToMs.mockReturnValue(0);

        const result = getDerivedProposalStatus(proposal);

        expect(result).toBe("Unknown");
        expect(mockConvertNanoSecondsToMs).toHaveBeenCalledWith("0");
      });
    });
  });
});
