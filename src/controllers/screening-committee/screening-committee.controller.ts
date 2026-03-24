import { Request, Response } from "express";
import { prisma } from "../..";
import {
  GovernanceRole,
  ReviewAction,
  ScreeningStatus,
  DraftProposalStage,
  Prisma,
} from "../../generated/prisma";
import { verifySignedPayload } from "../../lib/signature/verifySignature";
import {
  formatTimeRemaining,
  progressFraction,
} from "../../lib/utils/governance";

interface ProposalQueryParams {
  status?: "current" | "incoming" | "past";
  page?: string;
  page_size?: string;
  search?: string;
  wallet?: string;
}

interface ReviewData {
  action: "APPROVE" | "REJECT" | "COMMENT";
  rationale?: string;
}

interface ReviewBody {
  accountId: string;
  signature: string;
  publicKey: string;
  message: string;
  data: ReviewData;
}

export class ScreeningCommitteeController {
  public getMembers = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const members = await prisma.governance_members.findMany({
        where: { role: GovernanceRole.SCREENING },
        orderBy: { appointedAt: "desc" },
      });

      res.status(200).json({
        members: members.map((m) => ({
          id: m.id,
          wallet: m.wallet,
          name: m.name,
          subtitle: m.subtitle,
          appointedAt: m.appointedAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching screening committee members:", error);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  };

  public getProposals = async (
    req: Request<{}, {}, {}, ProposalQueryParams>,
    res: Response,
  ): Promise<void> => {
    try {
      const { status = "current", page_size, page, search, wallet } = req.query;
      const pageSize = parseInt(page_size ?? "10") || 10;
      const pageNumber = parseInt(page ?? "1") || 1;

      const [pendingCount, approvedAllTimeCount, allGovernanceIds] =
        await Promise.all([
          prisma.proposal_governance_status.count({
            where: { screeningStatus: ScreeningStatus.PENDING },
          }),
          prisma.proposal_governance_status.count({
            where: { screeningStatus: ScreeningStatus.APPROVED },
          }),
          prisma.proposal_governance_status.findMany({
            select: { proposalId: true },
          }),
        ]);

      const governanceIdSet = new Set(
        allGovernanceIds.map((g) => g.proposalId),
      );

      const incomingCount = await prisma.draft_proposals.count({
        where: {
          stage: DraftProposalStage.SUBMITTED,
          id: { notIn: [...governanceIdSet] },
        },
      });

      const stats = { pendingCount, incomingCount, approvedAllTimeCount };

      switch (status) {
        case "current":
          await this.getCurrentProposals(
            res, pageSize, pageNumber, search, wallet, stats,
          );
          break;
        case "incoming":
          await this.getIncomingProposals(
            res, pageSize, pageNumber, search, governanceIdSet, stats,
          );
          break;
        case "past":
          await this.getPastProposals(
            res, pageSize, pageNumber, search, stats,
          );
          break;
        default:
          res.status(400).json({ error: "Invalid status. Use current, incoming, or past." });
      }
    } catch (error) {
      console.error("Error fetching screening proposals:", error);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  };

  public getProposalById = async (
    req: Request<{ proposalId: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { proposalId } = req.params;

      const [proposal, governanceStatus, reviews, members] = await Promise.all([
        prisma.proposals.findFirst({ where: { proposalId } }),
        prisma.proposal_governance_status.findUnique({
          where: { proposalId },
        }),
        prisma.governance_reviews.findMany({
          where: { proposalId },
          include: { member: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.governance_members.findMany({
          where: { role: GovernanceRole.SCREENING },
        }),
      ]);

      if (!proposal) {
        res.status(404).json({ error: "Proposal not found" });
        return;
      }

      res.status(200).json({
        proposal: {
          proposalId: proposal.proposalId?.toString(),
          title: proposal.proposalTitle,
          description: proposal.proposalDescription,
          url: proposal.proposalUrl,
          submittedBy: proposal.creatorId,
          createdAt: proposal.createdAt,
          isApproved: proposal.isApproved,
          isRejected: proposal.isRejected,
          hasVotes: proposal.hasVotes,
          forVotingPower: proposal.forVotingPower?.toFixed(),
          againstVotingPower: proposal.againstVotingPower?.toFixed(),
          abstainVotingPower: proposal.abstainVotingPower?.toFixed(),
          numDistinctVoters: proposal.numDistinctVoters?.toString(),
        },
        governanceStatus: governanceStatus
          ? {
              proposalId: governanceStatus.proposalId,
              screeningStatus: governanceStatus.screeningStatus,
              screeningDeadline: governanceStatus.screeningDeadline,
              councilStatus: governanceStatus.councilStatus,
              vetoDeadline: governanceStatus.vetoDeadline,
              ratifiedAt: governanceStatus.ratifiedAt,
              timeRemaining: formatTimeRemaining(
                governanceStatus.screeningDeadline,
              ),
              progressFraction: progressFraction(
                governanceStatus.createdAt,
                governanceStatus.screeningDeadline,
              ),
            }
          : null,
        reviews: reviews.map((r) => ({
          id: r.id,
          action: r.action,
          rationale: r.rationale,
          createdAt: r.createdAt,
          member: {
            id: r.member.id,
            wallet: r.member.wallet,
            name: r.member.name,
            subtitle: r.member.subtitle,
          },
        })),
        members: members.map((m) => ({
          id: m.id,
          wallet: m.wallet,
          name: m.name,
          subtitle: m.subtitle,
          appointedAt: m.appointedAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching screening proposal detail:", error);
      res.status(500).json({ error: "Failed to fetch proposal" });
    }
  };

  public submitReview = async (
    req: Request<{ proposalId: string }, {}, ReviewBody, { network_id?: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { proposalId } = req.params;
      const { accountId, signature, publicKey, message, data } = req.body;
      const { network_id } = req.query;

      if (!accountId || !signature || !publicKey || !message || !data?.action) {
        res.status(400).json({
          error:
            "accountId, signature, publicKey, message, and data.action are required",
        });
        return;
      }

      const { action, rationale } = data;

      if (!["APPROVE", "REJECT", "COMMENT"].includes(action)) {
        res.status(400).json({ error: "Invalid action. Use APPROVE, REJECT, or COMMENT." });
        return;
      }

      const governanceStatus =
        await prisma.proposal_governance_status.findUnique({
          where: { proposalId },
        });

      if (
        !governanceStatus ||
        governanceStatus.screeningStatus !== ScreeningStatus.PENDING
      ) {
        res
          .status(400)
          .json({ error: "Proposal is not pending screening review" });
        return;
      }

      const networkId = network_id || "mainnet";
      const isVerified = await verifySignedPayload({
        signedPayload: {
          signature,
          publicKey,
          message,
          data: { ...data, proposalId },
        },
        networkId,
        accountId,
      });

      if (!isVerified) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      const member = await prisma.governance_members.findFirst({
        where: { wallet: accountId, role: GovernanceRole.SCREENING },
      });

      if (!member) {
        res.status(403).json({ error: "Not a screening committee member" });
        return;
      }

      if (action === "APPROVE" || action === "REJECT") {
        const existingVote = await prisma.governance_reviews.findFirst({
          where: {
            proposalId,
            memberId: member.id,
            action: { in: [ReviewAction.APPROVE, ReviewAction.REJECT] },
          },
        });

        if (existingVote) {
          res.status(409).json({ error: "Already voted on this proposal" });
          return;
        }
      }

      const review = await prisma.governance_reviews.create({
        data: {
          proposalId,
          memberId: member.id,
          action: action as ReviewAction,
          rationale: rationale || null,
        },
      });

      res.status(201).json({ review });
    } catch (error: any) {
      if (error?.code === "P2002") {
        res.status(409).json({ error: "Already voted on this proposal" });
        return;
      }
      console.error("Error submitting screening review:", error);
      res.status(500).json({ error: "Failed to submit review" });
    }
  };

  // --- private tab handlers ---

  private getCurrentProposals = async (
    res: Response,
    pageSize: number,
    pageNumber: number,
    search: string | undefined,
    wallet: string | undefined,
    stats: Record<string, number>,
  ): Promise<void> => {
    const statuses = await prisma.proposal_governance_status.findMany({
      where: { screeningStatus: ScreeningStatus.PENDING },
      orderBy: { createdAt: "desc" },
    });

    if (statuses.length === 0) {
      res.status(200).json({
        proposals: [], stats, count: 0,
        page: pageNumber, pageSize, totalPages: 0,
      });
      return;
    }

    const proposalIds = statuses.map((s) => s.proposalId);

    let proposals = await prisma.proposals.findMany({
      where: { proposalId: { in: proposalIds } },
    });

    if (search) {
      const q = search.toLowerCase();
      proposals = proposals.filter(
        (p) =>
          p.proposalId?.toString().includes(q) ||
          p.proposalTitle?.toLowerCase().includes(q) ||
          p.creatorId?.toLowerCase().includes(q),
      );
    }

    const count = proposals.length;
    const statusMap = new Map(statuses.map((s) => [s.proposalId, s]));

    // Sort by screening_deadline ascending (most urgent first)
    proposals.sort((a, b) => {
      const da = statusMap.get(a.proposalId?.toString() || "")?.screeningDeadline;
      const db = statusMap.get(b.proposalId?.toString() || "")?.screeningDeadline;
      return (da?.getTime() ?? Infinity) - (db?.getTime() ?? Infinity);
    });

    const paginated = proposals.slice(
      (pageNumber - 1) * pageSize,
      pageNumber * pageSize,
    );
    const paginatedIds = paginated
      .map((p) => p.proposalId?.toString())
      .filter(Boolean) as string[];

    const [commentCounts, memberVotes] = await Promise.all([
      prisma.governance_reviews.groupBy({
        by: ["proposalId"],
        where: { proposalId: { in: paginatedIds }, action: ReviewAction.COMMENT },
        _count: { id: true },
      }),
      wallet
        ? prisma.governance_reviews.findMany({
            where: {
              proposalId: { in: paginatedIds },
              member: { wallet },
              action: { in: [ReviewAction.APPROVE, ReviewAction.REJECT] },
            },
          })
        : Promise.resolve([]),
    ]);

    const commentMap = new Map(
      commentCounts.map((c) => [c.proposalId, c._count.id]),
    );
    const voteMap = new Map(memberVotes.map((v) => [v.proposalId, v.action]));

    const result = paginated.map((p) => {
      const pid = p.proposalId?.toString() || "";
      const gs = statusMap.get(pid);
      return {
        proposalId: pid,
        title: p.proposalTitle,
        submittedBy: p.creatorId,
        timeRemaining: formatTimeRemaining(gs?.screeningDeadline ?? null),
        progressFraction: gs
          ? progressFraction(gs.createdAt, gs.screeningDeadline)
          : 0,
        commentsCount: commentMap.get(pid) ?? 0,
        myVote: voteMap.get(pid) ?? null,
      };
    });

    res.status(200).json({
      proposals: result, stats, count,
      page: pageNumber, pageSize,
      totalPages: Math.ceil(count / pageSize),
    });
  };

  private getIncomingProposals = async (
    res: Response,
    pageSize: number,
    pageNumber: number,
    search: string | undefined,
    governanceIdSet: Set<string>,
    stats: Record<string, number>,
  ): Promise<void> => {
    const where: Prisma.draft_proposalsWhereInput = {
      stage: DraftProposalStage.SUBMITTED,
      id: { notIn: [...governanceIdSet] },
    };

    if (search) {
      const q = search.toLowerCase();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { author: { contains: q, mode: "insensitive" } },
      ];
    }

    const [drafts, count] = await Promise.all([
      prisma.draft_proposals.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      }),
      prisma.draft_proposals.count({ where }),
    ]);

    res.status(200).json({
      proposals: drafts.map((d) => ({
        id: d.id,
        title: d.title,
        submittedBy: d.author,
        forumLink: d.proposalUrl,
        submittedAt: d.submittedAt,
      })),
      stats,
      count,
      page: pageNumber,
      pageSize,
      totalPages: Math.ceil(count / pageSize),
    });
  };

  private getPastProposals = async (
    res: Response,
    pageSize: number,
    pageNumber: number,
    search: string | undefined,
    stats: Record<string, number>,
  ): Promise<void> => {
    const statuses = await prisma.proposal_governance_status.findMany({
      where: {
        screeningStatus: {
          in: [ScreeningStatus.APPROVED, ScreeningStatus.REJECTED],
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (statuses.length === 0) {
      res.status(200).json({
        proposals: [], stats, count: 0,
        page: pageNumber, pageSize, totalPages: 0,
      });
      return;
    }

    const proposalIds = statuses.map((s) => s.proposalId);

    let proposals = await prisma.proposals.findMany({
      where: { proposalId: { in: proposalIds } },
    });

    if (search) {
      const q = search.toLowerCase();
      proposals = proposals.filter(
        (p) =>
          p.proposalId?.toString().includes(q) ||
          p.proposalTitle?.toLowerCase().includes(q) ||
          p.creatorId?.toLowerCase().includes(q),
      );
    }

    const statusMap = new Map(statuses.map((s) => [s.proposalId, s]));
    proposals.sort((a, b) => {
      const sa = statusMap.get(a.proposalId?.toString() || "");
      const sb = statusMap.get(b.proposalId?.toString() || "");
      return (sb?.updatedAt.getTime() ?? 0) - (sa?.updatedAt.getTime() ?? 0);
    });

    const count = proposals.length;
    const paginated = proposals.slice(
      (pageNumber - 1) * pageSize,
      pageNumber * pageSize,
    );
    const paginatedIds = paginated
      .map((p) => p.proposalId?.toString())
      .filter(Boolean) as string[];

    const commentCounts = await prisma.governance_reviews.groupBy({
      by: ["proposalId"],
      where: { proposalId: { in: paginatedIds }, action: ReviewAction.COMMENT },
      _count: { id: true },
    });

    const commentMap = new Map(
      commentCounts.map((c) => [c.proposalId, c._count.id]),
    );

    const result = paginated.map((p) => {
      const pid = p.proposalId?.toString() || "";
      const gs = statusMap.get(pid);
      return {
        proposalId: pid,
        title: p.proposalTitle,
        submittedBy: p.creatorId,
        decidedAt: gs?.updatedAt ?? null,
        status: gs?.screeningStatus ?? null,
        commentsCount: commentMap.get(pid) ?? 0,
      };
    });

    res.status(200).json({
      proposals: result, stats, count,
      page: pageNumber, pageSize,
      totalPages: Math.ceil(count / pageSize),
    });
  };
}
