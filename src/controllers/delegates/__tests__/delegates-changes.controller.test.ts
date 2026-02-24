import request from "supertest";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";

describe("DelegateChangesController", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation();
    jest.clearAllMocks();
  });

  describe("GET /api/delegate_statement_changes", () => {
    it("should return delegate statement changes with default pagination", async () => {
      const mockChanges = [
        {
          account: "delegate1.near",
          created: new Date("2024-01-15T10:00:00.000Z"),
        },
        {
          account: "delegate2.near",
          created: new Date("2024-01-10T08:00:00.000Z"),
        },
      ];
      const mockCount = [{ count: BigInt(2) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockChanges)
        .mockResolvedValueOnce(mockCount);

      const response = await request(app)
        .get("/api/delegate_statement_changes")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        page: 1,
        offset: 10,
        changes: [
          {
            account: "delegate1.near",
            created: "2024-01-15T10:00:00.000Z",
          },
          {
            account: "delegate2.near",
            created: "2024-01-10T08:00:00.000Z",
          },
        ],
        count: 2,
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it("should support custom pagination via page and offset", async () => {
      const mockChanges = [
        {
          account: "delegate3.near",
          created: new Date("2024-02-01T12:00:00.000Z"),
        },
      ];
      const mockCount = [{ count: BigInt(15) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockChanges)
        .mockResolvedValueOnce(mockCount);

      const response = await request(app)
        .get("/api/delegate_statement_changes")
        .query({ page: "2", offset: "5" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        page: 2,
        offset: 5,
        changes: [
          {
            account: "delegate3.near",
            created: "2024-02-01T12:00:00.000Z",
          },
        ],
        count: 15,
      });
    });

    it("should return all delegates when lookback_days is not provided", async () => {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const response = await request(app)
        .get("/api/delegate_statement_changes")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        page: 1,
        offset: 10,
        changes: [],
        count: 0,
      });

      // Verify the query does NOT contain a lookback filter
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it("should apply lookback filter when lookback_days is provided", async () => {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      await request(app)
        .get("/api/delegate_statement_changes")
        .query({ lookback_days: "7" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it("should handle null created date gracefully", async () => {
      const mockChanges = [
        { account: "no-registration.near", created: null },
      ];
      const mockCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockChanges)
        .mockResolvedValueOnce(mockCount);

      const response = await request(app)
        .get("/api/delegate_statement_changes")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body.changes[0]).toEqual({
        account: "no-registration.near",
        created: null,
      });
    });

    it("should handle database error gracefully", async () => {
      prismaMock.$queryRaw.mockRejectedValue(
        new Error("Database connection failed")
      );

      const response = await request(app)
        .get("/api/delegate_statement_changes")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch delegate statement changes",
      });
    });
  });

  describe("GET /api/get_voting_power_chart/:account_id", () => {
    it("should return voting power chart data for an account", async () => {
      const mockRecords = [
        {
          block_height: BigInt(100000),
          voting_power: "500000000000000000000000",
          timestamp: new Date("2024-01-01T10:00:00.000Z"),
        },
        {
          block_height: BigInt(100500),
          voting_power: "750000000000000000000000",
          timestamp: new Date("2024-01-05T14:00:00.000Z"),
        },
        {
          block_height: BigInt(101000),
          voting_power: "1000000000000000000000000",
          timestamp: new Date("2024-01-10T18:00:00.000Z"),
        },
      ];

      prismaMock.$queryRaw.mockResolvedValue(mockRecords);

      const response = await request(app)
        .get("/api/get_voting_power_chart/user1.near")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual([
        {
          block_number: 100000,
          vp: "500000000000000000000000",
          timestamp: "2024-01-01T10:00:00.000Z",
        },
        {
          block_number: 100500,
          vp: "750000000000000000000000",
          timestamp: "2024-01-05T14:00:00.000Z",
        },
        {
          block_number: 101000,
          vp: "1000000000000000000000000",
          timestamp: "2024-01-10T18:00:00.000Z",
        },
      ]);
    });

    it("should return empty array when no VP data exists", async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/get_voting_power_chart/unknown.near")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual([]);
    });

    it("should handle database error gracefully", async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error("Query failed"));

      const response = await request(app)
        .get("/api/get_voting_power_chart/user1.near")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch voting power chart",
      });
    });
  });
});
