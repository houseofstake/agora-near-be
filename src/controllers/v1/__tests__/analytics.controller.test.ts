import request from "supertest";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";

describe("AnalyticsController", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("GET /api/v1/analytics/global", () => {
    it("should aggregate and normalize global analytics data correctly", async () => {
      const mockDelegateQuery = [
        { isEndorsed: true, totalVotingPower: BigInt(500) },
        { isEndorsed: false, totalVotingPower: BigInt(1000) }
      ];
      const mockActivelyDelegatingVpStats = [
        { uniqueAddresses: BigInt(40), totalVotingPower: BigInt(1500) }
      ];
      const mockNonDelegatingVpStats = [
        { uniqueAddresses: BigInt(60), totalVotingPower: BigInt(2000) }
      ];
      // Global Voting Activity Representation
      const mockVotingActivityQuery = [
        { isEndorsed: false, activeVoters: BigInt(50), uniqueParticipatingVP: BigInt(100) }
      ];
      // 4) Multi-delegator relational mapping (historicallySwitched)
      const mockDelegatorSwitches = [{ historicallySwitched: BigInt(5) }];
      // 5) Multi-delegator relational mapping (receivers)
      const mockDelegateReceiversQuery = [
        { isEndorsed: false, delegatesWithMultiple: BigInt(3) }
      ];
      // 6) Turnout Trend per Proposal
      const mockTurnoutTrendQuery = [
        { proposalId: 1, uniqueVoters: BigInt(100), totalTurnoutVp: BigInt(4000) }
      ];
      // 7) Voter Engagement Tiers
      const mockVoterEngagementQuery = [
        {
          activeVp: BigInt(1000), occasionalVp: BigInt(500), sleepingVp: BigInt(200),
          activeVoters: BigInt(10), occasionalVoters: BigInt(20), sleepingVoters: BigInt(30)
        }
      ];
      prismaMock.$queryRawUnsafe
        .mockResolvedValueOnce(mockDelegateQuery)
        .mockResolvedValueOnce(mockActivelyDelegatingVpStats)
        .mockResolvedValueOnce(mockNonDelegatingVpStats)
        .mockResolvedValueOnce(mockVotingActivityQuery)
        .mockResolvedValueOnce(mockDelegatorSwitches)
        .mockResolvedValueOnce(mockDelegateReceiversQuery)
        .mockResolvedValueOnce(mockTurnoutTrendQuery)
        .mockResolvedValueOnce(mockVoterEngagementQuery);

      const response = await request(app)
        .get("/api/v1/analytics/global")
        .expect(200)
        .expect("Content-Type", /json/);

      // Verify strings instead of bigint (normalizeBigInt logic)
      expect(response.body).toEqual({
        delegationDistribution: [
          { isEndorsed: true, totalVotingPower: "500" },
          { isEndorsed: false, totalVotingPower: "1000" }
        ],
        delegationStatusBreakdown: [
          { isActivelyDelegating: true, uniqueAddresses: "40", totalVotingPower: "1500" },
          { isActivelyDelegating: false, uniqueAddresses: "60", totalVotingPower: "2000" }
        ],
        votingActivity: [
          { isEndorsed: false, activeVoters: "50", uniqueParticipatingVP: "100" }
        ],
        relationships: {
          historicallySwitched: "5",
          receivers: [
            { isEndorsed: false, delegatesWithMultiple: "3" }
          ]
        },
        governanceHealth: {
          turnoutTrend: [
            { proposalId: 1, uniqueVoters: "100", totalTurnoutVp: "4000" }
          ],
          voterEngagement: {
            activeVp: "1000", occasionalVp: "500", sleepingVp: "200",
            activeVoters: "10", occasionalVoters: "20", sleepingVoters: "30"
          }
        }
      });
      
      expect(prismaMock.$queryRawUnsafe).toHaveBeenCalledTimes(8);
    });

    it("should handle error paths robustly", async () => {
      prismaMock.$queryRawUnsafe.mockRejectedValue(new Error("Database disconnected"));

      const response = await request(app)
        .get("/api/v1/analytics/global")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({ error: "Failed to fetch global analytics" });
    });
  });

  describe("GET /api/v1/analytics/proposal/:proposalId", () => {
    it("should process and return proposal specific analytics correctly", async () => {
      const parsedProposalId = 42;
      const mockProposalVotesQuery = [
        { isEndorsed: true, activeVoters: BigInt(10), participatingVP: BigInt(500), voteOption: "Approve" },
        { isEndorsed: false, activeVoters: BigInt(20), participatingVP: BigInt(100), voteOption: "Reject" }
      ];

      prismaMock.$queryRawUnsafe.mockResolvedValueOnce(mockProposalVotesQuery);

      const response = await request(app)
        .get(`/api/v1/analytics/proposal/${parsedProposalId}`)
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        proposalId: parsedProposalId,
        votesDistribution: [
          { isEndorsed: true, activeVoters: "10", participatingVP: "500", voteOption: "Approve" },
          { isEndorsed: false, activeVoters: "20", participatingVP: "100", voteOption: "Reject" }
        ]
      });

      expect(prismaMock.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("SELECT"),
        parsedProposalId
      );
    });

    it("should validate missing or malformed proposal parameters", async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/proposal/not_a_number`)
        .expect(400)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({ error: "Invalid proposalId format." });
    });

    it("should handle query failures on specific proposals", async () => {
      prismaMock.$queryRawUnsafe.mockRejectedValue(new Error("Timeout evaluating history"));

      const response = await request(app)
        .get("/api/v1/analytics/proposal/12")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({ error: "Failed to fetch proposal analytics" });
    });
  });
});
