import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sputnik = 'linear-gov.sputnik-dao.near';
  const charles = 'charles-hos.near';

  // Check delegation events for both
  const sputnikDelegations = await prisma.$queryRaw`
    SELECT id, block_height, delegator_id, delegatee_id, near_amount, delegate_event, is_latest_delegator_event 
    FROM fastnear.delegation_events 
    WHERE delegator_id = ${sputnik} OR delegatee_id = ${sputnik}
    ORDER BY block_height DESC;
  `;

  const charlesDelegations = await prisma.$queryRaw`
    SELECT id, block_height, delegator_id, delegatee_id, near_amount, delegate_event, is_latest_delegator_event 
    FROM fastnear.delegation_events 
    WHERE delegator_id = ${charles} OR delegatee_id = ${charles}
    ORDER BY block_height DESC;
  `;

  // Check registered voters view results
  const sputnikRv = await prisma.$queryRaw`
    SELECT registered_voter_id, is_actively_delegating, voting_power_from_delegations, voting_power_from_locks_unlocks, current_voting_power 
    FROM fastnear.registered_voters
    WHERE registered_voter_id = ${sputnik};
  `;

  const charlesRv = await prisma.$queryRaw`
    SELECT registered_voter_id, is_actively_delegating, voting_power_from_delegations, voting_power_from_locks_unlocks, current_voting_power 
    FROM fastnear.registered_voters
    WHERE registered_voter_id = ${charles};
  `;

  console.log("=== Sputnik Delegations ===");
  console.table(sputnikDelegations);
  
  console.log("\n=== Sputnik Registered Voters ===");
  console.table(sputnikRv);

  console.log("\n=== Charles Delegations ===");
  console.table(charlesDelegations);

  console.log("\n=== Charles Registered Voters ===");
  console.table(charlesRv);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
