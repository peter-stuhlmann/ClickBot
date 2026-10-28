export type TotpQrProps = {
  /** QR code of the otpauth address as an image data URL. */
  qrDataUrl: string;
  /** The same secret as text, for apps without camera. */
  secret: string;
};

/** First step of the 2FA setup: scan the QR code or type in the key. */
export function TotpQr({ qrDataUrl, secret }: TotpQrProps) {
  const grouped = secret.match(/.{1,4}/g)?.join(' ') ?? secret;
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-subtle p-4">
      {/* A data URL made on the server; next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="QR-Code für die Authenticator-App" width={176} height={176} />
      <p className="text-center text-small text-text-muted">
        Kein Scan möglich? Diesen Schlüssel in der App eingeben:
      </p>
      <code className="font-mono text-meta tracking-wide text-text select-all">{grouped}</code>
    </div>
  );
}
