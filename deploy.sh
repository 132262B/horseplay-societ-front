#!/bin/bash

set -e

# 설정
S3_BUCKET="horseplay-society"
AWS_REGION="ap-northeast-2"
BUILD_DIR="dist"

echo "🏗️  빌드 시작..."
npm run build

echo "🪣 S3 버킷 확인 중..."
if ! aws s3api head-bucket --bucket $S3_BUCKET --region $AWS_REGION 2>/dev/null; then
    echo "🪣 버킷이 없습니다. 생성 중..."
    aws s3 mb s3://$S3_BUCKET --region $AWS_REGION

    echo "🔧 정적 웹사이트 호스팅 설정 중..."
    aws s3 website s3://$S3_BUCKET --index-document index.html --error-document index.html

    echo "🔓 퍼블릭 액세스 설정 중..."
    aws s3api put-public-access-block --bucket $S3_BUCKET --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

    echo "📜 버킷 정책 설정 중..."
    aws s3api put-bucket-policy --bucket $S3_BUCKET --policy '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicReadGetObject",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": "arn:aws:s3:::'"$S3_BUCKET"'/*"
            }
        ]
    }'

    echo "✅ 버킷 생성 완료!"
fi

echo "📦 S3에 파일 업로드 중..."
aws s3 sync $BUILD_DIR s3://$S3_BUCKET --delete --region $AWS_REGION

echo "🔍 CloudFront Distribution ID 조회 중..."
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com']].Id" --output text)

if [ -z "$DISTRIBUTION_ID" ]; then
    # S3 웹사이트 엔드포인트로도 시도
    DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='${S3_BUCKET}.s3.amazonaws.com']].Id" --output text)
fi

if [ -z "$DISTRIBUTION_ID" ]; then
    echo "☁️  CloudFront Distribution이 없습니다. 생성 중..."

    CALLER_REF="deploy-$(date +%s)"

    DISTRIBUTION_CONFIG='{
        "CallerReference": "'"$CALLER_REF"'",
        "Comment": "Horse Game Distribution",
        "Enabled": true,
        "DefaultRootObject": "index.html",
        "Origins": {
            "Quantity": 1,
            "Items": [
                {
                    "Id": "S3-'"$S3_BUCKET"'",
                    "DomainName": "'"$S3_BUCKET"'.s3.'"$AWS_REGION"'.amazonaws.com",
                    "S3OriginConfig": {
                        "OriginAccessIdentity": ""
                    }
                }
            ]
        },
        "DefaultCacheBehavior": {
            "TargetOriginId": "S3-'"$S3_BUCKET"'",
            "ViewerProtocolPolicy": "redirect-to-https",
            "AllowedMethods": {
                "Quantity": 2,
                "Items": ["GET", "HEAD"],
                "CachedMethods": {
                    "Quantity": 2,
                    "Items": ["GET", "HEAD"]
                }
            },
            "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
            "Compress": true
        },
        "CustomErrorResponses": {
            "Quantity": 1,
            "Items": [
                {
                    "ErrorCode": 404,
                    "ResponsePagePath": "/index.html",
                    "ResponseCode": "200",
                    "ErrorCachingMinTTL": 300
                }
            ]
        },
        "PriceClass": "PriceClass_200"
    }'

    RESULT=$(aws cloudfront create-distribution --distribution-config "$DISTRIBUTION_CONFIG" --output json)
    DISTRIBUTION_ID=$(echo $RESULT | grep -o '"Id": "[^"]*"' | head -1 | cut -d'"' -f4)
    DOMAIN_NAME=$(echo $RESULT | grep -o '"DomainName": "[^"]*"' | head -1 | cut -d'"' -f4)

    echo "✅ CloudFront Distribution 생성 완료!"
    echo "   Distribution ID: $DISTRIBUTION_ID"
    echo "   URL: https://$DOMAIN_NAME"
    echo ""
    echo "⏳ CloudFront 배포가 활성화되는데 5-10분 정도 소요됩니다."
    exit 0
fi

echo "🚀 CloudFront 캐시 무효화 중... (Distribution ID: $DISTRIBUTION_ID)"
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

echo "✅ 배포 완료!"
