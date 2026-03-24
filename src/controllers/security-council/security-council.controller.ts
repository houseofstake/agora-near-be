import { Request, Response } from "express";
import { prisma } from "../..";
import {
  GovernanceRole,
  ReviewAction,
  CouncilStatus,
} from "../../generated/prisma";
import { verifySignedPayload } from "../../lib/signature/verifySignature";
import {
  formatTimeRemaining,
  progressFraction,
  formatVotesSummary,
} from "../../lib/utils/governance";

interface ProposalQueryParams {
  status?: "active" | "passed" | "vetoed";
  page?: string;
  page_size?: string;
  search?: string;
  wallet?: string;
}

interface VetoBody {
  accountId: string;
  signature: string;
  publicKey: string;
  message: string;
  data: { rationale: string };
}

export class SecurityCouncilController {
  public getMembers = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const members = await prisma.governance_members.findMany({
        where: { role: GovernanceRole.COUNCIL },
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
      console.error("Error fetching security council members:", error);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  };

  public getProposals = async (
    req: Request<{}, {}, {}, ProposalQueryParams>,
    res: Response,
  ): Promise<void> => {
    try {
      const { status = "active", page_size, page, search, wallet } = req.query;
      const pageSize = parseInt(page_size ?? "10") || 10;
      const pageNumber = parseInt(page ?? "1") || 1;

      const [activeCount, ratifiedAllTimeCount, vetoedCount] =
        await Promise.all([
          prisma.proposal_governance_status.count({
            where: { councilStatus: CouncilStatus.ACTIVE },
          }),
          prisma.proposal_governance_status.count({
            where: { councilStatus: CouncilStatus.RATIFIED },
          }),
          prisma.proposal_governance_status.count({
            where: { councilStatus: CouncilStatus.VETOED },
          }),
        ]);

      const stats = { activeCount, ratifiedAllTimeCount, vetoedCount };

      switch (status) {
        case "active":
          await this.getActiveProposals(
            res, pageSize, pageNumber, search, wallet, stats,
          );
          break;
        case "passed":
          await this.getPassedProposals(
            res, pageSize, pageNumber, search, stats,
          );
          break;
        case "vetoed":
          await this.getVetoedProposals(
            res, pageSize, pageNumber, search, stats,
          );
          break;
        default:
          res.status(400).json({ error: "Invalid status. Use active, passed, or vetoed." });
      }
    } catch (error) {
      console.error("Error fetching security council proposals:", error);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  };

  public getProposalById = async (
    req: Request<{ proposalId: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { proposalId } = req.params;

      const [proposal, governanceStatus, reviews] = await Promise.all([
        prisma.proposals.findFirst({ where: { proposalId } }),
        prisma.proposal_governance_status.findUnique({
          where: { proposalId },
        }),
        prisma.governance_reviews.findMany({
          where: { proposalId },
          include: { member: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      if (!proposal) {
        res.status(404).json({ error: "Proposal not found" });
        return;
      }

      const vetoReview = reviews.find((r) => r.action === ReviewAction.VETO);

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
          votesSummary: formatVotesSummary(
            proposal.forVotingPower,
            proposal.againstVotingPower,
          ),
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
                governanceStatus.vetoDeadline,
              ),
              progressFraction: progressFraction(
                governanceStatus.createdAt,
                governanceStatus.vetoDeadline,
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
        vetoRationale: vetoReview
          ? {
              rationale: vetoReview.rationale,
              createdAt: vetoReview.createdAt,
              member: {
                id: vetoReview.member.id,
                wallet: vetoReview.member.wallet,
                name: vetoReview.member.name,
                subtitle: vetoReview.member.subtitle,
              },
            }
          : null,
      });
    } catch (error) {
      console.error("Error fetching security council proposal detail:", error);
      res.status(500).json({ error: "Failed to fetch proposal" });
    }
  };

  public submitVeto = async (
    req: Request<{ proposalId: string }, {}, VetoBody, { network_id?: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { proposalId } = req.params;
      const { accountId, signature, publicKey, message, data } = req.body;
      const { network_id } = req.query;

      if (!accountId || !signature || !publicKey || !message) {
        res.status(400).json({
          error: "accountId, signature, publicKey, and message are required",
        });
        return;
      }

      if (!data?.rationale) {
        res.status(400).json({ error: "Rationale is required for a veto" });
        return;
      }

      const governanceStatus =
        await prisma.proposal_governance_status.findUnique({
          where: { proposalId },
        });

      if (
        !governanceStatus ||
        governanceStatus.councilStatus !== CouncilStatus.ACTIVE
      ) {
        res
          .status(400)
          .json({ error: "Proposal is not in active veto window" });
        return;
      }

      if (
        governanceStatus.vetoDeadline &&
        governanceStatus.vetoDeadline.getTime() < Date.now()
      ) {
        res.status(400).json({ error: "Veto deadline has passed" });
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
        where: { wallet: accountId, role: GovernanceRole.COUNCIL },
      });

      if (!member) {
        res.status(403).json({ error: "Not a security council member" });
        return;
      }

      const [review, updatedStatus] = await prisma.$transaction([
        prisma.governance_reviews.create({
          data: {
            proposalId,
            memberId: member.id,
            action: ReviewAction.VETO,
            rationale: data.rationale,
          },
        }),
        prisma.proposal_governance_status.update({
          where: { proposalId },
          data: { councilStatus: CouncilStatus.VETOED },
        }),
      ]);

      res.status(201).json({
        review,
        governanceStatus: updatedStatus,
      });
    } catch (error) {
      console.error("Error submitting veto:", error);
      res.status(500).json({ error: "Failed to submit veto" });
    }
  };

  // --- private tab handlers ---

  private getActiveProposals = async (
    res: Response,
    pageSize: number,
    pageNumber: number,
    search: string | undefined,
    wallet: string | undefined,
    stats: Record<string, number>,
  ): Promise<void> => {
    const statuses = await prisma.proposal_governance_status.findMany({
      where: { councilStatus: CouncilStatus.ACTIVE },
      orderBy: { vetoDeadline: "asc" },
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

    proposals.sort((a, b) => {
      const da = statusMap.get(a.proposalId?.toString() || "")?.vetoDeadline;
      const db = statusMap.get(b.proposalId?.toString() || "")?.vetoDeadline;
      return (da?.getTime() ?? Infinity) - (db?.getTime() ?? Infinity);
    });

    const paginated = proposals.slice(
      (pageNumber - 1) * pageSize,
      pageNumber * pageSize,
    );

    // If wallet provided, look up action status per proposal for that member
    let memberActionMap = new Map<string, string>();
    if (wallet) {
      const member = await prisma.governance_members.findFirst({
        where: { wallet, role: GovernanceRole.COUNCIL },
      });
      if (member) {
        const paginatedIds = paginated
          .map((p) => p.proposalId?.toString())
          .filter(Boolean) as string[];
        const memberReviews = await prisma.governance_reviews.findMany({
          where: { proposalId: { in: paginatedIds }, memberId: member.id },
        });
        memberActionMap = new Map(
          memberReviews.map((r) => [r.proposalId, r.action]),
        );
      }
    }

    const result = paginated.map((p) => {
      const pid = p.proposalId?.toString() || "";
      const gs = statusMap.get(pid);
      return {
        proposalId: pid,
        title: p.proposalTitle,
        submittedBy: p.creatorId,
        votesSummary: formatVotesSummary(
          p.forVotingPower,
          p.againstVotingPower,
        ),
        timeRemaining: formatTimeRemaining(gs?.vetoDeadline ?? null),
        progressFraction: gs
          ? progressFraction(gs.createdAt, gs.vetoDeadline)
          : 0,
        closesAt: gs?.vetoDeadline ?? null,
        actionStatus: memberActionMap.get(pid) ?? "No Veto Issued",
      };
    });

    res.status(200).json({
      proposals: result, stats, count,
      page: pageNumber, pageSize,
      totalPages: Math.ceil(count / pageSize),
    });
  };

  private getPassedProposals = async (
    res: Response,
    pageSize: number,
    pageNumber: number,
    search: string | undefined,
    stats: Record<string, number>,
  ): Promise<void> => {
    const statuses = await prisma.proposal_governance_status.findMany({
      where: { councilStatus: CouncilStatus.RATIFIED },
      orderBy: { ratifiedAt: "desc" },
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
      return (
        (sb?.ratifiedAt?.getTime() ?? 0) - (sa?.ratifiedAt?.getTime() ?? 0)
      );
    });

    const count = proposals.length;
    const paginated = proposals.slice(
      (pageNumber - 1) * pageSize,
      pageNumber * pageSize,
    );

    const result = paginated.map((p) => {
      const pid = p.proposalId?.toString() || "";
      const gs = statusMap.get(pid);
      return {
        proposalId: pid,
        title: p.proposalTitle,
        submittedBy: p.creatorId,
        votesSummary: formatVotesSummary(
          p.forVotingPower,
          p.againstVotingPower,
        ),
        ratifiedOn: gs?.ratifiedAt ?? null,
      };
    });

    res.status(200).json({
      proposals: result, stats, count,
      page: pageNumber, pageSize,
      totalPages: Math.ceil(count / pageSize),
    });
  };

  private getVetoedProposals = async (
    res: Response,
    pageSize: number,
    pageNumber: number,
    search: string | undefined,
    stats: Record<string, number>,
  ): Promise<void> => {
    const statuses = await prisma.proposal_governance_status.findMany({
      where: { councilStatus: CouncilStatus.VETOED },
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

    // Fetch veto reviews for rationale + author
    const vetoReviews = await prisma.governance_reviews.findMany({
      where: {
        proposalId: { in: paginatedIds },
        action: ReviewAction.VETO,
      },
      include: { member: true },
    });

    const vetoMap = new Map(vetoReviews.map((v) => [v.proposalId, v]));

    const result = paginated.map((p) => {
      const pid = p.proposalId?.toString() || "";
      const gs = statusMap.get(pid);
      const veto = vetoMap.get(pid);
      return {
        proposalId: pid,
        title: p.proposalTitle,
        submittedBy: p.creatorId,
        votesSummary: formatVotesSummary(
          p.forVotingPower,
          p.againstVotingPower,
        ),
        vetoedOn: veto?.createdAt ?? gs?.updatedAt ?? null,
        rationaleAuthor: veto
          ? { name: veto.member.name, wallet: veto.member.wallet }
          : null,
      };
    });

    res.status(200).json({
      proposals: result, stats, count,
      page: pageNumber, pageSize,
      totalPages: Math.ceil(count / pageSize),
    });
  };
}
