import type { DealSummaryContent } from "@/lib/crm/ai/types";

interface Props {
  content: DealSummaryContent;
}

export function DealSummaryView({ content }: Props) {
  return (
    <div className="space-y-4 text-sm">
      <p className="rounded-md bg-gray-50 px-3 py-2 font-medium">{content.factStrip}</p>

      <Section emoji="📋" title="Klíčové info o klientovi">
        <BulletList items={content.clientInfo} />
      </Section>

      <Section emoji="🎯" title="Témata jednání">
        <BulletList items={content.topics} />
      </Section>

      <Section emoji="📅" title="Historický pokrok">
        {content.history.length === 0 ? (
          <EmptyHint />
        ) : (
          <ul className="space-y-1">
            {content.history.map((h, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 font-medium tabular-nums text-gray-500">{h.date}</span>
                <span>{h.description}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section emoji="⏰" title="Naplánované aktivity">
        {content.upcoming.length === 0 ? (
          <EmptyHint />
        ) : (
          <ul className="space-y-1">
            {content.upcoming.map((u, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 font-medium tabular-nums text-gray-500">{u.date}</span>
                <span>{u.description}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section emoji="💡" title="Závěr">
        <p className="leading-relaxed">{content.conclusion}</p>
      </Section>

      <Section emoji="🤖" title="AI návrh dalších akcí">
        <BulletList items={content.nextActions} />
        <p className="mt-2 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-xs text-yellow-900">
          ⚠️ Nejde o akci — jen text k inspiraci. Akce zadej ručně přes Aktivitu nebo Edit dealu.
        </p>
      </Section>
    </div>
  );
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1 font-semibold">
        <span className="mr-1.5">{emoji}</span>
        {title}
      </h4>
      <div className="pl-5">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <EmptyHint />;
  return (
    <ul className="list-disc space-y-0.5 pl-4">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function EmptyHint() {
  return <p className="italic text-gray-500">Nedostatek dat.</p>;
}
