resource "null_resource" "invalidate_with_secret_cache_v4_only" {
  triggers = {
    run_id = timestamp()
  }

  provisioner "local-exec" {
    command = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.with_secret_v4_only.id} --paths '/*'"
  }
}

resource "null_resource" "invalidate_with_secret_cache" {
  triggers = {
    run_id = timestamp()
  }

  provisioner "local-exec" {
    command = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.with_secret.id} --paths '/*'"
  }
}

resource "null_resource" "invalidate_with_headers_cache" {
  triggers = {
    run_id = timestamp()
  }

  provisioner "local-exec" {
    command = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.with_headers.id} --paths '/*'"
  }
}