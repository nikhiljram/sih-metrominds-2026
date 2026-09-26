"""Cloud Object Storage Service — Supports Cloudflare R2 / AWS S3 with local disk fallback"""

import os
from typing import Tuple

S3_BUCKET = os.getenv("S3_BUCKET", "")
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "")
S3_REGION = os.getenv("S3_REGION", "us-east-1")

class CloudStorageService:
    def __init__(self):
        self.use_s3 = bool(S3_BUCKET and S3_ACCESS_KEY and S3_SECRET_KEY)
        if self.use_s3:
            try:
                import boto3
                self.s3_client = boto3.client(
                    's3',
                    endpoint_url=S3_ENDPOINT_URL if S3_ENDPOINT_URL else None,
                    aws_access_key_id=S3_ACCESS_KEY,
                    aws_secret_access_key=S3_SECRET_KEY,
                    region_name=S3_REGION
                )
                print(f"✅ Cloud Storage connected to bucket: {S3_BUCKET}")
            except Exception as e:
                print(f"⚠️ S3 connection failed ({e}). Falling back to local disk storage.")
                self.use_s3 = False

    def upload_file(self, file_content: bytes, destination_path: str, content_type: str = "application/octet-stream") -> Tuple[str, str]:
        """Upload file to Cloud S3 bucket if configured, otherwise save to local storage."""
        if self.use_s3:
            try:
                self.s3_client.put_object(
                    Bucket=S3_BUCKET,
                    Key=destination_path,
                    Body=file_content,
                    ContentType=content_type
                )
                cloud_url = f"{S3_ENDPOINT_URL}/{S3_BUCKET}/{destination_path}" if S3_ENDPOINT_URL else f"https://{S3_BUCKET}.s3.amazonaws.com/{destination_path}"
                return destination_path, cloud_url
            except Exception as e:
                print(f"⚠️ Failed cloud upload ({e}). Falling back to local disk.")

        # Local disk fallback
        local_dir = os.path.dirname(destination_path)
        if local_dir:
            os.makedirs(local_dir, exist_ok=True)
        with open(destination_path, "wb") as f:
            f.write(file_content)
        return destination_path, destination_path

storage_service = CloudStorageService()
