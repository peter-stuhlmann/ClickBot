import { Button } from '@/components/atoms/Button';
import { PageHeader } from '@/components/organisms/PageHeader';

/** Inside the sidebar: an unknown test, run, campaign or template (deleted or mistyped link). */
export default function NotFound() {
  return (
    <>
      <PageHeader
        title="Nicht gefunden"
        description="Das, was du aufrufen wolltest, gibt es nicht mehr oder der Link stimmt nicht."
      />
      <div>
        <Button href="/" variant="secondary">
          Zur Übersicht
        </Button>
      </div>
    </>
  );
}
