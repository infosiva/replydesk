import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
} as any);

async function main() {
  const b = await db.business.create({
    data: {
      name: "ReplyDesk Demo Clinic",
      twilioNumber: "+10000000000",
      emailInbox: "inbox@replydesk.app",
      officeStatus: "CLOSED",
      systemPrompt:
        "We are a dental clinic offering cleanings, fillings, and extractions. Hours: Mon-Fri 9am-5pm. Call us to book: 555-1234.",
    },
  });
  console.log("BUSINESS_ID=" + b.id);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
