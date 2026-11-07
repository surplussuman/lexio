from django.conf import settings

from .base import Storage, UploadResult


class S3Storage(Storage):
    """Production storage — AWS S3 + CloudFront (LLD stack table). Requires
    AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_STORAGE_BUCKET_NAME in
    .env. Not exercised in dev (STORAGE_BACKEND=local there)."""

    def __init__(self):
        import boto3  # imported lazily so dev never needs boto3 configured

        self._client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME,
        )
        self._bucket = settings.AWS_STORAGE_BUCKET_NAME

    def save(self, key: str, content: bytes, content_type: str = "application/octet-stream") -> UploadResult:
        self._client.put_object(Bucket=self._bucket, Key=key, Body=content, ContentType=content_type)
        return UploadResult(url=self.url_for(key), key=key)

    def presigned_upload_url(self, key: str, content_type: str, expires_in: int = 300) -> dict:
        post = self._client.generate_presigned_post(
            Bucket=self._bucket,
            Key=key,
            Fields={"Content-Type": content_type},
            Conditions=[{"Content-Type": content_type}],
            ExpiresIn=expires_in,
        )
        return {"url": post["url"], "fields": post["fields"], "direct": False}

    def read(self, key: str) -> bytes:
        return self._client.get_object(Bucket=self._bucket, Key=key)["Body"].read()

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=key)

    def url_for(self, key: str) -> str:
        if settings.CLOUDFRONT_DOMAIN:
            return f"https://{settings.CLOUDFRONT_DOMAIN}/{key}"
        return f"https://{self._bucket}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{key}"
