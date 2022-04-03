#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {CdkFargateTestStack} from '../lib/cdk-fargate-test-stack';

const app = new cdk.App();
new CdkFargateTestStack(app, 'CdkFargateTestStack', {
	env: {
		account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
		region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION
	}
});
