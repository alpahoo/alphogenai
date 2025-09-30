import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ENV_SERVER } from './Env';

export class R2Client {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor() {
    if (!ENV_SERVER.CLOUDFLARE_ACCOUNT_ID || !ENV_SERVER.CLOUDFLARE_R2_ACCESS_KEY_ID || 
        !ENV_SERVER.CLOUDFLARE_R2_SECRET_ACCESS_KEY || !ENV_SERVER.CLOUDFLARE_R2_BUCKET) {
      throw new Error('Missing Cloudflare R2 configuration');
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${ENV_SERVER.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ENV_SERVER.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: ENV_SERVER.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });
    
    this.bucket = ENV_SERVER.CLOUDFLARE_R2_BUCKET;
    this.publicBaseUrl = ENV_SERVER.CLOUDFLARE_R2_PUBLIC_BASE_URL || '';
  }

  async uploadFile(key: string, body: Buffer | Uint8Array, contentType?: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.client.send(command);
    return this.publicBaseUrl ? `${this.publicBaseUrl}/${key}` : key;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
