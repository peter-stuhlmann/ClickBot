import { Card } from '@/components/atoms/Card';
import { SwitchRow } from '@/components/molecules/SwitchRow';

export type VideoFormProps = {
  recordVideo: boolean;
  onChange: (recordVideo: boolean) => void;
};

/** Whether the runs of a job are recorded as a video, to play in the report or download. */
export function VideoForm({ recordVideo, onChange }: VideoFormProps) {
  return (
    <Card
      title="Video"
      description="Testläufe werden immer aufgenommen. Zugangsdaten sind im Video abgedeckt."
    >
      <SwitchRow
        label="Jeden Durchlauf als Video aufnehmen"
        description="Im Report abspielen oder als MP4 herunterladen. Ein Video bleibt 30 Tage, es braucht etwa 1–5 MB pro Minute."
        checked={recordVideo}
        onToggle={() => onChange(!recordVideo)}
      />
    </Card>
  );
}
