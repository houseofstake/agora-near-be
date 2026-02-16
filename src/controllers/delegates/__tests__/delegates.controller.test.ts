import request from "supertest";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";
import { Decimal } from "@prisma/client/runtime/client";
import { providers } from "near-api-js";

// Mock external dependencies
jest.mock("../../../lib/signature/verifySignature");
jest.mock("near-api-js");
jest.mock("../../../lib/utils/rpc");

import { verifySignedPayload } from "../../../lib/signature/verifySignature";
import { getRpcUrl } from "../../../lib/utils/rpc";

const mockVerifySignedPayload = verifySignedPayload as jest.MockedFunction<
  typeof verifySignedPayload
>;
const mockGetRpcUrl = getRpcUrl as jest.MockedFunction<typeof getRpcUrl>;
const mockProviders = providers as jest.Mocked<typeof providers>;

describe("DelegatesController", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation();

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("GET /api/delegates", () => {
    it("should return delegates with default pagination and default ordering", async () => {
      // Arrange
      const mockDelegates = [
        {
          registeredVoterId: "delegate1.near",
          currentVotingPower: new Decimal("1000000000000000000000000"),
          proposalParticipationRate: new Decimal("0.75"),
          address: "delegate1.near",
          twitter: "@delegate1",
          discord: "delegate1#1234",
          email: "delegate1@example.com",
          warpcast: "delegate1",
          statement: "I am delegate 1",
          topIssues: [{ type: "governance", value: "Improve voting" }],
          endorsed: false,
          notificationPreferences: {
            wants_proposal_created_email: "true",
            wants_proposal_ending_soon_email: "prompt",
            last_updated: "2024-01-01T00:00:00.000Z",
          },
        },
        {
          registeredVoterId: "delegate2.near",
          currentVotingPower: new Decimal("500000000000000000000000"),
          proposalParticipationRate: new Decimal("0.60"),
          address: "delegate2.near",
          twitter: "@delegate2",
          discord: "delegate2#5678",
          email: "delegate2@example.com",
          warpcast: "delegate2",
          statement: "I am delegate 2",
          topIssues: [{ type: "technical", value: "Protocol upgrades" }],
          endorsed: false,
          notificationPreferences: null,
        },
      ];
      const mockCount = 100;

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockDelegates)
        .mockResolvedValueOnce([{ count: BigInt(mockCount) }]);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        delegates: [
          {
            address: "delegate1.near",
            votingPower: "1000000000000000000000000",
            participationRate: "0.75",
            twitter: "@delegate1",
            discord: "delegate1#1234",
            warpcast: "delegate1",
            statement: "I am delegate 1",
            topIssues: [{ type: "governance", value: "Improve voting" }],
            endorsed: false,
            notificationPreferences: {
              wants_proposal_created_email: "true",
              wants_proposal_ending_soon_email: "prompt",
              last_updated: "2024-01-01T00:00:00.000Z",
            },
          },
          {
            address: "delegate2.near",
            votingPower: "500000000000000000000000",
            participationRate: "0.6",
            twitter: "@delegate2",
            discord: "delegate2#5678",
            warpcast: "delegate2",
            statement: "I am delegate 2",
            topIssues: [{ type: "technical", value: "Protocol upgrades" }],
            endorsed: false,
            notificationPreferences: null,
          },
        ],
        count: mockCount,
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it("should not return email addresses", async () => {
      // Arrange
      const mockDelegates = [
        {
          registeredVoterId: "delegate1.near",
          currentVotingPower: new Decimal("1000000000000000000000000"),
          proposalParticipationRate: new Decimal("0.75"),
          address: "delegate1.near",
          twitter: "@delegate1",
          discord: "delegate1#1234",
          email: "delegate1@example.com",
          warpcast: "delegate1",
          statement: "I am delegate 1",
          topIssues: [{ type: "governance", value: "Improve voting" }],
          endorsed: false,
          notificationPreferences: {
            wants_proposal_created_email: "true",
            wants_proposal_ending_soon_email: "prompt",
            last_updated: "2024-01-01T00:00:00.000Z",
          },
        },
        {
          registeredVoterId: "delegate2.near",
          currentVotingPower: new Decimal("500000000000000000000000"),
          proposalParticipationRate: new Decimal("0.60"),
          address: "delegate2.near",
          twitter: "@delegate2",
          discord: "delegate2#5678",
          email: "delegate2@example.com",
          warpcast: "delegate2",
          statement: "I am delegate 2",
          topIssues: [{ type: "technical", value: "Protocol upgrades" }],
          endorsed: false,
          notificationPreferences: null,
        },
      ];
      const mockCount = 100;

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockDelegates)
        .mockResolvedValueOnce([{ count: BigInt(mockCount) }]);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
      expect(response.body.delegates[0]).not.toHaveProperty("email");
      expect(response.body.delegates[1]).not.toHaveProperty("email");
    });

    it("should return delegates with custom pagination", async () => {
      // Arrange
      const mockDelegates = [
        {
          registeredVoterId: "delegate3.near",
          currentVotingPower: new Decimal("750000000000000000000000"),
          proposalParticipationRate: new Decimal("0.80"),
          address: "delegate3.near",
          twitter: "@delegate3",
          discord: null,
          warpcast: null,
          statement: "I am delegate 3",
          topIssues: [],
          endorsed: false,
        },
      ];
      const mockCount = 50;

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockDelegates)
        .mockResolvedValueOnce([{ count: BigInt(mockCount) }]);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates")
        .query({ page_size: "5", page: "2" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        delegates: [
          {
            address: "delegate3.near",
            votingPower: "750000000000000000000000",
            participationRate: "0.8",
            twitter: "@delegate3",
            discord: null,
            warpcast: null,
            statement: "I am delegate 3",
            topIssues: [],
            endorsed: false,
          },
        ],
        count: mockCount,
      });

      // Assert that the SQL query contains the correct pagination arguments
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining("LIMIT"),
            expect.stringContaining("OFFSET"),
          ]),
          values: expect.arrayContaining([5, 5]),
        })
      );
    });

    it("should return delegates ordered by most voting power", async () => {
      // Arrange
      const mockDelegates: any[] = [];
      const mockCount = 0;

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockDelegates)
        .mockResolvedValueOnce([{ count: BigInt(mockCount) }]);

      // Act & Assert
      await request(app)
        .get("/api/delegates")
        .query({ order_by: "most_voting_power" })
        .expect(200)
        .expect("Content-Type", /json/);

      // Assert that the SQL query contains the correct ORDER BY clause for descending voting power
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining(
              "ORDER BY rv.current_voting_power DESC NULLS LAST"
            ),
          ]),
          values: [10, 0],
        })
      );
    });

    it("should return delegates ordered by least voting power", async () => {
      // Arrange
      const mockDelegates: any[] = [];
      const mockCount = 0;

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockDelegates)
        .mockResolvedValueOnce([{ count: BigInt(mockCount) }]);

      // Act & Assert
      await request(app)
        .get("/api/delegates")
        .query({ order_by: "least_voting_power" })
        .expect(200)
        .expect("Content-Type", /json/);

      // Assert that the SQL query contains the correct ORDER BY clause for ascending voting power
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining(
              "ORDER BY rv.current_voting_power ASC NULLS FIRST"
            ),
          ]),
          values: [10, 0],
        })
      );
    });

    it("should return delegates filtered by endorsed", async () => {
      // Arrange
      const mockEndorsedDelegates = [
        {
          registeredVoterId: "endorsed1.near",
          currentVotingPower: new Decimal("2000000000000000000000000"),
          proposalParticipationRate: new Decimal("0.90"),
          address: "endorsed1.near",
          twitter: "@endorsed1",
          discord: "endorsed1#1111",
          email: "endorsed1@example.com",
          warpcast: "endorsed1",
          statement: "I am an endorsed delegate",
          topIssues: [{ type: "governance", value: "Governance improvements" }],
          endorsed: true,
        },
        {
          registeredVoterId: "endorsed2.near",
          currentVotingPower: new Decimal("1500000000000000000000000"),
          proposalParticipationRate: new Decimal("0.85"),
          address: "endorsed2.near",
          twitter: "@endorsed2",
          discord: "endorsed2#2222",
          email: "endorsed2@example.com",
          warpcast: "endorsed2",
          statement: "Another endorsed delegate",
          topIssues: [{ type: "technical", value: "Technical excellence" }],
          endorsed: true,
        },
      ];
      const mockCount = [{ count: BigInt(15) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockEndorsedDelegates)
        .mockResolvedValueOnce(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates")
        .query({ filter_by: "endorsed" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        delegates: [
          {
            address: "endorsed1.near",
            votingPower: "2000000000000000000000000",
            participationRate: "0.9",
            twitter: "@endorsed1",
            discord: "endorsed1#1111",
            warpcast: "endorsed1",
            statement: "I am an endorsed delegate",
            topIssues: [
              { type: "governance", value: "Governance improvements" },
            ],
            endorsed: true,
          },
          {
            address: "endorsed2.near",
            votingPower: "1500000000000000000000000",
            participationRate: "0.85",
            twitter: "@endorsed2",
            discord: "endorsed2#2222",
            warpcast: "endorsed2",
            statement: "Another endorsed delegate",
            topIssues: [{ type: "technical", value: "Technical excellence" }],
            endorsed: true,
          },
        ],
        count: 15,
      });

      // Verify the SQL query contains the endorsed filter
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining("WHERE ds.endorsed = true"),
          ]),
          values: expect.arrayContaining([10, 0]),
        })
      );

      // Verify the count query was called for endorsed delegates with Prisma.sql format
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining("SELECT COUNT(*) as count"),
            expect.stringContaining("WHERE ds.endorsed = true"),
          ]),
          values: [],
        })
      );
    });

    it("should return delegates filtered by single issue type", async () => {
      // Arrange
      const mockTechnicalDelegates = [
        {
          registeredVoterId: "tech1.near",
          currentVotingPower: new Decimal("1000000000000000000000000"),
          proposalParticipationRate: new Decimal("0.80"),
          address: "tech1.near",
          twitter: "@tech1",
          discord: "tech1#1111",
          email: "tech1@example.com",
          warpcast: "tech1",
          statement: "I focus on technical issues",
          topIssues: [{ type: "technical", value: "Protocol upgrades" }],
          endorsed: false,
        },
      ];
      const mockCount = [{ count: BigInt(5) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockTechnicalDelegates)
        .mockResolvedValueOnce(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates")
        .query({ issue_type: "technical" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        delegates: [
          {
            address: "tech1.near",
            votingPower: "1000000000000000000000000",
            participationRate: "0.8",
            twitter: "@tech1",
            discord: "tech1#1111",
            warpcast: "tech1",
            statement: "I focus on technical issues",
            topIssues: [{ type: "technical", value: "Protocol upgrades" }],
            endorsed: false,
          },
        ],
        count: 5,
      });

      // Verify the SQL query contains the issue type filter
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining("WHERE"),
            expect.stringContaining("EXISTS"),
            expect.stringContaining("jsonb_array_elements"),
            expect.stringContaining("issue->>'type' = ANY("),
          ]),
          values: expect.arrayContaining([["technical"], 10, 0]),
        })
      );
    });

    it("should return delegates filtered by multiple issue types", async () => {
      // Arrange
      const mockMultiDelegates = [
        {
          registeredVoterId: "multi1.near",
          currentVotingPower: new Decimal("800000000000000000000000"),
          proposalParticipationRate: new Decimal("0.85"),
          address: "multi1.near",
          twitter: "@multi1",
          discord: "multi1#1111",
          email: "multi1@example.com",
          warpcast: "multi1",
          statement: "I work on governance and technical issues",
          topIssues: [
            { type: "governance", value: "DAO improvements" },
            { type: "technical", value: "Security audits" },
          ],
          endorsed: false,
        },
      ];
      const mockCount = [{ count: BigInt(8) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockMultiDelegates)
        .mockResolvedValueOnce(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates")
        .query({ issue_type: "governance,technical" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        delegates: [
          {
            address: "multi1.near",
            votingPower: "800000000000000000000000",
            participationRate: "0.85",
            twitter: "@multi1",
            discord: "multi1#1111",
            warpcast: "multi1",
            statement: "I work on governance and technical issues",
            topIssues: [
              { type: "governance", value: "DAO improvements" },
              { type: "technical", value: "Security audits" },
            ],
            endorsed: false,
          },
        ],
        count: 8,
      });

      // Verify the SQL query contains the multiple issue types filter
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining("WHERE"),
            expect.stringContaining("EXISTS"),
            expect.stringContaining("jsonb_array_elements"),
            expect.stringContaining("issue->>'type' = ANY("),
          ]),
          values: expect.arrayContaining([["governance", "technical"], 10, 0]),
        })
      );
    });

    it("should return delegates filtered by both endorsed and issue type", async () => {
      // Arrange
      const mockFilteredDelegates = [
        {
          registeredVoterId: "endorsed-tech.near",
          currentVotingPower: new Decimal("1500000000000000000000000"),
          proposalParticipationRate: new Decimal("0.90"),
          address: "endorsed-tech.near",
          twitter: "@endorsed-tech",
          discord: "endorsed-tech#1111",
          email: "endorsed-tech@example.com",
          warpcast: "endorsed-tech",
          statement: "Endorsed technical expert",
          topIssues: [{ type: "technical", value: "Smart contract security" }],
          endorsed: true,
        },
      ];
      const mockCount = [{ count: BigInt(3) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockFilteredDelegates)
        .mockResolvedValueOnce(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates")
        .query({ filter_by: "endorsed", issue_type: "technical" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        delegates: [
          {
            address: "endorsed-tech.near",
            votingPower: "1500000000000000000000000",
            participationRate: "0.9",
            twitter: "@endorsed-tech",
            discord: "endorsed-tech#1111",
            warpcast: "endorsed-tech",
            statement: "Endorsed technical expert",
            topIssues: [
              { type: "technical", value: "Smart contract security" },
            ],
            endorsed: true,
          },
        ],
        count: 3,
      });

      // Verify the SQL query contains both filters with AND condition
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining("WHERE"),
            expect.stringContaining("ds.endorsed = true"),
            expect.stringContaining("AND"),
            expect.stringContaining("EXISTS"),
            expect.stringContaining("jsonb_array_elements"),
            expect.stringContaining("issue->>'type' = ANY("),
          ]),
          values: expect.arrayContaining([["technical"], 10, 0]),
        })
      );
    });

    it("should handle issue types with whitespace correctly", async () => {
      // Arrange
      const mockDelegates: any[] = [];
      const mockCount = [{ count: BigInt(0) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockDelegates)
        .mockResolvedValueOnce(mockCount);

      // Act & Assert
      await request(app)
        .get("/api/delegates")
        .query({ issue_type: " governance , technical , economic " })
        .expect(200)
        .expect("Content-Type", /json/);

      // Verify the issue types are trimmed correctly
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.arrayContaining([
            ["governance", "technical", "economic"],
            10,
            0,
          ]),
        })
      );
    });

    it("should return empty results when no delegates match issue type filter", async () => {
      // Arrange
      const mockDelegates: any[] = [];
      const mockCount = [{ count: BigInt(0) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockDelegates)
        .mockResolvedValueOnce(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates")
        .query({ issue_type: "nonexistent" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        delegates: [],
        count: 0,
      });
    });

    it("should handle null voting power and participation rate gracefully", async () => {
      // Arrange
      const mockDelegates = [
        {
          registeredVoterId: "delegate4.near",
          currentVotingPower: null,
          proposalParticipationRate: null,
          address: "delegate4.near",
          twitter: null,
          discord: null,
          email: null,
          warpcast: null,
          statement: null,
          topIssues: null,
          endorsed: null,
        },
      ];
      const mockCount = 1;

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockDelegates)
        .mockResolvedValueOnce([{ count: BigInt(mockCount) }]);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body.delegates[0]).toEqual({
        address: "delegate4.near",
        votingPower: undefined,
        participationRate: undefined,
        twitter: null,
        discord: null,
        warpcast: null,
        statement: null,
        topIssues: null,
        endorsed: null,
      });
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database connection failed";
      prismaMock.$queryRaw.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Internal Server Error",
      });
    });
  });

  describe("GET /api/delegates/:address", () => {
    it("should return delegate details for registered voter", async () => {
      // Arrange
      const mockVoterData = [
        {
          registeredVoterId: "delegate1.near",
          currentVotingPower: new Decimal("1000000000000000000000000"),
          proposalParticipationRate: new Decimal("0.75"),
          address: "delegate1.near",
          twitter: "@delegate1",
          discord: "delegate1#1234",
          email: "delegate1@example.com",
          warpcast: "delegate1",
          statement: "I am delegate 1",
          topIssues: [{ type: "governance", value: "Improve voting" }],
          message: "Test message",
          signature: "test_signature",
          publicKey: "test_public_key",
          agreeCodeConduct: true,
          endorsed: false,
          notificationPreferences: {
            wants_proposal_created_email: "true",
            wants_proposal_ending_soon_email: "false",
            last_updated: "2024-01-01T00:00:00.000Z",
          },
        },
      ];

      const mockForCount = 5;
      const mockAgainstCount = 3;
      const mockAbstainCount = 2;
      const mockDelegatedFromCount = 10;

      prismaMock.$queryRaw.mockResolvedValue(mockVoterData);
      prismaMock.proposalVotingHistory.count
        .mockResolvedValueOnce(mockForCount)
        .mockResolvedValueOnce(mockAgainstCount)
        .mockResolvedValueOnce(mockAbstainCount);
      prismaMock.delegationEvents.count.mockResolvedValue(
        mockDelegatedFromCount
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate1.near")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        delegate: {
          address: "delegate1.near",
          twitter: "@delegate1",
          discord: "delegate1#1234",
          warpcast: "delegate1",
          statement: "I am delegate 1",
          topIssues: [{ type: "governance", value: "Improve voting" }],
          endorsed: false,
          notificationPreferences: {
            wants_proposal_created_email: "true",
            wants_proposal_ending_soon_email: "false",
            last_updated: "2024-01-01T00:00:00.000Z",
          },
          votingPower: "1000000000000000000000000",
          forCount: mockForCount,
          againstCount: mockAgainstCount,
          abstainCount: mockAbstainCount,
          delegatedFromCount: mockDelegatedFromCount,
          participationRate: "0.75",
        },
      });
    });

    it("should not return email address", async () => {
      // Arrange
      const mockVoterData = [
        {
          registeredVoterId: "delegate1.near",
          currentVotingPower: new Decimal("1000000000000000000000000"),
          proposalParticipationRate: new Decimal("0.75"),
          address: "delegate1.near",
          twitter: "@delegate1",
          discord: "delegate1#1234",
          email: "delegate1@example.com",
          warpcast: "delegate1",
          statement: "I am delegate 1",
          topIssues: [{ type: "governance", value: "Improve voting" }],
          message: "Test message",
          signature: "test_signature",
          publicKey: "test_public_key",
          agreeCodeConduct: true,
          endorsed: false,
          notificationPreferences: {
            wants_proposal_created_email: "true",
            wants_proposal_ending_soon_email: "false",
            last_updated: "2024-01-01T00:00:00.000Z",
          },
        },
      ];

      const mockForCount = 5;
      const mockAgainstCount = 3;
      const mockAbstainCount = 2;
      const mockDelegatedFromCount = 10;

      prismaMock.$queryRaw.mockResolvedValue(mockVoterData);
      prismaMock.proposalVotingHistory.count
        .mockResolvedValueOnce(mockForCount)
        .mockResolvedValueOnce(mockAgainstCount)
        .mockResolvedValueOnce(mockAbstainCount);
      prismaMock.delegationEvents.count.mockResolvedValue(
        mockDelegatedFromCount
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate1.near")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(response.body.delegate).not.toHaveProperty("email");
    });

    it("should return delegate with just address for valid NEAR account not in registered voters", async () => {
      // Arrange
      prismaMock.$queryRaw.mockResolvedValue([]);
      mockGetRpcUrl.mockReturnValue("https://rpc.testnet.near.org");

      const mockProvider = {
        query: jest.fn().mockResolvedValue({ account_id: "validaccount.near" }),
      };

      mockProviders.JsonRpcProvider.mockImplementation(
        () => mockProvider as any
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/validaccount.near")
        .query({ networkId: "testnet" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(mockGetRpcUrl).toHaveBeenCalled();
      expect(mockProvider.query).toHaveBeenCalledWith({
        request_type: "view_account",
        account_id: "validaccount.near",
        finality: "final",
      });

      expect(response.body).toEqual({
        delegate: {
          address: "validaccount.near",
        },
      });
    });

    it("should return 404 for invalid NEAR account", async () => {
      // Arrange
      prismaMock.$queryRaw.mockResolvedValue([]);
      mockGetRpcUrl.mockReturnValue("https://rpc.testnet.near.org");

      const mockProvider = {
        query: jest.fn().mockRejectedValue(new Error("Account not found")),
      };
      mockProviders.JsonRpcProvider.mockImplementation(
        () => mockProvider as any
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/invalidaccount.near")
        .query({ networkId: "testnet" })
        .expect(404)
        .expect("Content-Type", /json/);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(mockGetRpcUrl).toHaveBeenCalled();
      expect(mockProvider.query).toHaveBeenCalledWith({
        request_type: "view_account",
        account_id: "invalidaccount.near",
        finality: "final",
      });

      expect(response.body).toEqual({
        message:
          "Address not found in registered voters and is not a valid NEAR account",
      });
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database timeout";
      prismaMock.$queryRaw.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate1.near")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch delegate",
      });
    });
  });

  describe("GET /api/delegates/:address/voting-history", () => {
    it("should return delegate voting history with default pagination", async () => {
      // Arrange
      const mockVotingHistory = [
        {
          voteOption: 1,
          votingPower: new Decimal("1000000000000000000000000"),
          voterId: "delegate1.near",
          votedAt: new Date("2024-01-01"),
          proposalId: BigInt(1),
          proposalName: "Test Proposal 1",
          memo: "I support this proposal",
        },
        {
          voteOption: 0,
          votingPower: new Decimal("500000000000000000000000"),
          voterId: "delegate1.near",
          votedAt: new Date("2024-01-02"),
          proposalId: BigInt(2),
          proposalName: "Test Proposal 2",
          memo: null,
        },
      ];
      const mockCount = 25;

      prismaMock.proposalVotingHistory.findMany.mockResolvedValue(
        mockVotingHistory
      );
      prismaMock.proposalVotingHistory.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate1.near/voting-history")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        votes: [
          {
            voteOption: "1",
            votingPower: "1000000000000000000000000",
            address: "delegate1.near",
            votedAt: "2024-01-01T00:00:00.000Z",
            proposalId: "1",
            proposalName: "Test Proposal 1",
            memo: "I support this proposal",
          },
          {
            voteOption: "0",
            votingPower: "500000000000000000000000",
            address: "delegate1.near",
            votedAt: "2024-01-02T00:00:00.000Z",
            proposalId: "2",
            proposalName: "Test Proposal 2",
            memo: null,
          },
        ],
        count: mockCount,
      });

      expect(prismaMock.proposalVotingHistory.findMany).toHaveBeenCalledWith({
        where: { voterId: "delegate1.near" },
        skip: 0,
        take: 10,
        orderBy: {
          votedDate: "desc",
        },
      });
    });

    it("should return delegate voting history with custom pagination", async () => {
      // Arrange
      const mockVotingHistory = [
        {
          voteOption: 2,
          votingPower: new Decimal("750000000000000000000000"),
          voterId: "delegate2.near",
          votedAt: new Date("2024-01-03"),
          proposalId: BigInt(3),
          proposalName: "Test Proposal 3",
          memo: null,
        },
      ];
      const mockCount = 12;

      prismaMock.proposalVotingHistory.findMany.mockResolvedValue(
        mockVotingHistory
      );
      prismaMock.proposalVotingHistory.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate2.near/voting-history")
        .query({ page_size: "5", page: "3" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        votes: [
          {
            voteOption: "2",
            votingPower: "750000000000000000000000",
            address: "delegate2.near",
            votedAt: "2024-01-03T00:00:00.000Z",
            proposalId: "3",
            proposalName: "Test Proposal 3",
            memo: null,
          },
        ],
        count: mockCount,
      });

      expect(prismaMock.proposalVotingHistory.findMany).toHaveBeenCalledWith({
        where: { voterId: "delegate2.near" },
        skip: 10,
        take: 5,
        orderBy: {
          votedDate: "desc",
        },
      });
    });

    it("should handle null voting power gracefully", async () => {
      // Arrange
      const mockVotingHistory = [
        {
          voteOption: 1,
          votingPower: null,
          voterId: "delegate3.near",
          votedAt: new Date("2024-01-01"),
          proposalId: BigInt(1),
          proposalName: "Test Proposal 1",
          memo: null,
        },
      ];
      const mockCount = 1;

      prismaMock.proposalVotingHistory.findMany.mockResolvedValue(
        mockVotingHistory
      );
      prismaMock.proposalVotingHistory.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate3.near/voting-history")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body.votes[0].votingPower).toBe("0");
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database connection failed";
      prismaMock.proposalVotingHistory.findMany.mockRejectedValue(
        new Error(errorMessage)
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate1.near/voting-history")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch delegate voting history",
      });
    });
  });

  describe("GET /api/delegates/:address/delegated-from", () => {
    it("should return delegate delegated from events with default pagination", async () => {
      // Arrange
      const mockDelegationEvents = [
        {
          id: 1,
          delegatorId: "delegator1.near",
          delegateeId: "delegate1.near",
          isLatestDelegatorEvent: true,
          delegateEvent: "ft_mint",
          eventTimestamp: "2024-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          delegatorId: "delegator2.near",
          delegateeId: "delegate1.near",
          isLatestDelegatorEvent: true,
          delegateEvent: "ft_mint",
          eventTimestamp: "2024-01-02T00:00:00.000Z",
        },
      ];
      const mockCount = 15;

      prismaMock.delegationEvents.findMany.mockResolvedValue(
        mockDelegationEvents
      );
      prismaMock.delegationEvents.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate1.near/delegated-from")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        events: mockDelegationEvents,
        count: mockCount,
      });

      expect(prismaMock.delegationEvents.findMany).toHaveBeenCalledWith({
        where: {
          delegateeId: "delegate1.near",
          isLatestDelegatorEvent: true,
          delegateEvent: "ft_mint",
        },
        skip: 0,
        take: 10,
        orderBy: {
          eventTimestamp: "desc",
        },
      });
    });

    it("should return delegate delegated from events with custom pagination", async () => {
      // Arrange
      const mockDelegationEvents = [
        {
          id: 3,
          delegatorId: "delegator3.near",
          delegateeId: "delegate2.near",
          isLatestDelegatorEvent: true,
          delegateEvent: "ft_mint",
          eventTimestamp: "2024-01-03T00:00:00.000Z",
        },
      ];
      const mockCount = 8;

      prismaMock.delegationEvents.findMany.mockResolvedValue(
        mockDelegationEvents
      );
      prismaMock.delegationEvents.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate2.near/delegated-from")
        .query({ page_size: "20", page: "2" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        events: mockDelegationEvents,
        count: mockCount,
      });

      expect(prismaMock.delegationEvents.findMany).toHaveBeenCalledWith({
        where: {
          delegateeId: "delegate2.near",
          isLatestDelegatorEvent: true,
          delegateEvent: "ft_mint",
        },
        skip: 20,
        take: 20,
        orderBy: {
          eventTimestamp: "desc",
        },
      });
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database timeout";
      prismaMock.delegationEvents.findMany.mockRejectedValue(
        new Error(errorMessage)
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate1.near/delegated-from")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch delegate delegated from events",
      });
    });
  });

  describe("GET /api/delegates/:address/delegated-to", () => {
    it("should return delegate delegated to events with default pagination", async () => {
      // Arrange
      const mockDelegationEvents = [
        {
          id: 1,
          delegatorId: "delegator1.near",
          delegateeId: "delegate1.near",
          isLatestDelegatorEvent: true,
          delegateMethod: "delegate_all",
          delegateEvent: "ft_mint",
          eventTimestamp: "2024-01-01T00:00:00.000Z",
        },
      ];
      const mockCount = 5;

      prismaMock.delegationEvents.findMany.mockResolvedValue(
        mockDelegationEvents
      );
      prismaMock.delegationEvents.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegator1.near/delegated-to")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        events: mockDelegationEvents,
        count: mockCount,
      });

      expect(prismaMock.delegationEvents.findMany).toHaveBeenCalledWith({
        where: {
          delegatorId: "delegator1.near",
          isLatestDelegatorEvent: true,
          delegateMethod: "delegate_all",
          delegateEvent: "ft_mint",
        },
        skip: 0,
        take: 10,
        orderBy: {
          eventTimestamp: "desc",
        },
      });
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database connection lost";
      prismaMock.delegationEvents.findMany.mockRejectedValue(
        new Error(errorMessage)
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegator1.near/delegated-to")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch delegate delegated to events",
      });
    });
  });

  describe("GET /api/delegates/:address/hos-activity", () => {
    it("should return delegate HOS activity with default pagination", async () => {
      // Arrange
      const mockUserActivities = [
        {
          receiptId: "receipt1",
          blockHeight: BigInt(12345),
          eventDate: new Date("2024-01-01"),
          nearAmount: new Decimal("1000000000000000000000000"),
          lockedNearBalance: new Decimal("5000000000000000000000000"),
          methodName: "on_lockup_update",
          eventType: "on_lockup_update_ft_mint",
        },
        {
          receiptId: "receipt2",
          blockHeight: BigInt(12346),
          eventDate: new Date("2024-01-02"),
          nearAmount: new Decimal("500000000000000000000000"),
          lockedNearBalance: new Decimal("4500000000000000000000000"),
          methodName: "on_lockup_update",
          eventType: "on_lockup_update_ft_burn",
        },
      ];
      const mockCount = 20;

      prismaMock.userActivities.findMany.mockResolvedValue(mockUserActivities);
      prismaMock.userActivities.count.mockResolvedValue(mockCount);

      mockGetRpcUrl.mockReturnValue("https://rpc.testnet.near.org");
      const mockProvider = {
        query: jest.fn().mockResolvedValue({
          result: Buffer.from(
            JSON.stringify({ local_deposit: "1000000000000000000000000" })
          ),
        }),
      };
      mockProviders.JsonRpcProvider.mockImplementation(
        () => mockProvider as any
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate1.near/hos-activity")
        .query({ network_id: "testnet", contract_id: "vote.testnet" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        hosActivity: [
          {
            receiptId: "receipt1",
            blockHeight: "12345",
            eventDate: "2024-01-01T00:00:00.000Z",
            nearAmount: "1000000000000000000000000",
            lockedNearBalance: "6000000000000000000000000",
            transactionType: "lock",
          },
          {
            receiptId: "receipt2",
            blockHeight: "12346",
            eventDate: "2024-01-02T00:00:00.000Z",
            nearAmount: "500000000000000000000000",
            lockedNearBalance: "5500000000000000000000000",
            transactionType: "unlock",
          },
        ],
        count: mockCount,
      });

      expect(prismaMock.userActivities.findMany).toHaveBeenCalledWith({
        where: {
          accountId: "delegate1.near",
          OR: [
            {
              methodName: "on_lockup_update",
              eventType: "on_lockup_update_ft_burn",
            },
            {
              methodName: "on_lockup_update",
              eventType: "on_lockup_update_ft_mint",
            },
            {
              methodName: "delegate_all",
              eventType: "delegate_all_ft_burn",
            },
            {
              methodName: "on_lockup_deployed",
              eventType: "lockup_deployed",
            },
            {
              methodName: "delegate_all",
              eventType: "delegate_all_ft_mint",
            },
            {
              methodName: "withdraw_from_staking_pool",
            },
            {
              methodName: "withdraw_all_from_staking_pool",
            },
            {
              methodName: "unstake",
            },
            {
              methodName: "unstake_all",
            },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: {
          eventTimestamp: "desc",
        },
      });
    });

    it("should handle initial_registration transaction type correctly", async () => {
      // Arrange
      const mockUserActivities = [
        {
          receiptId: "receipt3",
          blockHeight: BigInt(12347),
          eventDate: new Date("2024-01-03"),
          nearAmount: new Decimal("2000000000000000000000000"),
          lockedNearBalance: new Decimal("2000000000000000000000000"),
          methodName: "on_lockup_deployed",
          eventType: "lockup_deployed",
        },
      ];
      const mockCount = 1;

      prismaMock.userActivities.findMany.mockResolvedValue(mockUserActivities);
      prismaMock.userActivities.count.mockResolvedValue(mockCount);

      mockGetRpcUrl.mockReturnValue("https://rpc.testnet.near.org");
      const mockProvider = {
        query: jest.fn().mockResolvedValue({
          result: Buffer.from(
            JSON.stringify({ local_deposit: "1000000000000000000000000" })
          ),
        }),
      };
      mockProviders.JsonRpcProvider.mockImplementation(
        () => mockProvider as any
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate1.near/hos-activity")
        .query({ network_id: "testnet", contract_id: "vote.testnet" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body.hosActivity[0]).toMatchObject({
        receiptId: "receipt3",
        blockHeight: "12347",
        eventDate: "2024-01-03T00:00:00.000Z",
        nearAmount: "1000000000000000000000000", // Should be storage deposit
        lockedNearBalance: "1000000000000000000000000", // Should be storage deposit
        transactionType: "initial_registration",
      });
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database error";
      prismaMock.userActivities.findMany.mockRejectedValue(
        new Error(errorMessage)
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate1.near/hos-activity")
        .query({ network_id: "testnet", contract_id: "vote.testnet" })
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch delegate HOS activity",
      });
    });

    it("should handle RPC error gracefully", async () => {
      // Arrange
      mockGetRpcUrl.mockReturnValue("https://rpc.testnet.near.org");
      const mockProvider = {
        query: jest.fn().mockRejectedValue(new Error("RPC error")),
      };
      mockProviders.JsonRpcProvider.mockImplementation(
        () => mockProvider as any
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate1.near/hos-activity")
        .query({ network_id: "testnet", contract_id: "vote.testnet" })
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch delegate HOS activity",
      });
    });
    it("should handle unstake_all and withdraw_all transaction types correctly", async () => {
      // Arrange
      const mockUserActivities = [
        {
          receiptId: "receipt4",
          blockHeight: BigInt(12348),
          eventDate: new Date("2024-01-04"),
          nearAmount: new Decimal("3000000000000000000000000"),
          lockedNearBalance: new Decimal("3000000000000000000000000"),
          methodName: "withdraw_all_from_staking_pool",
          eventType: "withdraw_from_staking_pool",
        },
        {
          receiptId: "receipt5",
          blockHeight: BigInt(12349),
          eventDate: new Date("2024-01-05"),
          nearAmount: new Decimal("4000000000000000000000000"),
          lockedNearBalance: new Decimal("4000000000000000000000000"),
          methodName: "unstake_all",
          eventType: "unstake",
        },
      ];
      const mockCount = 2;

      prismaMock.userActivities.findMany.mockResolvedValue(mockUserActivities);
      prismaMock.userActivities.count.mockResolvedValue(mockCount);

      mockGetRpcUrl.mockReturnValue("https://rpc.testnet.near.org");
      const mockProvider = {
        query: jest.fn().mockResolvedValue({
          result: Buffer.from(
            JSON.stringify({ local_deposit: "1000000000000000000000000" })
          ),
        }),
      };
      mockProviders.JsonRpcProvider.mockImplementation(
        () => mockProvider as any
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/delegates/delegate1.near/hos-activity")
        .query({ network_id: "testnet", contract_id: "vote.testnet" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body.hosActivity).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            receiptId: "receipt4",
            transactionType: "staking_pool_withdraw",
          }),
          expect.objectContaining({
            receiptId: "receipt5",
            transactionType: "unstake",
          }),
        ])
      );
    });
  });

  describe("POST /api/delegates/statement", () => {
    const validStatementData = {
      message: "Test message",
      signature: "test_signature",
      publicKey: "test_public_key",
      data: {
        address: "delegate1.near",
        twitter: "@delegate1",
        discord: "delegate1#1234",
        email: "delegate1@example.com",
        warpcast: "delegate1",
        statement: "I am a delegate",
        topIssues: [{ type: "governance", value: "Improve voting" }],
        agreeCodeConduct: true,
      },
    };

    it("should create delegate statement successfully", async () => {
      // Arrange
      const mockCreatedStatement = {
        id: 1,
        ...validStatementData,
        statement: "I am a delegate", // Sanitized
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      mockVerifySignedPayload.mockResolvedValue(true);
      prismaMock.delegate_statements.upsert.mockResolvedValue(
        mockCreatedStatement
      );

      // Act & Assert
      const response = await request(app)
        .post("/api/delegates/statement")
        .send(validStatementData)
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        delegateStatement: mockCreatedStatement,
        success: true,
      });

      expect(mockVerifySignedPayload).toHaveBeenCalledWith({
        signedPayload: {
          signature: validStatementData.signature,
          publicKey: validStatementData.publicKey,
          message: validStatementData.message,
          data: validStatementData.data,
        },
        networkId: "mainnet",
        accountId: validStatementData.data.address,
      });

      expect(prismaMock.delegate_statements.upsert).toHaveBeenCalledWith({
        where: { address: validStatementData.data.address },
        update: expect.objectContaining({
          address: validStatementData.data.address,
          message: validStatementData.message,
          signature: validStatementData.signature,
          statement: validStatementData.data.statement,
          twitter: validStatementData.data.twitter,
          discord: validStatementData.data.discord,
          email: validStatementData.data.email,
          warpcast: validStatementData.data.warpcast,
          topIssues: validStatementData.data.topIssues,
          agreeCodeConduct: validStatementData.data.agreeCodeConduct,
          publicKey: validStatementData.publicKey,
        }),
        create: expect.objectContaining({
          address: validStatementData.data.address,
          message: validStatementData.message,
          signature: validStatementData.signature,
          statement: validStatementData.data.statement,
          twitter: validStatementData.data.twitter,
          discord: validStatementData.data.discord,
          email: validStatementData.data.email,
          warpcast: validStatementData.data.warpcast,
          topIssues: validStatementData.data.topIssues,
          agreeCodeConduct: validStatementData.data.agreeCodeConduct,
          publicKey: validStatementData.publicKey,
        }),
      });
    });

    it("should reject invalid signature", async () => {
      // Arrange
      mockVerifySignedPayload.mockResolvedValue(false);

      // Act & Assert
      const response = await request(app)
        .post("/api/delegates/statement")
        .send(validStatementData)
        .expect(400)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Invalid signature",
      });

      expect(prismaMock.delegate_statements.upsert).not.toHaveBeenCalled();
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database constraint violation";
      mockVerifySignedPayload.mockResolvedValue(true);
      prismaMock.delegate_statements.upsert.mockRejectedValue(
        new Error(errorMessage)
      );

      // Act & Assert
      const response = await request(app)
        .post("/api/delegates/statement")
        .send(validStatementData)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to create delegate statement",
      });
    });

    it("should handle signature verification throwing error", async () => {
      // Arrange
      mockVerifySignedPayload.mockRejectedValue(
        new Error("Signature verification failed")
      );

      // Act & Assert
      const response = await request(app)
        .post("/api/delegates/statement")
        .send(validStatementData)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to create delegate statement",
      });
    });

    it("should create delegate statement with notification preferences", async () => {
      // Arrange
      const statementDataWithNotifications = {
        ...validStatementData,
        data: {
          ...validStatementData.data,
          notification_preferences: {
            wants_proposal_created_email: "true",
            wants_proposal_ending_soon_email: "false",
          },
        },
      };

      const mockCreatedStatement = {
        id: 1,
        ...statementDataWithNotifications,
        statement: "I am a delegate",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      mockVerifySignedPayload.mockResolvedValue(true);
      prismaMock.delegate_statements.findUnique.mockResolvedValue(null);
      prismaMock.delegate_statements.upsert.mockResolvedValue(
        mockCreatedStatement
      );

      // Act & Assert
      const response = await request(app)
        .post("/api/delegates/statement")
        .send(statementDataWithNotifications)
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        delegateStatement: mockCreatedStatement,
        success: true,
      });

      expect(prismaMock.delegate_statements.upsert).toHaveBeenCalledWith({
        where: { address: statementDataWithNotifications.data.address },
        update: expect.objectContaining({
          notification_preferences: expect.objectContaining({
            wants_proposal_created_email: "true",
            wants_proposal_ending_soon_email: "false",
            last_updated: expect.any(String),
          }),
        }),
        create: expect.objectContaining({
          notification_preferences: expect.objectContaining({
            wants_proposal_created_email: "true",
            wants_proposal_ending_soon_email: "false",
            last_updated: expect.any(String),
          }),
        }),
      });
    });

    it("should reject invalid notification preferences", async () => {
      // Arrange
      const statementDataWithInvalidNotifications = {
        ...validStatementData,
        data: {
          ...validStatementData.data,
          notification_preferences: {
            wants_proposal_created_email: "invalid_value",
          },
        },
      };

      mockVerifySignedPayload.mockResolvedValue(true);

      // Act & Assert
      const response = await request(app)
        .post("/api/delegates/statement")
        .send(statementDataWithInvalidNotifications)
        .expect(400)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: `Invalid notification preference values. Must be 'true', 'false', or 'prompt'`,
      });

      expect(prismaMock.delegate_statements.upsert).not.toHaveBeenCalled();
    });
  });
});
