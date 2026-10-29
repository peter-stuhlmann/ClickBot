import { Card } from '@/components/atoms/Card';
import { Checkbox } from '@/components/atoms/Checkbox';

export type ApprovalCardProps = {
  confirmed: boolean;
  error?: string;
  onChange: (confirmed: boolean) => void;
};

/**
 * Product rule: whoever creates a job confirms that the website may be tested. Last step of the
 * wizard, right before "Job anlegen"; the server checks it again.
 */
export function ApprovalCard({ confirmed, error, onChange }: ApprovalCardProps) {
  return (
    <Card title="Freigabe">
      <div className="flex flex-col gap-1.5">
        <Checkbox
          label="Die Website gehört uns oder dem Kunden, und der Kunde hat den Test freigegeben."
          checked={confirmed}
          onChange={(event) => onChange(event.target.checked)}
          {...(error ? { 'aria-invalid': true, 'aria-describedby': 'job-confirmed-error' } : {})}
        />
        {error && (
          <p id="job-confirmed-error" className="text-small text-danger">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
