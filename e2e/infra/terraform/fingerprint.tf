module "fingerprint_cloudfront_integration" {
  source = "fingerprintjs/fingerprint-cloudfront-proxy-integration/aws"

  fpjs_agent_download_path = var.fpjs_agent_download_path
  fpjs_get_result_path     = var.fpjs_get_result_path
  fpjs_shared_secret       = var.fpjs_shared_secret
  fetch_lambda_from_s3     = false
  local_lambda_path        = "../../../lambda_latest.zip"
}

// TODO After release, replace with source from above
module "fingerprint_cloudfront_integration_v4_only" {
  source = "git::https://github.com/fingerprintjs/terraform-aws-fingerprint-cloudfront-proxy-integration.git?ref=feature/add-v4-support"

  fpjs_shared_secret       = var.fpjs_shared_secret
  fetch_lambda_from_s3     = false
  local_lambda_path        = "../../../lambda_latest.zip"
}