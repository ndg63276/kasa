#!/bin/bash

aws s3 sync . s3://smartathome.co.uk/kasa/ --exclude ".git*" --exclude "scripts/*" --exclude "images/*"
aws cloudfront create-invalidation --distribution-id E1M3QR4XNVBQ5H --paths "/kasa/*"
