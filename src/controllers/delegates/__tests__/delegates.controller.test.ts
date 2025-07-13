import request from "supertest";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";
import { Decimal } from "@prisma/client/runtime/client";
import { providers } from "near-api-js";

// Mock external dependencies
jest.mock("../../../lib/signature/verifySignature");
jest.mock("near-api-js");
jest.mock("../../../lib/utils/rpc");

import { verifySignature } from "../../../lib/signature/verifySignature";
import { getRpcUrl } from "../../../lib/utils/rpc";

const mockVerifySignature = verifySignature as jest.MockedFunction<
  typeof verifySignature
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
        },
      ];
      const mockCount = 100;

      prismaMock.$queryRaw.mockResolvedValue(mockDelegates);
      prismaMock.registeredVoters.count.mockResolvedValue(mockCount);

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
            email: "delegate1@example.com",
            warpcast: "delegate1",
            statement: "I am delegate 1",
            topIssues: [{ type: "governance", value: "Improve voting" }],
          },
          {
            address: "delegate2.near",
            votingPower: "500000000000000000000000",
            participationRate: "0.6",
            twitter: "@delegate2",
            discord: "delegate2#5678",
            email: "delegate2@example.com",
            warpcast: "delegate2",
            statement: "I am delegate 2",
            topIssues: [{ type: "technical", value: "Protocol upgrades" }],
          },
        ],
        count: mockCount,
      });

      expect(prismaMock.registeredVoters.count).toHaveBeenCalled();
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
          email: null,
          warpcast: null,
          statement: "I am delegate 3",
          topIssues: [],
        },
      ];
      const mockCount = 50;

      prismaMock.$queryRaw.mockResolvedValue(mockDelegates);
      prismaMock.registeredVoters.count.mockResolvedValue(mockCount);

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
            email: null,
            warpcast: null,
            statement: "I am delegate 3",
            topIssues: [],
          },
        ],
        count: mockCount,
      });

      // Assert that the SQL query contains the correct pagination arguments
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        5, // pageSize
        5 // offset
      );
    });

    it("should return delegates ordered by most voting power", async () => {
      // Arrange
      const mockDelegates: any[] = [];
      const mockCount = 0;

      prismaMock.$queryRaw.mockResolvedValue(mockDelegates);
      prismaMock.registeredVoters.count.mockResolvedValue(mockCount);

      // Act & Assert
      await request(app)
        .get("/api/delegates")
        .query({ order_by: "most_voting_power" })
        .expect(200)
        .expect("Content-Type", /json/);

      // Assert that the SQL query contains the correct ORDER BY clause for descending voting power
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
        expect.anything(), // First argument: main query template
        expect.objectContaining({
          strings: expect.arrayContaining([
            "ORDER BY rv.current_voting_power DESC NULLS LAST",
          ]),
        }),
        10, // pageSize
        0 // offset
      );
    });

    it("should return delegates ordered by least voting power", async () => {
      // Arrange
      const mockDelegates: any[] = [];
      const mockCount = 0;

      prismaMock.$queryRaw.mockResolvedValue(mockDelegates);
      prismaMock.registeredVoters.count.mockResolvedValue(mockCount);

      // Act & Assert
      await request(app)
        .get("/api/delegates")
        .query({ order_by: "least_voting_power" })
        .expect(200)
        .expect("Content-Type", /json/);

      // Assert that the SQL query contains the correct ORDER BY clause for ascending voting power
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          strings: expect.arrayContaining([
            "ORDER BY rv.current_voting_power ASC NULLS FIRST",
          ]),
        }),
        10,
        0
      );
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
        },
      ];
      const mockCount = 1;

      prismaMock.$queryRaw.mockResolvedValue(mockDelegates);
      prismaMock.registeredVoters.count.mockResolvedValue(mockCount);

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
        email: null,
        warpcast: null,
        statement: null,
        topIssues: null,
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
          email: "delegate1@example.com",
          warpcast: "delegate1",
          statement: "I am delegate 1",
          topIssues: [{ type: "governance", value: "Improve voting" }],
          votingPower: "1000000000000000000000000",
          forCount: mockForCount,
          againstCount: mockAgainstCount,
          abstainCount: mockAbstainCount,
          delegatedFromCount: mockDelegatedFromCount,
          participationRate: "0.75",
        },
      });
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
        },
        {
          voteOption: 0,
          votingPower: new Decimal("500000000000000000000000"),
          voterId: "delegate1.near",
          votedAt: new Date("2024-01-02"),
          proposalId: BigInt(2),
          proposalName: "Test Proposal 2",
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
          },
          {
            voteOption: "0",
            votingPower: "500000000000000000000000",
            address: "delegate1.near",
            votedAt: "2024-01-02T00:00:00.000Z",
            proposalId: "2",
            proposalName: "Test Proposal 2",
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
  });

  describe("POST /api/delegates/statement", () => {
    const validStatementData = {
      address: "delegate1.near",
      message: "Test message",
      signature: "test_signature",
      publicKey: "test_public_key",
      twitter: "@delegate1",
      discord: "delegate1#1234",
      email: "delegate1@example.com",
      warpcast: "delegate1",
      statement: "I am a delegate",
      topIssues: [{ type: "governance", value: "Improve voting" }],
      agreeCodeConduct: true,
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

      mockVerifySignature.mockReturnValue(true);
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

      expect(mockVerifySignature).toHaveBeenCalledWith({
        message: validStatementData.message,
        signature: validStatementData.signature,
        publicKey: validStatementData.publicKey,
      });

      expect(prismaMock.delegate_statements.upsert).toHaveBeenCalledWith({
        where: { address: validStatementData.address },
        update: expect.objectContaining({
          address: validStatementData.address,
          message: validStatementData.message,
          signature: validStatementData.signature,
          statement: validStatementData.statement,
          twitter: validStatementData.twitter,
          discord: validStatementData.discord,
          email: validStatementData.email,
          warpcast: validStatementData.warpcast,
          topIssues: validStatementData.topIssues,
          agreeCodeConduct: validStatementData.agreeCodeConduct,
          publicKey: validStatementData.publicKey,
        }),
        create: expect.objectContaining({
          address: validStatementData.address,
          message: validStatementData.message,
          signature: validStatementData.signature,
          statement: validStatementData.statement,
          twitter: validStatementData.twitter,
          discord: validStatementData.discord,
          email: validStatementData.email,
          warpcast: validStatementData.warpcast,
          topIssues: validStatementData.topIssues,
          agreeCodeConduct: validStatementData.agreeCodeConduct,
          publicKey: validStatementData.publicKey,
        }),
      });
    });

    it("should reject invalid signature", async () => {
      // Arrange
      mockVerifySignature.mockReturnValue(false);

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
      mockVerifySignature.mockReturnValue(true);
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
      mockVerifySignature.mockImplementation(() => {
        throw new Error("Signature verification failed");
      });

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
  });
});
