import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { MONTHS_SHORT_ID } from "@/lib/format";
import EmailScreen, { type MailRow } from "./EmailScreen";

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/** "Hari ini" / "Kemarin" / "Minggu lalu" / "Lebih lama", like the prototype's list headers. */
function dayGroupOf(received: Date, today: number) {
  const day = startOfDay(received);
  const diff = Math.round((today - day) / 86_400_000);
  if (diff <= 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  if (diff <= 7) return "Minggu lalu";
  return "Lebih lama";
}

export default async function EmailPage() {
  const context = await requireActiveContext();

  const messages = await db.mailMessage.findMany({
    orderBy: { receivedAt: "desc" },
    take: 300,
  });

  const today = startOfDay(new Date());

  const rows: MailRow[] = messages.map((message) => {
    const received = message.receivedAt;
    const isToday = startOfDay(received) === today;
    const hh = String(received.getHours()).padStart(2, "0");
    const mm = String(received.getMinutes()).padStart(2, "0");
    const shortDate = `${received.getDate()} ${MONTHS_SHORT_ID[received.getMonth()]}`;

    return {
      id: message.id,
      folder: message.folder,
      fromName: message.fromName,
      fromEmail: message.fromEmail,
      toEmail: message.toEmail,
      subject: message.subject,
      body: message.body,
      isRead: message.isRead,
      isStarred: message.isStarred,
      dayGroup: dayGroupOf(received, today),
      timeLabel: isToday ? `${hh}:${mm}` : shortDate,
      fullLabel: `${received.getDate()} ${MONTHS_SHORT_ID[received.getMonth()]} ${received.getFullYear()} · ${hh}:${mm}`,
    };
  });

  return (
    <EmailScreen
      messages={rows}
      accountName={context.user.name}
      accountEmail={context.user.email}
      companyName={context.company.name}
    />
  );
}
