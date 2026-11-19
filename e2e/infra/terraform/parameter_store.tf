# POC: integration settings in SSM Parameter Store instead of Secrets Manager.
# The published Terraform module still creates a Secrets Manager secret; the e2e distributions ignore it
# and point the proxy at these parameters through the FPJS_PARAMETER_PATH origin header instead.

locals {
  fpjs_lambda_name         = element(split(":", module.fingerprint_cloudfront_integration.fpjs_proxy_lambda_arn), 6)
  fpjs_lambda_name_v4_only = element(split(":", module.fingerprint_cloudfront_integration_v4_only.fpjs_proxy_lambda_arn), 6)

  fpjs_parameter_path         = "/fingerprint-pro-cloudfront-integration/${local.fpjs_lambda_name}"
  fpjs_parameter_path_v4_only = "/fingerprint-pro-cloudfront-integration/${local.fpjs_lambda_name_v4_only}"
}

resource "aws_ssm_parameter" "fpjs_get_result_path" {
  name  = "${local.fpjs_parameter_path}/fpjs_get_result_path"
  type  = "String"
  value = var.fpjs_get_result_path
}

resource "aws_ssm_parameter" "fpjs_agent_download_path" {
  name  = "${local.fpjs_parameter_path}/fpjs_agent_download_path"
  type  = "String"
  value = var.fpjs_agent_download_path
}

resource "aws_ssm_parameter" "fpjs_pre_shared_secret" {
  name  = "${local.fpjs_parameter_path}/fpjs_pre_shared_secret"
  type  = "SecureString"
  value = var.fpjs_shared_secret
}

resource "aws_ssm_parameter" "fpjs_pre_shared_secret_v4_only" {
  name  = "${local.fpjs_parameter_path_v4_only}/fpjs_pre_shared_secret"
  type  = "SecureString"
  value = var.fpjs_shared_secret
}

data "aws_lambda_function" "fpjs_proxy" {
  function_name = local.fpjs_lambda_name
}

data "aws_lambda_function" "fpjs_proxy_v4_only" {
  function_name = local.fpjs_lambda_name_v4_only
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role_policy" "fpjs_proxy_parameter_store" {
  name = "ParameterStoreAccess"
  role = element(split("/", data.aws_lambda_function.fpjs_proxy.role), 1)
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParametersByPath"]
      Resource = "arn:aws:ssm:us-east-1:${data.aws_caller_identity.current.account_id}:parameter${local.fpjs_parameter_path}"
    }]
  })
}

resource "aws_iam_role_policy" "fpjs_proxy_parameter_store_v4_only" {
  name = "ParameterStoreAccess"
  role = element(split("/", data.aws_lambda_function.fpjs_proxy_v4_only.role), 1)
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParametersByPath"]
      Resource = "arn:aws:ssm:us-east-1:${data.aws_caller_identity.current.account_id}:parameter${local.fpjs_parameter_path_v4_only}"
    }]
  })
}
