import { Card } from '@/components/atoms/Card';

export type InfoCardProps = {
  title: string;
  items: readonly { title: string; text: string }[];
};

/** Short facts next to a settings page, e.g. how keys are protected (Figma 08a "Sicherheit"). */
export function InfoCard({ title, items }: InfoCardProps) {
  return (
    <Card title={title}>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.title} className="flex flex-col gap-1 rounded-input bg-bg p-3">
            <span className="text-body font-medium text-text">{item.title}</span>
            <span className="text-small text-text-muted">{item.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
