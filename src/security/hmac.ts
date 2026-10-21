export interface WebhookSignatureConfig {
  secret: string;
  headerName: string;
  maxSkewSec: number;
}